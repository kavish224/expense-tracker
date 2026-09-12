"use client";
import React from "react";
import { Skeleton } from "@/components/ui";

/** Loading placeholders shaped like the chart they precede, so real data doesn't
 * make the layout jump when it lands. */

export function AreaChartSkeleton({ height = 200 }: { height?: number }) {
  return <Skeleton h={height} style={{ borderRadius: 10 }} />;
}

export function DonutSkeleton({ size = 180 }: { size?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <Skeleton h={size} w={size} style={{ borderRadius: "50%" }} />
        <div
          style={{
            position: "absolute", inset: size * 0.28, borderRadius: "50%",
            background: "var(--surface-1)",
          }}
        />
      </div>
    </div>
  );
}

export function BarListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} h={30} style={{ borderRadius: 8 }} />
      ))}
    </div>
  );
}
