import { Suspense } from "react";
import { requireUserId, getShellData } from "@/lib/user";
import { TransactionsClient } from "./TransactionsClient";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const userId = await requireUserId();
  const { accounts, categories } = await getShellData(userId);
  return (
    <Suspense fallback={null}>
      <TransactionsClient accounts={accounts} categories={categories} />
    </Suspense>
  );
}
