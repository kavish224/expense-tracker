"use client";
import React from "react";
import { formatINR } from "./ui";

// Spending calendar heatmap (Zerodha Console P&L-heatmap pattern), single-hue
// intensity ramp so it reads as "how much" without red/green guilt colouring.
export function Heatmap({
  data, selectedDate, onSelect,
}: {
  data: { date: string; amount: number }[];
  selectedDate?: string | null;
  onSelect?: (date: string | null) => void;
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.amount), 1);

  // group into weeks (columns), day-of-week rows
  const first = new Date(data[0].date);
  const startPad = first.getDay(); // 0 Sun
  const cells: ({ date: string; amount: number } | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  data.forEach((d) => cells.push(d));
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const size = 15, gap = 4;
  const intensity = (a: number) => (a <= 0 ? 0 : 0.15 + 0.85 * Math.min(1, a / max));

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap, minWidth: weeks.length * (size + gap) }}>
        {weeks.map((w, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap }}>
            {Array.from({ length: 7 }).map((_, di) => {
              const c = w[di];
              if (!c) return <div key={di} style={{ width: size, height: size }} />;
              const op = intensity(c.amount);
              const selected = selectedDate === c.date;
              return (
                <div
                  key={di}
                  onClick={onSelect ? () => onSelect(selected ? null : c.date) : undefined}
                  title={`${new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${formatINR(c.amount)}`}
                  style={{
                    width: size, height: size, borderRadius: 3,
                    background: op === 0 ? "var(--surface-2)" : "var(--accent)",
                    opacity: op === 0 ? 1 : op,
                    border: selected ? "1.5px solid var(--ink)" : "1px solid var(--hairline)",
                    boxShadow: selected ? "0 0 0 2px var(--accent-glow)" : "none",
                    cursor: onSelect ? "pointer" : "default",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 11, color: "var(--ink-subtle)" }}>
        Less
        {[0, 0.3, 0.55, 0.8, 1].map((o, i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: o === 0 ? "var(--surface-2)" : "var(--accent)", opacity: o === 0 ? 1 : o, border: "1px solid var(--hairline)" }} />
        ))}
        More
      </div>
    </div>
  );
}
