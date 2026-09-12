import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-[10px] border border-hairline-strong bg-surface-2 px-3 text-[14px] text-ink outline-none",
        "placeholder:text-ink-subtle focus-visible:border-accent",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-2 block text-[11px] font-semibold uppercase tracking-[.07em] text-ink-subtle", className)} {...props} />;
}
