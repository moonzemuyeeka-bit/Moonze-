import {
  getAccounts,
  getDataset,
  getOpportunities,
  territoryName,
} from "@/lib/repositories";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/config";
import { avg, cycleDays, isOpen, isWon, sum } from "@/lib/services/metrics";
import { classifyRep } from "@/lib/services/status";
import type { PerformanceStatus, RepScorecard, Salesperson } from "@/lib/types";

export function repScorecard(
  sp: Salesperson,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): RepScorecard {
  const ds = getDataset();
  const opps = getOpportunities();
  const mine = opps.filter((o) => o.ownerId === sp.id);

  const target = ds.salespersonTargets[sp.id];
  const actual = ds.salespersonActuals[sp.id];
  const prevActual = ds.salespersonPrevActuals[sp.id];
  const achievementPct = target ? (actual / target) * 100 : 0;
  const trendPct = prevActual ? ((actual - prevActual) / prevActual) * 100 : 0;

  const pipeline = sum(mine.filter(isOpen).map((o) => o.value));
  const pipelineCoverage = target ? pipeline / target : 0;

  const reached = mine.filter((o) => o.maxStageIndex >= 1).length;
  const won = mine.filter(isWon).length;
  const conversionPct = reached ? (won / reached) * 100 : 0;

  const wonDeals = mine.filter(isWon);
  const avgDealSize = wonDeals.length ? avg(wonDeals.map((o) => o.value)) : 0;
  const cycleWon = wonDeals.filter((o) => o.cycle);
  const salesCycleDays = cycleWon.length
    ? Math.round(avg(cycleWon.map(cycleDays)))
    : 0;

  const myAccounts = getAccounts().filter((a) => a.ownerId === sp.id);
  const newAccounts = myAccounts.filter(
    (a) => a.relationshipStatus === "New" || a.relationshipStatus === "Growing",
  ).length;
  const retentionPct =
    myAccounts.length === 0
      ? 100
      : (myAccounts.filter((a) => a.revenueTrendPct >= -12).length /
          myAccounts.length) *
        100;

  // Status derives from shared, threshold-driven classifier (never arbitrary).
  const status: PerformanceStatus = classifyRep(
    achievementPct,
    pipelineCoverage,
    conversionPct,
    thresholds,
  );
  let attentionReason: string;
  if (status === "Critical") {
    attentionReason =
      achievementPct < thresholds.repCriticalAchievement
        ? `Target achievement of ${achievementPct.toFixed(0)}% is below the ${thresholds.repCriticalAchievement}% critical threshold.`
        : `Pipeline coverage of ${pipelineCoverage.toFixed(1)}x is critically low.`;
  } else if (status === "Needs Attention") {
    attentionReason =
      conversionPct < 18
        ? `Conversion of ${conversionPct.toFixed(0)}% is below the healthy range.`
        : `Achievement ${achievementPct.toFixed(0)}% / coverage ${pipelineCoverage.toFixed(1)}x are below target.`;
  } else {
    attentionReason = "Meeting achievement, coverage and conversion targets.";
  }

  return {
    salesperson: sp,
    territoryName: territoryName(sp.territoryId),
    target,
    actual,
    achievementPct,
    pipeline,
    pipelineCoverage,
    conversionPct,
    avgDealSize,
    salesCycleDays,
    newAccounts,
    retentionPct,
    activityScore: sp.activityScore,
    trendPct,
    status,
    attentionReason,
  };
}

export function allScorecards(
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): RepScorecard[] {
  return getDataset()
    .salespeople.map((sp) => repScorecard(sp, thresholds))
    .sort((a, b) => a.achievementPct - b.achievementPct);
}
