import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";
import { serializeTxn as serialize } from "@/lib/serialize";
import { assertOwnedAccount, assertOwnedCategory } from "@/lib/ownership";

const patchSchema = z.object({
  categoryId: z.string().nullable().optional(),
  merchantName: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
  amount: z.number().positive().optional(),
  isReviewed: z.boolean().optional(),
  paymentRail: z.enum(["UPI", "NEFT", "RTGS", "IMPS", "CARD", "CASH", "OTHER"]).optional(),
  accountId: z.string().optional(),
  txnDatetime: z.string().optional(),
  kind: z.enum(["EXPENSE", "TRANSFER"]).optional(),
  transferAccountId: z.string().nullable().optional(),
  tagColor: z.string().max(20).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owned = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  const d = parsed.data;

  if (d.accountId && !(await assertOwnedAccount(userId, d.accountId)))
    return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  if (d.categoryId && !(await assertOwnedCategory(userId, d.categoryId)))
    return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  if (d.transferAccountId && !(await assertOwnedAccount(userId, d.transferAccountId)))
    return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  if (d.transferAccountId && d.transferAccountId === (d.accountId ?? owned.accountId))
    return NextResponse.json({ error: "A transfer can't point at its own account" }, { status: 400 });

  const data: any = {};
  for (const k of ["categoryId", "merchantName", "note", "amount", "isReviewed", "paymentRail", "accountId", "kind", "transferAccountId", "tagColor"] as const) {
    if (d[k] !== undefined) data[k] = d[k];
  }
  // Switching back to a plain expense drops any leftover counterparty link.
  if (d.kind === "EXPENSE" && d.transferAccountId === undefined) data.transferAccountId = null;
  if (d.txnDatetime !== undefined) {
    const dt = new Date(d.txnDatetime);
    if (isNaN(dt.getTime())) return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
    data.txnDatetime = dt;
  }

  const txn = await prisma.transaction.update({ where: { id }, data, include: { account: true, category: true, transferAccount: true } });
  return NextResponse.json({ transaction: serialize(txn) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owned = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
