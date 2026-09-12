// Pure matching logic for transfer detection (unit-testable, no DB access).
// A "transfer" is money moving between two of the user's own accounts —
// a credit card bill payment, an ATM cash withdrawal, a bank-to-bank move.
// It shows up in raw statement data as two independent, unlinked legs: a
// DEBIT on the paying/source account and a CREDIT on the receiving account,
// for the same amount, within a few days of each other.
export interface CandidateTxn {
  id: string;
  accountId: string;
  accountName: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  txnDatetime: Date;
  merchantName: string | null;
  rawNarration: string | null;
}

export interface TransferMatch {
  debit: CandidateTxn; // the outflow leg — becomes the surviving kind:TRANSFER row
  credit: CandidateTxn; // the inflow leg — gets removed once confirmed (see service.ts)
  daysApart: number;
  confidence: "high" | "medium";
}

const DAY_MS = 86_400_000;
const MAX_DAYS_APART = 3;

/** Finds plausible transfer pairs among a flat list of unlinked, same-user
 * transactions spanning multiple accounts. Each debit and each credit is used
 * in at most one match (greedy, closest-date-first) so one real payment
 * can't fan out into several suggestions. */
export function detectTransferPairs(txns: CandidateTxn[]): TransferMatch[] {
  const debits = txns.filter((t) => t.direction === "DEBIT");
  const credits = txns.filter((t) => t.direction === "CREDIT");

  const usedCreditIds = new Set<string>();
  const matches: TransferMatch[] = [];

  for (const debit of debits) {
    let best: { credit: CandidateTxn; daysApart: number } | null = null;
    for (const credit of credits) {
      if (usedCreditIds.has(credit.id)) continue;
      if (credit.accountId === debit.accountId) continue; // must be a different account
      if (Math.abs(credit.amount - debit.amount) > 0.005) continue;
      const daysApart = Math.abs(debit.txnDatetime.getTime() - credit.txnDatetime.getTime()) / DAY_MS;
      if (daysApart > MAX_DAYS_APART) continue;
      if (!best || daysApart < best.daysApart) best = { credit, daysApart };
    }
    if (best) {
      usedCreditIds.add(best.credit.id);
      matches.push({
        debit,
        credit: best.credit,
        daysApart: best.daysApart,
        confidence: best.daysApart <= 1 ? "high" : "medium",
      });
    }
  }

  return matches.sort((a, b) => b.debit.txnDatetime.getTime() - a.debit.txnDatetime.getTime());
}
