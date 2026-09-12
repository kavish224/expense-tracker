import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdApi } from "@/lib/user";
import { dismissPair } from "@/lib/transfers/service";

const schema = z.object({ debitId: z.string(), creditId: z.string() });

export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await dismissPair(userId, parsed.data.debitId, parsed.data.creditId);
  return NextResponse.json({ ok: true });
}
