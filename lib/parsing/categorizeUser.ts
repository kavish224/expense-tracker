// DB-aware wrapper around the pure `categorize()` heuristic — loads a user's rules and
// category set once per request/ingestion pass (never per-row) and exposes both the
// categoryKey-space helpers the import/parse flow expects and a direct categoryId resolver
// for flows (email ingest) that write straight to a Transaction.
import { prisma } from "@/lib/db";
import { CATEGORY_BY_KEY } from "@/lib/constants";
import { categorize, type CategorizeResult, type RuleRecord } from "./categorize";
import { normalizeMerchant } from "./merchant";

// How far back to look for a user's own merchant history (majority-category
// learning + recurring/subscription detection) — recent enough to reflect current
// spending patterns, generous enough to catch monthly/quarterly recurrences.
const HISTORY_WINDOW_DAYS = 180;
// A repeat charge at least this many days after a prior one is treated as a
// distinct recurrence rather than the same transaction landing twice (dedup's
// job) or an unrelated same-day double-charge.
const RECURRING_MIN_GAP_DAYS = 18;
// How close two amounts must be to count as "the same" recurring charge —
// generous enough to absorb small subscription price bumps/taxes.
const RECURRING_AMOUNT_TOLERANCE = 0.05;

interface MerchantHistoryEntry { amount: number; date: Date }

export interface CategorizationContext {
  rules: RuleRecord[];
  categoryIdToKey: Map<string, string>;
  categoryIdByColorToken: Map<string, string>;
  merchantMajority: Map<string, string>;
  recentByMerchant: Map<string, MerchantHistoryEntry[]>;
}

export async function loadCategorizationContext(userId: string): Promise<CategorizationContext> {
  const since = new Date();
  since.setDate(since.getDate() - HISTORY_WINDOW_DAYS);
  const [rules, cats, history] = await Promise.all([
    prisma.rule.findMany({ where: { userId, setCategoryId: { not: null } } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, isReviewed: true, merchantName: { not: null }, txnDatetime: { gte: since } },
      select: { merchantName: true, categoryId: true, amount: true, txnDatetime: true },
      orderBy: { txnDatetime: "desc" },
      take: 1000,
    }),
  ]);
  const colorTokenToKey = new Map(Object.values(CATEGORY_BY_KEY).map((c) => [c.colorToken, c.key]));
  const categoryIdToKey = new Map(cats.map((c) => [c.id, colorTokenToKey.get(c.colorToken) ?? "misc"]));
  const categoryIdByColorToken = new Map(cats.map((c) => [c.colorToken, c.id]));

  // Group past confirmed transactions by normalized merchant, tallying category
  // counts (for majority-vote learning) and keeping amount/date (for recurring
  // detection) — one pass over the same history query serves both features.
  const counts = new Map<string, Map<string, number>>();
  const recentByMerchant = new Map<string, MerchantHistoryEntry[]>();
  for (const t of history) {
    const key = normalizeMerchant(t.merchantName).toLowerCase();
    const catKey = t.categoryId ? categoryIdToKey.get(t.categoryId) : undefined;
    if (catKey) {
      const perCat = counts.get(key) ?? new Map<string, number>();
      perCat.set(catKey, (perCat.get(catKey) ?? 0) + 1);
      counts.set(key, perCat);
    }
    const entries = recentByMerchant.get(key) ?? [];
    entries.push({ amount: Number(t.amount), date: t.txnDatetime });
    recentByMerchant.set(key, entries);
  }
  // Only trust a merchant's history once it's been confirmed at least twice —
  // a single past transaction is one data point, not a pattern.
  const merchantMajority = new Map<string, string>();
  for (const [key, perCat] of counts) {
    const total = [...perCat.values()].reduce((a, b) => a + b, 0);
    if (total < 2) continue;
    const [topKey] = [...perCat.entries()].sort((a, b) => b[1] - a[1])[0];
    merchantMajority.set(key, topKey);
  }

  return {
    rules: rules.map((r) => ({ matchType: r.matchType, matchValue: r.matchValue, setCategoryId: r.setCategoryId as string, priority: r.priority })),
    categoryIdToKey,
    categoryIdByColorToken,
    merchantMajority,
    recentByMerchant,
  };
}

// True when this merchant+amount pair matches a prior confirmed transaction from
// at least RECURRING_MIN_GAP_DAYS ago — the signature of a recurring subscription
// or bill (Netflix, rent, gym) rather than a one-off purchase that happens to
// share a merchant. Used to boost confidence on top of an already-decent category
// guess, not as a category source of its own.
export function isRecurring(ctx: CategorizationContext, merchantName: string | undefined, amount: number | undefined): boolean {
  if (!merchantName || amount == null) return false;
  const key = normalizeMerchant(merchantName).toLowerCase();
  const entries = ctx.recentByMerchant.get(key);
  if (!entries || entries.length === 0) return false;
  const now = Date.now();
  return entries.some((e) => {
    const gapDays = (now - e.date.getTime()) / 86_400_000;
    if (gapDays < RECURRING_MIN_GAP_DAYS) return false;
    const diff = Math.abs(e.amount - amount) / Math.max(e.amount, amount);
    return diff <= RECURRING_AMOUNT_TOLERANCE;
  });
}

export function categorizeInContext(
  ctx: CategorizationContext,
  input: { merchantName?: string; narration?: string; vpa?: string; amount?: number; accountId?: string }
): CategorizeResult {
  const base = categorize(input, ctx.rules, ctx.categoryIdToKey, ctx.merchantMajority);
  // A recognized recurring charge on top of an already-decent category guess
  // (merchant history or better) is confident enough to skip the review queue —
  // an unfamiliar/misc-fallback guess is not, even if the amount recurs, since
  // blindly auto-confirming an unknown merchant risks silently mis-tracking spend.
  if (base.confidence < 1 && base.confidence >= 0.75 && isRecurring(ctx, input.merchantName, input.amount)) {
    return { ...base, confidence: 1 };
  }
  return base;
}

export function categoryIdFor(ctx: CategorizationContext, result: CategorizeResult): string | null {
  const colorToken = CATEGORY_BY_KEY[result.categoryKey]?.colorToken ?? "misc";
  return ctx.categoryIdByColorToken.get(colorToken) ?? null;
}
