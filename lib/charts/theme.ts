// Shared chart theme (React.CSSProperties, formatters, small pure helpers) so every
// Recharts instance in the app looks consistent instead of each page inventing its
// own tooltip/axis/gradient styling from scratch.
import type { CSSProperties } from "react";

/** Resolves a `--c-<token>` design-system color to a concrete hex/rgb string, for the
 * few Recharts primitives (e.g. Pie `Cell`) that need an actual color rather than a
 * CSS var reference. */
export function resolveCssVar(token: string): string {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(`--c-${token}`).trim() || "#888";
}

export const axisTick = { fontSize: 10, fill: "var(--ink-subtle)" } as const;
export const gridStroke = "var(--hairline)";

/** ₹62.6k / ₹1.2L / ₹3.4Cr — for axis ticks and other tight spaces. Falls back to a
 * plain compact format if the runtime's Intl doesn't support Indian grouping. */
export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(abs);
  return `${sign}₹${compact}`;
}

export const tooltipBoxStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: 10,
  boxShadow: "var(--shadow-e2)",
  fontSize: 12,
  color: "var(--ink)",
  padding: "9px 12px",
  minWidth: 120,
};

/** Percent change of current vs previous, or null when previous is 0 and current
 * isn't (an undefined "% change from zero" rather than a misleading number). */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
