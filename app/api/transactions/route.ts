import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";
import { serializeTxn as serialize } from "@/lib/serialize";
import { assertOwnedAccount, assertOwnedCategory } from "@/lib/ownership";

export async function GET(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const accountId = sp.get("accountId") || undefined;
  const categoryId = sp.get("categoryId") || undefined;
  const q = sp.get("q")?.trim();
  const from = sp.get("from");
  const to = sp.get("to");
  const review = sp.get("review"); // "1" → only unreviewed
  const kind = sp.get("kind"); // "EXPENSE" | "TRANSFER"
  const take = Math.min(parseInt(sp.get("take") || "100"), 500);

  const where: any = { userId };
  if (accountId) where.accountId = accountId;
  if (categoryId) where.categoryId = categoryId;
  if (review === "1") where.isReviewed = false;
  if (kind === "EXPENSE" || kind === "TRANSFER") where.kind = kind;
  if (from || to) where.txnDatetime = {};
  if (from) where.txnDatetime.gte = new Date(from);
  if (to) where.txnDatetime.lte = new Date(to);
  if (q) {
    const amt = parseFloat(q.replace(/[₹,]/g, ""));
    where.OR = [
      { merchantName: { contains: q, mode: "insensitive" } },
      { note: { contains: q, mode: "insensitive" } },
      { rawNarration: { contains: q, mode: "insensitive" } },
      ...(isFinite(amt) ? [{ amount: amt }] : []),
    ];
  }

  const txns = await prisma.transaction.findMany({
    where,
    include: { account: true, category: true, transferAccount: true },
    orderBy: { txnDatetime: "desc" },
    take,
  });
  return NextResponse.json({ transactions: txns.map(serialize) });
}

const createSchema = z.object({
  amount: z.number().positive(),
  accountId: z.string(),
  categoryId: z.string().optional().nullable(),
  direction: z.enum(["DEBIT", "CREDIT"]).default("DEBIT"),
  merchantName: z.string().optional(),
  note: z.string().optional(),
  paymentRail: z.enum(["UPI", "NEFT", "RTGS", "IMPS", "CARD", "CASH", "OTHER"]).default("OTHER"),
  txnDatetime: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  const d = parsed.data;

  if (!(await assertOwnedAccount(userId, d.accountId)))
    return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  if (d.categoryId && !(await assertOwnedCategory(userId, d.categoryId)))
    return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });

  const txn = await prisma.transaction.create({
    data: {
      userId,
      accountId: d.accountId,
      amount: d.amount,
      direction: d.direction,
      categoryId: d.categoryId || null,
      merchantName: d.merchantName,
      note: d.note,
      paymentRail: d.paymentRail,
      txnDatetime: d.txnDatetime ? new Date(d.txnDatetime) : new Date(),
      source: "MANUAL",
      confidence: 1,
      isReviewed: true,
    },
    include: { account: true, category: true, transferAccount: true },
  });
  return NextResponse.json({ transaction: serialize(txn) });
}

