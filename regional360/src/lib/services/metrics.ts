import {
  getAccounts,
  getDataset,
  getOpportunities,
  getSalespeople,
} from "@/lib/repositories";
import { classifyRep } from "@/lib/services/status";
import type { KpiSummary, Opportunity, Stage } from "@/lib/types";

const OPEN: Stage[] = [
  "Prospect",
  "Qualified",
  "Discovery",
  "Proposal",
  "Negotiation",
];

export function isOpen(o: Opportunity) {
  return OPEN.includes(o.stage);
}
export function isWon(o: Opportunity) {
  return o.stage === "Closed Won";
}
export function isLost(o: Opportunity) {
  return o.stage === "Closed Lost";
}

export function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}
export function avg(nums: number[]) {
  return nums.length ? sum(nums) / nums.length : 0;
}

// Region revenue for a cohort = closed-won value in that cohort.
export function cohortRevenue(cohort: "current" | "previous") {
  return sum(
    getOpportunities()
      .filter((o) => isWon(o) && o.cohort === cohort)
      .map((o) => o.value),
  );
}

// Cycle length in days for a won opportunity (sum of stage durations).
export function cycleDays(o: Opportunity): number {
  if (!o.cycle) return 0;
  return sum(Object.values(o.cycle));
}

export function conversionForCohort(cohort: "current" | "previous"): number {
  const opps = getOpportunities().filter((o) => o.cohort === cohort);
  const reached = opps.filter((o) => o.maxStageIndex >= 1).length; // reached Qualified+
  const won = opps.filter((o) => isWon(o)).length;
  return reached ? (won / reached) * 100 : 0;
}

export function avgCycleForCohort(cohort: "current" | "previous"): number {
  const won = getOpportunities().filter(
    (o) => isWon(o) && o.cohort === cohort && o.cycle,
  );
  return avg(won.map(cycleDays));
}

export function getKpiSummary(): KpiSummary {
  const ds = getDataset();
  const opps = getOpportunities();
  const accounts = getAccounts();
  const salespeople = getSalespeople();

  const revenue = ds.regionRevenue;
  const prevRevenue = ds.regionPrevRevenue;
  const revenueTarget = ds.regionTarget;
  const achievementPct = (revenue / revenueTarget) * 100;
  const revenueGrowthPct = prevRevenue
    ? ((revenue - prevRevenue) / prevRevenue) * 100
    : 0;

  const openOpps = opps.filter(isOpen);
  const pipelineValue = sum(openOpps.map((o) => o.value));
  const weightedPipeline = sum(
    openOpps.map((o) => (o.value * o.probability) / 100),
  );
  const pipelineCoverage = revenueTarget ? pipelineValue / revenueTarget : 0;

  const wonCurrent = opps.filter((o) => isWon(o) && o.cohort === "current");
  const avgDealSize = wonCurrent.length
    ? avg(wonCurrent.map((o) => o.value))
    : avg(opps.filter(isWon).map((o) => o.value));

  const conversionPct = conversionForCohort("current");
  const prevConversionPct = conversionForCohort("previous");
  const avgSalesCycleDays = avgCycleForCohort("current");
  const prevSalesCycleDays = avgCycleForCohort("previous");

  // Customer counts / retention (demo heuristics from account trends)
  const newCustomers = accounts.filter(
    (a) => a.relationshipStatus === "New" || a.relationshipStatus === "Growing",
  ).length;
  const decliningOrLost = accounts.filter(
    (a) => a.revenueTrendPct < -12,
  ).length;
  const churnPct = (decliningOrLost / accounts.length) * 100;
  const retentionPct = 100 - churnPct;

  // Rep status counts using the shared classifier (matches the Team page).
  let performing = 0;
  let needsAttention = 0;
  let critical = 0;
  for (const sp of salespeople) {
    const target = ds.salespersonTargets[sp.id];
    const mine = opps.filter((o) => o.ownerId === sp.id);
    const actual = ds.salespersonActuals[sp.id];
    const ach = target ? (actual / target) * 100 : 0;
    const pipeline = sum(mine.filter(isOpen).map((o) => o.value));
    const coverage = target ? pipeline / target : 0;
    const reached = mine.filter((o) => o.maxStageIndex >= 1).length;
    const won = mine.filter(isWon).length;
    const conv = reached ? (won / reached) * 100 : 0;
    const status = classifyRep(ach, coverage, conv);
    if (status === "Critical") critical++;
    else if (status === "Needs Attention") needsAttention++;
    else performing++;
  }

  return {
    revenue,
    revenueTarget,
    achievementPct,
    revenueGrowthPct,
    pipelineValue,
    weightedPipeline,
    pipelineCoverage,
    newCustomers,
    retentionPct,
    churnPct,
    conversionPct,
    prevConversionPct,
    avgDealSize,
    avgSalesCycleDays,
    prevSalesCycleDays,
    performingReps: performing,
    needsAttentionReps: needsAttention,
    criticalReps: critical,
    totalReps: salespeople.length,
  };
}

// Territory-level coverage (used for Northern narrative)
export function territoryCoverage() {
  const ds = getDataset();
  const opps = getOpportunities();
  return ds.territories.map((t) => {
    const pipeline = sum(
      opps
        .filter((o) => o.territoryId === t.id && isOpen(o))
        .map((o) => o.value),
    );
    const target = ds.territoryTargets[t.id];
    const revenue = ds.salespeople
      .filter((sp) => sp.territoryId === t.id)
      .reduce((a, sp) => a + ds.salespersonActuals[sp.id], 0);
    return {
      territory: t,
      pipeline,
      target,
      revenue,
      coverage: target ? pipeline / target : 0,
      achievementPct: target ? (revenue / target) * 100 : 0,
    };
  });
}
