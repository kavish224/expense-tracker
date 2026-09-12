import { Suspense } from "react";
import { requireUserId, getShellData } from "@/lib/user";
import { StatementsClient } from "./StatementsClient";

export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  const userId = await requireUserId();
  const { accounts } = await getShellData(userId);
  return (
    <Suspense fallback={null}>
      <StatementsClient accounts={accounts} />
    </Suspense>
  );
}
