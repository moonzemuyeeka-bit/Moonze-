// Configurable thresholds that drive status classification across the app.
// Surfaced (and editable in-session) on the Settings page. Statuses are never
// arbitrary — they derive from these thresholds applied to computed metrics.

export interface Thresholds {
  // Rep performance status (target achievement %, and pipeline coverage x)
  repPerformingAchievement: number; // >= => Performing (if coverage ok)
  repCriticalAchievement: number; // < => Critical
  repHealthyCoverage: number; // pipeline coverage considered healthy
  // Account health score bands (0-100)
  accountHealthy: number; // >= => Healthy
  accountAtRisk: number; // >= => At Risk, else Critical
  // Pipeline coverage target for a territory/region
  targetCoverage: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  repPerformingAchievement: 90,
  repCriticalAchievement: 70,
  repHealthyCoverage: 3,
  accountHealthy: 70,
  accountAtRisk: 45,
  targetCoverage: 3,
};

export const APP_NAME = "Regional360";
