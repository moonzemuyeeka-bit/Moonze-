import { Badge } from "@/components/ui/badge";
import type { HealthTier, PerformanceStatus } from "@/lib/types";

const PERF_MAP: Record<
  PerformanceStatus,
  { variant: "success" | "warning" | "destructive"; dot: string }
> = {
  Performing: { variant: "success", dot: "bg-success" },
  "Needs Attention": { variant: "warning", dot: "bg-warning" },
  Critical: { variant: "destructive", dot: "bg-destructive" },
};

export function PerformancePill({ status }: { status: PerformanceStatus }) {
  const cfg = PERF_MAP[status];
  return (
    <Badge variant={cfg.variant} className="gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </Badge>
  );
}

const HEALTH_MAP: Record<
  HealthTier,
  { variant: "success" | "warning" | "destructive" }
> = {
  Healthy: { variant: "success" },
  "At Risk": { variant: "warning" },
  Critical: { variant: "destructive" },
};

export function HealthPill({ tier }: { tier: HealthTier }) {
  return <Badge variant={HEALTH_MAP[tier].variant}>{tier}</Badge>;
}
