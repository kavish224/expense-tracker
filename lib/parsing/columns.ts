// Column auto-detection for CSV/XLSX statements (FSD 3.1).
// Header sniffing → canonical field map. Result can be persisted as a BankTemplate.

export interface ColumnMap {
  date?: number;
  narration?: number;
  debit?: number;
  credit?: number;
  amount?: number; // single signed amount column (some banks)
  balance?: number;
  ref?: number;
}

const SYNONYMS: Record<keyof ColumnMap, string[]> = {
  date: ["date", "txn date", "transaction date", "value date", "posting date"],
  narration: ["narration", "description", "particulars", "remarks", "details", "transaction remarks"],
  debit: ["debit", "withdrawal", "withdrawal amt", "dr", "debit amount", "paid out"],
  credit: ["credit", "deposit", "deposit amt", "cr", "credit amount", "paid in"],
  amount: ["amount", "txn amount", "transaction amount"],
  balance: ["balance", "closing balance", "running balance", "available balance"],
  ref: ["ref", "reference", "cheque", "utr", "rrn", "ref no", "reference no", "chq/ref no"],
};

export function detectColumns(headerRow: string[]): ColumnMap {
  const map: ColumnMap = {};
  const norm = headerRow.map((h) => String(h || "").toLowerCase().trim());
  (Object.keys(SYNONYMS) as (keyof ColumnMap)[]).forEach((field) => {
    const syns = SYNONYMS[field];
    let bestIdx = -1;
    norm.forEach((h, i) => {
      if (bestIdx !== -1) return;
      if (syns.some((s) => h === s || h.includes(s))) bestIdx = i;
    });
    if (bestIdx !== -1) map[field] = bestIdx;
  });
  return map;
}

export function looksLikeHeader(row: string[]): boolean {
  const joined = row.join(" ").toLowerCase();
  return /date/.test(joined) && /(narration|description|particulars|amount|debit|credit)/.test(joined);
}

// Given a data row and a column map, extract normalised numeric fields.
export function extractRow(row: (string | number)[], map: ColumnMap) {
  const num = (i?: number) => {
    if (i == null) return 0;
    const raw = String(row[i] ?? "").replace(/[₹,\s]/g, "");
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  };
  let debit = num(map.debit);
  let credit = num(map.credit);
  if (map.amount != null && !map.debit && !map.credit) {
    const a = num(map.amount);
    if (a < 0) debit = Math.abs(a);
    else credit = a;
  }
  return {
    dateRaw: map.date != null ? String(row[map.date] ?? "") : "",
    narration: map.narration != null ? String(row[map.narration] ?? "") : "",
    debit,
    credit,
    balance: map.balance != null ? num(map.balance) : undefined,
    ref: map.ref != null ? String(row[map.ref] ?? "") : "",
  };
}
