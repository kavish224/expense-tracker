import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";
import { assertOwnedAccount } from "@/lib/ownership";

// Raw, unfiltered per-account ledger — exactly what the source statement had,
// including transfers/settlements (no kind filtering here; that distinction
// belongs to the Settlements/Expenses pages, not the raw register).
export async function GET(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
  if (!(await assertOwnedAccount(userId, accountId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const txns = await prisma.transaction.findMany({
    where: { userId, accountId },
    orderBy: { txnDatetime: "asc" },
    include: { category: true },
  });

  let running = Number(account.openingBalance);
  const withBalance = txns.map((t) => {
    const amt = Number(t.amount);
    running += t.direction === "CREDIT" ? amt : -amt;
    return {
      id: t.id,
      amount: amt,
      direction: t.direction,
      txnDatetime: t.txnDatetime,
      merchantName: t.merchantName,
      rawNarration: t.rawNarration,
      categoryName: t.category?.name ?? null,
      categoryColorToken: t.category?.colorToken ?? null,
      kind: t.kind,
      source: t.source,
      runningBalance: Math.round(running * 100) / 100,
    };
  });

  return NextResponse.json({
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution,
      identifierHint: account.identifierHint,
      openingBalance: Number(account.openingBalance),
    },
    transactions: withBalance.reverse(), // most recent first for display
  });
}
