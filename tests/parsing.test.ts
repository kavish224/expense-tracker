import { describe, test, expect } from "vitest";
import { parseNarration } from "@/lib/parsing/narration";
import { tieOut, type TieRow } from "@/lib/parsing/tieout";
import { dedup, nameSimilarity, type DedupExisting } from "@/lib/parsing/dedup";
import { categorize } from "@/lib/parsing/categorize";
import { normalizeMerchant } from "@/lib/parsing/merchant";
import { detectColumns, extractRow, looksLikeHeader } from "@/lib/parsing/columns";
import { extractDate } from "@/lib/parsing/date";

describe("parseNarration", () => {
  test("UPI with VPA + name + txn id", () => {
    const p = parseNarration("UPI/swiggy@ybl/SWIGGY BANGALORE/INV001/240112345678/SUCCESS");
    expect(p.rail).toBe("UPI");
    expect(p.vpa).toBe("swiggy@ybl");
    expect(p.counterparty?.toLowerCase()).toContain("swiggy");
    expect(p.externalRef).toBe("240112345678");
  });

  test("NEFT extracts UTR + IFSC", () => {
    const p = parseNarration("NEFT CR UTR HDFC24001234567890 FROM ABC PVT LTD IFSC HDFC0001234");
    expect(p.rail).toBe("NEFT");
    expect(p.externalRef).toMatch(/HDFC24001234567890/);
    expect(p.ifsc).toBe("HDFC0001234");
  });

  test("IMPS extracts 12-digit RRN", () => {
    const p = parseNarration("IMPS P2A RRN 230145678901 FROM JOHN DOE");
    expect(p.rail).toBe("IMPS");
    expect(p.externalRef).toBe("230145678901");
  });

  test("card POS flags rail CARD", () => {
    const p = parseNarration("POS/AMAZON IN/Mumbai RUPAY 7788");
    expect(p.rail).toBe("CARD");
  });

  test("detects refund + fee flags", () => {
    expect(parseNarration("UPI REFUND swiggy@ybl").refundFlag).toBe(true);
    expect(parseNarration("NEFT CHG 5.90").feesFlag).toBe(true);
  });

  test("OCR-confused RRN digits (O/I in place of 0/1) still extract cleanly", () => {
    const p = parseNarration("IMPS P2A RRN 23O145678I01 FROM JOHN DOE");
    expect(p.externalRef).toBe("230145678101");
  });

  test("OCR-confused UTR digits still extract cleanly", () => {
    const p = parseNarration("NEFT CR 24OI12345678I0I REF PAYMENT");
    expect(p.externalRef).toBe("240112345678101");
  });

  test("OCR-confused IFSC (O in place of the mandatory 0) still normalizes", () => {
    const p = parseNarration("NEFT CR UTR HDFC24001234567890 FROM ABC PVT LTD IFSC HDFCO001234");
    expect(p.ifsc).toBe("HDFC0001234");
  });

  test("OCR digit-fix does not corrupt real merchant names", () => {
    const p = parseNarration("UPI/blinkit@ybl/BLINKIT BANGALORE/INV001/240112345678/SUCCESS");
    expect(p.counterparty?.toLowerCase()).toContain("blinkit");
  });
});

describe("tieOut", () => {
  const rows: TieRow[] = [
    { index: 0, debit: 0, credit: 1000, balance: 2000 },
    { index: 1, debit: 300, credit: 0, balance: 1700 },
    { index: 2, debit: 200, credit: 0, balance: 1500 },
  ];
  test("balances when opening+credits-debits=closing", () => {
    const r = tieOut(rows, 1000, 1500);
    expect(r.balanced).toBe(true);
    expect(r.status).toBe("BALANCED");
    expect(r.offBy).toBe(0);
  });
  test("detects off-by and localises bad row via running balance", () => {
    const bad: TieRow[] = [
      { index: 0, debit: 0, credit: 1000, balance: 2000 },
      { index: 1, debit: 300, credit: 0, balance: 1600 }, // should be 1700
    ];
    const r = tieOut(bad, 1000, 1700);
    expect(r.balanced).toBe(false);
    expect(r.badRows).toContain(1);
  });
  test("card statement without balances → NA control-total", () => {
    const r = tieOut([{ index: 0, debit: 500, credit: 0 }], null, null);
    expect(r.status).toBe("NA");
  });
  test("exact tie-out over many rows — integer-paise summation avoids float drift", () => {
    const many: TieRow[] = Array.from({ length: 1000 }, (_, i) => ({ index: i, debit: 33.33, credit: 0 }));
    const r = tieOut(many, 100000, 100000 - 1000 * 33.33);
    expect(r.balanced).toBe(true);
    expect(r.offBy).toBe(0);
  });
});

describe("dedup", () => {
  const existing: DedupExisting[] = [
    { id: "a", amount: 420, date: new Date("2026-07-22T20:24:00Z"), accountId: "acc1", externalRef: "240112345678", merchantName: "Swiggy" },
    { id: "b", amount: 268, date: new Date("2026-07-22T18:02:00Z"), accountId: "acc1", merchantName: "Uber" },
  ];
  test("exact external ref → DUPLICATE", () => {
    const r = dedup({ amount: 420, date: new Date("2026-07-22T20:25:00Z"), accountId: "acc1", externalRef: "240112345678" }, existing);
    expect(r.status).toBe("DUPLICATE");
    expect(r.matchId).toBe("a");
  });
  test("manual (no ref) same amount+date+name → PROBABLE", () => {
    const r = dedup({ amount: 420, date: new Date("2026-07-22T21:00:00Z"), accountId: "acc1", merchantName: "SWIGGY" }, existing);
    expect(r.status).toBe("PROBABLE");
    expect(r.matchId).toBe("a");
  });
  test("different amount → NEW", () => {
    const r = dedup({ amount: 999, date: new Date("2026-07-22T21:00:00Z"), accountId: "acc1", merchantName: "Zomato" }, existing);
    expect(r.status).toBe("NEW");
  });
  test("name similarity", () => {
    expect(nameSimilarity("Swiggy", "SWIGGY")).toBe(1);
    expect(nameSimilarity("Amazon IN", "amazon")).toBeGreaterThan(0.5);
  });
});

describe("extractDate", () => {
  // Regression: ICICI's real alert template writes "on Jul 20, 2026 at 10:30:43" —
  // a comma-separated month-name date with no slash or dash. The original regex
  // only matched slash/dash-separated dates, so every ICICI alert silently fell
  // back to `new Date()` (the ingestion instant) instead of the real transaction
  // date — corrupting the stored date and breaking date-window dedup.
  test("extracts a 'Mon DD, YYYY' date (ICICI template)", () => {
    const d = extractDate("...has been used for a transaction of INR 336.00 on Jul 20, 2026 at 10:30:43.");
    expect(d?.toISOString().slice(0, 10)).toBe("2026-07-20");
  });
  test("extracts a 'DD Mon YYYY' date", () => {
    const d = extractDate("paid on 05 Jul 2026 via UPI");
    expect(d?.toISOString().slice(0, 10)).toBe("2026-07-05");
  });
  test("still extracts slash-separated dates", () => {
    const d = extractDate("debited on 22/07/2026");
    expect(d?.toISOString().slice(0, 10)).toBe("2026-07-22");
  });
  test("returns null when no date-shaped text is present", () => {
    expect(extractDate("no date in this text at all")).toBeNull();
  });
});

describe("categorize", () => {
  test("keyword heuristic maps swiggy → food", () => {
    expect(categorize({ merchantName: "Swiggy" }).categoryKey).toBe("food");
  });
  test("uber → transport", () => {
    expect(categorize({ narration: "UPI uber@paytm" }).categoryKey).toBe("transport");
  });
  test("unknown → misc low confidence", () => {
    const r = categorize({ merchantName: "Zzz Unknown" });
    expect(r.categoryKey).toBe("misc");
    expect(r.confidence).toBeLessThan(0.5);
  });
  test("rule beats heuristic", () => {
    const r = categorize(
      { merchantName: "Swiggy" },
      [{ matchType: "MERCHANT_CONTAINS", matchValue: "swiggy", setCategoryId: "cat_entertainment", priority: 10 }],
      new Map([["cat_entertainment", "entertainment"]])
    );
    expect(r.categoryKey).toBe("entertainment");
  });
  test("merchant history beats keyword heuristic but loses to a rule", () => {
    const history = new Map([["swiggy", "entertainment"]]);
    const r = categorize({ merchantName: "Swiggy" }, [], undefined, history);
    expect(r.categoryKey).toBe("entertainment");
    expect(r.confidence).toBe(0.75);
    const withRule = categorize(
      { merchantName: "Swiggy" },
      [{ matchType: "MERCHANT_CONTAINS", matchValue: "swiggy", setCategoryId: "cat_food", priority: 10 }],
      new Map([["cat_food", "food"]]),
      history
    );
    expect(withRule.categoryKey).toBe("food");
    expect(withRule.confidence).toBe(1);
  });
});

describe("normalizeMerchant", () => {
  test("strips UPI/rail prefixes and VPA handles before matching", () => {
    expect(normalizeMerchant("UPI-SWIGGY-9821XXXXXX@YBL")).toBe("Swiggy");
    expect(normalizeMerchant("POS AMAZON PAY INDIA PVT LTD")).toBe("Amazon");
  });
  test("cleans an unlisted merchant's noise instead of showing it raw", () => {
    expect(normalizeMerchant("UPI-JOHN DOE ENTERPRISES@OKHDFCBANK")).toBe("John Doe Enterprises");
  });
  test("strips trailing DR/CR markers", () => {
    expect(normalizeMerchant("SOME MERCHANT DR")).toBe("Some Merchant");
  });
});

describe("column detection", () => {
  test("maps common HDFC-style headers", () => {
    const header = ["Date", "Narration", "Withdrawal Amt", "Deposit Amt", "Closing Balance", "Ref No"];
    expect(looksLikeHeader(header)).toBe(true);
    const map = detectColumns(header);
    expect(map.date).toBe(0);
    expect(map.narration).toBe(1);
    expect(map.debit).toBe(2);
    expect(map.credit).toBe(3);
    expect(map.balance).toBe(4);
  });
  test("extractRow parses amounts with commas/₹", () => {
    const header = ["Date", "Narration", "Withdrawal Amt", "Deposit Amt", "Closing Balance"];
    const map = detectColumns(header);
    const row = extractRow(["22/07/2026", "UPI/swiggy@ybl", "₹1,299.00", "", "38,180.00"], map);
    expect(row.debit).toBeCloseTo(1299);
    expect(row.balance).toBeCloseTo(38180);
  });
});
