import { getOpportunities } from "@/lib/repositories";
import type { FunnelStage, Opportunity } from "@/lib/types";

// Funnel stages mapped onto the pipeline model so the data is internally
// consistent and each stage is clickable/drillable.
const FUNNEL: { label: string; index: number }[] = [
  { label: "Prospects", index: 0 },
  { label: "Qualified", index: 1 },
  { label: "Discovery", index: 2 },
  { label: "Proposal", index: 3 },
  { label: "Negotiation", index: 4 },
  { label: "Closed Won", index: 5 },
];

export interface FunnelFilter {
  salespersonId?: string;
  territoryId?: string;
  productId?: string;
  industryAccountIds?: string[];
  cohort?: "current" | "previous" | "all";
}

function applyFilter(opps: Opportunity[], f: FunnelFilter): Opportunity[] {
  return opps.filter((o) => {
    if (f.salespersonId && o.ownerId !== f.salespersonId) return false;
    if (f.territoryId && o.territoryId !== f.territoryId) return false;
    if (f.productId && o.productId !== f.productId) return false;
    if (f.industryAccountIds && !f.industryAccountIds.includes(o.accountId))
      return false;
    if (f.cohort && f.cohort !== "all" && o.cohort !== f.cohort) return false;
    return true;
  });
}

export function buildFunnel(filter: FunnelFilter = {}): FunnelStage[] {
  const current = applyFilter(getOpportunities(), {
    ...filter,
    cohort: filter.cohort ?? "current",
  });
  const previous = applyFilter(getOpportunities(), {
    ...filter,
    cohort: "previous",
  });

  const countAtOrPast = (opps: Opportunity[], idx: number) =>
    opps.filter((o) => o.maxStageIndex >= idx).length;
  const valueAtOrPast = (opps: Opportunity[], idx: number) =>
    opps
      .filter((o) => o.maxStageIndex >= idx)
      .reduce((a, b) => a + b.value, 0);

  return FUNNEL.map((stage, i) => {
    const count = countAtOrPast(current, stage.index);
    const value = valueAtOrPast(current, stage.index);
    const next = FUNNEL[i + 1];
    let conversion: number | null = null;
    let prevConversion: number | null = null;
    if (next) {
      const cNext = countAtOrPast(current, next.index);
      conversion = count ? (cNext / count) * 100 : 0;
      const pCur = countAtOrPast(previous, stage.index);
      const pNext = countAtOrPast(previous, next.index);
      prevConversion = pCur ? (pNext / pCur) * 100 : 0;
    }
    return {
      stage: stage.label,
      count,
      value,
      conversionToNextPct: conversion,
      prevConversionToNextPct: prevConversion,
      leakagePct: conversion === null ? null : 100 - conversion,
    };
  });
}

// The single largest leakage point (stage->next with the biggest drop),
// and whether it worsened vs the previous cohort.
export function biggestLeakage(filter: FunnelFilter = {}) {
  const funnel = buildFunnel(filter);
  let worst: FunnelStage | null = null;
  for (const s of funnel) {
    if (s.leakagePct === null) continue;
    if (!worst || s.leakagePct > (worst.leakagePct ?? 0)) worst = s;
  }
  return worst;
}

export function opportunitiesAtStage(
  stageLabel: string,
  filter: FunnelFilter = {},
): Opportunity[] {
  const idx = FUNNEL.find((f) => f.label === stageLabel)?.index ?? 0;
  const opps = applyFilter(getOpportunities(), {
    ...filter,
    cohort: filter.cohort ?? "current",
  });
  return opps.filter((o) => o.maxStageIndex >= idx);
}
