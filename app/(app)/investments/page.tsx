import { Suspense } from "react";
import { requireUserId, getShellData } from "@/lib/user";
import { prisma } from "@/lib/db";
import { InvestmentsClient } from "./InvestmentsClient";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const userId = await requireUserId();
  const [{ accounts: fundingAccounts }, investmentAccounts] = await Promise.all([
    getShellData(userId),
    prisma.account.findMany({
      where: { userId, isArchived: false, type: "INVESTMENT" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, institution: true, colorToken: true, icon: true },
    }),
  ]);
  return (
    <Suspense fallback={null}>
      <InvestmentsClient fundingAccounts={fundingAccounts} investmentAccounts={investmentAccounts} />
    </Suspense>
  );
}
