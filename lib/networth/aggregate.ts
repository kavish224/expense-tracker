// Net worth aggregations (FSD 3.6). Pure functions over per-account balances
// so they're unit-testable and reused by the API + trend chart.

export type AccountClass = "BANK" | "CASH" | "CREDIT_CARD" | "INVESTMENT" | "LOAN" | "OTHER_ASSET";

export interface AccountBalance {
  accountId: string;
  name: string;
  type: AccountClass;
  colorToken: string;
  icon: string;
  // Raw magnitude: ledger accounts' running balance (can be negative for a
  // credit card carrying debt), or a manual account's entered value. LOAN is
  // always entered as a positive "amount owed" — the sign flip happens below.
  balance: number;
}

export interface NetWorthAccountEntry {
  accountId: string;
  name: string;
  type: AccountClass;
  colorToken: string;
  icon: string;
  contribution: number; // signed net-worth contribution
}

export interface NetWorth {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  assets: NetWorthAccountEntry[];
  liabilities: NetWorthAccountEntry[];
}

// Only LOAN needs an explicit sign flip — CREDIT_CARD debt already comes out
// negative from its own ledger balance (openingBalance + credits − debits),
// so it needs no special-casing here.
function signedContribution(b: { type: AccountClass; balance: number }): number {
  return b.type === "LOAN" ? -Math.abs(b.balance) : b.balance;
}

export function computeNetWorth(balances: AccountBalance[]): NetWorth {
  const entries: NetWorthAccountEntry[] = balances.map((b) => ({
    accountId: b.accountId,
    name: b.name,
    type: b.type,
    colorToken: b.colorToken,
    icon: b.icon,
    contribution: round(signedContribution(b)),
  }));
  // Split by sign rather than by type — a credit card in credit (rare, e.g.
  // overpaid) is an asset, and one carrying debt is a liability, regardless
  // of its static account type.
  const assets = entries.filter((e) => e.contribution >= 0).sort((a, b) => b.contribution - a.contribution);
  const liabilities = entries.filter((e) => e.contribution < 0).sort((a, b) => a.contribution - b.contribution);
  const totalAssets = round(assets.reduce((a, e) => a + e.contribution, 0));
  const totalLiabilities = round(-liabilities.reduce((a, e) => a + e.contribution, 0));
  return { netWorth: round(totalAssets - totalLiabilities), totalAssets, totalLiabilities, assets, liabilities };
}

export interface SnapshotRow {
  accountType: AccountClass;
  balance: number;
  asOf: Date;
}

// Snapshots are written as a batch (one row per account, all sharing the same
// `asOf` instant — see snapshotNetWorth in service.ts), so grouping by exact
// timestamp — not by calendar day — is what keeps two same-day "snapshot now"
// clicks as two distinct points instead of silently summing into one.
export function netWorthSeries(rows: SnapshotRow[]): { date: string; netWorth: number }[] {
  const byBatch = new Map<number, number>();
  for (const r of rows) {
    const t = r.asOf.getTime();
    byBatch.set(t, (byBatch.get(t) || 0) + signedContribution({ type: r.accountType, balance: r.balance }));
  }
  return [...byBatch.entries()]
    .map(([t, netWorth]) => ({ date: new Date(t).toISOString(), netWorth: round(netWorth) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
