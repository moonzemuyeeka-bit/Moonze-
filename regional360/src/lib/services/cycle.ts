import { getOpportunities } from "@/lib/repositories";
import { avg } from "@/lib/services/metrics";
import { CYCLE_STAGES } from "@/lib/types";
import type { CycleStage, CycleStageName, Opportunity } from "@/lib/types";

export function cycleStageBreakdown(): CycleStage[] {
  const wonCurrent = getOpportunities().filter(
    (o) => o.stage === "Closed Won" && o.cohort === "current" && o.cycle,
  );
  const wonPrev = getOpportunities().filter(
    (o) => o.stage === "Closed Won" && o.cohort === "previous" && o.cycle,
  );

  return CYCLE_STAGES.map((stage: CycleStageName) => {
    const current = avg(wonCurrent.map((o) => o.cycle![stage]));
    const previous = avg(wonPrev.map((o) => o.cycle![stage]));
    const changePct = previous ? ((current - previous) / previous) * 100 : 0;
    return {
      stage,
      currentDays: Math.round(current),
      previousDays: Math.round(previous),
      changePct: Math.round(changePct),
    };
  });
}

export function totalCycle() {
  const breakdown = cycleStageBreakdown();
  const current = breakdown.reduce((a, b) => a + b.currentDays, 0);
  const previous = breakdown.reduce((a, b) => a + b.previousDays, 0);
  return {
    current,
    previous,
    changePct: previous ? Math.round(((current - previous) / previous) * 100) : 0,
  };
}

export function bottleneckStage(): CycleStage {
  const breakdown = cycleStageBreakdown();
  return [...breakdown].sort(
    (a, b) =>
      b.currentDays - b.previousDays - (a.currentDays - a.previousDays),
  )[0];
}

// Open opportunities most affected by long time-in-stage (drill-down target).
export function affectedOpportunities(): Opportunity[] {
  return getOpportunities()
    .filter((o) => o.riskStatus === "Stalled" || o.daysInStage > 25)
    .filter((o) => !["Closed Won", "Closed Lost"].includes(o.stage))
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, 12);
}
