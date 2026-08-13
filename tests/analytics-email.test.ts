import { describe, test, expect } from "vitest";
import { kpis, byCategory, byAccount, dailySeries, recurring, periodRange, type TxnLite } from "@/lib/analytics/aggregate";
import { parseAlertEmail } from "@/lib/email/parse";
import { redact, validateGrounded, type RawLlmRow } from "@/lib/llm/adapter";
import { groundAlertOutput } from "@/lib/llm/email-adapter";

const txns: TxnLite[] = [
  { amount: 420, direction: "DEBIT", txnDatetime: new Date("2026-07-22"), categoryKey: "food", accountId: "a1", accountName: "HDFC RuPay", merchantName: "Swiggy" },
  { amount: 268, direction: "DEBIT", txnDatetime: new Date("2026-07-22"), categoryKey: "transport", accountId: "a2", accountName: "ICICI Amazon", merchantName: "Uber" },
  { amount: 649, direction: "DEBIT", txnDatetime: new Date("2026-06-20"), categoryKey: "bills", accountId: "a1", accountName: "HDFC RuPay", merchantName: "Netflix" },
  { amount: 649, direction: "DEBIT", txnDatetime: new Date("2026-07-20"), categoryKey: "bills", accountId: "a1", accountName: "HDFC RuPay", merchantName: "Netflix" },
  { amount: 184000, direction: "CREDIT", txnDatetime: new Date("2026-07-01"), categoryKey: "income", accountId: "b1", accountName: "HDFC Bank" },
];

describe("analytics", () => {
  test("kpis sum only debits", () => {
    const k = kpis(txns, 31);
    expect(k.totalSpent).toBe(420 + 268 + 649 + 649);
    expect(k.count).toBe(4);
    expect(k.topCategory?.key).toBe("bills");
  });
  test("byCategory sorted desc", () => {
    const c = byCategory(txns);
    expect(c[0].key).toBe("bills");
    expect(c[0].amount).toBe(1298);
  });
  test("byAccount groups spend", () => {
    const a = byAccount(txns);
    expect(a.find((x) => x.accountId === "a1")?.amount).toBe(420 + 649 + 649);
  });
  test("dailySeries fills gaps", () => {
    const s = dailySeries(txns, new Date("2026-07-20"), new Date("2026-07-22"));
    expect(s.length).toBe(3);
    expect(s[0].amount).toBe(649);
  });
  test("recurring detects Netflix monthly", () => {
    const r = recurring(txns);
    expect(r.find((x) => x.merchant === "Netflix")?.count).toBe(2);
  });
  test("periodRange month starts on the 1st", () => {
    const { start } = periodRange("month", new Date("2026-07-22"));
    expect(start.getDate()).toBe(1);
  });
});

describe("email parse + redaction", () => {
  test("parses HDFC-style debit alert", () => {
    const a = parseAlertEmail(
      "Rs.420.00 spent on your HDFC Bank Card ending 7788 at SWIGGY on 22-07-26 via UPI.",
      "Transaction Alert",
      "alerts@hdfcbank.net"
    );
    expect(a).not.toBeNull();
    expect(a!.amount).toBeCloseTo(420);
    expect(a!.direction).toBe("DEBIT");
    expect(a!.accountHint).toBe("7788");
    // The alert states "on 22-07-26" — the parser must use that, not the moment it
    // happens to be ingested at (regression test: previously always stamped `new Date()`).
    expect(a!.when.toISOString().slice(0, 10)).toBe("2026-07-22");
  });
  test("parses credit alert", () => {
    const a = parseAlertEmail("INR 184000 credited to your account.", "Salary");
    expect(a!.direction).toBe("CREDIT");
  });
  test("falls back to now when the alert states no date", () => {
    const before = Date.now();
    const a = parseAlertEmail("Rs.100.00 debited from your account.", "Alert");
    expect(a!.when.getTime()).toBeGreaterThanOrEqual(before);
  });

  // Regression tests from real alert emails seen via live Gmail polling — the
  // original regex (character class excluding @ / :, and independent whole-document
  // amount+keyword matching) misparsed every one of these in production.
  describe("real-world bank template regressions", () => {
    test("ICICI: extracts merchant from 'Info:' field, not credit-limit boilerplate", () => {
      const a = parseAlertEmail(
        "ICICI Bank Online Dear Customer, Your ICICI Bank Credit Card XX4003 has been used for a transaction of INR 336.00 on Jul 20, 2026 at 10:30:43. Info: AMAZON PAY WALLET LOAD. The Available Credit Limit on your card is INR 2,09,837.16 and Total Credit Limit is INR 2,60,000.00. The above limits are a total of the limits of all the Credit Cards issued to the primary card holder, including any supplementary cards."
      );
      expect(a).not.toBeNull();
      expect(a!.amount).toBeCloseTo(336);
      expect(a!.direction).toBe("DEBIT");
      expect(a!.merchantName).toBe("AMAZON PAY WALLET LOAD");
    });

    test("AU Bank: extracts merchant from 'UPI/NAME on DATE', even when the name itself contains 'on'", () => {
      const a = parseAlertEmail(
        "AU Small Finance Bank Dear Kavish, Namaskar! INR 137.00 were spent on your AU Bank Credit Card xx6579 at UPI/HIGH ON CHAI on 25-07-2026 at 07:38:27 pm. If the transaction was not done by you, please call 180012001500 immediately or SMS PBLOCK 6579 to 5676767."
      );
      expect(a).not.toBeNull();
      expect(a!.amount).toBeCloseTo(137);
      expect(a!.direction).toBe("DEBIT");
      expect(a!.merchantName).toBe("HIGH ON CHAI");
    });

    test("HDFC RuPay: extracts VPA merchant from 'Paid to', not the safety-footer boilerplate", () => {
      const a = parseAlertEmail(
        "HDFC BANK Dear Customer, Rs.328.00 has been debited from your RuPay Credit Card (ending 4284) Paid to swiggyinstamart@icici Date: 22-07-26 UPI Transaction Reference Number: 093358732693. If you did not make this transaction, please act immediately. Your safety and trust are very important to us. We're here to support you at every step."
      );
      expect(a).not.toBeNull();
      expect(a!.amount).toBeCloseTo(328);
      expect(a!.direction).toBe("DEBIT");
      expect(a!.merchantName).toBe("swiggyinstamart@icici");
    });

    test("rejects a promotional email that mentions an amount and 'spends' but isn't a transaction", () => {
      const a = parseAlertEmail(
        "Get rewarded on Travel, Gold, UPI and everyday spends. #Paytmkaro Redeem points as Gold 1 Reward Point = ₹1 Paytm Gold Lifetime free Zero joining & annual fee 12 free lounge visits Complimentary, every year"
      );
      expect(a).toBeNull();
    });

    test("rejects a loan-offer marketing email", () => {
      const a = parseAlertEmail(
        "Check eligible amount and rate details. To view this message in HTML format, click here: https://example.com/r/?id=abc"
      );
      expect(a).toBeNull();
    });

    // Regression: a real SBI Rewardz monthly e-statement (no actual transaction) got
    // misparsed as a ₹200 DEBIT — the first AMOUNT_DIRECTION_PATTERNS entry matches
    // "Rs.200 spent" regardless of the leading "per", so "2 Reward Points per Rs.200
    // spent* on SBI Debit Card at POS" (an earn-rate rule) satisfied it. Found by
    // cross-checking a backfilled transaction against the live source email in Gmail.
    test("rejects an amount that only appears in a reward-rate rule sentence", () => {
      const a = parseAlertEmail(
        "Here is your Reward Point E-Statement for the month of Jun 2026. SBI awards 2 Reward Points per Rs.200 spent* on SBI Debit Card at POS (Point of Sale) or online."
      );
      expect(a).toBeNull();
    });
  });
  test("redacts long account and card numbers", () => {
    const r = redact("A/c 123456789012 card 4455123412344455");
    expect(r).not.toContain("123456789012");
    expect(r).toContain("****");
  });

  test("redacts card numbers spaced or dashed, not just contiguous", () => {
    expect(redact("Card 4111 1111 1111 1111")).not.toContain("4111 1111 1111 1111");
    expect(redact("Card 4111-1111-1111-1111")).not.toContain("4111-1111-1111-1111");
  });

  test("redacts PAN with a stray internal space", () => {
    const r = redact("PAN ABCDE 1234F on file");
    expect(r).toContain("PAN****");
    expect(r).not.toContain("ABCDE 1234F");
  });

  test("redacts long account numbers broken up with spaces", () => {
    const r = redact("A/c 1234 5678 9012 debited");
    expect(r).not.toContain("1234 5678 9012");
    expect(r).toContain("****");
  });
});

describe("LLM grounding guard", () => {
  function row(overrides: Partial<RawLlmRow> = {}): RawLlmRow {
    return {
      sourceLine: 1, date: "22/07/2026", narration: "n", amount: 5000,
      direction: "DEBIT", merchantName: null, category: null, confidence: 0.9,
      ...overrides,
    };
  }

  test("accepts a row grounded in a real transaction line", () => {
    const lines = ["UPI debited Rs.5000.00 to swiggy@ybl on 22/07/2026"];
    const out = validateGrounded([row()], lines);
    expect(out).toHaveLength(1);
  });

  test("rejects a row whose amount only matches a balance/limit figure, not a transaction", () => {
    const lines = ["Avl Bal: 5000.00 as of 22/07/2026"];
    const out = validateGrounded([row()], lines);
    expect(out).toHaveLength(0);
  });

  test("rejects a row referencing a source line that doesn't exist", () => {
    const lines = ["UPI debited Rs.100.00 on 22/07/2026"];
    const out = validateGrounded([row({ sourceLine: 5, amount: 100 })], lines);
    expect(out).toHaveLength(0);
  });

  test("rejects a second row fabricated against an already-used source line", () => {
    const lines = ["UPI debited Rs.500.00 to swiggy@ybl on 22/07/2026"];
    const out = validateGrounded(
      [row({ amount: 500 }), row({ amount: 500, merchantName: "Fabricated" })],
      lines
    );
    expect(out).toHaveLength(1);
  });
});

describe("email LLM adapter grounding (groundAlertOutput)", () => {
  function output(overrides: Partial<Parameters<typeof groundAlertOutput>[0]> = {}) {
    return {
      isTransaction: true, amount: 336, direction: "DEBIT" as const, merchantName: "AMAZON PAY WALLET LOAD",
      accountHint: "4003", rail: "CARD" as const, dateText: "Jul 20, 2026",
      ...overrides,
    };
  }

  test("accepts a grounded, real transaction email", () => {
    const text = "Your ICICI Bank Credit Card XX4003 has been used for a transaction of INR 336.00 on Jul 20, 2026. Info: AMAZON PAY WALLET LOAD.";
    const r = groundAlertOutput(output(), text, "alerts@icicibank.com");
    expect(r).not.toBeNull();
    expect(r!.amount).toBe(336);
    expect(r!.direction).toBe("DEBIT");
  });

  test("rejects when the model itself says it's not a transaction", () => {
    const text = "Get rewarded on Travel, Gold, UPI and everyday spends of INR 336.";
    const r = groundAlertOutput(output({ isTransaction: false }), text, "promo@bank.com");
    expect(r).toBeNull();
  });

  test("rejects a hallucinated amount not present in the source text", () => {
    const text = "Your account was debited for a purchase today.";
    const r = groundAlertOutput(output({ amount: 999 }), text, "alerts@bank.com");
    expect(r).toBeNull();
  });

  test("rejects when the source text has no transaction keyword at all", () => {
    const text = "Your current balance is 336.00 as of today.";
    const r = groundAlertOutput(output(), text, "alerts@bank.com");
    expect(r).toBeNull();
  });

  test("falls back to now() when no date is grounded anywhere", () => {
    const text = "Rs.336.00 debited via UPI";
    const before = Date.now();
    const r = groundAlertOutput(output({ dateText: "not a real date" }), text, "alerts@bank.com");
    expect(r).not.toBeNull();
    expect(r!.when.getTime()).toBeGreaterThanOrEqual(before);
  });

  // Regression: a real marketing email (Outlook/MSO-generated HTML from a promo
  // sender) contained an unrelated "23.00" figure (e.g. a style dimension) far from
  // any of its incidental transaction-sounding words, and the model hallucinated a
  // ₹23 CREDIT transaction from it. A whole-document check ("does this doc contain
  // the amount, and separately, does it contain any txn keyword") passed even
  // though neither was actually describing a transaction. Requiring the keyword
  // near the amount rejects this.
  test("rejects when the amount and the transaction keyword are unrelated and far apart", () => {
    const text =
      "Win big prizes this festive season! ".repeat(10) +
      "Some unrelated dimension is 23.00 units wide. " +
      "Terms apply. ".repeat(10) +
      "This offer was credited to selected customers only, not a purchase.";
    const r = groundAlertOutput(output({ amount: 23 }), text, "promo@brand.com");
    expect(r).toBeNull();
  });

  test("still accepts when the keyword is adjacent to the amount despite a long email", () => {
    const text =
      "Dear Customer, ".repeat(5) +
      "Rs.336.00 was debited from your account for a transaction. " +
      "Thank you for banking with us. ".repeat(10);
    const r = groundAlertOutput(output(), text, "alerts@bank.com");
    expect(r).not.toBeNull();
    expect(r!.amount).toBe(336);
  });

  test("extracts a stable external ref (UTR) from the source text when present", () => {
    const text = "UPI: Rs.336.00 debited to AMAZON PAY WALLET LOAD. UPI Ref No 240112345678.";
    const r = groundAlertOutput(output(), text, "alerts@bank.com");
    expect(r).not.toBeNull();
    expect(r!.externalRef).toBe("240112345678");
  });

  // Regression: a real SBI Rewardz monthly e-statement (no actual transaction
  // anywhere in it) got parsed as a ₹200 DEBIT because its fine print reads "SBI
  // awards 2 Reward Points per Rs.200 spent* on SBI Debit Card at POS" — an
  // earn-rate rule, not a transaction record, but "200" + "POS" landed within the
  // proximity window together. Found by cross-checking a backfilled transaction
  // against the live source email in Gmail.
  test("rejects an amount grounded only in a reward-rate rule sentence", () => {
    const text =
      "Here is your Reward Point E-Statement for the month of Jun 2026. " +
      "Reward Point Summary - 01/06/2026 - 30/06/2026. Opening Balance 350. " +
      "SBI awards 2 Reward Points per Rs.200 spent* on SBI Debit Card at POS (Point of Sale) or online.";
    const r = groundAlertOutput(output({ amount: 200, dateText: "01/06/2026" }), text, "no-reply@alerts.sbi.bank.in");
    expect(r).toBeNull();
  });
});
