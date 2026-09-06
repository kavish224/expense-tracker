// DB-touching half of net worth (FSD 3.6) — computes live balances and
// persists snapshots. Pure aggregation logic lives in aggregate.ts.
import { prisma } from "@/lib/db";
import { computeNetWorth, netWorthSeries, type AccountBalance, type AccountClass } from "./aggregate";

const LEDGER_TYPES = new Set(["BANK", "CASH", "CREDIT_CARD"]);

export async function computeAccountBalances(userId: string): Promise<AccountBalance[]> {
  const accounts = await prisma.account.findMany({ where: { userId, isArchived: false } });
  const ledgerIds = accounts.filter((a) => LEDGER_TYPES.has(a.type)).map((a) => a.id);

  const directMap = new Map<string, { credit: number; debit: number }>();
  const transferMap = new Map<string, number>();

  if (ledgerIds.length > 0) {
    const [directSums, transfersIn] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["accountId", "direction"],
        where: { userId, accountId: { in: ledgerIds } },
        _sum: { amount: true },
      }),
      // A credit card bill payment is recorded once, as a TRANSFER on the
      // paying bank account (see Transaction.transferAccountId) — the card's
      // own transaction list never sees it. Without this, a fully-paid-off
      // card would still show its full swiped total as still owed.
      prisma.transaction.groupBy({
        by: ["transferAccountId"],
        where: { userId, kind: "TRANSFER", transferAccountId: { in: ledgerIds } },
        _sum: { amount: true },
      }),
    ]);
    for (const row of directSums) {
      const cur = directMap.get(row.accountId) || { credit: 0, debit: 0 };
      if (row.direction === "CREDIT") cur.credit += Number(row._sum.amount ?? 0);
      else cur.debit += Number(row._sum.amount ?? 0);
      directMap.set(row.accountId, cur);
    }
    for (const row of transfersIn) {
      if (!row.transferAccountId) continue;
      transferMap.set(row.transferAccountId, Number(row._sum.amount ?? 0));
    }
  }

  return accounts.map((a) => {
    if (LEDGER_TYPES.has(a.type)) {
      const d = directMap.get(a.id) || { credit: 0, debit: 0 };
      const paidIn = transferMap.get(a.id) || 0;
      const balance = Number(a.openingBalance) + d.credit - d.debit + paidIn;
      return { accountId: a.id, name: a.name, type: a.type as AccountClass, colorToken: a.colorToken, icon: a.icon, balance };
    }
    return { accountId: a.id, name: a.name, type: a.type as AccountClass, colorToken: a.colorToken, icon: a.icon, balance: Number(a.currentBalance ?? 0) };
  });
}

export async function getNetWorth(userId: string) {
  return computeNetWorth(await computeAccountBalances(userId));
}

export async function getNetWorthSeries(userId: string) {
  const rows = await prisma.balanceSnapshot.findMany({
    where: { userId },
    include: { account: { select: { type: true } } },
    orderBy: { asOf: "asc" },
  });
  return netWorthSeries(rows.map((r) => ({ accountType: r.account.type as AccountClass, balance: Number(r.balance), asOf: r.asOf })));
}

export async function snapshotNetWorth(userId: string) {
  const balances = await computeAccountBalances(userId);
  if (balances.length === 0) return { count: 0, asOf: null };
  const asOf = new Date();
  await prisma.balanceSnapshot.createMany({
    data: balances.map((b) => ({ userId, accountId: b.accountId, balance: b.balance, asOf })),
  });
  return { count: balances.length, asOf };
}
