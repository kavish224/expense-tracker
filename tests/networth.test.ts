import { describe, test, expect } from "vitest";
import { computeNetWorth, netWorthSeries, type AccountBalance } from "@/lib/networth/aggregate";

const acc = (over: Partial<AccountBalance>): AccountBalance => ({
  accountId: "a1", name: "Acc", type: "BANK", colorToken: "misc", icon: "🏦", balance: 0, ...over,
});

describe("net worth", () => {
  test("computeNetWorth sums assets and liabilities, netWorth = assets - liabilities", () => {
    const balances: AccountBalance[] = [
      acc({ accountId: "bank", name: "HDFC Bank", type: "BANK", balance: 50000 }),
      acc({ accountId: "mf", name: "Mutual Funds", type: "INVESTMENT", balance: 120000 }),
      acc({ accountId: "loan", name: "Car Loan", type: "LOAN", balance: 80000 }),
    ];
    const nw = computeNetWorth(balances);
    expect(nw.totalAssets).toBe(170000);
    expect(nw.totalLiabilities).toBe(80000);
    expect(nw.netWorth).toBe(90000);
    expect(nw.assets.map((a) => a.accountId).sort()).toEqual(["bank", "mf"]);
    expect(nw.liabilities.map((a) => a.accountId)).toEqual(["loan"]);
  });

  test("a credit card carrying debt (negative ledger balance) lands in liabilities without a type-based flag", () => {
    const balances: AccountBalance[] = [
      acc({ accountId: "cc", name: "HDFC RuPay", type: "CREDIT_CARD", balance: -4500 }),
      acc({ accountId: "cash", name: "Cash", type: "CASH", balance: 2000 }),
    ];
    const nw = computeNetWorth(balances);
    expect(nw.liabilities).toHaveLength(1);
    expect(nw.liabilities[0].accountId).toBe("cc");
    expect(nw.liabilities[0].contribution).toBe(-4500);
    expect(nw.netWorth).toBe(2000 - 4500);
  });

  test("a credit card in credit (overpaid) counts as an asset", () => {
    const balances: AccountBalance[] = [acc({ accountId: "cc", type: "CREDIT_CARD", balance: 300 })];
    const nw = computeNetWorth(balances);
    expect(nw.assets).toHaveLength(1);
    expect(nw.totalAssets).toBe(300);
  });

  test("LOAN balance is always entered positive and negated regardless of sign", () => {
    const balances: AccountBalance[] = [acc({ accountId: "loan", type: "LOAN", balance: -500 })];
    const nw = computeNetWorth(balances);
    expect(nw.liabilities[0].contribution).toBe(-500);
  });

  test("netWorthSeries sums a snapshot batch (same asOf instant) into one point", () => {
    const t1 = new Date("2026-08-01T10:00:00Z");
    const t2 = new Date("2026-08-15T10:00:00Z");
    const series = netWorthSeries([
      { accountType: "BANK", balance: 10000, asOf: t1 },
      { accountType: "INVESTMENT", balance: 5000, asOf: t1 },
      { accountType: "BANK", balance: 12000, asOf: t2 },
      { accountType: "LOAN", balance: 2000, asOf: t2 },
    ]);
    expect(series).toEqual([
      { date: t1.toISOString(), netWorth: 15000 },
      { date: t2.toISOString(), netWorth: 10000 },
    ]);
  });

  test("netWorthSeries keeps two same-day snapshot batches as distinct points", () => {
    const morning = new Date("2026-08-01T09:00:00Z");
    const evening = new Date("2026-08-01T21:00:00Z");
    const series = netWorthSeries([
      { accountType: "BANK", balance: 1000, asOf: morning },
      { accountType: "BANK", balance: 1500, asOf: evening },
    ]);
    expect(series).toHaveLength(2);
    expect(series.map((s) => s.netWorth)).toEqual([1000, 1500]);
  });
});
