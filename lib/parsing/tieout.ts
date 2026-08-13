// Balance tie-out verification — the reliability backbone (FSD 3.1).
// A statement that ties out is verified regardless of how rows were produced.

export interface TieRow {
  index: number;
  debit: number; // 0 if none
  credit: number; // 0 if none
  balance?: number; // running balance after the row, if the statement provides it
}

export interface TieOutResult {
  balanced: boolean;
  status: "BALANCED" | "UNBALANCED" | "NA";
  offBy: number;
  expectedClosing: number;
  computedClosing: number;
  badRows: number[]; // indexes where running balance breaks
  method: "statement" | "running" | "control-total";
}

const EPS_PAISE = 1; // one paisa tolerance

// Money here is schema-constrained to 2 decimal places (Decimal(14,2)), so every
// value converts to an exact integer number of paise — summing in paise (plain JS
// integer addition) avoids the float drift that accumulating dozens/hundreds of
// binary-imprecise rupee values in a reduce() can produce, which was previously
// capable of falsely flagging a legitimately balanced large statement as UNBALANCED.
function toPaise(n: number): number {
  return Math.round(n * 100);
}

/**
 * Statement-level check: opening + Σcredit − Σdebit = closing.
 * If per-row running balances exist, also localise the first broken row.
 */
export function tieOut(
  rows: TieRow[],
  opening: number | null,
  closing: number | null
): TieOutResult {
  const sumDebitPaise = rows.reduce((a, r) => a + toPaise(r.debit || 0), 0);
  const sumCreditPaise = rows.reduce((a, r) => a + toPaise(r.credit || 0), 0);

  // running-balance localisation
  const badRows: number[] = [];
  const hasRunning = rows.every((r) => typeof r.balance === "number");
  if (hasRunning && opening != null) {
    let prevPaise = toPaise(opening);
    for (const r of rows) {
      const expectedPaise = prevPaise + toPaise(r.credit || 0) - toPaise(r.debit || 0);
      const actualPaise = toPaise(r.balance as number);
      if (Math.abs(expectedPaise - actualPaise) > EPS_PAISE) badRows.push(r.index);
      prevPaise = actualPaise;
    }
  }

  if (opening != null && closing != null) {
    const computedPaise = toPaise(opening) + sumCreditPaise - sumDebitPaise;
    const offByPaise = computedPaise - toPaise(closing);
    const balanced = Math.abs(offByPaise) <= EPS_PAISE && badRows.length === 0;
    return {
      balanced,
      status: balanced ? "BALANCED" : "UNBALANCED",
      offBy: offByPaise / 100,
      expectedClosing: closing,
      computedClosing: computedPaise / 100,
      badRows,
      method: hasRunning ? "running" : "statement",
    };
  }

  // No opening/closing (e.g. card statement) → control total only: caller supplies
  // an expected total separately; here we report NA but still surface running breaks.
  return {
    balanced: badRows.length === 0,
    status: "NA",
    offBy: 0,
    expectedClosing: NaN,
    computedClosing: (sumCreditPaise - sumDebitPaise) / 100,
    badRows,
    method: "control-total",
  };
}
