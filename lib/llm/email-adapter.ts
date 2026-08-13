// LLM-based bank-alert email parser — fallback for lib/email/parse.ts's regex
// parser when it can't recognize the format. Indian banks/wallets fragment into
// dozens of alert formats (HDFC, ICICI, SBI, Bank of Baroda, AU Small Finance,
// Amazon Pay, PhonePe, GPay, Paytm, ...); hand-writing regex per sender doesn't
// scale, so this mirrors lib/llm/adapter.ts's grounded, anti-hallucination
// approach instead — the model must ground its extraction in text that's
// actually present in the email, or the row is rejected.
import { generateText, Output } from "ai";
import { z } from "zod";
import { isLlmEnabled, redact, resolveLlmModel } from "@/lib/llm/adapter";
import { extractDate } from "@/lib/parsing/date";
import { parseNarration } from "@/lib/parsing/narration";
import type { ParsedAlert } from "@/lib/email/parse";

const alertSchema = z.object({
  isTransaction: z.boolean(),
  amount: z.number().positive().nullable(),
  direction: z.enum(["DEBIT", "CREDIT"]).nullable(),
  merchantName: z.string().nullable(),
  accountHint: z.string().nullable(),
  rail: z.enum(["UPI", "NEFT", "RTGS", "IMPS", "CARD", "CASH", "OTHER"]).nullable(),
  dateText: z.string().nullable(),
  // A credit card bill payment (money moving from a bank account to pay off a
  // card) rather than a real purchase/expense. Optional (defaults falsy) so
  // older callers/fixtures that predate this field still type-check.
  isCreditCardBillPayment: z.boolean().optional(),
  // For a bill payment: last 4 digits / name of the card being paid, if stated.
  cardBeingPaidHint: z.string().nullable().optional(),
  // A UPI transaction explicitly funded by a (RuPay) credit card rather than
  // a bank account — same rail (UPI), different funding account.
  isCreditCardFundedUpi: z.boolean().optional(),
});
type AlertOutput = z.infer<typeof alertSchema>;

const TXN_KEYWORD_RE =
  /\b(debit(?:ed)?|credit(?:ed)?|spent|paid|purchase(?:d)?|withdraw(?:n|al)?|txn|transaction|refund(?:ed)?|charged|UPI|NEFT|RTGS|IMPS|POS)\b/i;

// How close a transaction keyword must appear to the grounded amount, in characters.
// A long HTML-derived email (newsletter, marketing) can easily contain some txn
// keyword *somewhere* and some number matching the claimed amount *somewhere else*,
// entirely unrelated to each other — a whole-document check would ground a
// hallucinated transaction in that coincidence. Requiring proximity mirrors how the
// deterministic regex parser (lib/email/parse.ts) already matches amount+verb
// together rather than independently.
const PROXIMITY_WINDOW = 120;

// Reward/loyalty program emails routinely state an earn-rate like "2 points per
// Rs.200 spent at POS" — a rule describing how points accrue, not a record of an
// actual transaction. That phrasing satisfies the proximity check above (amount +
// txn keyword both present, close together) despite not being one. Found via a
// real false positive: an SBI Rewardz monthly e-statement got parsed as a ₹200
// debit purely because its fine print mentioned "Rs.200 spent" near "POS".
const RATE_DESCRIPTOR_RE =
  /\b(?:per|every)\s+(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d+)?\s+spent\b|\bpoints?\s+(?:per|worth)\b/i;

// Returns the index of a text occurrence of `amount`, or -1 if none is found.
function findAmountIndex(amount: number, text: string): number {
  const target2dp = amount.toFixed(2);
  const targetInt = String(Math.round(amount));
  const re = /\d[\d,]*\.?\d*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const norm = m[0].replace(/,/g, "");
    if (!norm || isNaN(Number(norm))) continue;
    if (norm === target2dp || norm === targetInt || Number(norm).toFixed(2) === target2dp) return m.index;
  }
  return -1;
}

/**
 * Grounding + mapping step, split out from the network call so it's unit-testable
 * without mocking the AI SDK (mirrors validateGrounded in lib/llm/adapter.ts).
 * Rejects anything not marked a transaction, whose amount doesn't literally appear
 * in the source text, or whose text doesn't read like a transaction at all.
 */
export function groundAlertOutput(output: AlertOutput, sourceText: string, sender: string): ParsedAlert | null {
  if (!output.isTransaction || output.amount == null || !output.direction) return null;

  const amountIdx = findAmountIndex(output.amount, sourceText);
  if (amountIdx === -1) return null; // amount must trace back to real text

  // The transaction keyword must appear near the grounded amount, not merely
  // somewhere in the document (see PROXIMITY_WINDOW comment above).
  const windowStart = Math.max(0, amountIdx - PROXIMITY_WINDOW);
  const windowEnd = Math.min(sourceText.length, amountIdx + PROXIMITY_WINDOW);
  const window = sourceText.slice(windowStart, windowEnd);
  if (!TXN_KEYWORD_RE.test(window)) return null;
  if (RATE_DESCRIPTOR_RE.test(window)) return null;

  // Same dedup-of-confirmation logic as the regex parser: a credit card bill
  // payment fires both a bank-side debit and a card-side "payment received"
  // confirmation for the same transfer — only the bank-side debit is kept.
  if (output.isCreditCardBillPayment && output.direction === "CREDIT") return null;
  const kind: "EXPENSE" | "TRANSFER" = output.isCreditCardBillPayment ? "TRANSFER" : "EXPENSE";

  const when = (output.dateText && extractDate(output.dateText)) || extractDate(sourceText) || new Date();
  // Extracting a stable reference (UTR/RRN/UPI txn id) from the raw text, when
  // present, gives dedup its strongest, most reliable signal — the same one the
  // deterministic regex parser already relies on — instead of leaving every
  // LLM-resolved alert to fall back on the weaker amount+date+name heuristic.
  const externalRef = parseNarration(sourceText).externalRef;
  return {
    amount: output.amount,
    direction: output.direction,
    merchantName: output.merchantName ?? undefined,
    accountHint: output.accountHint ?? (sender.match(/@([a-z]+)/i)?.[1] ?? undefined),
    rail: output.rail ?? "OTHER",
    externalRef,
    when,
    kind,
    transferToHint: kind === "TRANSFER" ? (output.cardBeingPaidHint ?? undefined) : undefined,
    creditCardFunded: output.isCreditCardFundedUpi,
  };
}

/**
 * LLM fallback for a single alert email. Returns null when the adapter is
 * disabled, the call fails, or the output doesn't survive grounding — all cases
 * mean the caller should treat this email as unparseable, same contract as
 * parseAlertEmail (the deterministic parser it backs up).
 */
export async function parseAlertEmailWithLLM(body: string, subject = "", sender = ""): Promise<ParsedAlert | null> {
  if (!isLlmEnabled()) return null;
  const model = resolveLlmModel();
  const text = `Subject: ${redact(subject)}\n${redact(body)}`.replace(/\s+/g, " ").trim();

  const sys =
    "You extract a single bank/card/UPI transaction alert from an email, if the email genuinely is one. " +
    "Indian bank/wallet alert formats vary widely (HDFC, ICICI, SBI, Bank of Baroda, AU Small Finance, Amazon Pay, " +
    "PhonePe, GPay, Paytm, etc). Set isTransaction=false for anything that is not a real transaction alert — " +
    "marketing, newsletters, OTPs, statement summaries, promotional 'earn rewards' emails, or a balance/credit-limit " +
    "notice with no actual transaction. When isTransaction is true: amount must be the exact transacted amount as a " +
    "positive number — never a balance or credit-limit figure appearing elsewhere in the email. direction is DEBIT " +
    "for money out, CREDIT for money in. merchantName is who was paid / who paid, if stated. accountHint is the last " +
    "4 digits of the card/account if stated. rail is the payment rail if inferable. dateText is the transaction date " +
    "exactly as written in the email, if stated. isCreditCardBillPayment is true only when this alert is money moving " +
    "to pay off a credit card bill (e.g. 'payment received towards your Credit Card ending 1234', 'auto-debit towards " +
    "Credit Card') — NOT a regular purchase made using a credit card. cardBeingPaidHint is the last 4 digits or bank " +
    "name of the card being paid, only for a bill payment. isCreditCardFundedUpi is true only when a UPI payment was " +
    "explicitly funded by a credit card (commonly phrased as 'RuPay Credit Card' used for a UPI transaction) rather " +
    "than a bank account — most UPI alerts are bank-funded, so this should usually be false.";

  try {
    const { output } = await generateText({
      model,
      temperature: 0,
      output: Output.object({ schema: alertSchema }),
      system: sys,
      prompt: text,
    });
    if (!output) return null;
    return groundAlertOutput(output, text, sender);
  } catch (err) {
    console.error("Email LLM adapter call failed:", err);
    return null; // fail closed → caller treats as unparseable
  }
}
