import * as React from "react";
import { cn } from "@/lib/utils";

/** Calm, useful empty states rather than a blank panel. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-blush-200 bg-white/60 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-blush-100 text-blush-600 [&_svg]:size-6">
          {icon}
        </span>
      ) : null}
      <p className="font-display text-lg text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-ink-soft">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
