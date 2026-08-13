import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owned = await prisma.account.findFirst({ where: { id, userId } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  for (const k of ["name", "isArchived", "colorToken", "icon", "identifierHint", "institution"]) if (k in body) data[k] = body[k];
  const account = await prisma.account.update({ where: { id }, data });
  return NextResponse.json({ account: { ...account, openingBalance: Number(account.openingBalance) } });
}

// Archive (soft delete) preserves history.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owned = await prisma.account.findFirst({ where: { id, userId } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.account.update({ where: { id }, data: { isArchived: true } });
  return NextResponse.json({ ok: true });
}
