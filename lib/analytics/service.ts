import { prisma } from "@/lib/db";
import { kpis, dailySeries, recurring, byAccount, periodRange, type TxnLite } from "./aggregate";

export type Period = "week" | "month" | "quarter" | "custom";

export async function computeAnalytics(userId: string, period: Period, customRange?: { start: Date; end: Date }) {
  const { start, end } = customRange ?? periodRange(period === "custom" ? "month" : period);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  // TRANSFER-kind rows (e.g. a credit card bill payment) move money between
  // the user's own accounts rather than spending it — the original card
  // swipe was already counted as an EXPENSE, so including the payment here
  // too would double-count the same money leaving the household.
  const rows = await prisma.transaction.findMany({
    where: { userId, txnDatetime: { gte: start, lte: end }, isReviewed: true, kind: "EXPENSE" },
    include: { account: true, category: true },
    orderBy: { txnDatetime: "asc" },
  });

  const txns: TxnLite[] = rows.map((t) => ({
    amount: Number(t.amount),
    direction: t.direction as "DEBIT" | "CREDIT",
    txnDatetime: t.txnDatetime,
    categoryKey: t.category?.colorToken ?? "misc",
    accountId: t.accountId,
    accountName: t.account.name,
    merchantName: t.merchantName ?? undefined,
  }));

  // category breakdown by identity (id/name/color) for display + budgets
  const catMap = new Map<string, { id: string; name: string; colorToken: string; amount: number }>();
  for (const t of rows) {
    if (t.direction !== "DEBIT") continue;
    const id = t.categoryId ?? "uncat";
    const cur = catMap.get(id) ?? { id, name: t.category?.name ?? "Uncategorized", colorToken: t.category?.colorToken ?? "misc", amount: 0 };
    cur.amount += Number(t.amount);
    catMap.set(id, cur);
  }
  const categories = [...catMap.values()].map((c) => ({ ...c, amount: round(c.amount) })).sort((a, b) => b.amount - a.amount);

  // budgets vs actual
  const budgets = await prisma.budget.findMany({ where: { userId }, include: { category: true } });
  const totalSpent = txns.filter((t) => t.direction === "DEBIT").reduce((a, t) => a + t.amount, 0);
  const budgetRows = budgets.map((b) => {
    const actual = b.categoryId ? (catMap.get(b.categoryId)?.amount ?? 0) : totalSpent;
    return {
      id: b.id,
      name: b.category?.name ?? "Overall",
      colorToken: b.category?.colorToken ?? "accent",
      limit: Number(b.amount),
      actual: round(actual),
    };
  });

  return {
    period,
    range: { start, end },
    kpis: kpis(txns, days),
    categories,
    accounts: byAccount(txns),
    daily: dailySeries(txns, start, end),
    recurring: recurring(txns).slice(0, 4),
    budgets: budgetRows,
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
