// Money helpers. We keep amounts as numbers of rupees in JS logic and format
// with Indian grouping. Prisma stores Decimal(14,2) for precision.

export function formatINR(value: number, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const { decimals = false, sign = false } = opts;
  const neg = value < 0;
  const abs = Math.abs(value);
  const s = abs.toLocaleString("en-IN", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  const prefix = neg ? "-₹" : sign ? "+₹" : "₹";
  return `${prefix}${s}`;
}

export function roundPaisa(n: number): number {
  return Math.round(n * 100) / 100;
}
