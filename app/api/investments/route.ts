import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/user";
import { getInvestmentSummaries, listInvestmentFlows } from "@/lib/investments/service";

export async function GET() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [summaries, flows] = await Promise.all([
    getInvestmentSummaries(userId),
    listInvestmentFlows(userId),
  ]);
  return NextResponse.json({ summaries, flows });
}
