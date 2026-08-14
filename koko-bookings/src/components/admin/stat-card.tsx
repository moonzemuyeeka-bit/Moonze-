import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
}) {
  const tones = {
    brand: "bg-blush-100 text-blush-700",
    success: "bg-mint-50 text-mint-700",
    warning: "bg-amber-soft-50 text-amber-soft-700",
    danger: "bg-rose-alert-50 text-rose-alert-700",
    neutral: "bg-white text-ink-soft",
  } as const;

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl",
            tones[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{label}</p>
          <p className="font-display text-2xl leading-tight text-ink">{value}</p>
          {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
