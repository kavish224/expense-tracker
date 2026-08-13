import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";
import { assertOwnedCategory } from "@/lib/ownership";

export async function GET() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const budgets = await prisma.budget.findMany({ where: { userId }, include: { category: true } });
  return NextResponse.json({ budgets: budgets.map((b) => ({ id: b.id, amount: Number(b.amount), period: b.period, categoryId: b.categoryId, category: b.category ? { name: b.category.name, colorToken: b.category.colorToken } : null })) });
}

const schema = z.object({ categoryId: z.string().nullable().optional(), amount: z.number().positive(), period: z.enum(["MONTHLY", "WEEKLY"]).default("MONTHLY") });

export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid budget" }, { status: 400 });
  if (parsed.data.categoryId && !(await assertOwnedCategory(userId, parsed.data.categoryId))) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  const categoryId = parsed.data.categoryId ?? null;
  // The schema has no unique constraint on (userId, categoryId), so without this
  // check, saving the same category's budget twice (e.g. re-opening the editor)
  // would silently pile up duplicate rows that then double-count in the UI.
  const existing = await prisma.budget.findFirst({ where: { userId, categoryId } });
  const b = existing
    ? await prisma.budget.update({ where: { id: existing.id }, data: { amount: parsed.data.amount, period: parsed.data.period } })
    : await prisma.budget.create({ data: { userId, categoryId, amount: parsed.data.amount, period: parsed.data.period } });
  return NextResponse.json({ budget: { id: b.id, amount: Number(b.amount), period: b.period, categoryId: b.categoryId } });
}
