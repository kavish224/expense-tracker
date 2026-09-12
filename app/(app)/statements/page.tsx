import { Suspense } from "react";
import { requireUserId, getShellData } from "@/lib/user";
import { prisma } from "@/lib/db";
import { StatementsClient } from "./StatementsClient";

export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  const userId = await requireUserId();
  const { accounts, categories } = await getShellData(userId);
  // Every non-archived account (ledger + investment) is a valid transfer/settlement
  // destination when linking a statement row — investment accounts specifically
  // aren't in `accounts` above since they carry no transaction ledger of their own.
  const linkableAccounts = await prisma.account.findMany({
    where: { userId, isArchived: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, type: true },
  });
  return (
    <Suspense fallback={null}>
      <StatementsClient accounts={accounts} linkableAccounts={linkableAccounts} categories={categories} />
    </Suspense>
  );
}
