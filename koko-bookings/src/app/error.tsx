"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

/**
 * Error boundary for the whole app. Customers see a calm apology and a way out;
 * the underlying cause is logged rather than printed on the page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardContent className="space-y-4 p-6 pt-6 text-center">
          <h1 className="font-display text-3xl text-ink">Something went wrong</h1>
          <p className="text-ink-soft">{GENERIC_ERROR_MESSAGE}</p>
          <p className="text-sm text-ink-soft">
            Your appointment and any deposit you have paid are safe. Nothing was lost.
          </p>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:justify-center">
            <Button onClick={reset} size="lg">
              <RefreshCw aria-hidden />
              Try again
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/">
                <Home aria-hidden />
                Back to the homepage
              </Link>
            </Button>
          </div>

          {error.digest ? (
            <p className="pt-2 text-xs text-ink-soft">
              Reference for support: {error.digest}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
