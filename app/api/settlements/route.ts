import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/user";
import { listSettlements } from "@/lib/transfers/service";

export async function GET() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settlements = await listSettlements(userId);
  return NextResponse.json({ settlements });
}
