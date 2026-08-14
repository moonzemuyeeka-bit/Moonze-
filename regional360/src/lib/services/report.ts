import { formatCurrency, formatPercent } from "@/lib/utils";
import { getKpiSummary, territoryCoverage } from "@/lib/services/metrics";
import { allScorecards } from "@/lib/services/team";
import { allAccountHealth } from "@/lib/services/accounts";
import { diagnosePerformance } from "@/lib/services/diagnostics";
import { buildRecommendedActions } from "@/lib/services/actions";
import { getMarketSignals } from "@/lib/repositories";

export interface ReportSection {
  title: string;
  body: string[];
}

export function weeklyBusinessReview(): ReportSection[] {
  const kpi = getKpiSummary();
  const cov = territoryCoverage();
  const weakest = [...cov].sort((a, b) => a.coverage - b.coverage)[0];
  const cards = allScorecards();
  const health = allAccountHealth();
  const atRisk = health.filter((h) => h.tier !== "Healthy");
  const diag = diagnosePerformance();
  const actions = buildRecommendedActions();
  const topMarket = getMarketSignals()
    .filter((m) => m.opportunity === "High")
    .sort((a, b) => b.estimatedMarket - a.estimatedMarket)[0];

  return [
    {
      title: "Executive Summary",
      body: [
        `Regional revenue is ${formatCurrency(kpi.revenue, { compact: true })} at ${formatPercent(kpi.achievementPct)} of the ${formatCurrency(kpi.revenueTarget, { compact: true })} target, with ${formatPercent(kpi.revenueGrowthPct)} period-over-period growth.`,
        `The leading diagnosed contributor is ${diag.categories[0].category} (${diag.categories[0].score}%). ${diag.headline}`,
        `Pipeline coverage is ${kpi.pipelineCoverage.toFixed(1)}x and retention is ${formatPercent(kpi.retentionPct)}.`,
      ],
    },
    {
      title: "Revenue Performance",
      body: [
        `Revenue ${formatCurrency(kpi.revenue, { compact: true })} vs target ${formatCurrency(kpi.revenueTarget, { compact: true })} (${formatPercent(kpi.achievementPct)}).`,
        `Average deal size ${formatCurrency(kpi.avgDealSize, { compact: true })}; average sales cycle ${Math.round(kpi.avgSalesCycleDays)} days (was ${Math.round(kpi.prevSalesCycleDays)}).`,
        `Conversion ${formatPercent(kpi.conversionPct)} vs ${formatPercent(kpi.prevConversionPct)} prior period.`,
      ],
    },
    {
      title: "Pipeline",
      body: [
        `Open pipeline ${formatCurrency(kpi.pipelineValue, { compact: true })}; weighted ${formatCurrency(kpi.weightedPipeline, { compact: true })}.`,
        `Weakest territory: ${weakest.territory.name} at ${weakest.coverage.toFixed(1)}x coverage (${formatPercent(weakest.achievementPct)} to target).`,
        ...cov.map(
          (c) => `${c.territory.name}: ${c.coverage.toFixed(1)}x coverage, ${formatPercent(c.achievementPct)} to target.`,
        ),
      ],
    },
    {
      title: "Team Performance",
      body: [
        `${kpi.performingReps} performing, ${kpi.needsAttentionReps} need attention, ${kpi.criticalReps} critical.`,
        `Lowest performer: ${cards[0].salesperson.name} at ${formatPercent(cards[0].achievementPct)} of target.`,
        `Top performer: ${cards[cards.length - 1].salesperson.name} at ${formatPercent(cards[cards.length - 1].achievementPct)} of target.`,
      ],
    },
    {
      title: "Account Health",
      body: [
        `${atRisk.length} accounts At Risk or Critical (${formatCurrency(atRisk.reduce((a, b) => a + b.account.annualRevenue, 0), { compact: true })} revenue).`,
        ...atRisk.slice(0, 4).map(
          (h) => `${h.account.name}: ${h.healthScore}/100 (${h.tier}), ${h.openIssues} open issue${h.openIssues === 1 ? "" : "s"}.`,
        ),
      ],
    },
    {
      title: "Market Opportunities",
      body: [
        topMarket
          ? `${topMarket.industry}: ${formatCurrency(topMarket.estimatedMarket, { compact: true })} estimated market at ${topMarket.penetration}% penetration (demo signal).`
          : "No high-priority market signals this period.",
        "Market items are demo/generated data and are not verified real-world facts.",
      ],
    },
    {
      title: "Risks",
      body: [
        `${formatCurrency(atRisk.reduce((a, b) => a + b.account.annualRevenue, 0), { compact: true })} revenue exposed in at-risk accounts.`,
        `${weakest.territory.name} coverage of ${weakest.coverage.toFixed(1)}x threatens future quarters.`,
        `Sales cycle trend: ${Math.round(kpi.avgSalesCycleDays)}d vs ${Math.round(kpi.prevSalesCycleDays)}d.`,
      ],
    },
    {
      title: "Actions Outstanding",
      body: actions.slice(0, 5).map((a) => `[${a.priority}] ${a.title} — ${a.reason}`),
    },
    {
      title: "Priorities for Next Week",
      body: [
        `Rebuild coverage in ${weakest.territory.name}.`,
        "Resolve outstanding issues on Critical accounts before renewals.",
        "Remove the process bottleneck slowing the sales cycle.",
        `Coach ${cards[0].salesperson.name} on qualification and closing.`,
      ],
    },
  ];
}
