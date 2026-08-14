import { formatCurrency } from "@/lib/utils";
import { allAccountHealth } from "@/lib/services/accounts";
import { allScorecards } from "@/lib/services/team";
import { biggestLeakage } from "@/lib/services/funnel";
import { bottleneckStage } from "@/lib/services/cycle";
import { territoryCoverage } from "@/lib/services/metrics";
import { getMarketSignals } from "@/lib/repositories";
import type { ActionPriority, RecommendedAction } from "@/lib/types";

function priorityFromScore(impact: number, urgency: number): ActionPriority {
  const s = impact * 0.6 + urgency * 0.4;
  if (s >= 70) return "High";
  if (s >= 45) return "Medium";
  return "Low";
}

// Priority ranking = impact-weighted, urgency-weighted, boosted by confidence,
// penalised by effort. Higher score => surfaced first.
export function priorityScore(a: RecommendedAction): number {
  const conf = a.confidence === "High" ? 1 : a.confidence === "Medium" ? 0.8 : 0.6;
  return (a.impact * 0.55 + a.urgency * 0.35) * conf - a.effort * 0.15;
}

export function buildRecommendedActions(): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  // --- Customer risk: at-risk / critical accounts with revenue at stake ---
  const health = allAccountHealth();
  for (const h of health.filter((x) => x.tier !== "Healthy").slice(0, 6)) {
    const atStake = h.account.annualRevenue;
    const urgency =
      h.daysToRenewal !== null && h.daysToRenewal < 60 ? 92 : 70;
    const impact = Math.min(95, 45 + (atStake / 12000));
    actions.push({
      id: `act-acc-${h.account.id}`,
      title: `Call ${h.account.name}`,
      reason: `${formatCurrency(atStake, { compact: true })} revenue at risk — health ${h.healthScore}/100 (${h.tier}), ${h.openIssues} open issue${h.openIssues === 1 ? "" : "s"}${h.daysToRenewal !== null ? `, renewal in ${h.daysToRenewal} days` : ""}.`,
      priority: priorityFromScore(impact, urgency),
      source: h.openIssues > 0 ? "Customer Risk" : "Accounts",
      impact,
      urgency,
      confidence: h.tier === "Critical" ? "High" : "Medium",
      effort: 25,
      relatedType: "account",
      relatedId: h.account.id,
      suggestedAction:
        h.openIssues > 0
          ? `Schedule an executive account review and resolve the ${h.openIssues} outstanding issue${h.openIssues === 1 ? "" : "s"} before renewal.`
          : "Book a strategic account review to protect and grow revenue.",
    });
  }

  // --- Territory pipeline coverage ----------------------------------------
  const coverage = territoryCoverage().sort((a, b) => a.coverage - b.coverage);
  const weakest = coverage[0];
  if (weakest && weakest.coverage < 3) {
    actions.push({
      id: `act-terr-${weakest.territory.id}`,
      title: `Review ${weakest.territory.name} territory pipeline`,
      reason: `Coverage is only ${weakest.coverage.toFixed(1)}x against target (${formatCurrency(weakest.target, { compact: true })}).`,
      priority: priorityFromScore(78, 74),
      source: "Pipeline",
      impact: 78,
      urgency: 74,
      confidence: "High",
      effort: 40,
      relatedType: "territory",
      relatedId: weakest.territory.id,
      suggestedAction:
        "Run a pipeline-generation sprint and reallocate prospecting to higher-performing sectors.",
    });
  }

  // --- Team: coach underperformers ----------------------------------------
  const scorecards = allScorecards();
  const teamAvgConversion =
    scorecards.reduce((a, b) => a + b.conversionPct, 0) / scorecards.length;
  for (const s of scorecards.filter((x) => x.status !== "Performing").slice(0, 4)) {
    const gap = teamAvgConversion - s.conversionPct;
    actions.push({
      id: `act-coach-${s.salesperson.id}`,
      title: `Coach ${s.salesperson.name}`,
      reason:
        gap > 0
          ? `Conversion is ${gap.toFixed(0)} pts below the team average (${s.conversionPct.toFixed(0)}% vs ${teamAvgConversion.toFixed(0)}%).`
          : `${s.attentionReason}`,
      priority: s.status === "Critical" ? "High" : "Medium",
      source: "Team",
      impact: s.status === "Critical" ? 72 : 55,
      urgency: 58,
      confidence: "Medium",
      effort: 45,
      relatedType: "salesperson",
      relatedId: s.salesperson.id,
      suggestedAction:
        s.pipelineCoverage < 2
          ? "Focus coaching on prospect qualification and territory targeting."
          : "Focus coaching on discovery depth and closing technique.",
    });
  }

  // --- Process: approval bottleneck ---------------------------------------
  const bottleneck = bottleneckStage();
  if (bottleneck.changePct > 20) {
    actions.push({
      id: `act-process-${bottleneck.stage}`,
      title: `Escalate ${bottleneck.stage.toLowerCase()} bottleneck`,
      reason: `${bottleneck.stage} time rose ${bottleneck.changePct}% (${bottleneck.previousDays}d → ${bottleneck.currentDays}d), lengthening the sales cycle.`,
      priority: priorityFromScore(70, 66),
      source: "Process",
      impact: 70,
      urgency: 66,
      confidence: "High",
      effort: 35,
      suggestedAction:
        "Review approval workflow owners and set an SLA to remove the bottleneck.",
    });
  }

  // --- Funnel leakage ------------------------------------------------------
  const leak = biggestLeakage();
  if (leak && (leak.leakagePct ?? 0) > 45) {
    actions.push({
      id: `act-funnel-${leak.stage}`,
      title: `Fix ${leak.stage} funnel leakage`,
      reason: `${leak.stage} conversion is ${leak.conversionToNextPct?.toFixed(0)}% (leakage ${leak.leakagePct?.toFixed(0)}%), the largest drop in the funnel.`,
      priority: priorityFromScore(64, 55),
      source: "Performance",
      impact: 64,
      urgency: 55,
      confidence: "Medium",
      effort: 40,
      suggestedAction:
        "Inspect deals stuck at this stage and standardise the next-step play.",
    });
  }

  // --- Market opportunity --------------------------------------------------
  const topMarket = getMarketSignals()
    .filter((m) => m.opportunity === "High")
    .sort((a, b) => b.estimatedMarket - a.estimatedMarket)[0];
  if (topMarket) {
    actions.push({
      id: `act-market-${topMarket.id}`,
      title: `Pursue ${topMarket.industry} growth opportunity`,
      reason: `${formatCurrency(topMarket.estimatedMarket, { compact: true })} estimated market at ${topMarket.penetration}% penetration (demo signal).`,
      priority: priorityFromScore(60, 40),
      source: "Market",
      impact: 60,
      urgency: 40,
      confidence: "Low",
      effort: 55,
      suggestedAction: topMarket.recommendedAction,
    });
  }

  return actions.sort((a, b) => priorityScore(b) - priorityScore(a));
}
