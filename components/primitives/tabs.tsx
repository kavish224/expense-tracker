"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-[10px] border border-hairline bg-surface-2 p-1",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-7 items-center whitespace-nowrap rounded-[8px] px-3 text-[13px] font-semibold text-ink-muted transition-colors",
        "data-[state=active]:bg-surface-1 data-[state=active]:text-ink data-[state=active]:shadow-[var(--shadow-e1)]",
        "hover:text-ink disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}
