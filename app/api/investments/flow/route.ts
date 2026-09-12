import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdApi } from "@/lib/user";
import { createInvestmentFlow } from "@/lib/investments/service";

const schema = z.object({
  investmentAccountId: z.string(),
  fundingAccountId: z.string(),
  direction: z.enum(["CONTRIBUTION", "WITHDRAWAL"]),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const txn = await createInvestmentFlow(userId, parsed.data);
    return NextResponse.json({ ok: true, id: txn.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not record flow";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
