import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Accepts either INGEST_TOKEN (manual/local testing) or CRON_SECRET (sent as
// `Authorization: Bearer $CRON_SECRET` by Vercel Cron, or forwarded the same way by a
// QStash schedule's Upstash-Forward-Authorization header) — same endpoint, either
// legitimate scheduler/caller.
export function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!provided) return false;
  const ingestToken = process.env.INGEST_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  if (ingestToken && tokenMatches(provided, ingestToken)) return true;
  if (cronSecret && tokenMatches(provided, cronSecret)) return true;
  return false;
}
