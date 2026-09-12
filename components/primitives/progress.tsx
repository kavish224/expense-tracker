"use client";
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/cn";

/** Thin budget/limit bar. `tone` picks the fill color (green/amber/red by
 * caller-computed threshold) — Progress itself has no opinion on "good vs bad". */
export function Progress({
  value, tone = "pos", className,
}: { value: number; tone?: "pos" | "warn" | "neg"; className?: string }) {
  const toneClass = tone === "neg" ? "bg-neg" : tone === "warn" ? "bg-warn" : "bg-pos";
  return (
    <ProgressPrimitive.Root
      value={value}
      className={cn("h-[5px] w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full transition-[width] duration-300", toneClass)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
