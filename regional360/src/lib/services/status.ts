import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/config";
import type { PerformanceStatus } from "@/lib/types";

// Shared, threshold-driven rep classifier so the Dashboard summary and the
// Team Command Centre always agree. Achievement-first, with coverage and
// conversion as downgrades.
export function classifyRep(
  achievementPct: number,
  coverage: number,
  conversionPct: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): PerformanceStatus {
  if (achievementPct < thresholds.repCriticalAchievement) return "Critical";
  if (
    achievementPct < thresholds.repPerformingAchievement ||
    conversionPct < 16 ||
    coverage < 1.1
  )
    return "Needs Attention";
  return "Performing";
}
