import { requireUserId, getShellData } from "@/lib/user";
import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const userId = await requireUserId();
  const { accounts } = await getShellData(userId);
  return <ImportClient accounts={accounts} />;
}
