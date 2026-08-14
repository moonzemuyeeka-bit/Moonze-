import {
  accountById,
  accountName,
  getOpportunities,
  productName,
  salespersonName,
  territoryName,
} from "@/lib/repositories";
import { avg, isOpen, isWon } from "@/lib/services/metrics";
import { getKpiSummary } from "@/lib/services/metrics";
import type { Opportunity, Stage } from "@/lib/types";

export interface EnrichedOpportunity extends Opportunity {
  accountName: string;
  ownerName: string;
  territoryName: string;
  productName: string;
  industry: string;
}

export function enrichedOpportunities(): EnrichedOpportunity[] {
  return getOpportunities().map((o) => ({
    ...o,
    accountName: accountName(o.accountId),
    ownerName: salespersonName(o.ownerId),
    territoryName: territoryName(o.territoryId),
    productName: productName(o.productId),
    industry: accountById(o.accountId)?.industry ?? "Unknown",
  }));
}

export interface PipelineMetrics {
  total: number;
  weighted: number;
  coverage: number;
  avgDealSize: number;
  avgCycleDays: number;
  velocityPerDay: number;
  openCount: number;
}

export function pipelineMetrics(): PipelineMetrics {
  const kpi = getKpiSummary();
  const opps = getOpportunities();
  const open = opps.filter(isOpen);
  const won = opps.filter(isWon);
  const reached = opps.filter((o) => o.maxStageIndex >= 1).length;
  const winRate = reached ? won.length / reached : 0;
  const avgDeal = won.length ? avg(won.map((o) => o.value)) : 0;
  const cycle = kpi.avgSalesCycleDays || 1;
  // velocity = (open opps * win rate * avg deal) / cycle length
  const velocity = (open.length * winRate * avgDeal) / cycle;

  return {
    total: kpi.pipelineValue,
    weighted: kpi.weightedPipeline,
    coverage: kpi.pipelineCoverage,
    avgDealSize: kpi.avgDealSize,
    avgCycleDays: kpi.avgSalesCycleDays,
    velocityPerDay: velocity,
    openCount: open.length,
  };
}

export const KANBAN_STAGES: Stage[] = [
  "Prospect",
  "Qualified",
  "Discovery",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];
