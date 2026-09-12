"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className, children, showClose = true, ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-[80] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[90] w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2",
          "max-h-[86vh] overflow-y-auto rounded-[20px] border border-hairline bg-surface-1 p-6",
          "shadow-[var(--shadow-e3)] outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-ink-muted transition-colors hover:text-ink"
          >
            <X size={14} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-5 flex items-center justify-between pr-8", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-[16px] font-semibold tracking-tight text-ink", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-6 flex justify-end gap-2 border-t border-hairline pt-4", className)}
      {...props}
    />
  );
}
