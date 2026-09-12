"use client";
import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { resolveCssVar, tooltipBoxStyle } from "@/lib/charts/theme";
import { formatINR } from "@/components/ui";

export interface DonutSlice {
  id: string;
  name: string;
  amount: number;
  colorToken: string;
}

/** Shared inner-ring donut with a centered total and click-to-select (used to
 * cross-filter the surrounding page rather than just decorate it). */
export function Donut({
  data, size = 176, thickness = 26, centerLabel, centerValue, selectedId, onSelect,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  const outer = size / 2 - 4;
  const inner = Math.max(0, outer - thickness);

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <ResponsiveContainer width={size} height={size}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius={outer}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="var(--surface-1)"
            strokeWidth={2}
            isAnimationActive={false}
            onClick={onSelect ? (entry: any) => onSelect(selectedId === entry.id ? null : entry.id) : undefined}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={resolveCssVar(d.colorToken)} opacity={!selectedId || selectedId === d.id ? 1 : 0.35} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as DonutSlice;
              const pct = total > 0 ? ((p.amount / total) * 100).toFixed(1) : "0";
              return (
                <div style={tooltipBoxStyle}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                  <div className="num" style={{ color: "var(--ink-muted)" }}>{formatINR(p.amount)} · {pct}%</div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div
          style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 2,
          }}
        >
          {centerLabel && <span style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{centerLabel}</span>}
          {centerValue && <span className="num" style={{ fontSize: 17, fontWeight: 700 }}>{centerValue}</span>}
        </div>
      )}
    </div>
  );
}
