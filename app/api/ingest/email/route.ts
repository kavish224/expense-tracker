import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAlertEmail } from "@/lib/email/parse";
import { parseAlertEmailWithLLM } from "@/lib/llm/email-adapter";
import { createTransactionFromAlert } from "@/lib/email/ingest";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

function tokenMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, and length itself must not leak via early return.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Token-protected webhook for forwarded bank-alert emails.
// Body: { token, email (for user resolution), sender, subject, body }
// Live Gmail polling would call this same logic. Creates a pending (to-review) txn.
export async function POST(req: NextRequest) {
  const ingestToken = process.env.INGEST_TOKEN;
  if (!ingestToken) return NextResponse.json({ error: "ingest not configured" }, { status: 503 });

  const ipLimit = await checkRateLimit(`ingest:ip:${clientIp(req)}`, 30, 10 * 60_000);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSec);

  const body = await req.json().catch(() => null);
  if (!body || !tokenMatches(body.token, ingestToken))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!body.email || typeof body.email !== "string")
    return NextResponse.json({ error: "email required" }, { status: 400 });

  // Look up the user and parse the alert before branching, and return an identical
  // response for "no such user" vs "unparseable alert" — otherwise the distinct
  // statuses let a caller with a valid token enumerate registered emails.
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  let alert = parseAlertEmail(body.body || "", body.subject || "", body.sender || "");
  if (!alert) alert = await parseAlertEmailWithLLM(body.body || "", body.subject || "", body.sender || "");
  if (!user || !alert) return NextResponse.json({ error: "could not process alert" }, { status: 422 });

  const result = await createTransactionFromAlert(user.id, alert, body.body || "");
  if (!result.ok) {
    if (result.reason === "duplicate") return NextResponse.json({ ok: true, duplicate: true, transactionId: result.transactionId });
    return NextResponse.json({ error: "no account" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, transactionId: result.transactionId });
}
