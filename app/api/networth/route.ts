import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/user";
import { getNetWorth, getNetWorthSeries } from "@/lib/networth/service";

export async function GET() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [netWorth, series] = await Promise.all([getNetWorth(userId), getNetWorthSeries(userId)]);
  return NextResponse.json({ ...netWorth, series });
}
