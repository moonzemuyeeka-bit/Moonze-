import { formatPercent } from "@/lib/utils";
import { getDataset } from "@/lib/repositories";
import { getKpiSummary, territoryCoverage } from "@/lib/services/metrics";
import { allAccountHealth } from "@/lib/services/accounts";
import { allScorecards } from "@/lib/services/team";

export interface DailyBriefing {
  greeting: string;
  yesterday: { revenue: number; target: number; achievementPct: number };
  developments: string[];
  priorities: string[];
}

export function dailyBriefing(): DailyBriefing {
  const ds = getDataset();
  const kpi = getKpiSummary();
  const cov = territoryCoverage().sort((a, b) => a.coverage - b.coverage)[0];
  const critical = allAccountHealth().filter((h) => h.tier === "Critical");
  const worstRep = allScorecards()[0];

  // "Yesterday" figures scaled from the current period for demo purposes.
  const yRevenue = Math.round(kpi.revenue / 8);
  const yTarget = Math.round(kpi.revenueTarget / 8);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const wonYesterday = ds.opportunities.filter(
    (o) => o.stage === "Closed Won" && o.cohort === "current",
  ).length;

  return {
    greeting,
    yesterday: {
      revenue: yRevenue,
      target: yTarget,
      achievementPct: (yRevenue / yTarget) * 100,
    },
    developments: [
      `${Math.max(3, Math.round(wonYesterday / 6))} deals closed in the last day.`,
      `Pipeline coverage is ${kpi.pipelineCoverage.toFixed(1)}x across the region.`,
      `${cov.territory.name} territory pipeline is the weakest at ${cov.coverage.toFixed(1)}x coverage.`,
      `${critical.length} strategic account${critical.length === 1 ? "" : "s"} ${critical.length === 1 ? "is" : "are"} now high risk.`,
    ],
    priorities: [
      `Review the ${cov.territory.name} territory pipeline.`,
      critical.length
        ? `Contact ${critical[0].account.name} (health ${critical[0].healthScore}/100).`
        : "Protect your at-risk accounts.",
      `Coach ${worstRep.salesperson.name} (${formatPercent(worstRep.achievementPct)} to target).`,
      "Escalate the sales-process approval delays.",
    ],
  };
}
