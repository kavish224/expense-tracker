"use client";
import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/cn";

export const ToggleGroup = ToggleGroupPrimitive.Root;

export function ToggleGroupItem({ className, children, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-[12.5px] font-semibold",
        "border-hairline bg-surface-1 text-ink transition-colors cursor-pointer",
        "data-[state=on]:border-accent data-[state=on]:bg-accent-tint data-[state=on]:text-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}
