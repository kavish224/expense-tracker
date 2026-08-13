import { requireUserId } from "@/lib/user";
import { prisma } from "@/lib/db";
import { periodRange } from "@/lib/analytics/aggregate";
import { AccountsClient } from "./AccountsClient";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const userId = await requireUserId();
  const { start, end } = periodRange("month");
  const accounts = await prisma.account.findMany({ where: { userId, isArchived: false }, orderBy: { createdAt: "asc" } });

  const spendByAcc = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: { userId, direction: "DEBIT", kind: "EXPENSE", txnDatetime: { gte: start, lte: end } },
    _sum: { amount: true },
    _count: true,
  });
  const spendMap = new Map(spendByAcc.map((s) => [s.accountId, { spent: Number(s._sum.amount ?? 0), count: s._count }]));

  const data = accounts.map((a) => ({
    id: a.id, name: a.name, type: a.type, colorToken: a.colorToken, icon: a.icon,
    identifierHint: a.identifierHint, institution: a.institution,
    spent: spendMap.get(a.id)?.spent ?? 0, count: spendMap.get(a.id)?.count ?? 0,
  }));

  return <AccountsClient accounts={data} />;
}
