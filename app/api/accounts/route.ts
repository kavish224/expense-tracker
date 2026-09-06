import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";

export async function GET() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const accounts = await prisma.account.findMany({ where: { userId, isArchived: false }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ accounts: accounts.map((a) => ({ ...a, openingBalance: Number(a.openingBalance), currentBalance: a.currentBalance == null ? null : Number(a.currentBalance) })) });
}

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["BANK", "CREDIT_CARD", "CASH", "INVESTMENT", "LOAN", "OTHER_ASSET"]),
  institution: z.string().optional(),
  identifierHint: z.string().optional(),
  colorToken: z.string().default("misc"),
  icon: z.string().default("💳"),
  // Manual accounts only (FSD 3.6) — ledger accounts derive their balance
  // from transactions and ignore this field.
  currentBalance: z.number().finite().optional(),
});

const MANUAL_TYPES = new Set(["INVESTMENT", "LOAN", "OTHER_ASSET"]);

export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  const { currentBalance, ...rest } = parsed.data;
  const account = await prisma.account.create({
    data: { userId, ...rest, currentBalance: MANUAL_TYPES.has(rest.type) ? (currentBalance ?? 0) : undefined },
  });
  return NextResponse.json({ account: { ...account, openingBalance: Number(account.openingBalance), currentBalance: account.currentBalance == null ? null : Number(account.currentBalance) } });
}
