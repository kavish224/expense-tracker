// Shared transaction serializer (Decimal-safe → plain JSON for the client).
import { normalizeMerchant } from "@/lib/parsing/merchant";

export function serializeTxn(t: any) {
  return {
    id: t.id,
    amount: Number(t.amount),
    direction: t.direction,
    kind: t.kind,
    txnDatetime: t.txnDatetime,
    // Stored merchantName is deliberately kept raw (see lib/parsing/merchant.ts) for
    // reconciliation against the original statement — normalized only here, at display
    // time, same as lib/analytics/service.ts. Null/empty stays as-is so callers' "—"
    // fallback for a missing merchant still applies (normalizeMerchant("") would
    // otherwise turn every unnamed transaction into the literal string "Unknown").
    merchantName: t.merchantName ? normalizeMerchant(t.merchantName) : t.merchantName,
    note: t.note,
    paymentRail: t.paymentRail,
    source: t.source,
    isReviewed: t.isReviewed,
    confidence: t.confidence,
    rawNarration: t.rawNarration,
    account: t.account ? { id: t.account.id, name: t.account.name, colorToken: t.account.colorToken, type: t.account.type } : null,
    category: t.category ? { id: t.category.id, name: t.category.name, colorToken: t.category.colorToken, icon: t.category.icon } : null,
    transferAccount: t.transferAccount ? { id: t.transferAccount.id, name: t.transferAccount.name } : null,
  };
}
