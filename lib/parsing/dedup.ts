// Duplicate detection across manual / email / import sources (FSD 3.1).
// Priority stack: exact ref → ref+amount tolerance → fuzzy(account+amount+date+name)
// → instrument+amount+date.

export interface DedupCandidate {
  amount: number;
  date: Date;
  accountId: string;
  externalRef?: string | null;
  instrumentHint?: string | null;
  merchantName?: string | null;
}

export interface DedupExisting extends DedupCandidate {
  id: string;
}

export type DedupStatus = "NEW" | "DUPLICATE" | "PROBABLE";

export interface DedupResult {
  status: DedupStatus;
  matchId?: string;
  reason?: string;
}

const FEE_BAND = 1.0; // ₹ tolerance to absorb small fees
const DAY = 86400000;

export function dedup(
  candidate: DedupCandidate,
  existing: DedupExisting[],
  opts: { dateWindowDays?: number; nameThreshold?: number } = {}
): DedupResult {
  const dateWindow = (opts.dateWindowDays ?? 3) * DAY;
  const nameThreshold = opts.nameThreshold ?? 0.6;

  // 1) exact external ref
  if (candidate.externalRef) {
    const hit = existing.find((e) => e.externalRef && e.externalRef === candidate.externalRef);
    if (hit) return { status: "DUPLICATE", matchId: hit.id, reason: "exact-ref" };
  }

  // 2) ref + amount within fee band
  if (candidate.externalRef) {
    const hit = existing.find(
      (e) => e.externalRef === candidate.externalRef && Math.abs(e.amount - candidate.amount) <= FEE_BAND
    );
    if (hit) return { status: "DUPLICATE", matchId: hit.id, reason: "ref+amount" };
  }

  // 3) fuzzy: same account + same amount + date window + name similarity
  const sameAcct = existing.filter(
    (e) =>
      e.accountId === candidate.accountId &&
      Math.abs(e.amount - candidate.amount) <= FEE_BAND &&
      Math.abs(e.date.getTime() - candidate.date.getTime()) <= dateWindow
  );
  for (const e of sameAcct) {
    const sim = nameSimilarity(candidate.merchantName || "", e.merchantName || "");
    if (sim >= nameThreshold) return { status: "PROBABLE", matchId: e.id, reason: "fuzzy-name" };
  }
  // amount+date match but names weak/absent → still probable (manual entries lack names)
  if (sameAcct.length > 0) return { status: "PROBABLE", matchId: sameAcct[0].id, reason: "amount+date" };

  // 4) instrument + amount + date
  if (candidate.instrumentHint) {
    const hit = existing.find(
      (e) =>
        e.instrumentHint === candidate.instrumentHint &&
        Math.abs(e.amount - candidate.amount) <= FEE_BAND &&
        Math.abs(e.date.getTime() - candidate.date.getTime()) <= dateWindow
    );
    if (hit) return { status: "PROBABLE", matchId: hit.id, reason: "instrument" };
  }

  return { status: "NEW" };
}

// Normalised token overlap (Dice-ish) for merchant names.
export function nameSimilarity(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  return (2 * inter) / (ta.size + tb.size);
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
