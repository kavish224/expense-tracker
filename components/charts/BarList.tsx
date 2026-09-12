"use client";
import React from "react";
import { resolveCssVar } from "@/lib/charts/theme";

export interface BarListItem {
  key: string;
  name: string;
  value: number;
  colorToken?: string;
  sub?: string;
}

/** Horizontal relative-magnitude bar list (Tremor's BarList pattern, adapted to
 * our CSS-variable color tokens instead of a fixed Tailwind palette so category
 * colors stay identical to every other chart in the app). Rows become real
 * buttons — not just divs — when `onSelect` is given, so they're keyboard-
 * focusable and screen-reader-actionable instead of mouse-only. */
export function BarList({
  data, valueFormatter, onSelect, selectedKey,
}: {
  data: BarListItem[];
  valueFormatter: (v: number) => string;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
}) {
  const max = Math.max(...data.map((d) => d.value), 0.0001);
  return (
    <div role="list" className="flex flex-col">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const isDimmed = !!selectedKey && selectedKey !== d.key;
        const Row = onSelect ? "button" : "div";
        return (
          <Row
            key={d.key}
            role="listitem"
            type={onSelect ? "button" : undefined}
            onClick={onSelect ? () => onSelect(d.key) : undefined}
            title={d.name}
            className={[
              "flex w-full items-center gap-2.5 py-2 text-left transition-opacity",
              i < data.length - 1 ? "border-b border-hairline" : "",
              onSelect ? "cursor-pointer" : "",
              isDimmed ? "opacity-40" : "",
            ].join(" ")}
          >
            {d.colorToken && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: `var(--c-${d.colorToken})` }}
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-[13.5px] font-semibold">
                <span className="truncate text-ink">{d.name}</span>
                <span className="num shrink-0 text-ink">{valueFormatter(d.value)}</span>
              </div>
              <div className="mt-[5px] h-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${pct}%`, background: d.colorToken ? resolveCssVar(d.colorToken) : "var(--accent)" }}
                />
              </div>
            </div>
            {d.sub && <span className="shrink-0 text-[11px] text-ink-subtle">{d.sub}</span>}
          </Row>
        );
      })}
    </div>
  );
}
