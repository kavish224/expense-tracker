// Rate limiter for the token-protected public webhooks (/api/ingest/email,
// /api/ingest/gmail/poll) — the only routes that aren't behind Clerk auth, so
// this is the actual brute-force defense on INGEST_TOKEN/CRON_SECRET guessing.
//
// Backed by Upstash Redis (KV_REST_API_URL/TOKEN, provisioned via the Vercel
// Marketplace) when configured, since Vercel serverless/edge invocations can
// land on any instance — an in-memory counter wouldn't actually enforce a
// shared limit there. Falls back to in-memory for local dev without Upstash
// configured, same gated-with-deterministic-fallback pattern as the LLM/Gmail
// adapters elsewhere in this app.
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? Redis.fromEnv() : null;

// One Ratelimit instance per distinct (limit, windowMs) pair — cheap to construct,
// but each keeps its own script-hash cache, so reuse rather than rebuild per call.
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let rl = limiters.get(cacheKey);
  if (!rl) {
    rl = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
      analytics: false,
      prefix: "expense-tracker:ratelimit",
    });
    limiters.set(cacheKey, rl);
  }
  return rl;
}

// In-memory fallback (local dev without Upstash configured).
type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of buckets) if (w.resetAt <= now) buckets.delete(key);
}, 60_000).unref?.();

function checkRateLimitInMemory(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  existing.count++;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  if (!redis) return checkRateLimitInMemory(key, limit, windowMs);
  const { success, reset } = await getLimiter(limit, windowMs).limit(key);
  return { allowed: success, retryAfterSec: success ? 0 : Math.max(0, Math.ceil((reset - Date.now()) / 1000)) };
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests, try again later" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
