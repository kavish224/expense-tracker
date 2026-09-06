import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/user";
import { snapshotNetWorth } from "@/lib/networth/service";

export async function POST() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await snapshotNetWorth(userId);
  return NextResponse.json(result);
}
