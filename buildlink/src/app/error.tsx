"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

/**
 * Global error boundary.
 *
 * Deliberately shows no stack trace or database text — a user trying to buy
 * cement gains nothing from it, and it can leak schema detail. The digest is
 * displayed so support can correlate the report with the server log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[buildlink] client error boundary:", error.digest ?? error.message);
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <Logo />
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-50 text-danger-700">
        <ShieldAlert className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-foreground-muted">
          This is on our side, not yours. Try again — your cart, projects and orders are safe.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="text-xs text-foreground-subtle">
          Reference for support: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
    </main>
  );
}
