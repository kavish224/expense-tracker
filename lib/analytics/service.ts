import { prisma } from "@/lib/db";
import { kpis, dailySeries, dailyCategorySeries, previousPeriodRange, recurring, byAccount, periodRange, type TxnLite } from "./aggregate";
import { normalizeMerchant } from "@/lib/parsing/merchant";

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
    categoryId: t.categoryId ?? "uncat",
  }));

  // Previous equivalent-length period, for the %-change badges on the KPI row.
  const prevRange = previousPeriodRange(start, end);
  const prevRows = await prisma.transaction.findMany({
    where: { userId, txnDatetime: { gte: prevRange.start, lte: prevRange.end }, isReviewed: true, kind: "EXPENSE" },
    include: { category: true },
  });
  const prevTxns: TxnLite[] = prevRows.map((t) => ({
    amount: Number(t.amount),
    direction: t.direction as "DEBIT" | "CREDIT",
    txnDatetime: t.txnDatetime,
    categoryKey: t.category?.colorToken ?? "misc",
    accountId: t.accountId,
    accountName: "",
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
  // budgets vs actual (computed below) — categories carry their own budget limit,
  // when one's set, so the category list can show a progress bar inline instead of
  // requiring a second cross-reference against the separate budgets card.
  const budgets = await prisma.budget.findMany({ where: { userId }, include: { category: true } });
  const budgetLimitByCategoryId = new Map(budgets.filter((b) => b.categoryId).map((b) => [b.categoryId as string, Number(b.amount)]));

  const categories = [...catMap.values()]
    .map((c) => ({ ...c, amount: round(c.amount), budgetLimit: budgetLimitByCategoryId.get(c.id) }))
    .sort((a, b) => b.amount - a.amount);

  // Merchant breakdown — grouped on the normalized display name (raw bank/UPI narrations
  // like "SWIGGY*ORD8827BLR" would otherwise fragment the same real merchant into many rows).
  const merchMap = new Map<string, { name: string; colorToken: string; amount: number; count: number }>();
  for (const t of rows) {
    if (t.direction !== "DEBIT") continue;
    const name = normalizeMerchant(t.merchantName);
    const cur = merchMap.get(name) ?? { name, colorToken: t.category?.colorToken ?? "misc", amount: 0, count: 0 };
    cur.amount += Number(t.amount);
    cur.count += 1;
    merchMap.set(name, cur);
  }
  const merchants = [...merchMap.values()]
    .map((m) => ({ ...m, amount: round(m.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // budgets vs actual
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
    previousKpis: kpis(prevTxns, days),
    categories,
    merchants,
    accounts: byAccount(txns),
    daily: dailySeries(txns, start, end),
    dailyCategories: dailyCategorySeries(txns, start, end),
    recurring: recurring(txns).slice(0, 4),
    budgets: budgetRows,
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
