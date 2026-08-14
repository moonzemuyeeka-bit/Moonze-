import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendProps {
  value: number; // percentage change
  // whether an increase is good (revenue) or bad (churn, cycle time)
  invert?: boolean;
  suffix?: string;
  className?: string;
}

export function Trend({ value, invert = false, suffix = "%", className }: TrendProps) {
  const direction = value > 0.5 ? "up" : value < -0.5 ? "down" : "flat";
  const good = invert ? value < 0 : value > 0;
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  const color =
    direction === "flat"
      ? "text-muted-foreground"
      : good
        ? "text-success"
        : "text-destructive";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", color, className)}>
      <Icon className="h-3.5 w-3.5" />
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}
