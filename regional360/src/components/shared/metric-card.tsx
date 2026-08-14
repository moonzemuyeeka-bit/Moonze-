import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Trend } from "@/components/shared/trend";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: { value: number; invert?: boolean };
  diagnosis?: string;
  action?: { label: string; href: string };
  icon?: LucideIcon;
  emphasis?: "default" | "positive" | "warning" | "negative";
}

const EMPHASIS: Record<string, string> = {
  default: "",
  positive: "border-l-2 border-l-success",
  warning: "border-l-2 border-l-warning",
  negative: "border-l-2 border-l-destructive",
};

export function MetricCard({
  label,
  value,
  sub,
  trend,
  diagnosis,
  action,
  icon: Icon,
  emphasis = "default",
}: MetricCardProps) {
  return (
    <Card className={cn("flex flex-col p-4", EMPHASIS[emphasis])}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {trend && <Trend value={trend.value} invert={trend.invert} />}
      </div>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      {diagnosis && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          <span>{diagnosis}</span>
        </p>
      )}
      {action && (
        <Link
          href={action.href}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {action.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </Card>
  );
}
