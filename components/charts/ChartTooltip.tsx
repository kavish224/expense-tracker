"use client";
import React from "react";
import { tooltipBoxStyle } from "@/lib/charts/theme";

/**
 * One custom tooltip renderer for every chart in the app, instead of each chart
 * styling Recharts' default tooltip box differently. Pass as `content={(props) =>
 * <ChartTooltip {...props} formatter={...} />}`.
 */
export function ChartTooltip({
  active, payload, label, formatter, labelFormatter,
}: {
  active?: boolean;
  payload?: readonly { value?: number | string | null; name?: string; color?: string; dataKey?: string }[];
  label?: string | number;
  formatter?: (value: number, name: string, dataKey?: string) => string;
  labelFormatter?: (label: string | number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => typeof p.value === "number" && p.value !== 0);
  if (rows.length === 0) return null;

  return (
    <div style={tooltipBoxStyle}>
      {label !== undefined && (
        <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--ink-muted)", fontSize: 11 }}>
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {p.color && <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flex: "none" }} />}
            <span style={{ color: "var(--ink-muted)", flex: 1, whiteSpace: "nowrap" }}>{p.name}</span>
            <span className="num" style={{ fontWeight: 600, flex: "none" }}>
              {formatter ? formatter(p.value as number, p.name ?? "", p.dataKey) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
