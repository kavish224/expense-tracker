// Shared date parser for statement imports and bank-alert emails. Always returns
// UTC midnight for the calendar date found, rather than local midnight — building via
// `new Date(y, m, d)` then serializing to UTC/ISO shifts the date back a calendar day
// on any server running ahead of UTC (e.g. IST, this app's primary market).
export function parseStatementDate(s: string): Date {
  s = String(s).trim();
  // dd/mm/yyyy or dd-mm-yy(yy)
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return new Date(Date.UTC(yy, parseInt(mo) - 1, parseInt(d)));
  }
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return new Date();
  // Natural-language dates ("25 Jul 2026") are parsed by the engine in local time too —
  // re-express as UTC midnight for the same calendar date it settled on.
  return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
}

// Finds a date-like substring in free text (bank alert emails, narrations) and parses
// it. Returns null if nothing date-shaped is found, so the caller can decide on a
// fallback rather than silently guessing. Tried in order:
//  1. dd/mm/yyyy or dd-mmm-yy(yy) — slash/dash separated (most statement narrations).
//  2. "Mon DD, YYYY" / "Mon DD YYYY" — ICICI and several other bank alert templates
//     write the transaction date this way (e.g. "on Jul 20, 2026 at 10:30:43"),
//     with no slash or dash at all, which pattern 1 can never match.
//  3. "DD Mon YYYY" / "DD Mon, YYYY" — the reverse ordering some alerts use.
const DATE_PATTERNS = [
  /\b(\d{1,2}[\/\-](?:\d{1,2}|[A-Za-z]{3,9})[\/\-]\d{2,4})\b/,
  /\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/,
  /\b(\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4})\b/,
];

export function extractDate(text: string): Date | null {
  for (const re of DATE_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const d = parseStatementDate(m[1]);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
