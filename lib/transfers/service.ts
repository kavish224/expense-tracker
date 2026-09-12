import { prisma } from "@/lib/db";
import { detectTransferPairs, type CandidateTxn, type TransferMatch } from "./detect";

const LEDGER_TYPES = ["BANK", "CASH", "CREDIT_CARD"] as const;

async function candidatePool(userId: string): Promise<CandidateTxn[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      kind: "EXPENSE",
      transferIgnored: false,
      account: { type: { in: [...LEDGER_TYPES] } },
    },
    select: {
      id: true,
      accountId: true,
      direction: true,
      amount: true,
      txnDatetime: true,
      merchantName: true,
      rawNarration: true,
      account: { select: { name: true } },
    },
    orderBy: { txnDatetime: "desc" },
    take: 2000,
  });
  return rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    accountName: r.account.name,
    direction: r.direction as "DEBIT" | "CREDIT",
    amount: Number(r.amount),
    txnDatetime: r.txnDatetime,
    merchantName: r.merchantName,
    rawNarration: r.rawNarration,
  }));
}

export async function getSuggestions(userId: string): Promise<TransferMatch[]> {
  const pool = await candidatePool(userId);
  return detectTransferPairs(pool);
}

/** Confirms a suggested pair as a real transfer. Per the existing net-worth
 * convention (lib/networth/service.ts), a transfer is represented as ONE row —
 * the outflow leg, marked kind:TRANSFER with transferAccountId pointing at the
 * destination. The inflow leg would otherwise double-record the same money
 * movement, so it's deleted once the pair is linked. */
export async function confirmTransfer(userId: string, debitId: string, creditId: string) {
  const [debit, credit] = await Promise.all([
    prisma.transaction.findFirst({ where: { id: debitId, userId, direction: "DEBIT" } }),
    prisma.transaction.findFirst({ where: { id: creditId, userId, direction: "CREDIT" } }),
  ]);
  if (!debit || !credit) throw new Error("Transaction not found");
  if (debit.accountId === credit.accountId) throw new Error("Both legs are on the same account");

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: debit.id },
      data: { kind: "TRANSFER", transferAccountId: credit.accountId },
    }),
    prisma.transaction.delete({ where: { id: credit.id } }),
  ]);
}

/** Marks a suggested pair as "not a transfer" so it stops being suggested. */
export async function dismissPair(userId: string, debitId: string, creditId: string) {
  await prisma.transaction.updateMany({
    where: { id: { in: [debitId, creditId] }, userId },
    data: { transferIgnored: true },
  });
}

export interface SettlementEntry {
  id: string;
  amount: number;
  txnDatetime: Date;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  note: string | null;
}

export async function listSettlements(userId: string): Promise<SettlementEntry[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, kind: "TRANSFER", transferAccountId: { not: null } },
    select: {
      id: true,
      amount: true,
      txnDatetime: true,
      accountId: true,
      transferAccountId: true,
      merchantName: true,
      rawNarration: true,
      account: { select: { name: true } },
      transferAccount: { select: { name: true } },
    },
    orderBy: { txnDatetime: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    txnDatetime: r.txnDatetime,
    fromAccountId: r.accountId,
    fromAccountName: r.account.name,
    toAccountId: r.transferAccountId!,
    toAccountName: r.transferAccount?.name ?? "Unknown",
    note: r.merchantName ?? r.rawNarration,
  }));
}
