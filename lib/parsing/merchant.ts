// Merchant display-name normalization for analytics grouping. Bank/UPI narrations are
// messy free text (e.g. "SWIGGY*ORD8827BLR", "AMAZON PAY INDIA PVT LTD REF992817") — grouping
// on the raw string fragments the same real-world merchant into dozens of distinct rows.
// This never touches the stored `merchantName` (still needed for reconciliation against the
// original statement) — it's applied at read time, wherever transactions are grouped by merchant.

// Canonical display name for well-known merchants, keyed by a lowercase substring to match
// against — reuses the same brand set `categorize.ts` already recognizes by keyword.
const ALIASES: [string, string][] = [
  ["swiggy", "Swiggy"], ["zomato", "Zomato"], ["eatsure", "EatSure"], ["dominos", "Domino's"],
  ["kfc", "KFC"], ["mcdonald", "McDonald's"], ["starbucks", "Starbucks"],
  ["bigbasket", "BigBasket"], ["blinkit", "Blinkit"], ["zepto", "Zepto"], ["grofers", "Grofers"],
  ["dmart", "DMart"], ["instamart", "Instamart"],
  ["uber", "Uber"], ["ola", "Ola"], ["rapido", "Rapido"], ["irctc", "IRCTC"],
  ["indianoil", "Indian Oil"], ["hpcl", "HPCL"], ["bpcl", "BPCL"],
  ["amazon", "Amazon"], ["flipkart", "Flipkart"], ["myntra", "Myntra"], ["ajio", "Ajio"],
  ["nykaa", "Nykaa"], ["meesho", "Meesho"], ["croma", "Croma"],
  ["netflix", "Netflix"], ["spotify", "Spotify"], ["hotstar", "Hotstar"], ["jio", "Jio"],
  ["airtel", "Airtel"], ["youtube", "YouTube"],
  ["pharmeasy", "PharmEasy"], ["1mg", "Tata 1mg"], ["apollo", "Apollo Pharmacy"],
  ["netmeds", "Netmeds"], ["practo", "Practo"],
  ["bookmyshow", "BookMyShow"], ["pvr", "PVR"], ["inox", "INOX"], ["steam", "Steam"],
];

// Order-id / reference-number noise: "*ORD8827BLR", trailing 6+ digit runs, UPI/bank
// boilerplate suffixes that carry no identity of their own.
const NOISE_PATTERNS = [
  /\*[A-Z0-9]{4,}/gi,
  /\b(REF|ORD|TXN|UPI)[A-Z0-9]{4,}\b/gi,
  /\b\d{6,}\b/g,
  /\b(PVT\.?\s?LTD\.?|LIMITED|LTD\.?|PRIVATE)\b/gi,
  /\b(IN|INDIA)\b$/gi,
];

// Payment-rail / processor prefixes carrying no merchant identity of their own —
// stripped before matching, mirroring how bank-enrichment APIs (Plaid Enrich,
// Context.dev) tokenize a raw descriptor and discard the rail/processor token
// before brand matching, rather than relying solely on a hardcoded alias list.
const RAIL_PREFIX_RE = /^(UPI|NEFT|RTGS|IMPS|POS|ECOM|VPS|SQ|TST|PAY|CHK)[\s\-*:/]+/i;
// UPI VPA handle suffix ("@okhdfcbank", "@ybl", "@paytm") — a bank/PSP routing
// token, not part of the merchant's name.
const VPA_HANDLE_RE = /@[a-z][a-z0-9.]*\b/gi;
// Trailing DR/CR markers some statements append to every narration.
const DRCR_SUFFIX_RE = /\s*[-/]?(DR|CR)$/i;

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeMerchant(raw: string | null | undefined): string {
  const input = (raw || "").trim();
  if (!input) return "Unknown";

  // Strip rail/processor/VPA noise before matching so an unlisted merchant's
  // residue is clean rather than raw; fall back to the untouched input if
  // stripping ate the whole string (nothing but noise tokens).
  const prelim = input.replace(RAIL_PREFIX_RE, "").replace(VPA_HANDLE_RE, "").replace(DRCR_SUFFIX_RE, "").trim() || input;

  const lower = prelim.toLowerCase();
  for (const [needle, display] of ALIASES) {
    if (lower.includes(needle)) return display;
  }

  let cleaned = prelim;
  for (const pattern of NOISE_PATTERNS) cleaned = cleaned.replace(pattern, " ");
  cleaned = cleaned.replace(/[^a-zA-Z0-9&'.\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return input; // cleanup ate everything unusual — show the raw string rather than blank

  // All-caps bank narrations ("AMAZON PAY") read better title-cased; a name that's
  // already mixed-case (typed by the user) is left alone rather than mangled.
  return cleaned === cleaned.toUpperCase() ? titleCase(cleaned) : cleaned;
}
