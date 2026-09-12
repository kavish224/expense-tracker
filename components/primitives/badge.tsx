import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva("inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold", {
  variants: {
    variant: {
      neutral: "bg-surface-2 text-ink-muted",
      accent: "bg-accent-tint text-accent",
      negative: "bg-neg/15 text-neg",
      positive: "bg-pos/15 text-pos",
      warning: "bg-warn/15 text-warn",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
