import { NextRequest, NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/user";
import { computeAnalytics, type Period } from "@/lib/analytics/service";

const VALID_PERIODS: Period[] = ["week", "month", "quarter", "custom"];

export async function GET(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const periodParam = req.nextUrl.searchParams.get("period") as Period;
  const period = VALID_PERIODS.includes(periodParam) ? periodParam : "month";

  let customRange: { start: Date; end: Date } | undefined;
  if (period === "custom") {
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");
    if (!fromParam || !toParam) return NextResponse.json({ error: "from and to are required for a custom range" }, { status: 400 });
    const start = new Date(`${fromParam}T00:00:00`);
    const end = new Date(`${toParam}T23:59:59.999`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: "invalid date range" }, { status: 400 });
    }
    customRange = { start, end };
  }

  const data = await computeAnalytics(userId, period, customRange);
  return NextResponse.json(data);
}
