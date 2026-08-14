"use client";

import * as React from "react";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/errors";

/**
 * Form-level result banner.
 *
 * Rendered in a live region so a screen-reader user hears the outcome of a
 * submission without having to hunt for it, and never shows a raw error: the
 * message always comes from `toActionError`.
 */
export function FormMessage({
  state,
  successMessage,
  className,
}: {
  state: ActionResult<unknown> | null;
  successMessage?: string;
  className?: string;
}) {
  return (
    <div aria-live="polite" className={className}>
      {state && !state.ok ? (
        <Alert tone="danger" title="We could not continue">
          {state.error}
        </Alert>
      ) : null}
      {state?.ok && successMessage ? <Alert tone="success">{successMessage}</Alert> : null}
    </div>
  );
}

/** Extracts the messages for one field from an action result. */
export function fieldError(
  state: ActionResult<unknown> | null,
  field: string,
): string[] | undefined {
  if (!state || state.ok) return undefined;
  return state.fieldErrors?.[field];
}
