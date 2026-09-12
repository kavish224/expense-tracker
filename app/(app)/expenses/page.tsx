import { Suspense } from "react";
import { requireUserId } from "@/lib/user";
import { ExpensesClient } from "./ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await requireUserId();
  return (
    <Suspense fallback={null}>
      <ExpensesClient />
    </Suspense>
  );
}
