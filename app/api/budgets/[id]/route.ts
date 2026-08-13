import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";

const schema = z.object({ amount: z.number().positive(), period: z.enum(["MONTHLY", "WEEKLY"]).optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owned = await prisma.budget.findFirst({ where: { id, userId } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid budget" }, { status: 400 });
  const b = await prisma.budget.update({ where: { id }, data: { amount: parsed.data.amount, ...(parsed.data.period ? { period: parsed.data.period } : {}) } });
  return NextResponse.json({ budget: { id: b.id, amount: Number(b.amount), period: b.period, categoryId: b.categoryId } });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owned = await prisma.budget.findFirst({ where: { id, userId } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.budget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
