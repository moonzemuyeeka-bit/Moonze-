"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-blush-900/25 backdrop-blur-sm data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-line bg-cream p-5 shadow-card data-[state=open]:animate-fade-up sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6",
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <DialogPrimitive.Title className="font-display text-xl text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-ink-soft">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            className="rounded-full p-2 text-ink-muted transition-colors hover:bg-blush-100 hover:text-blush-700"
            aria-label="Close"
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
