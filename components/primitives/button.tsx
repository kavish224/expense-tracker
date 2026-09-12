"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-semibold tracking-[-0.01em] transition-[filter,transform,box-shadow] cursor-pointer disabled:cursor-default disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-[image:var(--accent-grad)] text-white shadow-[0_1px_2px_rgba(0,0,0,.25),inset_0_1px_0_rgba(255,255,255,.16)] hover:brightness-[1.07] hover:-translate-y-px",
        secondary: "border border-hairline-strong bg-surface-2 text-ink hover:bg-surface-3",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
        destructive: "bg-neg/10 text-neg hover:bg-neg/15",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4 text-[14px]",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
