// Shared "parsed alert -> pending transaction" logic, used by both the manual
// ingest webhook (POST /api/ingest/email) and the live Gmail poller — one place
// for account resolution, categorization, and transaction creation.
import { prisma } from "@/lib/db";
import { loadCategorizationContext, categorizeInContext, categoryIdFor } from "@/lib/parsing/categorizeUser";
import { dedup, type DedupExisting } from "@/lib/parsing/dedup";
import type { ParsedAlert } from "@/lib/email/parse";
import { notifyTransaction } from "@/lib/whatsapp";
import { verifyCategoryWithLLM } from "@/lib/llm/adapter";
import type { Account } from "@/generated/prisma/client";

export type IngestResult =
  | { ok: true; transactionId: string }
  | { ok: false; reason: "no-account" }
  | { ok: false; reason: "duplicate"; transactionId: string };

// Bidirectional substring match: the hint (e.g. "hdfcbank", from the sender's
// email domain) and the account's stored institution/name (e.g. "HDFC") are
// rarely the same string, and neither is reliably the longer one — an alert
// from "alerts@hdfcbank.com" should match an account named just "HDFC".
export function matchByHint(pool: Account[], hint: string | undefined): Account | undefined {
  if (!hint) return undefined;
  const exact = pool.find((a) => a.identifierHint === hint);
  if (exact) return exact;
  const h = hint.toLowerCase();
  return pool.find((a) => {
    const institution = a.institution?.toLowerCase();
    const name = a.name.toLowerCase();
    return (institution && (institution.includes(h) || h.includes(institution))) || name.includes(h) || h.includes(name);
  });
}

export async function createTransactionFromAlert(
  userId: string,
  alert: ParsedAlert,
  rawBody: string
): Promise<IngestResult> {
  // An email alert is, by construction, never a cash transaction (cash spends
  // have no email trail) — a CASH-type account is deliberately never used as
  // a fallback below, even if it's the user's only account, so an unmatched
  // alert surfaces as "no account" (visible, fixable in Settings) rather than
  // silently mislabeling every transaction as Cash.
  const accounts = await prisma.account.findMany({ where: { userId, isArchived: false } });
  const nonCashAccounts = accounts.filter((a) => a.type !== "CASH");
  const bankAccounts = nonCashAccounts.filter((a) => a.type === "BANK");
  const cardAccounts = nonCashAccounts.filter((a) => a.type === "CREDIT_CARD");

  let account: Account | undefined;
  let transferAccount: Account | undefined;

  if (alert.kind === "TRANSFER") {
    // A credit card bill payment leaves from a BANK account — prefer matching
    // the paying account there first, since accountHint on these alerts is
    // the paying bank, not the card. transferToHint (the card being paid) is
    // resolved separately, against card accounts specifically.
    account = matchByHint(bankAccounts, alert.accountHint) ?? bankAccounts[0];
    transferAccount = matchByHint(cardAccounts, alert.transferToHint);
  } else if (alert.creditCardFunded) {
    // RuPay-on-UPI: rail is UPI, but the funding account is the card, not a bank.
    account = matchByHint(cardAccounts, alert.accountHint) ?? matchByHint(nonCashAccounts, alert.accountHint);
  } else {
    account = matchByHint(nonCashAccounts, alert.accountHint);
  }
  if (!account) account = cardAccounts[0] ?? nonCashAccounts[0];
  if (!account) return { ok: false, reason: "no-account" };

  // A resent/double-forwarded alert (or a Gmail-poll retry racing its own
  // GmailProcessedMessage write) must not double-post the same transaction —
  // mirrors the dedup check the CSV import path already does.
  const existing = await prisma.transaction.findMany({
    where: { userId, accountId: account.id },
    select: { id: true, amount: true, txnDatetime: true, accountId: true, externalRef: true, instrumentHint: true, merchantName: true },
    orderBy: { txnDatetime: "desc" },
    take: 800,
  });
  const existingLite: DedupExisting[] = existing.map((e) => ({
    id: e.id, amount: Number(e.amount), date: e.txnDatetime, accountId: e.accountId,
    externalRef: e.externalRef, instrumentHint: e.instrumentHint, merchantName: e.merchantName,
  }));
  const dedupResult = dedup(
    { amount: alert.amount, date: alert.when, accountId: account.id, externalRef: alert.externalRef, merchantName: alert.merchantName },
    existingLite
  );
  // Unlike the CSV import flow (which surfaces PROBABLE matches to the user in an
  // interactive review step before committing), this path runs unattended — there's
  // no human in the loop to resolve an ambiguous match. Bank/wallet senders routinely
  // fire multiple alert emails for the same real transaction (an SMS-style alert plus
  // a statement notification, a debit alert plus an auto-debit confirmation, etc.), so
  // treating PROBABLE the same as DUPLICATE here trades a small risk of suppressing a
  // genuine same-day/same-amount repeat purchase for avoiding the much more likely and
  // much more disruptive outcome: silently multiplying every alert into several
  // duplicate transactions. Any genuinely missed transaction still surfaces when the
  // user reconciles against their real bank/card statement.
  if (dedupResult.status !== "NEW" && dedupResult.matchId) {
    return { ok: false, reason: "duplicate", transactionId: dedupResult.matchId };
  }

  const ctx = await loadCategorizationContext(userId);
  let cat = categorizeInContext(ctx, { merchantName: alert.merchantName, amount: alert.amount });
  // Deterministic pipeline (rules → merchant history → keywords) fell all the way
  // through to the generic misc fallback — worth a single LLM verification call
  // before this lands in the review queue, since email ingestion is unattended and
  // this is otherwise the transaction type most likely to sit uncategorized.
  if (cat.confidence < 0.5) {
    const verified = await verifyCategoryWithLLM({ merchantName: alert.merchantName, amount: alert.amount });
    if (verified) cat = verified;
  }
  const categoryId = categoryIdFor(ctx, cat);

  const txn = await prisma.transaction.create({
    data: {
      userId,
      accountId: account.id,
      kind: alert.kind,
      transferAccountId: transferAccount?.id,
      amount: alert.amount,
      direction: alert.direction,
      merchantName: alert.merchantName,
      categoryId,
      paymentRail: (alert.rail as any) || "OTHER",
      externalRef: alert.externalRef,
      txnDatetime: alert.when,
      source: "EMAIL",
      confidence: cat.confidence,
      // A matched rule (confidence 1) is a certainty the user already declared —
      // skip the review queue. Anything else from an unattended email alert still
      // needs a human glance before it counts toward spend.
      isReviewed: cat.confidence >= 1,
      rawNarration: rawBody.slice(0, 500),
    },
  });

  await notifyTransaction({
    merchantName: alert.merchantName,
    amount: alert.amount,
    direction: alert.direction,
    accountName: account.name,
    when: alert.when,
  });

  return { ok: true, transactionId: txn.id };
}
