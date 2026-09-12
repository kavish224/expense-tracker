// Live Gmail polling adapter (FSD 3.3b). Uses Google's official Node clients
// (@googleapis/gmail + google-auth-library) rather than hand-rolled REST calls —
// correctly handles auth, retries, and API edge cases.
//
// Auth: the in-app "Connect Gmail" flow (Settings → /api/gmail/oauth/start + callback)
// produces a refresh token, stored encrypted on User.gmailRefreshToken, which
// OAuth2Client exchanges for short-lived access tokens as needed. Same flow in local
// dev and production — only the callback's registered redirect URI differs per origin.
// Scope is read-only (gmail.readonly) — the poller never writes anything back to Gmail.
//
// Dedup: since we can't write a "processed" label back to Gmail under a read-only
// scope, processed message IDs are tracked in our own DB (GmailProcessedMessage)
// instead.
import { gmail_v1, gmail, auth } from "@googleapis/gmail";
import { convert as convertHtmlToText } from "html-to-text";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { parseAlertEmail } from "@/lib/email/parse";
import { parseAlertEmailWithLLM } from "@/lib/llm/email-adapter";
import { createTransactionFromAlert } from "@/lib/email/ingest";
import { decryptSecret } from "@/lib/crypto";

// Client id/secret identify our app to Google and never expire — only the
// per-user refresh token (stored on User.gmailRefreshToken, set via the
// /api/gmail/oauth connect flow) can go stale, which is handled per-poll below.
export function isGmailEnabled(): boolean {
  return !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
}

function oauthClient() {
  return new auth.OAuth2({
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
  });
}

function isInvalidGrantError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("invalid_grant");
}

// Forces a token refresh up front (rather than lazily on the first Gmail API
// call) so an expired/revoked refresh token surfaces here as invalid_grant,
// where the caller can mark the user for reconnect, instead of failing deep
// inside the per-message loop.
async function getClient(refreshToken: string): Promise<gmail_v1.Gmail> {
  const oauth2Client = oauthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  await oauth2Client.getAccessToken();
  return gmail({ version: "v1", auth: oauth2Client });
}

// Read-only — the poller never writes anything back to Gmail. Dedup (avoiding
// reprocessing the same email) is tracked in our own DB instead of a Gmail label.
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// Drives the in-app "Connect Gmail" button (app/api/gmail/oauth/start + callback) —
// the same code path in local dev and production, the redirect URI just needs
// registering once per origin in the Google Cloud OAuth client.
export function getGmailAuthUrl(redirectUri: string, state: string): string {
  const oauth2Client = oauthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline", // required to get a refresh_token
    prompt: "consent", // forces a refresh_token even for a user who granted before
    scope: [GMAIL_SCOPE],
    redirect_uri: redirectUri,
    state,
  });
}

// Stateless CSRF protection for the OAuth redirect (RFC 6749 §10.12): the `state`
// param is an HMAC-signed, time-boxed token binding the callback back to the user
// and browser session that started it — signed with a key derived from
// CLERK_SECRET_KEY rather than requiring a session store, since Vercel Functions
// are stateless between invocations.
const STATE_TTL_MS = 10 * 60_000;

function stateKey(): Buffer {
  const root = process.env.CLERK_SECRET_KEY;
  if (!root) throw new Error("CLERK_SECRET_KEY is required (used as key-derivation root)");
  return createHmac("sha256", root).update("gmail-oauth-state-v1").digest();
}

export function signOAuthState(userId: string): string {
  const payload = JSON.stringify({ uid: userId, ts: Date.now(), nonce: randomBytes(8).toString("hex") });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", stateKey()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyOAuthState(state: string | null, expectedUserId: string): boolean {
  if (!state) return false;
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return false;
  const expectedSig = createHmac("sha256", stateKey()).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const { uid, ts } = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    return uid === expectedUserId && Date.now() - ts <= STATE_TTL_MS;
  } catch {
    return false;
  }
}

export async function exchangeGmailCode(code: string, redirectUri: string): Promise<{ refreshToken: string; email: string | null }> {
  const oauth2Client = oauthClient();
  const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri });
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token — revoke access at https://myaccount.google.com/permissions and try connecting again");
  }
  oauth2Client.setCredentials(tokens);
  const client = gmail({ version: "v1", auth: oauth2Client });
  const { data } = await client.users.getProfile({ userId: "me" });
  return { refreshToken: tokens.refresh_token, email: data.emailAddress ?? null };
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  // html-to-text properly discards <style>/<script>, Outlook/Word MSO conditional
  // comments and VML markup, and other structural noise that a hand-rolled
  // "<[^>]+>" tag strip lets straight through as visible text — real MSO-generated
  // marketing HTML previously leaked raw VML tag soup into parsed narrations.
  return convertHtmlToText(html, { wordwrap: false }).replace(/\s+/g, " ").trim();
}

// Some senders' MIME messages are malformed: the text/plain part is itself a copy of
// the HTML source rather than real plain text (seen in practice from at least one
// marketing sender). Detect that case by tag density rather than trusting the
// declared MIME type, so it still gets routed through the HTML converter.
function looksLikeHtml(text: string): boolean {
  const tagMatches = text.match(/<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?>/gi);
  return !!tagMatches && tagMatches.length >= 3;
}

// Gmail messages are MIME trees; walk parts depth-first, preferring text/plain and
// falling back to text/html (stripped) if that's all the sender provided.
function extractBody(payload?: gmail_v1.Schema$MessagePart): string {
  let plain = "";
  let html = "";
  function walk(part?: gmail_v1.Schema$MessagePart) {
    if (!part) return;
    const mime = part.mimeType || "";
    if (mime === "text/plain" && part.body?.data) plain += decodeBase64Url(part.body.data);
    else if (mime === "text/html" && part.body?.data) html += decodeBase64Url(part.body.data);
    for (const p of part.parts || []) walk(p);
  }
  walk(payload);
  if (plain.trim()) return looksLikeHtml(plain) ? stripHtml(plain) : plain;
  if (html.trim()) return stripHtml(html);
  return "";
}

function headerValue(payload: gmail_v1.Schema$MessagePart | undefined, name: string): string {
  const h = (payload?.headers || []).find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

export interface PollResult {
  scanned: number;
  created: number;
  resolvedViaLlm: number;
  skippedNoMatch: number;
  skippedNoAccount: number;
  skippedDuplicate: number;
  skippedAlreadyProcessed: number;
  errored: number;
}

export interface PollOptions {
  /** Full override of the Gmail search query (also settable via GMAIL_SEARCH_QUERY). */
  query?: string;
  /** Convenience: restricts the default query to `after:YYYY/MM/DD` — e.g. for a one-off backfill. */
  afterDate?: string;
  /** Safety cap on how many messages a single poll call will read (across all pages). Default 300. */
  maxMessages?: number;
}

const DEFAULT_KEYWORDS =
  '(debited OR credited OR spent OR paid OR withdrawn OR purchased OR "auto debited" OR "auto-debited" OR "payment successful" OR "transaction alert" OR UPI OR NEFT OR RTGS OR IMPS OR POS)';

/**
 * Poll Gmail for bank-alert emails matching the query, parse each one (regex
 * first, LLM fallback if enabled and regex misses), and create pending
 * transactions for whichever ones look like real alerts. Every scanned message
 * is recorded in GmailProcessedMessage regardless of outcome, so it's never
 * re-scanned. `messages.list` results are paginated (maxResults is a page size,
 * not a total cap — https://developers.google.com/workspace/gmail/api/guides/list-messages)
 * and followed via nextPageToken up to `maxMessages`.
 */
export async function pollGmailForAlerts(opts: PollOptions = {}): Promise<PollResult> {
  if (!isGmailEnabled()) throw new Error("Gmail polling is not configured");

  const targetEmail = process.env.GMAIL_TARGET_USER_EMAIL;
  const user = targetEmail
    ? await prisma.user.findUnique({ where: { email: targetEmail } })
    : (await prisma.user.findFirst({ where: { gmailRefreshToken: { not: null } } })) ?? (await prisma.user.findFirst());
  if (!user) throw new Error("No user found to attribute Gmail-ingested transactions to");

  // The Connect Gmail flow (Settings → /api/gmail/oauth/*) is the single source of
  // truth for this token in every environment — no env-var fallback, so local dev
  // and prod behave identically.
  if (!user.gmailRefreshToken) {
    throw new Error(`Gmail is not connected for ${user.email} — connect it from Settings`);
  }

  let client: gmail_v1.Gmail;
  try {
    client = await getClient(decryptSecret(user.gmailRefreshToken));
  } catch (err: unknown) {
    if (isInvalidGrantError(err)) {
      await prisma.user.update({ where: { id: user.id }, data: { gmailRefreshToken: null, gmailNeedsReconnect: true } });
      throw new Error(`Gmail access for ${user.email} was revoked or expired — reconnect it from Settings`);
    }
    throw err;
  }

  const query =
    opts.query ||
    process.env.GMAIL_SEARCH_QUERY ||
    `${opts.afterDate ? `after:${opts.afterDate.replace(/-/g, "/")}` : "newer_than:30d"} ${DEFAULT_KEYWORDS}`;
  const maxMessages = opts.maxMessages ?? 300;

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const { data: listData } = await client.users.messages.list({
      userId: "me", q: query, maxResults: 100, pageToken,
    });
    for (const m of listData.messages || []) if (m.id) ids.push(m.id);
    pageToken = listData.nextPageToken ?? undefined;
  } while (pageToken && ids.length < maxMessages);
  // Gmail's list pagination can return the same id across adjacent pages (e.g. if
  // the mailbox's result ordering shifts between page fetches) — dedup before
  // processing so a repeat id is never fully re-fetched/re-parsed/re-LLM'd, only to
  // fail with a unique-constraint error when it tries to record itself processed twice.
  const cappedIds = [...new Set(ids)].slice(0, maxMessages);

  const result: PollResult = { scanned: 0, created: 0, resolvedViaLlm: 0, skippedNoMatch: 0, skippedNoAccount: 0, skippedDuplicate: 0, skippedAlreadyProcessed: 0, errored: 0 };
  if (cappedIds.length === 0) return result;

  const already = await prisma.gmailProcessedMessage.findMany({
    where: { messageId: { in: cappedIds } },
    select: { messageId: true },
  });
  const alreadySet = new Set(already.map((a) => a.messageId));

  for (const id of cappedIds) {
    if (alreadySet.has(id)) {
      result.skippedAlreadyProcessed++;
      continue;
    }
    result.scanned++;
    // Isolate each message: one failed Gmail API call or parse error shouldn't
    // abort the rest of the batch, and a message that errors before being marked
    // processed will simply be retried on the next poll (safe — createTransactionFromAlert
    // is dedup-guarded against reprocessing the same alert twice).
    try {
      const { data: full } = await client.users.messages.get({ userId: "me", id, format: "full" });
      const sender = headerValue(full.payload, "From");
      const subject = headerValue(full.payload, "Subject");
      const body = extractBody(full.payload);

      // List-Unsubscribe is a bulk/marketing-mail signal (RFC 2369) that legitimate
      // transactional bank/card alerts essentially never carry — skip parsing
      // entirely for these (both the deterministic regex path and the LLM fallback)
      // rather than trusting either one to never misfire on a promotional email.
      // Found via a real false positive: an HDFC marketing banner email (sent from
      // a bulk-mail ESP domain, not the bank) got parsed as a ₹20,000 credit purely
      // from incidental "credited"-adjacent promo copy.
      //
      // A tighter, header-independent link-density check was tried here too (reject
      // when a body has several "[https://...]" link renderings) to catch the same
      // false-positive class when List-Unsubscribe is absent — but real bank alerts'
      // own footer disclaimers (block-card/report-fraud/set-pin links) routinely hit
      // 3+ links themselves, so it rejected the vast majority of genuine alerts
      // (measured: created transactions dropped from 161 to 2 in a live re-run).
      // Reverted — the user's workflow already does a nightly manual review pass, so
      // an occasional marketing false positive is a much cheaper mistake than
      // silently losing most of a day's real capture.
      const isBulkMail = !!headerValue(full.payload, "List-Unsubscribe");

      let alert = isBulkMail ? null : parseAlertEmail(body, subject, sender);
      if (!alert && !isBulkMail) {
        alert = await parseAlertEmailWithLLM(body, subject, sender);
        if (alert) result.resolvedViaLlm++;
      }
      if (alert) {
        const created = await createTransactionFromAlert(user.id, alert, body);
        if (created.ok) result.created++;
        else if (created.reason === "duplicate") result.skippedDuplicate++;
        else result.skippedNoAccount++;
      } else {
        result.skippedNoMatch++;
      }

      // Always record on success, even on no-match — otherwise a permanently-unparseable
      // email would be re-fetched and re-attempted on every single poll forever. `upsert`
      // rather than `create`: two overlapping poll invocations (e.g. a manual trigger
      // racing the cron) could both reach this id past the in-memory dedup above — that's
      // a legitimate "already recorded" outcome, not an error worth counting/logging.
      await prisma.gmailProcessedMessage.upsert({ where: { messageId: id }, create: { messageId: id }, update: {} });
    } catch (err) {
      result.errored++;
      console.error(`Gmail poll: failed to process message ${id}:`, err);
    }
  }
  return result;
}
