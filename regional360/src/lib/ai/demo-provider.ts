import { formatCurrency, formatPercent } from "@/lib/utils";
import { getKpiSummary, territoryCoverage } from "@/lib/services/metrics";
import { allScorecards } from "@/lib/services/team";
import { allAccountHealth, crossSellRecommendations } from "@/lib/services/accounts";
import { buildFunnel, biggestLeakage } from "@/lib/services/funnel";
import { cycleStageBreakdown, bottleneckStage, totalCycle } from "@/lib/services/cycle";
import { diagnosePerformance } from "@/lib/services/diagnostics";
import { getMarketSignals } from "@/lib/repositories";
import type { AIAnswer, AIContext, AIProvider } from "@/lib/ai/types";

function matches(q: string, terms: string[]) {
  const s = q.toLowerCase();
  return terms.some((t) => s.includes(t));
}

// -- Intent builders ---------------------------------------------------------

function whyBehindTarget(): AIAnswer {
  const kpi = getKpiSummary();
  const gap = 100 - kpi.achievementPct;
  const cov = territoryCoverage().sort((a, b) => a.coverage - b.coverage)[0];
  const leak = biggestLeakage();
  const bottleneck = bottleneckStage();
  const diag = diagnosePerformance();
  const convDrop = kpi.prevConversionPct - kpi.conversionPct;

  return {
    title: "Why are we behind target?",
    summary: `Regional revenue is currently ${formatPercent(kpi.achievementPct)} of target (${formatCurrency(kpi.revenue, { compact: true })} of ${formatCurrency(kpi.revenueTarget, { compact: true })}), a ${formatPercent(Math.max(0, gap))} gap.`,
    diagnosis: [
      `Pipeline coverage in the ${cov.territory.name} territory has fallen to ${cov.coverage.toFixed(1)}x.`,
      `Opportunity-to-close conversion has moved from ${formatPercent(kpi.prevConversionPct)} to ${formatPercent(kpi.conversionPct)}${convDrop > 0 ? ` (down ${convDrop.toFixed(0)} pts)` : ""}.`,
      `${bottleneck.stage} time has increased ${bottleneck.changePct >= 0 ? "+" : ""}${bottleneck.changePct}% (${bottleneck.previousDays}d → ${bottleneck.currentDays}d).`,
    ],
    recommendations: [
      "Review approval bottlenecks and set an SLA on the slowest stage.",
      "Coach the reps with the largest conversion decline.",
      "Redirect prospecting toward higher-performing sectors to rebuild coverage.",
    ],
    why: `The diagnostic weights point primarily at ${diag.categories[0].category.toLowerCase()} (${diag.categories[0].score}%) rather than activity alone — ${leak ? `the ${leak.stage} stage shows the largest funnel leakage at ${leak.leakagePct?.toFixed(0)}%` : "mid-funnel leakage is elevated"}.`,
    confidence: "Medium",
    confidenceReason:
      "Based on revenue, pipeline coverage, conversion and cycle-time data. External market conditions have not been independently verified.",
    supportingData: [
      { label: "Revenue vs target", value: `${formatCurrency(kpi.revenue, { compact: true })} / ${formatCurrency(kpi.revenueTarget, { compact: true })}` },
      { label: "Achievement", value: formatPercent(kpi.achievementPct) },
      { label: `${cov.territory.name} coverage`, value: `${cov.coverage.toFixed(1)}x` },
      { label: "Conversion (now vs prior)", value: `${formatPercent(kpi.conversionPct)} vs ${formatPercent(kpi.prevConversionPct)}` },
      { label: `${bottleneck.stage} time`, value: `${bottleneck.currentDays}d (${bottleneck.changePct >= 0 ? "+" : ""}${bottleneck.changePct}%)` },
    ],
    suggestedActions: [
      { label: "Create 30-day recovery plan", kind: "create-plan" },
      { label: "Investigate further", kind: "investigate", href: "/performance" },
      { label: "View supporting data", kind: "view-data", href: "/performance" },
    ],
    followUps: [
      "Give me a plan to close the revenue gap.",
      "Which salesperson needs attention?",
      "Why has conversion declined?",
    ],
    source: "demo",
  };
}

function whoNeedsAttention(): AIAnswer {
  const cards = allScorecards();
  const teamAvg = cards.reduce((a, b) => a + b.conversionPct, 0) / cards.length;
  const critical = cards.filter((c) => c.status !== "Performing");
  const worst = cards[0];
  return {
    title: "Which salesperson needs attention?",
    summary: `${critical.length} of ${cards.length} reps need attention. ${worst.salesperson.name} needs the most support at ${formatPercent(worst.achievementPct)} of target.`,
    diagnosis: critical
      .slice(0, 3)
      .map(
        (c) =>
          `${c.salesperson.name} (${c.territoryName}): ${formatPercent(c.achievementPct)} to target, ${c.pipelineCoverage.toFixed(1)}x coverage, ${formatPercent(c.conversionPct)} conversion — ${c.status}.`,
      ),
    recommendations: [
      `${worst.salesperson.name}: ${worst.pipelineCoverage < 2 ? "insufficient qualified pipeline — coach on qualification and territory targeting" : "coach on discovery depth and closing technique"}.`,
      "Pair lower-conversion reps with a top performer for deal reviews.",
      "Set a weekly pipeline-generation target for reps below 2x coverage.",
    ],
    why: `Statuses derive from configured thresholds. ${worst.salesperson.name}'s coverage of ${worst.pipelineCoverage.toFixed(1)}x suggests the issue is pipeline volume/quality rather than raw activity (${worst.activityScore}/100 activity).`,
    confidence: "Medium",
    confidenceReason:
      "Based on target achievement, pipeline coverage and conversion. Individual context (accounts, ramp) should be confirmed in a 1:1.",
    supportingData: [
      { label: "Team avg conversion", value: formatPercent(teamAvg) },
      { label: `${worst.salesperson.name} achievement`, value: formatPercent(worst.achievementPct) },
      { label: `${worst.salesperson.name} coverage`, value: `${worst.pipelineCoverage.toFixed(1)}x` },
      { label: "Reps below target", value: `${critical.length}/${cards.length}` },
    ],
    suggestedActions: [
      { label: "Create coaching plan", kind: "create-plan", href: "/team" },
      { label: "Open Team Command Centre", kind: "open", href: "/team" },
    ],
    followUps: [
      `Give me a coaching plan for ${worst.salesperson.name}.`,
      "Which territory should receive more attention?",
    ],
    source: "demo",
  };
}

function accountsAtRisk(): AIAnswer {
  const health = allAccountHealth().filter((h) => h.tier !== "Healthy");
  const worst = health[0];
  const atStake = health.reduce((a, b) => a + b.account.annualRevenue, 0);
  return {
    title: "Which accounts are at risk?",
    summary: `${health.length} accounts are At Risk or Critical, representing ${formatCurrency(atStake, { compact: true })} of annual revenue. ${worst.account.name} is the most urgent.`,
    diagnosis: health
      .slice(0, 4)
      .map(
        (h) =>
          `${h.account.name}: health ${h.healthScore}/100 (${h.tier}), revenue ${h.account.revenueTrendPct}% , ${h.openIssues} open issue${h.openIssues === 1 ? "" : "s"}${h.daysToRenewal !== null ? `, renewal in ${h.daysToRenewal}d` : ""}.`,
      ),
    recommendations: [
      `${worst.account.name}: schedule an executive account review and resolve the ${worst.openIssues} outstanding issue${worst.openIssues === 1 ? "" : "s"} before renewal.`,
      "Prioritise accounts with a renewal inside 60 days and declining engagement.",
      "Assign a service-recovery owner to each Critical account.",
    ],
    why: `Health scores combine revenue trend, engagement, open issues, contact recency, renewal proximity and product penetration. ${worst.account.name} is driven down by ${worst.signals.filter((s) => s.impact < 0).slice(0, 2).map((s) => s.label.toLowerCase()).join(" and ")}.`,
    confidence: worst.tier === "Critical" ? "High" : "Medium",
    confidenceReason:
      "Based on commercial and customer-experience signals in the app. External relationship context should be confirmed with the account owner.",
    supportingData: [
      { label: "At-risk / critical accounts", value: `${health.length}` },
      { label: "Revenue at stake", value: formatCurrency(atStake, { compact: true }) },
      { label: `${worst.account.name} health`, value: `${worst.healthScore}/100` },
      { label: `${worst.account.name} open issues`, value: `${worst.openIssues}` },
    ],
    suggestedActions: [
      { label: "Create account review action", kind: "create-plan", href: "/accounts" },
      { label: "Open Accounts", kind: "open", href: "/accounts" },
    ],
    followUps: [
      "Which customers should I call today?",
      "Where is our biggest growth opportunity?",
    ],
    source: "demo",
  };
}

function customersToCall(): AIAnswer {
  const health = allAccountHealth();
  const priority = health
    .filter((h) => h.tier !== "Healthy" || (h.daysToRenewal ?? 999) < 45)
    .slice(0, 5);
  return {
    title: "Which customers should I call today?",
    summary: `Your five highest-priority calls balance revenue at risk, open issues and renewal timing.`,
    diagnosis: priority.map(
      (h, i) =>
        `${i + 1}. ${h.account.name} (${h.ownerName}) — ${formatCurrency(h.account.annualRevenue, { compact: true })}, health ${h.healthScore}/100${h.openIssues ? `, ${h.openIssues} open issue${h.openIssues === 1 ? "" : "s"}` : ""}${h.daysToRenewal !== null ? `, renewal ${h.daysToRenewal}d` : ""}.`,
    ),
    recommendations: [
      `Start with ${priority[0].account.name}: highest revenue-at-risk with the nearest renewal.`,
      "Lead each call by acknowledging open issues before commercial topics.",
      "Log next contact dates so at-risk accounts don't slip.",
    ],
    why: "Prioritisation weights revenue exposure, health tier, open complaints and renewal proximity.",
    confidence: "Medium",
    confidenceReason: "Based on account health and renewal data available in the app.",
    supportingData: priority
      .slice(0, 3)
      .map((h) => ({ label: h.account.name, value: `${h.healthScore}/100` })),
    suggestedActions: [
      { label: "Add calls to Action Centre", kind: "create-plan", href: "/actions" },
      { label: "Open Accounts", kind: "open", href: "/accounts" },
    ],
    followUps: ["Which accounts are at risk?", "Prepare my regional performance meeting."],
    source: "demo",
  };
}

function growthOpportunity(): AIAnswer {
  const market = getMarketSignals()
    .filter((m) => m.opportunity === "High")
    .sort((a, b) => b.estimatedMarket - a.estimatedMarket)[0];
  // Also find biggest cross-sell across accounts
  const health = allAccountHealth();
  const expansion = [...health].sort(
    (a, b) => b.expansionPotential - a.expansionPotential,
  )[0];
  const cross = crossSellRecommendations(expansion.account)[0];
  return {
    title: "Where is our biggest growth opportunity?",
    summary: `Two strong plays: the ${market.industry} market (${formatCurrency(market.estimatedMarket, { compact: true })} at ${market.penetration}% penetration) and expanding ${expansion.account.name} (${formatCurrency(expansion.expansionPotential, { compact: true })} untapped).`,
    diagnosis: [
      `${market.industry}: ${market.headline} — demo market signal, ${market.penetration}% current penetration.`,
      `${expansion.account.name}: penetration ${expansion.penetrationPct.toFixed(0)}%, ${formatCurrency(expansion.expansionPotential, { compact: true })} expansion headroom.`,
      cross
        ? `${cross.product.name} is used by ${cross.peerAdoptionPct}% of similar ${expansion.account.industry} accounts but not by ${expansion.account.name}.`
        : "Cross-sell whitespace exists across strategic accounts.",
    ],
    recommendations: [
      market.recommendedAction + " (label as demo-generated market data).",
      cross
        ? `Position ${cross.product.name} into ${expansion.account.name} — strongest peer-adoption signal.`
        : "Build an account expansion plan for the lowest-penetration strategic accounts.",
    ],
    why: `Market items are clearly-labelled demo signals; the account expansion figure is computed from potential minus current revenue and peer product adoption.`,
    confidence: "Low",
    confidenceReason:
      "Market signals are demo/generated data and not verified real-world facts; account expansion is data-driven but assumes peer comparability.",
    supportingData: [
      { label: `${market.industry} market`, value: formatCurrency(market.estimatedMarket, { compact: true }) },
      { label: `${expansion.account.name} penetration`, value: formatPercent(expansion.penetrationPct) },
      { label: "Expansion headroom", value: formatCurrency(expansion.expansionPotential, { compact: true }) },
    ],
    suggestedActions: [
      { label: "Create growth action", kind: "create-plan", href: "/actions" },
      { label: "Open Market Radar", kind: "open", href: "/market" },
    ],
    followUps: ["What are the biggest risks in my region?", "Summarise this week's performance."],
    source: "demo",
  };
}

function conversionDeclined(): AIAnswer {
  const kpi = getKpiSummary();
  const funnel = buildFunnel();
  const leak = biggestLeakage();
  return {
    title: "Why has conversion declined?",
    summary: `Opportunity-to-close conversion is ${formatPercent(kpi.conversionPct)} versus ${formatPercent(kpi.prevConversionPct)} previously. The drop is concentrated at a single funnel stage.`,
    diagnosis: [
      leak
        ? `${leak.stage} → next conversion is ${leak.conversionToNextPct?.toFixed(0)}% (was ${leak.prevConversionToNextPct?.toFixed(0)}%), the largest leakage.`
        : "Mid-funnel leakage has increased.",
      "Deals are stalling before commitment rather than being lost outright.",
      "Lower-coverage territories show the sharpest decline.",
    ],
    recommendations: [
      "Inspect deals stuck at the leaking stage and standardise the next-step play.",
      "Add a qualification checkpoint before proposals to protect win rate.",
      "Coach reps with the largest stage-specific drop.",
    ],
    why: `Comparing current and prior opportunity cohorts isolates the stage where progression fell most${leak ? ` (${leak.stage})` : ""}.`,
    confidence: "Medium",
    confidenceReason: "Based on cohort funnel comparison; qualitative deal notes not analysed.",
    supportingData: funnel
      .filter((f) => f.conversionToNextPct !== null)
      .map((f) => ({
        label: `${f.stage} → next`,
        value: `${f.conversionToNextPct?.toFixed(0)}% (was ${f.prevConversionToNextPct?.toFixed(0)}%)`,
      })),
    suggestedActions: [
      { label: "Investigate funnel", kind: "investigate", href: "/performance" },
      { label: "Create action", kind: "create-plan", href: "/actions" },
    ],
    followUps: ["What is causing our sales cycle to increase?", "Which salesperson needs attention?"],
    source: "demo",
  };
}

function salesCycle(): AIAnswer {
  const breakdown = cycleStageBreakdown();
  const bottleneck = bottleneckStage();
  const total = totalCycle();
  return {
    title: "What is causing our sales cycle to increase?",
    summary: `Average sales cycle is ${total.current} days, ${total.changePct >= 0 ? "up" : "down"} ${Math.abs(total.changePct)}% versus ${total.previous} days previously. ${bottleneck.stage} is the largest contributor.`,
    diagnosis: [
      `${bottleneck.stage}: ${bottleneck.currentDays}d vs ${bottleneck.previousDays}d prior (${bottleneck.changePct >= 0 ? "+" : ""}${bottleneck.changePct}%).`,
      "Other stages are broadly stable, isolating the bottleneck.",
      "Longer cycles are compressing in-quarter closes and coverage.",
    ],
    recommendations: [
      `Set an SLA on ${bottleneck.stage.toLowerCase()} and identify the approval owners.`,
      "Escalate deals exceeding the stage SLA automatically.",
      "Track cycle time weekly until it returns to the prior baseline.",
    ],
    why: `Per-stage durations from won deals show ${bottleneck.stage} rising far more than any other stage.`,
    confidence: "High",
    confidenceReason: "Stage timing is computed directly from closed-won deal data.",
    supportingData: breakdown.map((b) => ({
      label: b.stage,
      value: `${b.currentDays}d (${b.changePct >= 0 ? "+" : ""}${b.changePct}%)`,
    })),
    suggestedActions: [
      { label: "Escalate bottleneck", kind: "create-plan", href: "/actions" },
      { label: "View sales cycle", kind: "view-data", href: "/performance" },
    ],
    followUps: ["Give me a plan to close the revenue gap.", "Why are we behind target?"],
    source: "demo",
  };
}

function recoveryPlan(): AIAnswer {
  const kpi = getKpiSummary();
  const cov = territoryCoverage().sort((a, b) => a.coverage - b.coverage)[0];
  const worst = allScorecards()[0];
  const bottleneck = bottleneckStage();
  const gap = kpi.revenueTarget - kpi.revenue;
  return {
    title: "30-day revenue recovery plan",
    summary: `A focused 30-day plan to close the ${formatCurrency(Math.max(0, gap), { compact: true })} gap by attacking coverage, process and conversion in parallel.`,
    diagnosis: [
      `Week 1 — Process: remove the ${bottleneck.stage.toLowerCase()} bottleneck (${bottleneck.currentDays}d) with an SLA and named owners.`,
      `Week 2 — Pipeline: run a generation sprint in ${cov.territory.name} (coverage ${cov.coverage.toFixed(1)}x) toward high-performing sectors.`,
      `Week 3 — People: coach ${worst.salesperson.name} and peers on qualification/closing; pair with top performers.`,
      "Week 4 — Review: measure conversion, cycle time and coverage against baseline; lock in wins.",
    ],
    recommendations: [
      "Convert each week into tracked actions in the Action Centre.",
      "Protect at-risk revenue with executive account reviews in parallel.",
      "Report progress in the Weekly Business Review.",
    ],
    why: "The plan sequences the highest-leverage, lowest-effort interventions first (process), then rebuilds coverage and conversion.",
    confidence: "Medium",
    confidenceReason: "Based on current diagnostics; impact depends on execution and market stability.",
    supportingData: [
      { label: "Revenue gap", value: formatCurrency(Math.max(0, gap), { compact: true }) },
      { label: `${cov.territory.name} coverage`, value: `${cov.coverage.toFixed(1)}x` },
      { label: "Bottleneck", value: `${bottleneck.stage} ${bottleneck.currentDays}d` },
    ],
    suggestedActions: [
      { label: "Create these as actions", kind: "create-plan", href: "/actions" },
      { label: "Open Action Centre", kind: "open", href: "/actions" },
    ],
    followUps: ["Prepare my regional performance meeting.", "Which accounts are at risk?"],
    source: "demo",
  };
}

function prepareMeeting(): AIAnswer {
  const kpi = getKpiSummary();
  const health = allAccountHealth().filter((h) => h.tier !== "Healthy");
  const diag = diagnosePerformance();
  return {
    title: "Regional performance meeting pack",
    summary: `Talking points for your regional review: performance, the leading diagnosis, team, at-risk accounts and priorities.`,
    diagnosis: [
      `Performance: ${formatCurrency(kpi.revenue, { compact: true })} revenue at ${formatPercent(kpi.achievementPct)} of target, growth ${kpi.revenueGrowthPct >= 0 ? "+" : ""}${kpi.revenueGrowthPct.toFixed(0)}%.`,
      `Leading diagnosis: ${diag.categories[0].category} (${diag.categories[0].score}%).`,
      `Team: ${kpi.performingReps} performing, ${kpi.needsAttentionReps} need attention, ${kpi.criticalReps} critical.`,
      `Accounts: ${health.length} at-risk/critical; pipeline coverage ${kpi.pipelineCoverage.toFixed(1)}x.`,
    ],
    recommendations: [
      "Open with the revenue gap and the single biggest lever (process).",
      "Assign owners to the top 3 actions live in the meeting.",
      "Close with next-week priorities and measurement.",
    ],
    why: "The pack sequences observe → diagnose → decide so the meeting drives decisions, not just status.",
    confidence: "High",
    confidenceReason: "Assembled directly from current in-app metrics.",
    supportingData: [
      { label: "Achievement", value: formatPercent(kpi.achievementPct) },
      { label: "Coverage", value: `${kpi.pipelineCoverage.toFixed(1)}x` },
      { label: "At-risk accounts", value: `${health.length}` },
    ],
    suggestedActions: [
      { label: "Generate Weekly Business Review", kind: "open", href: "/reports" },
      { label: "Open Action Centre", kind: "open", href: "/actions" },
    ],
    followUps: ["Summarise this week's performance.", "What are the biggest risks in my region?"],
    source: "demo",
  };
}

function weekSummary(): AIAnswer {
  const kpi = getKpiSummary();
  const cov = territoryCoverage().sort((a, b) => a.coverage - b.coverage)[0];
  const health = allAccountHealth().filter((h) => h.tier === "Critical");
  return {
    title: "This week's performance summary",
    summary: `Revenue reached ${formatPercent(kpi.achievementPct)} of target with ${kpi.pipelineCoverage.toFixed(1)}x coverage. Momentum is mixed: conversion ${kpi.conversionPct >= kpi.prevConversionPct ? "improved" : "softened"} and cycle time is ${kpi.avgSalesCycleDays >= kpi.prevSalesCycleDays ? "up" : "down"}.`,
    diagnosis: [
      `Revenue ${formatCurrency(kpi.revenue, { compact: true })} vs ${formatCurrency(kpi.revenueTarget, { compact: true })} target.`,
      `${cov.territory.name} remains the weakest territory at ${cov.coverage.toFixed(1)}x coverage.`,
      `${health.length} account${health.length === 1 ? "" : "s"} became critical; retention ${formatPercent(kpi.retentionPct)}.`,
    ],
    recommendations: [
      "Carry the top 3 actions into next week with named owners.",
      "Prioritise the weakest territory for pipeline generation.",
      "Protect critical accounts before their renewals.",
    ],
    why: "Summary compares current metrics to the prior period across revenue, coverage, conversion and cycle.",
    confidence: "Medium",
    confidenceReason: "Based on period-over-period in-app metrics.",
    supportingData: [
      { label: "Achievement", value: formatPercent(kpi.achievementPct) },
      { label: "Conversion", value: `${formatPercent(kpi.conversionPct)} vs ${formatPercent(kpi.prevConversionPct)}` },
      { label: "Retention", value: formatPercent(kpi.retentionPct) },
    ],
    suggestedActions: [
      { label: "Open Weekly Business Review", kind: "open", href: "/reports" },
    ],
    followUps: ["Prepare my regional performance meeting.", "Where is our biggest growth opportunity?"],
    source: "demo",
  };
}

function whichTerritory(): AIAnswer {
  const cov = territoryCoverage().sort((a, b) => a.coverage - b.coverage);
  const weakest = cov[0];
  return {
    title: "Which territory should receive more attention?",
    summary: `${weakest.territory.name} needs the most attention: ${weakest.coverage.toFixed(1)}x coverage and ${formatPercent(weakest.achievementPct)} of target — the lowest in the region.`,
    diagnosis: cov
      .slice(0, 3)
      .map(
        (c) =>
          `${c.territory.name}: ${c.coverage.toFixed(1)}x coverage, ${formatPercent(c.achievementPct)} to target, pipeline ${formatCurrency(c.pipeline, { compact: true })}.`,
      ),
    recommendations: [
      `Run a pipeline-generation sprint in ${weakest.territory.name}.`,
      "Reallocate marketing/SDR support to the weakest coverage first.",
      "Review territory account assignments for whitespace.",
    ],
    why: "Coverage and achievement are computed per territory from open pipeline and closed-won revenue against target.",
    confidence: "High",
    confidenceReason: "Territory metrics computed directly from pipeline and revenue data.",
    supportingData: cov.map((c) => ({
      label: c.territory.name,
      value: `${c.coverage.toFixed(1)}x / ${formatPercent(c.achievementPct)}`,
    })),
    suggestedActions: [
      { label: "Create territory action", kind: "create-plan", href: "/actions" },
      { label: "Open Pipeline", kind: "open", href: "/pipeline" },
    ],
    followUps: ["Why are we behind target?", "Which salesperson needs attention?"],
    source: "demo",
  };
}

function biggestRisks(): AIAnswer {
  const kpi = getKpiSummary();
  const health = allAccountHealth().filter((h) => h.tier !== "Healthy");
  const atStake = health.reduce((a, b) => a + b.account.annualRevenue, 0);
  const cov = territoryCoverage().sort((a, b) => a.coverage - b.coverage)[0];
  const bottleneck = bottleneckStage();
  return {
    title: "What are the biggest risks in my region?",
    summary: `Three risks stand out: revenue-at-risk in the account base, weak coverage in ${cov.territory.name}, and a widening ${bottleneck.stage.toLowerCase()} bottleneck.`,
    diagnosis: [
      `${formatCurrency(atStake, { compact: true })} of revenue sits in ${health.length} at-risk/critical accounts.`,
      `${cov.territory.name} coverage of ${cov.coverage.toFixed(1)}x threatens future quarters.`,
      `${bottleneck.stage} time (${bottleneck.currentDays}d, ${bottleneck.changePct >= 0 ? "+" : ""}${bottleneck.changePct}%) is slowing closes.`,
    ],
    recommendations: [
      "Stand up account-recovery plans for critical accounts before renewals.",
      "Rebuild coverage in the weakest territory now to protect next quarter.",
      "Remove the process bottleneck with an SLA.",
    ],
    why: "Risks are ranked by revenue exposure, forward coverage and cycle-time trend.",
    confidence: "Medium",
    confidenceReason: "Based on account, pipeline and cycle data; external market risk not independently verified.",
    supportingData: [
      { label: "Revenue at risk", value: formatCurrency(atStake, { compact: true }) },
      { label: "Weakest coverage", value: `${cov.territory.name} ${cov.coverage.toFixed(1)}x` },
      { label: "Retention", value: formatPercent(kpi.retentionPct) },
    ],
    suggestedActions: [
      { label: "Review actions", kind: "open", href: "/actions" },
      { label: "Open Accounts", kind: "open", href: "/accounts" },
    ],
    followUps: ["Which customers should I call today?", "Prepare my regional performance meeting."],
    source: "demo",
  };
}

function generalOverview(context: AIContext): AIAnswer {
  // Context-aware default depending on which module the manager is viewing.
  switch (context.module) {
    case "team":
      return whoNeedsAttention();
    case "accounts":
      return accountsAtRisk();
    case "pipeline":
      return conversionDeclined();
    case "market":
      return growthOpportunity();
    case "performance":
      return whyBehindTarget();
    case "reports":
      return weekSummary();
    case "actions":
      return prepareMeeting();
    default: {
      const kpi = getKpiSummary();
      return {
        title: "Regional overview",
        summary: `${formatCurrency(kpi.revenue, { compact: true })} revenue at ${formatPercent(kpi.achievementPct)} of target, ${kpi.pipelineCoverage.toFixed(1)}x pipeline coverage, ${formatPercent(kpi.retentionPct)} retention. Ask me why performance changed, who needs attention, or for a recovery plan.`,
        diagnosis: [
          `${kpi.performingReps} reps performing, ${kpi.needsAttentionReps} need attention, ${kpi.criticalReps} critical.`,
          `Conversion ${formatPercent(kpi.conversionPct)} (was ${formatPercent(kpi.prevConversionPct)}); avg cycle ${Math.round(kpi.avgSalesCycleDays)}d.`,
        ],
        recommendations: [
          "Start with the Action Centre for today's priorities.",
          "Use Diagnose Performance to understand the revenue gap.",
        ],
        why: "This is a high-level snapshot. Ask a specific question for a full diagnosis.",
        confidence: "High",
        confidenceReason: "Computed directly from current in-app metrics.",
        supportingData: [
          { label: "Achievement", value: formatPercent(kpi.achievementPct) },
          { label: "Coverage", value: `${kpi.pipelineCoverage.toFixed(1)}x` },
          { label: "Retention", value: formatPercent(kpi.retentionPct) },
        ],
        suggestedActions: [
          { label: "Open Action Centre", kind: "open", href: "/actions" },
          { label: "Diagnose performance", kind: "investigate", href: "/performance" },
        ],
        followUps: [
          "Why are we behind target?",
          "Which salesperson needs attention?",
          "Which accounts are at risk?",
        ],
        source: "demo",
      };
    }
  }
}

export class DemoAIProvider implements AIProvider {
  name = "demo";

  async ask(question: string, context: AIContext): Promise<AIAnswer> {
    const q = question.trim();
    if (!q) return generalOverview(context);

    if (matches(q, ["recovery plan", "close the revenue gap", "close the gap", "action plan", "30-day", "30 day"]))
      return recoveryPlan();
    if (matches(q, ["behind target", "below target", "missing target", "miss target", "revenue gap", "14%", "why are we", "under target"]))
      return whyBehindTarget();
    if (matches(q, ["needs attention", "who needs", "salesperson", "sales person", "which rep", "coaching", "coach"]) && !matches(q, ["territory"]))
      return whoNeedsAttention();
    if (matches(q, ["at risk", "at-risk", "churn", "risk accounts", "which accounts"]) && !matches(q, ["region", "biggest risk"]))
      return accountsAtRisk();
    if (matches(q, ["call today", "should i call", "who to call", "customers to call", "call"]))
      return customersToCall();
    if (matches(q, ["growth opportunity", "biggest growth", "expansion", "upsell", "cross-sell", "cross sell", "opportunity"]))
      return growthOpportunity();
    if (matches(q, ["conversion", "convert", "win rate"]))
      return conversionDeclined();
    if (matches(q, ["sales cycle", "cycle", "taking longer", "slow down", "slower"]))
      return salesCycle();
    if (matches(q, ["prepare", "meeting", "review pack", "performance meeting", "qbr", "wbr"]))
      return prepareMeeting();
    if (matches(q, ["summarise", "summarize", "this week", "week's", "weekly", "recap"]))
      return weekSummary();
    if (matches(q, ["territory", "which region", "territories"]))
      return whichTerritory();
    if (matches(q, ["biggest risk", "risks in my region", "top risk", "risk", "risks"]))
      return biggestRisks();

    return generalOverview(context);
  }
}
