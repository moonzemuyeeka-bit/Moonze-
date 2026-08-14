"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary: catches failures in the root layout itself, so it has to
 * render its own document and cannot rely on shared components.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] root layout error", error);
  }, [error]);

  return (
    <html lang="en-ZM">
      <body className="font-sans antialiased">
        <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4 py-10">
          <div className="w-full rounded-3xl border border-line bg-white p-6 text-center shadow-card">
            <h1 className="font-display text-3xl text-ink">Koko&rsquo;s Bookings</h1>
            <p className="mt-3 text-ink-soft">
              Something went wrong. Please try again.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 h-11 rounded-full bg-blush-600 px-6 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
