import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";
import { CATEGORY_BY_KEY } from "@/lib/constants";
import { assertOwnedAccount } from "@/lib/ownership";

// Body: { accountId, fileName, tieOutStatus, rows: [{...parsed, action: "ADD"|"MERGE"|"SKIP", categoryId?}] }
export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.accountId || !Array.isArray(body.rows)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  if (!(await assertOwnedAccount(userId, body.accountId))) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  // resolve category keys → ids
  const cats = await prisma.category.findMany({ where: { userId } });
  const catByColor = new Map(cats.map((c) => [c.colorToken, c.id]));
  const keyToColor = (k: string) => CATEGORY_BY_KEY[k]?.colorToken ?? "misc";

  // categoryId, if supplied per-row, must also belong to this user — resolve once against the same set.
  const ownedCategoryIds = new Set(cats.map((c) => c.id));

  let added = 0, merged = 0, skipped = 0;
  for (const r of body.rows) {
    const action = r.action || (r.dedupStatus === "DUPLICATE" ? "MERGE" : "ADD");
    if (action === "SKIP") { skipped++; continue; }
    const categoryId = (r.categoryId && ownedCategoryIds.has(r.categoryId) ? r.categoryId : null) || catByColor.get(keyToColor(r.categoryKey)) || null;

    if (action === "MERGE" && r.dedupMatchId) {
      const result = await prisma.transaction.updateMany({
        where: { id: r.dedupMatchId, userId },
        data: {
          source: "MANUAL_IMPORT",
          externalRef: r.externalRef ?? undefined,
          rawNarration: r.narration ?? undefined,
          merchantName: r.merchantName ?? undefined,
          isReviewed: true,
        },
      });
      if (result.count > 0) merged++;
      else skipped++;
      continue;
    }

    await prisma.transaction.create({
      data: {
        userId,
        accountId: body.accountId,
        amount: r.amount,
        direction: r.direction,
        categoryId,
        merchantName: r.merchantName,
        paymentRail: r.rail,
        externalRef: r.externalRef,
        rawNarration: r.narration,
        txnDatetime: new Date(r.date),
        source: "IMPORT",
        confidence: r.confidence ?? 0.7,
        isReviewed: !r.needsReview,
      },
    });
    added++;
  }

  await prisma.importBatch.create({
    data: {
      userId,
      accountId: body.accountId,
      sourceFormat: (body.fileName || "").toLowerCase().endsWith(".csv") ? "CSV" : "XLSX",
      fileName: body.fileName || "import",
      rowCount: added + merged,
      tieOutStatus: body.tieOutStatus || "NA",
      status: "COMMITTED",
    },
  });

  return NextResponse.json({ ok: true, added, merged, skipped });
}
