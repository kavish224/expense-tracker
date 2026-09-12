"use client";
import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/cn";

export const Drawer = DrawerPrimitive.Root;
export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerClose = DrawerPrimitive.Close;

export function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/50" />
      <DrawerPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-[90] flex max-h-[92dvh] flex-col rounded-t-[20px]",
          "border-t border-hairline bg-surface-1 outline-none",
          className
        )}
        {...props}
      >
        {/* Grabber — vaul handles the actual drag-to-dismiss gesture; this is
            purely the visual affordance users expect on a bottom sheet. */}
        <div className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-hairline-strong" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

export function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title className={cn("text-[13px] font-semibold text-ink-muted", className)} {...props} />;
}
