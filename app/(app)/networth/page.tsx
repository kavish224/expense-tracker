import { requireUserId } from "@/lib/user";
import { getNetWorth, getNetWorthSeries } from "@/lib/networth/service";
import { NetWorthClient } from "./NetWorthClient";

export const dynamic = "force-dynamic";

export default async function NetWorthPage() {
  const userId = await requireUserId();
  const [netWorth, series] = await Promise.all([getNetWorth(userId), getNetWorthSeries(userId)]);
  return <NetWorthClient initial={{ ...netWorth, series }} />;
}
