import { requireUserId } from "@/lib/user";
import { prisma } from "@/lib/db";
import { periodRange } from "@/lib/analytics/aggregate";
import { HomeClient } from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await requireUserId();
  const { start, end } = periodRange("month");

  const [monthSpend, prevMonthSpend, review, recent, streakDays] = await Promise.all([
    sumSpend(userId, start, end),
    prevMonth(userId),
    prisma.transaction.findMany({
      where: { userId, isReviewed: false },
      include: { account: true, category: true, transferAccount: true },
      orderBy: { txnDatetime: "desc" },
      take: 6,
    }),
    prisma.transaction.findMany({
      where: { userId, isReviewed: true },
      include: { account: true, category: true, transferAccount: true },
      orderBy: { txnDatetime: "desc" },
      take: 5,
    }),
    computeStreak(userId),
  ]);

  const delta = prevMonthSpend > 0 ? Math.round(((monthSpend - prevMonthSpend) / prevMonthSpend) * 100) : 0;

  // daily sparkline (this month)
  const daily = await prisma.transaction.findMany({
    where: { userId, direction: "DEBIT", kind: "EXPENSE", isReviewed: true, txnDatetime: { gte: start, lte: end } },
    select: { txnDatetime: true, amount: true },
  });
  const spark = buildSpark(daily.map((d) => ({ date: d.txnDatetime, amount: Number(d.amount) })), start, end);

  return (
    <HomeClient
      monthSpend={monthSpend}
      delta={delta}
      spark={spark}
      streak={streakDays}
      review={review.map(ser)}
      recent={recent.map(ser)}
    />
  );
}

function ser(t: any) {
  return {
    id: t.id, amount: Number(t.amount), direction: t.direction, kind: t.kind, merchantName: t.merchantName,
    account: { id: t.accountId, name: t.account.name, colorToken: t.account.colorToken },
    category: t.category ? { id: t.categoryId, name: t.category.name, colorToken: t.category.colorToken, icon: t.category.icon } : null,
    transferAccount: t.transferAccount ? { id: t.transferAccount.id, name: t.transferAccount.name } : null,
    source: t.source, txnDatetime: t.txnDatetime,
  };
}

async function sumSpend(userId: string, start: Date, end: Date) {
  const r = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId, direction: "DEBIT", kind: "EXPENSE", isReviewed: true, txnDatetime: { gte: start, lte: end } } });
  return Number(r._sum.amount ?? 0);
}
async function prevMonth(userId: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return sumSpend(userId, start, end);
}
async function computeStreak(userId: string): Promise<{ logged: number; of: number }> {
  const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0);
  const txns = await prisma.transaction.findMany({ where: { userId, txnDatetime: { gte: since } }, select: { txnDatetime: true } });
  const days = new Set(txns.map((t) => t.txnDatetime.toISOString().slice(0, 10)));
  return { logged: days.size, of: 7 };
}
function buildSpark(rows: { date: Date; amount: number }[], start: Date, end: Date): number[] {
  const map = new Map<string, number>();
  rows.forEach((r) => { const k = r.date.toISOString().slice(0, 10); map.set(k, (map.get(k) || 0) + r.amount); });
  const out: number[] = [];
  const cur = new Date(start);
  while (cur <= end) { out.push(map.get(cur.toISOString().slice(0, 10)) || 0); cur.setDate(cur.getDate() + 1); }
  return out;
}
