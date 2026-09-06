// LLM statement-parsing adapter (FSD 3.2), via Vercel AI Gateway.
// - Activates when Gateway auth is available: an explicit AI_GATEWAY_API_KEY for
//   local/self-hosted runs, or automatically via Vercel's injected VERCEL_OIDC_TOKEN
//   when deployed on Vercel — no key management needed there.
// - Redacts account/card numbers, PAN, GSTIN before sending (privacy posture).
// - Output is grounded (see validateGrounded) to reject hallucinated transactions
//   before it ever reaches the caller, since this data can be auto-posted as money
//   movements. LLM output is still passed through tie-out + validators downstream.
import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

// Prefer calling OpenAI directly with OPENAI_API_KEY when set (uses the user's own
// OpenAI billing/credits) — falls back to Vercel AI Gateway ("provider/model" string,
// resolved via AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN) otherwise.
const OPENAI_MODEL = process.env.LLM_OPENAI_MODEL || "gpt-4o-mini";
export function resolveLlmModel() {
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai(OPENAI_MODEL);
  }
  return process.env.LLM_MODEL || "openai/gpt-4o-mini";
}

export interface LlmMappedRow {
  date: string;
  narration: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  merchantName?: string | null;
  category?: string | null;
  confidence: number;
}

// merchantName/category are nullable rather than .optional(): OpenAI's strict
// structured-output mode requires every property to appear in the schema's
// "required" array, so true optionality has to be modeled as "present but null".
// sourceLine ties each extracted row back to a specific input line — required so we
// can verify the row is actually grounded in real input, not invented.
const rowSchema = z.object({
  sourceLine: z.number().int().min(1),
  date: z.string().min(1),
  narration: z.string().min(1),
  amount: z.number().positive(),
  direction: z.enum(["DEBIT", "CREDIT"]),
  merchantName: z.string().nullable(),
  category: z.enum(["food", "grocery", "transport", "shopping", "bills", "health", "entertainment", "misc"]).nullable(),
  confidence: z.number(),
});
const outputSchema = z.object({ rows: z.array(rowSchema) });
export type RawLlmRow = z.infer<typeof rowSchema>;

export function isLlmEnabled(): boolean {
  // Direct OpenAI key takes priority (see resolveLlmModel). Otherwise, AI SDK reads
  // AI_GATEWAY_API_KEY itself when the model is a plain "provider/model" string;
  // VERCEL_OIDC_TOKEN is injected automatically on Vercel deployments and needs no
  // key on our end, so either is sufficient to attempt a call.
  return !!(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

/**
 * Mask identifiers that the model does not need to map fields. Tolerates a single
 * space or dash between digit/character groups — real statement text and OCR
 * output routinely break numbers up this way ("4111 1111 1111 1111", "ABCDE 1234
 * F"), and the original contiguous-only patterns let those straight through.
 */
export function redact(text: string): string {
  let out = text;
  // Card-like: 4 groups of 4 digits, optionally separated by a space/dash.
  out = out.replace(/\b(\d{4})[\s-]?\d{4}[\s-]?\d{4}[\s-]?(\d{4})\b/g, "$1****$2");
  // GSTIN (2 digits, 5 letters, 4 digits, 1 letter, 1 digit, 'Z', 1 alnum).
  out = out.replace(/\b\d{2}[\s-]?[A-Z]{5}[\s-]?\d{4}[\s-]?[A-Z][\s-]?\dZ[A-Z0-9]\b/g, "GSTIN****");
  // PAN (5 letters, 4 digits, 1 letter).
  out = out.replace(/\b[A-Z]{5}[\s-]?\d{4}[\s-]?[A-Z]\b/g, "PAN****");
  // Any remaining long digit run (account numbers), 9-18 digits total, allowing
  // single space/dash separators between digits.
  out = out.replace(/\b(?:\d[\s-]?){8,17}\d\b/g, (m) => {
    const digits = m.replace(/[\s-]/g, "");
    return digits.length >= 9 && digits.length <= 18 ? "****" + digits.slice(-4) : m;
  });
  return out;
}

/** Does this line contain a number matching the claimed amount, in some plausible formatting? */
function amountGroundedIn(amount: number, line: string): boolean {
  const candidates = line.match(/\d[\d,]*\.?\d*/g) || [];
  const target2dp = amount.toFixed(2);
  const targetInt = String(Math.round(amount));
  return candidates.some((raw) => {
    const norm = raw.replace(/,/g, "");
    if (!norm || isNaN(Number(norm))) return false;
    return norm === target2dp || norm === targetInt || Number(norm).toFixed(2) === target2dp;
  });
}

/** Loosely: does this look like it contains an actual date (not just any digits)? */
function looksLikeDate(s: string): boolean {
  return /\d{1,4}[\/\-\s](?:[a-z]{3,}|\d{1,2})[\/\-\s]\d{2,4}/i.test(s) || !isNaN(Date.parse(s));
}

// Guards against grounding a hallucinated row in a line that merely contains a
// number matching the claimed amount by coincidence — e.g. "Avl Bal: 5000.00 as
// of 22/07/2026" would otherwise ground a fabricated ₹5000 row, since that line
// has both a plausible amount and a plausible date but describes no transaction.
const TXN_KEYWORD_RE = /\b(debit(?:ed)?|credit(?:ed)?|spent|paid|purchase(?:d)?|withdraw(?:n|al)?|txn|transaction|refund(?:ed)?|charged|UPI|NEFT|RTGS|IMPS|POS)\b/i;
function looksLikeTransactionLine(s: string): boolean {
  return TXN_KEYWORD_RE.test(s);
}

/**
 * Reject rows that aren't grounded in real input: each row must reference a valid,
 * unique source line, and its claimed amount must actually appear in that line's
 * text. This is the primary defense against hallucinated transactions — an LLM
 * asked to extract structured data from non-transaction text can otherwise invent
 * plausible-looking rows with no basis in the input.
 */
export function validateGrounded(rows: RawLlmRow[], rawLines: string[]): LlmMappedRow[] {
  const usedLines = new Set<number>();
  const out: LlmMappedRow[] = [];
  for (const row of rows) {
    const lineIdx = row.sourceLine - 1;
    if (lineIdx < 0 || lineIdx >= rawLines.length) continue; // references a line that doesn't exist
    if (usedLines.has(lineIdx)) continue; // one transaction per source line — no fan-out fabrication
    const sourceLine = rawLines[lineIdx];
    if (!amountGroundedIn(row.amount, sourceLine)) continue; // amount must trace back to real text
    if (!looksLikeDate(row.date)) continue;
    if (!looksLikeTransactionLine(sourceLine)) continue; // reject balance/limit figures masquerading as transactions
    usedLines.add(lineIdx);
    out.push({
      date: row.date,
      narration: row.narration,
      amount: row.amount,
      direction: row.direction,
      merchantName: row.merchantName,
      category: row.category,
      confidence: row.confidence,
    });
  }
  return out;
}

/**
 * Map raw statement rows to canonical fields with the LLM. Returns null when the
 * adapter is disabled or the call fails; returns [] (not null) when the call
 * succeeded but nothing survived grounding validation — both cases mean the caller
 * should not treat the output as usable transactions.
 */
export async function mapRowsWithLLM(rawRows: string[]): Promise<LlmMappedRow[] | null> {
  if (!isLlmEnabled()) return null;
  const model = resolveLlmModel();
  const redacted = rawRows.map(redact);
  const numbered = redacted.map((line, i) => `${i + 1}: ${line}`).join("\n");

  const sys =
    "You extract structured transactions from Indian bank/card statement lines. Each input line is numbered. " +
    "For every line that is clearly a real financial transaction, return one row with sourceLine set to that " +
    "line's number. Do NOT invent, infer, guess, or fabricate a transaction that isn't clearly present in the " +
    "line text — if a line is not a transaction (e.g. a header, a blank line, junk data), omit it entirely. " +
    "Never emit more than one row per source line, and never emit a row for a line number that wasn't given. " +
    "amount must be the exact number written in that line (as a positive value) — never estimate or round to " +
    "a different figure. direction is DEBIT (money out) or CREDIT (money in). confidence is 0..1, reflecting " +
    "how certain you are this line is a genuine transaction. category, if inferable, must be one of: " +
    "food, grocery, transport, shopping, bills, health, entertainment, misc. If no lines are real transactions, " +
    "return an empty rows array.";

  try {
    const { output } = await generateText({
      model,
      temperature: 0,
      output: Output.object({ schema: outputSchema }),
      system: sys,
      prompt: numbered,
    });
    if (!output || !Array.isArray(output.rows)) return null;
    return validateGrounded(output.rows, redacted);
  } catch (err) {
    console.error("LLM adapter call failed, falling back to deterministic parser:", err);
    return null; // fail closed → deterministic fallback
  }
}

const CATEGORY_KEYS = ["food", "grocery", "transport", "shopping", "bills", "health", "entertainment", "misc"] as const;
const categoryVerifySchema = z.object({
  category: z.enum(CATEGORY_KEYS),
  confidence: z.number().min(0).max(1),
});

/**
 * Last-resort category verification for a transaction the deterministic pipeline
 * (rules → merchant history → keyword heuristic) couldn't confidently place —
 * i.e. it fell all the way through to the "misc" fallback. Mirrors the layered
 * pattern real enrichment engines use (deterministic/rule layers for the
 * confident majority, an ML/LLM layer only for the low-confidence tail) rather
 * than running an LLM call on every transaction.
 *
 * Deliberately capped below 1: this is a *suggestion* to narrow the review
 * queue's guess, not a certainty — the caller must still leave the transaction
 * unreviewed (isReviewed only ever flips true at confidence >= 1). Returns null
 * when disabled, the call fails, or the model itself wasn't confident (mirrors
 * mapRowsWithLLM's fail-closed contract).
 */
export async function verifyCategoryWithLLM(input: {
  merchantName?: string;
  narration?: string;
  amount?: number;
}): Promise<{ categoryKey: string; confidence: number } | null> {
  if (!isLlmEnabled()) return null;
  if (!input.merchantName && !input.narration) return null;
  const model = resolveLlmModel();

  const sys =
    "Classify a single Indian bank/card/UPI transaction into exactly one category: " +
    "food, grocery, transport, shopping, bills, health, entertainment, or misc. " +
    "Use misc when the merchant/narration genuinely doesn't indicate a clear category — " +
    "do not guess confidently just to avoid misc. confidence is 0..1, reflecting how sure " +
    "you are, given only a merchant name/narration and amount with no other context.";
  const prompt = `Merchant: ${redact(input.merchantName || "(unknown)")}\nNarration: ${redact(input.narration || "(none)")}\nAmount: ₹${input.amount ?? "?"}`;

  try {
    const { output } = await generateText({
      model,
      temperature: 0,
      output: Output.object({ schema: categoryVerifySchema }),
      system: sys,
      prompt,
    });
    if (!output || output.category === "misc") return null;
    // Capped just above the review queue's 0.5 "low confidence" threshold: this
    // moves the transaction from a bare guess to a specific AI-suggested category
    // (better starting point at review time) without ever reaching the
    // rule/keyword confidence tiers or the confidence>=1 auto-skip-review path.
    return { categoryKey: output.category, confidence: Math.min(0.55, Math.max(0.5, output.confidence)) };
  } catch (err) {
    console.error("Category verification LLM call failed:", err);
    return null; // fail closed → caller keeps the deterministic misc guess
  }
}
