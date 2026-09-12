import { prisma } from "@/lib/db";

export interface InvestmentSummary {
  accountId: string;
  name: string;
  institution: string | null;
  colorToken: string;
  icon: string;
  invested: number; // total contributed in (bank -> platform)
  withdrawn: number; // total taken out (platform -> bank)
  netInvested: number; // invested - withdrawn (cost basis)
  currentValue: number; // manually-tracked market value (Account.currentBalance)
  gainLoss: number; // currentValue - netInvested
  gainLossPct: number | null;
}

export async function getInvestmentSummaries(userId: string): Promise<InvestmentSummary[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, type: "INVESTMENT", isArchived: false },
    orderBy: { createdAt: "asc" },
  });
  if (accounts.length === 0) return [];

  const flows = await prisma.transaction.groupBy({
    by: ["transferAccountId", "direction"],
    where: {
      userId,
      kind: "TRANSFER",
      transferAccountId: { in: accounts.map((a) => a.id) },
    },
    _sum: { amount: true },
  });

  const flowMap = new Map<string, { invested: number; withdrawn: number }>();
  for (const row of flows) {
    if (!row.transferAccountId) continue;
    const cur = flowMap.get(row.transferAccountId) || { invested: 0, withdrawn: 0 };
    const amt = Number(row._sum.amount ?? 0);
    // A DEBIT on the funding account moving money INTO the platform is a
    // contribution; a CREDIT on the funding account is money coming back OUT.
    if (row.direction === "DEBIT") cur.invested += amt;
    else cur.withdrawn += amt;
    flowMap.set(row.transferAccountId, cur);
  }

  return accounts.map((a) => {
    const f = flowMap.get(a.id) || { invested: 0, withdrawn: 0 };
    const netInvested = f.invested - f.withdrawn;
    const currentValue = Number(a.currentBalance ?? 0);
    const gainLoss = currentValue - netInvested;
    return {
      accountId: a.id,
      name: a.name,
      institution: a.institution,
      colorToken: a.colorToken,
      icon: a.icon,
      invested: f.invested,
      withdrawn: f.withdrawn,
      netInvested,
      currentValue,
      gainLoss,
      gainLossPct: netInvested > 0 ? (gainLoss / netInvested) * 100 : null,
    };
  });
}

export interface InvestmentFlowEntry {
  id: string;
  accountId: string; // investment platform
  accountName: string;
  fundingAccountId: string;
  fundingAccountName: string;
  direction: "CONTRIBUTION" | "WITHDRAWAL";
  amount: number;
  txnDatetime: Date;
  note: string | null;
}

export async function listInvestmentFlows(userId: string): Promise<InvestmentFlowEntry[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, kind: "TRANSFER", transferAccount: { type: "INVESTMENT" } },
    select: {
      id: true,
      amount: true,
      direction: true,
      txnDatetime: true,
      merchantName: true,
      rawNarration: true,
      accountId: true,
      transferAccountId: true,
      account: { select: { name: true } },
      transferAccount: { select: { name: true } },
    },
    orderBy: { txnDatetime: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    accountId: r.transferAccountId!,
    accountName: r.transferAccount!.name,
    fundingAccountId: r.accountId,
    fundingAccountName: r.account.name,
    direction: r.direction === "DEBIT" ? "CONTRIBUTION" : "WITHDRAWAL",
    amount: Number(r.amount),
    txnDatetime: r.txnDatetime,
    note: r.merchantName ?? r.rawNarration,
  }));
}

export async function createInvestmentFlow(
  userId: string,
  input: {
    investmentAccountId: string;
    fundingAccountId: string;
    direction: "CONTRIBUTION" | "WITHDRAWAL";
    amount: number;
    date: string;
    note?: string;
  }
) {
  const [investmentAccount, fundingAccount] = await Promise.all([
    prisma.account.findFirst({ where: { id: input.investmentAccountId, userId, type: "INVESTMENT" } }),
    prisma.account.findFirst({
      where: { id: input.fundingAccountId, userId, type: { in: ["BANK", "CASH", "CREDIT_CARD"] } },
    }),
  ]);
  if (!investmentAccount) throw new Error("Investment platform not found");
  if (!fundingAccount) throw new Error("Funding account not found");

  return prisma.transaction.create({
    data: {
      userId,
      accountId: fundingAccount.id,
      transferAccountId: investmentAccount.id,
      kind: "TRANSFER",
      direction: input.direction === "CONTRIBUTION" ? "DEBIT" : "CREDIT",
      amount: input.amount,
      txnDatetime: new Date(`${input.date}T00:00:00.000Z`),
      merchantName: input.note || `${input.direction === "CONTRIBUTION" ? "Investment in" : "Withdrawal from"} ${investmentAccount.name}`,
      source: "MANUAL",
      confidence: 1,
      isReviewed: true,
    },
  });
}
