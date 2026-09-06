import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorized } from "@/lib/cron-auth";
import { isWhatsAppEnabled, notifyDailySummary } from "@/lib/whatsapp";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// This app's primary market is IST (see lib/parsing/date.ts), so "yesterday" for the
// morning summary is computed against IST calendar days regardless of the server's
// own timezone, rather than UTC days.
function istYesterdayRange(): { start: Date; end: Date; label: string } {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const y = nowIst.getUTCFullYear();
  const m = nowIst.getUTCMonth();
  const d = nowIst.getUTCDate() - 1;
  const startIstMidnightAsUtc = Date.UTC(y, m, d, 0, 0, 0);
  const start = new Date(startIstMidnightAsUtc - IST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const label = new Date(startIstMidnightAsUtc).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return { start, end, label };
}

async function handle(req: NextRequest) {
  if (!isWhatsAppEnabled()) return NextResponse.json({ error: "whatsapp not configured" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const targetEmail = process.env.GMAIL_TARGET_USER_EMAIL;
  const user = targetEmail ? await prisma.user.findUnique({ where: { email: targetEmail } }) : await prisma.user.findFirst();
  if (!user) return NextResponse.json({ error: "no user found" }, { status: 404 });

  const { start, end, label } = istYesterdayRange();
  const txns = await prisma.transaction.findMany({
    where: { userId: user.id, direction: "DEBIT", kind: "EXPENSE", txnDatetime: { gte: start, lt: end } },
    select: { amount: true, merchantName: true },
  });

  const totalSpent = txns.reduce((sum, t) => sum + Number(t.amount), 0);
  const byMerchant = new Map<string, number>();
  for (const t of txns) {
    const key = t.merchantName || "Unknown";
    byMerchant.set(key, (byMerchant.get(key) || 0) + Number(t.amount));
  }
  const topMerchant = [...byMerchant.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  await notifyDailySummary({ dateLabel: label, totalSpent, count: txns.length, topMerchant });

  return NextResponse.json({ ok: true, dateLabel: label, totalSpent, count: txns.length, topMerchant });
}

export const GET = handle; // Vercel Cron invokes with GET
export const POST = handle; // manual/local testing
