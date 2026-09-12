import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/user";
import { getSuggestions } from "@/lib/transfers/service";

export async function GET() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const suggestions = await getSuggestions(userId);
  return NextResponse.json({ suggestions });
}
