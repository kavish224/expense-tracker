import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isGmailEnabled, pollGmailForAlerts } from "@/lib/email/gmail";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { notifyError } from "@/lib/whatsapp";

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Accepts either INGEST_TOKEN (manual/local testing) or CRON_SECRET (the value Vercel
// Cron sends as `Authorization: Bearer $CRON_SECRET` when it invokes this route on a
// schedule) — same endpoint, two legitimate callers.
function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!provided) return false;
  const ingestToken = process.env.INGEST_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  if (ingestToken && tokenMatches(provided, ingestToken)) return true;
  if (cronSecret && tokenMatches(provided, cronSecret)) return true;
  return false;
}

async function handle(req: NextRequest) {
  if (!isGmailEnabled()) return NextResponse.json({ error: "gmail not configured" }, { status: 503 });

  const ipLimit = await checkRateLimit(`gmail-poll:ip:${clientIp(req)}`, 10, 10 * 60_000);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSec);

  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Optional one-off overrides for a manual backfill (e.g. ?after=2026-07-01&max=1000);
  // Cron's default GET call carries neither, so steady-state polling is unaffected.
  const afterDate = req.nextUrl.searchParams.get("after") || undefined;
  if (afterDate && !/^\d{4}-\d{2}-\d{2}$/.test(afterDate)) {
    return NextResponse.json({ error: "after must be YYYY-MM-DD" }, { status: 400 });
  }
  const maxParam = req.nextUrl.searchParams.get("max");
  const maxMessages = maxParam ? Math.min(2000, Math.max(1, parseInt(maxParam, 10) || 0)) : undefined;

  try {
    const result = await pollGmailForAlerts({ afterDate, maxMessages });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Gmail poll failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    await notifyError("Gmail poll failed", message);
    return NextResponse.json({ error: "poll failed" }, { status: 502 });
  }
}

export const GET = handle; // Vercel Cron invokes with GET
export const POST = handle; // manual/local testing
