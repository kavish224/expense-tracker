import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";
import { assertOwnedCategory } from "@/lib/ownership";

const bodySchema = z.object({
  merchantName: z.string().trim().min(1).max(200),
  categoryId: z.string(),
  applyToPast: z.boolean().optional(),
});

// Creates (or re-points, if one already exists for this merchant) a MERCHANT_CONTAINS
// rule so future categorization — email ingest, CSV/XLSX import — picks it up automatically.
// Optionally backfills past transactions from the same merchant that are still
// uncategorized/misc, so teaching the app once fixes the whole history at once.
export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid rule" }, { status: 400 });
  const { merchantName, categoryId, applyToPast } = parsed.data;

  if (!(await assertOwnedCategory(userId, categoryId))) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const matchValue = merchantName.toLowerCase();
  const existing = await prisma.rule.findFirst({ where: { userId, matchType: "MERCHANT_CONTAINS", matchValue } });
  const rule = existing
    ? await prisma.rule.update({ where: { id: existing.id }, data: { setCategoryId: categoryId, priority: Date.now() } })
    : await prisma.rule.create({ data: { userId, matchType: "MERCHANT_CONTAINS", matchValue, setCategoryId: categoryId, priority: Date.now() } });

  let updated = 0;
  if (applyToPast) {
    const result = await prisma.transaction.updateMany({
      where: {
        userId,
        merchantName: { contains: matchValue, mode: "insensitive" },
        OR: [{ categoryId: null }, { category: { colorToken: "misc" } }],
      },
      data: { categoryId },
    });
    updated = result.count;
  }

  return NextResponse.json({ rule, updated });
}

export async function GET() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rules = await prisma.rule.findMany({ where: { userId }, orderBy: { priority: "desc" } });
  return NextResponse.json({ rules });
}
