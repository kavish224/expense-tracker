// Bank alert email parser (FSD 3.3). Turns a forwarded transaction-alert email
// into a pending transaction. Works today via POST /api/ingest/email; live Gmail
// polling (lib/email/gmail.ts) activates when GMAIL_* env is present.
//
// Patterns below were tuned against real alert emails from HDFC, ICICI, and AU Small
// Finance Bank (via live Gmail polling) — not just synthetic examples — including two
// real false positives (marketing/promo emails misread as transactions) that drove the
// "amount and verb must appear together" requirement below instead of matching either
// independently anywhere in the email.

import { parseNarration } from "@/lib/parsing/narration";
import { extractDate } from "@/lib/parsing/date";

export interface ParsedAlert {
  amount: number;
  direction: "DEBIT" | "CREDIT";
  merchantName?: string;
  accountHint?: string; // last4 / bank name to resolve account
  rail: string;
  externalRef?: string;
  when: Date;
  // EXPENSE (default) vs TRANSFER — a credit card bill payment moves money
  // between the user's own accounts and is never counted as spend.
  kind: "EXPENSE" | "TRANSFER";
  // For a TRANSFER: last4/bank-name hint identifying which credit card the
  // payment is towards, resolved against Account.identifierHint/institution
  // the same way accountHint is.
  transferToHint?: string;
  // Signals a UPI transaction was funded by a (RuPay) credit card rather than
  // a bank account — the payment rail is still UPI, but the funding account
  // resolution should prefer a CREDIT_CARD account over a BANK account.
  creditCardFunded?: boolean;
}

const RE_CARD4 = /(?:card|a\/c|account|ac|ending|xx)\D{0,12}(\d{4})\b/i;
const RE_CURRENCY = "(?:INR|Rs\\.?|₹)\\s*([\\d,]+(?:\\.\\d{1,2})?)";

// Amount and direction are matched together, not independently — a marketing email
// that happens to mention both "spent" (e.g. "everyday spends") and some unrelated
// number elsewhere is not a transaction. Tried in order; first match wins.
const AMOUNT_DIRECTION_PATTERNS: { re: RegExp; direction: "DEBIT" | "CREDIT" }[] = [
  { re: new RegExp(`${RE_CURRENCY}\\s*(?:\\/-)?\\s*(?:has\\s+been\\s+|have\\s+been\\s+|were\\s+|was\\s+)?(?:debited|spent|paid|withdrawn)`, "i"), direction: "DEBIT" },
  { re: new RegExp(`(?:debited|spent|paid|withdrawn)\\D{0,25}?${RE_CURRENCY}`, "i"), direction: "DEBIT" },
  { re: new RegExp(`${RE_CURRENCY}\\s*(?:has\\s+been\\s+|have\\s+been\\s+|were\\s+|was\\s+)?(?:credited|received)`, "i"), direction: "CREDIT" },
  { re: new RegExp(`(?:credited|received)\\D{0,25}?${RE_CURRENCY}`, "i"), direction: "CREDIT" },
  // ICICI-style: "...has been used for a transaction of INR 336.00..." — no bare
  // debited/spent keyword anywhere in the email, but this phrasing always means a debit.
  { re: new RegExp(`used\\s+for\\s+a\\s+transaction\\s+of\\s+${RE_CURRENCY}`, "i"), direction: "DEBIT" },
];

// Merchant extraction, tried in priority order (bank-specific structured formats
// first, generic heuristics last). Character classes deliberately include @ . / _
// — real merchant text is VPAs (name@bank) and UPI-prefixed narrations
// (UPI/MERCHANT NAME), and excluding those characters was the root cause of every
// merchant-extraction failure found against real emails: the regex couldn't complete
// a match at the real merchant and skipped ahead to unrelated boilerplate instead.
const MERCHANT_PATTERNS: RegExp[] = [
  /\bInfo:\s*([^.]{2,60})\./i, // ICICI: "Info: AMAZON PAY WALLET LOAD."
  /\bUPI\/([A-Za-z0-9 .&\-]{2,40}?)(?:\s+on\s+\d|\.|,|$)/i, // "at UPI/HIGH ON CHAI on 25-07-2026" — terminator requires "on" to precede a date (digit), not just any word, since merchant names themselves sometimes contain "on"
  /\bPaid\s+to\s+([A-Za-z0-9@._\-]{3,40})/i, // HDFC RuPay: "Paid to swiggyinstamart@icici"
  /\b(?:at|to|towards)\s+([A-Za-z0-9@._&\-]{3,40}?)(?:\s+on\s+\d|\.|,|$)/i, // generic fallback
];

// Boilerplate that regexes above can still accidentally capture (disclaimer text,
// "call us" footers, credit-limit sentences) — reject these regardless of which
// pattern produced them, rather than trusting any single regex to never misfire.
const RE_BOILERPLATE = /\b(card holder|bank account|support you|click here|message in html|lifetime free|reward point|customer care|toll[- ]?free|sms\s*(?:block|pblock)|call\s*(?:us|on)|avl\.?\s*bal|available (?:credit )?limit|total credit limit|terms and condition|not done by you|report it|block the card|supplementary card)\b/i;

// Reward/loyalty program terms & conditions routinely state an earn-rate like "2
// points per Rs.200 spent" — a rule about how points accrue, not a record of an
// actual transaction. AMOUNT_DIRECTION_PATTERNS' first pattern matches "Rs.200
// spent" directly regardless of the leading "per", so this needs its own check
// (found via a real SBI Rewardz monthly e-statement misparsed as a ₹200 debit).
const RE_RATE_DESCRIPTOR = /\b(?:per|every)\s+(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d+)?\s+spent\b/i;

// E-commerce/food-delivery order confirmations and shipping-status emails are
// itemized receipts, not bank/wallet alerts — but their "bill breakdown" tables
// (delivery fee, platform fee, taxes, a "Paid ... ₹X" line summarizing an order
// that was already paid for) satisfy the amount+verb proximity check above just
// as well as a real debit alert. Found via two real false positives: a Swiggy
// "your order was delivered" email and a Myntra order-confirmation email, both
// fabricating a transaction (with a nonsense merchant name lifted from nearby
// prose) purely from their receipt table. Deliberately excludes generic terms
// like "bill details" / "order id" — a genuine Swiggy Dineout *payment
// confirmation* email (a real transaction) contains both, so only terms
// specific to an order/delivery/shipping flow (never present in a "your
// payment was successful" confirmation) are used here.
const RE_ORDER_RECEIPT =
  /\b(price breakup|order journey|order (?:is )?confirmed|item\(s\) will reach you|sold by|delivered on time|shipping charges|estimated delivery|track your order|mrp)\b/i;

// Credit card bill payment alerts (bank-side "we received your payment" or
// "auto-debit towards your card" messages) — these move money from a bank
// account to pay down a credit card, not a new expense. Tuned against the
// common HDFC/ICICI/SBI Card phrasing: "payment ... received ... towards
// your Credit Card", "auto-debit towards Credit Card", "bill payment ...
// Credit Card".
const RE_CC_PAYMENT_PATTERNS = [
  /payment\D{0,40}(?:received|credited|processed)\D{0,60}credit\s*card/i,
  /credit\s*card\D{0,60}payment\D{0,40}(?:received|successful|processed)/i,
  /(?:auto[- ]?debit|payment)\D{0,40}towards\D{0,40}credit\s*card/i,
  /bill\s*payment\D{0,40}credit\s*card/i,
];

// A UPI transaction explicitly tied to a (RuPay) credit card rather than a
// bank account — same payment rail (UPI) as a regular bank-funded UPI spend,
// but the funding account should resolve to the card, not the bank.
const RE_CC_UPI = /(?:rupay\s+)?credit\s*card\D{0,60}\bupi\b|\bupi\b\D{0,60}(?:rupay\s+)?credit\s*card/i;

function extractMerchant(text: string, narrationCounterparty?: string): string | undefined {
  for (const re of MERCHANT_PATTERNS) {
    const m = text.match(re);
    const candidate = m?.[1]?.trim();
    if (candidate && candidate.length >= 2 && !RE_BOILERPLATE.test(candidate)) return candidate;
  }
  if (narrationCounterparty && !RE_BOILERPLATE.test(narrationCounterparty)) return narrationCounterparty;
  return undefined;
}

export function parseAlertEmail(body: string, subject = "", sender = ""): ParsedAlert | null {
  const text = `${subject}\n${body}`.replace(/\s+/g, " ").trim();
  if (RE_ORDER_RECEIPT.test(text)) return null; // merchant receipt, not a bank alert

  let amount: number | undefined;
  let direction: "DEBIT" | "CREDIT" | undefined;
  for (const p of AMOUNT_DIRECTION_PATTERNS) {
    const m = text.match(p.re);
    if (m && m.index != null) {
      const a = parseFloat(m[1].replace(/,/g, ""));
      const context = text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20);
      if (isFinite(a) && a > 0 && !RE_RATE_DESCRIPTOR.test(context)) {
        amount = a;
        direction = p.direction;
        break;
      }
    }
  }
  if (amount == null || !direction) return null; // no tight amount+verb match — not a recognizable transaction

  // A credit card bill payment fires two alerts for the same event: the bank
  // debits the paying account ("₹5000 debited... towards Credit Card"), and
  // separately the card issuer confirms receipt ("Payment of ₹5000 received
  // towards your Credit Card ending 1234"). Recording both would double-book
  // a single transfer — so the card-side confirmation (direction CREDIT) is
  // treated as a non-transaction here; only the bank-side debit is captured,
  // as a TRANSFER rather than an EXPENSE.
  const isCcPayment = RE_CC_PAYMENT_PATTERNS.some((re) => re.test(text));
  if (isCcPayment && direction === "CREDIT") return null;
  const kind: "EXPENSE" | "TRANSFER" = isCcPayment ? "TRANSFER" : "EXPENSE";

  const nar = parseNarration(text);
  const card4 = text.match(RE_CARD4)?.[1];
  const merchantName = extractMerchant(text, nar.counterparty);

  // Prefer the date actually stated in the alert (e.g. "...on 22-07-26...") — falling
  // back to "now" only when the email genuinely doesn't include one. Alerts aren't
  // always ingested the instant the transaction happens (batched forwarding, webhook
  // retries, etc.), so defaulting to "now" unconditionally silently backdates/misdates
  // the transaction whenever there's any delay.
  const when = extractDate(text) ?? new Date();

  return {
    amount,
    direction,
    merchantName,
    accountHint: card4 || (sender.match(/@([a-z]+)/i)?.[1] ?? undefined),
    rail: nar.rail,
    externalRef: nar.externalRef,
    when,
    kind,
    transferToHint: kind === "TRANSFER" ? card4 : undefined,
    creditCardFunded: RE_CC_UPI.test(text),
  };
}
