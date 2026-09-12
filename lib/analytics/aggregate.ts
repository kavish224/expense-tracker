// Analytics aggregations (FSD 3.4). Pure functions over a normalised txn list so
// they are unit-testable and reused by the API + export.
import { normalizeMerchant } from "@/lib/parsing/merchant";

export interface TxnLite {
  amount: number;
  direction: "DEBIT" | "CREDIT";
  txnDatetime: Date;
  categoryKey: string;
  accountId: string;
  accountName: string;
  merchantName?: string;
  // Real category id (distinct from categoryKey, which is the colorToken used
  // for grouping/coloring) — only needed for the per-day category breakdown
  // that powers click-to-filter, so it's optional everywhere else.
  categoryId?: string;
}

export interface Kpis {
  totalSpent: number;
  count: number;
  avgPerDay: number;
  topCategory: { key: string; amount: number } | null;
}

export function periodRange(period: "week" | "month" | "quarter", ref = new Date()) {
  const end = new Date(ref);
  const start = new Date(ref);
  if (period === "week") start.setDate(end.getDate() - 6);
  else if (period === "month") start.setDate(1);
  else start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

const spends = (txns: TxnLite[]) => txns.filter((t) => t.direction === "DEBIT");

export function kpis(txns: TxnLite[], days: number): Kpis {
  const s = spends(txns);
  const total = s.reduce((a, t) => a + t.amount, 0);
  const byCat = byCategory(txns);
  const top = byCat[0] ?? null;
  return {
    totalSpent: round(total),
    count: s.length,
    avgPerDay: round(total / Math.max(1, days)),
    topCategory: top ? { key: top.key, amount: top.amount } : null,
  };
}

export function byCategory(txns: TxnLite[]) {
  const m = new Map<string, number>();
  for (const t of spends(txns)) m.set(t.categoryKey, (m.get(t.categoryKey) || 0) + t.amount);
  return [...m.entries()].map(([key, amount]) => ({ key, amount: round(amount) })).sort((a, b) => b.amount - a.amount);
}

export function byAccount(txns: TxnLite[]) {
  const m = new Map<string, { name: string; amount: number }>();
  for (const t of spends(txns)) {
    const cur = m.get(t.accountId) || { name: t.accountName, amount: 0 };
    cur.amount += t.amount;
    m.set(t.accountId, cur);
  }
  return [...m.entries()].map(([id, v]) => ({ accountId: id, name: v.name, amount: round(v.amount) })).sort((a, b) => b.amount - a.amount);
}

export function dailySeries(txns: TxnLite[], start: Date, end: Date) {
  const days: { date: string; amount: number }[] = [];
  const map = new Map<string, number>();
  for (const t of spends(txns)) {
    const k = t.txnDatetime.toISOString().slice(0, 10);
    map.set(k, (map.get(k) || 0) + t.amount);
  }
  const cur = new Date(start);
  while (cur <= end) {
    const k = cur.toISOString().slice(0, 10);
    days.push({ date: k, amount: round(map.get(k) || 0) });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// Per-day category totals (by real category id, not colorToken) — powers
// click-a-day-to-filter on the trend chart without a second round-trip.
export function dailyCategorySeries(txns: TxnLite[], start: Date, end: Date) {
  const map = new Map<string, Map<string, number>>();
  for (const t of spends(txns)) {
    if (!t.categoryId) continue;
    const day = t.txnDatetime.toISOString().slice(0, 10);
    const dayMap = map.get(day) ?? new Map<string, number>();
    dayMap.set(t.categoryId, (dayMap.get(t.categoryId) || 0) + t.amount);
    map.set(day, dayMap);
  }
  const out: { date: string; categories: Record<string, number> }[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const k = cur.toISOString().slice(0, 10);
    const dayMap = map.get(k);
    out.push({
      date: k,
      categories: dayMap ? Object.fromEntries([...dayMap.entries()].map(([id, a]) => [id, round(a)])) : {},
    });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// The equivalent-length window immediately preceding [start, end] — used to
// compute period-over-period deltas for any period type (week/month/quarter/
// custom) without special-casing each one.
export function previousPeriodRange(start: Date, end: Date) {
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}

// Recurring detection: same merchant, similar amount, ~monthly cadence, ≥2 hits.
export function recurring(txns: TxnLite[]) {
  // Grouped on the normalized display name, not the raw narration — the same
  // merchant routinely shows up under several different raw strings (a UPI VPA
  // handle changes per transaction, e.g. "zepto.payu@hdfcbank" vs
  // "zeptomarketplac895229.rzp@rxairtel" are both Zepto), which would otherwise
  // split one genuinely recurring merchant into several one-off groups that
  // never reach the count>=2 threshold below.
  const groups = new Map<string, TxnLite[]>();
  for (const t of spends(txns)) {
    if (!t.merchantName) continue;
    const k = normalizeMerchant(t.merchantName).toLowerCase();
    (groups.get(k) || groups.set(k, []).get(k)!).push(t);
  }
  const out: { merchant: string; amount: number; count: number }[] = [];
  groups.forEach((list) => {
    if (list.length >= 2) {
      const amounts = list.map((t) => t.amount);
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stable = amounts.every((a) => Math.abs(a - avg) / avg < 0.15);
      if (stable) out.push({ merchant: normalizeMerchant(list[0].merchantName), amount: round(avg), count: list.length });
    }
  });
  return out.sort((a, b) => b.count - a.count);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
