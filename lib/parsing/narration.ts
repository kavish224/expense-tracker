// Deterministic Indian bank-narration parser.
// Extracts hard identifiers with regex (reliable) across UPI/NEFT/RTGS/IMPS/Card.
// See FSD 3.1. Used by import + as the fallback when the LLM adapter is disabled.

export type ParsedRail = "UPI" | "NEFT" | "RTGS" | "IMPS" | "CARD" | "CASH" | "OTHER";

export interface ParsedNarration {
  rail: ParsedRail;
  counterparty?: string;
  vpa?: string;
  ifsc?: string;
  externalRef?: string; // UTR / RRN / UPI txn id
  refNote?: string;
  feesFlag: boolean;
  refundFlag: boolean;
}

// OCR confusion normalisation for scanned statements. Whitespace collapse only —
// digit/letter confusion (O0, I1/l1, B8, S5) is corrected separately, and only
// within isolated numeric-identifier tokens (see ocrDigitFix below), never across
// the whole narration: a blanket substitution would corrupt real letters in
// merchant names and VPAs (e.g. "Blinkit" -> "8linkit").
export function normalizeOcr(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

const OCR_DIGIT_MAP: Record<string, string> = { O: "0", I: "1", l: "1", B: "8", S: "5" };

function ocrDigitFix(token: string): string {
  return token.replace(/[OIlBS]/g, (ch) => OCR_DIGIT_MAP[ch]);
}

// Scans for tokens that are almost entirely digits but for a handful of
// OCR-confusable letters, corrects just those letters, and returns the first
// token (in the given length range) that becomes a clean digit run.
function extractOcrCorrectedDigitRun(text: string, minLen: number, maxLen: number): string | undefined {
  const re = new RegExp(`\\b([0-9OIlBS]{${minLen},${maxLen}})\\b`, "g");
  for (const m of text.matchAll(re)) {
    const raw = m[1];
    if (/^\d+$/.test(raw)) continue; // clean digit run — the primary regex already handles this case
    const fixed = ocrDigitFix(raw);
    if (/^\d+$/.test(fixed)) return fixed;
  }
  return undefined;
}

const RE_UPI_VPA = /\b([a-z0-9.\-_]{2,})@([a-z]{2,})\b/i;
const RE_IFSC = /\b([A-Z]{4}0[A-Z0-9]{6})\b/;
// OCR-tolerant IFSC: the mandatory literal "0" (5th char) is often misread as "O".
const RE_IFSC_OCR = /\b([A-Z]{4}[0O][A-Z0-9]{6})\b/;
const RE_UTR = /\b(?:UTR[:\s]*)?([A-Z]{2,6}\d{9,22}|\d{12,22})\b/;
const RE_RRN = /\b(?:RRN[:\s]*)?(\d{12})\b/;
const RE_REFHINT = /\b(INV[-\s]?\w+|BILL[-\s]?\w+|REF[#:\s]?\w+)\b/i;

export function parseNarration(raw: string): ParsedNarration {
  const text = normalizeOcr(raw);
  const upper = text.toUpperCase();

  const refundFlag = /\b(REFUND|REVERSAL|REV|RVS)\b/.test(upper);
  const feesFlag = /\b(CHG|CHARGE|COMM|FEE|GST)\b/.test(upper);

  let rail: ParsedRail = "OTHER";
  if (/\bUPI\b|@[a-z]{2,}\b/i.test(text)) rail = "UPI";
  else if (/\bNEFT\b/.test(upper)) rail = "NEFT";
  else if (/\bRTGS\b/.test(upper)) rail = "RTGS";
  else if (/\bIMPS\b/.test(upper)) rail = "IMPS";
  else if (/\bPOS\b|\bCARD\b|\bECOM\b|\bVISA\b|\bRUPAY\b|\bMASTERCARD\b/.test(upper)) rail = "CARD";

  const vpaMatch = text.match(RE_UPI_VPA);
  const vpa = vpaMatch ? vpaMatch[0].toLowerCase() : undefined;

  let ifsc = text.match(RE_IFSC)?.[1];
  if (!ifsc) {
    const m = text.match(RE_IFSC_OCR)?.[1];
    if (m) ifsc = m[4] === "O" ? m.slice(0, 4) + "0" + m.slice(5) : m;
  }

  let externalRef: string | undefined;
  if (rail === "IMPS") externalRef = text.match(RE_RRN)?.[1] ?? extractOcrCorrectedDigitRun(text, 12, 12);
  if (!externalRef) externalRef = text.match(RE_UTR)?.[1] ?? extractOcrCorrectedDigitRun(text, 12, 22);

  const refNote = text.match(RE_REFHINT)?.[1];

  // counterparty: prefer VPA local-part or a name token in a slash-delimited UPI string,
  // else the longest alpha run that isn't a known keyword.
  let counterparty: string | undefined;
  const slashParts = text.split("/").map((p) => p.trim()).filter(Boolean);
  if (rail === "UPI" && slashParts.length >= 2) {
    // UPI/vpa/NAME/ref/txnid/status  → pick the NAME-like part
    const nameLike = slashParts.find(
      (p) => /^[A-Za-z][A-Za-z .&]{2,}$/.test(p) && !/^UPI$/i.test(p) && !p.includes("@")
    );
    if (nameLike) counterparty = titleCase(nameLike);
  }
  if (!counterparty && vpa) counterparty = titleCase(vpa.split("@")[0].replace(/[._]/g, " "));
  if (!counterparty) {
    const cleaned = upper
      .replace(/\b(UPI|NEFT|RTGS|IMPS|POS|CARD|DR|CR|TO|FROM|A\/C|AC|VPA|UTR|RRN|SUCCESS|PAYMENT)\b/g, " ")
      .replace(/[^A-Z &]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const token = cleaned.split(" ").filter((w) => w.length >= 3).slice(0, 3).join(" ");
    if (token) counterparty = titleCase(token);
  }

  return { rail, counterparty, vpa, ifsc, externalRef, refNote, feesFlag, refundFlag };
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
