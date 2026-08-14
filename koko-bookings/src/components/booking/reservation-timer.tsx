"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Counts down the slot reservation. When it reaches zero the slot is released
 * server-side, so the customer is told rather than left guessing.
 */
export function ReservationTimer({
  expiresAt,
  onExpire,
  className,
}: {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => remaining(expiresAt));

  useEffect(() => {
    setSecondsLeft(remaining(expiresAt));
    const interval = setInterval(() => {
      const next = remaining(expiresAt);
      setSecondsLeft(next);
      if (next <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const urgent = secondsLeft <= 120;

  return (
    <p
      role="timer"
      aria-live="off"
      className={cn(
        "flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm",
        urgent
          ? "border-rose-alert-200 bg-rose-alert-50 text-rose-alert-700"
          : "border-blush-200 bg-blush-50 text-blush-800",
        className,
      )}
    >
      <Timer className="size-4 shrink-0" aria-hidden />
      {secondsLeft > 0 ? (
        <span>
          We are holding this slot for{" "}
          <span className="font-semibold tabular-nums">
            {minutes}:{String(seconds).padStart(2, "0")}
          </span>
        </span>
      ) : (
        <span className="font-medium">Your reservation has expired.</span>
      )}
    </p>
  );
}

function remaining(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}
