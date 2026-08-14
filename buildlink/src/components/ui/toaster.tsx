"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Toast host. Mounted once in the root layout; feature code calls
 * `toast.success(...)` / `toast.error(...)` from sonner directly.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-border shadow-popover",
          title: "text-sm font-semibold",
          description: "text-sm",
        },
      }}
    />
  );
}
