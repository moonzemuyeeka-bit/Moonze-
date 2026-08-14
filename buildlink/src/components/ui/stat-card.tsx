import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Headline metric tile.
 *
 * Money is rendered with tabular figures so a column of amounts lines up, and
 * the label sits above the value: on a phone the label is what you scan.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "brand" | "gold" | "danger" | "success";
  href?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const toneClasses = {
    default: "border-border bg-surface",
    brand: "border-brand-200 bg-brand-50",
    gold: "border-gold-200 bg-gold-50",
    danger: "border-danger-500/20 bg-danger-50",
    success: "border-success-500/20 bg-success-50",
  }[tone];

  const iconClasses = {
    default: "bg-surface-muted text-foreground-muted",
    brand: "bg-brand-100 text-brand-800",
    gold: "bg-gold-100 text-gold-800",
    danger: "bg-danger-50 text-danger-700",
    success: "bg-success-50 text-success-700",
  }[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            {label}
          </p>
          <p className="tabular text-2xl font-semibold leading-tight text-foreground">{value}</p>
        </div>
        {Icon ? (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconClasses)}>
            <Icon className="size-4.5" />
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-2 text-xs text-foreground-muted">{hint}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
      {href ? (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
          View <ArrowRight aria-hidden className="size-3.5" />
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "block rounded-xl border p-4 shadow-card transition-shadow hover:shadow-card-hover",
          toneClasses,
          className,
        )}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={cn("rounded-xl border p-4 shadow-card", toneClasses, className)}>{body}</div>
  );
}
