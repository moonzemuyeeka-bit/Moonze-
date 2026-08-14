import { getOpportunities } from "@/lib/repositories";
import { biggestLeakage } from "@/lib/services/funnel";
import { bottleneckStage, totalCycle } from "@/lib/services/cycle";
import { getKpiSummary } from "@/lib/services/metrics";
import { allScorecards } from "@/lib/services/team";
import type { DiagnosticCategory } from "@/lib/types";

// AI-generated diagnostic assessment. Scores are heuristic weights derived
// from available in-app data — NOT scientifically validated predictions.
export function diagnosePerformance(): {
  categories: DiagnosticCategory[];
  headline: string;
} {
  const kpi = getKpiSummary();
  const leakage = biggestLeakage();
  const bottleneck = bottleneckStage();
  const cycle = totalCycle();
  const scorecards = allScorecards();
  const opps = getOpportunities();

  const lost = opps.filter((o) => o.stage === "Closed Lost");
  const lostBy = (reason: string) =>
    lost.filter((o) => o.lostReason === reason).length;
  const priceLost = lostBy("Price") + lostBy("Missing feature");
  const competitorLost = lostBy("Competitor");
  const timingLost = lostBy("No decision") + lostBy("Budget frozen") + lostBy("Timing");

  const conversionDrop = kpi.prevConversionPct - kpi.conversionPct;
  const cycleIncrease = cycle.changePct;
  const weakReps = scorecards.filter((s) => s.status !== "Performing").length;

  // Raw weights (higher = more likely a contributor)
  let market = 12 + competitorLost * 4;
  let people = 10 + weakReps * 5 + Math.max(0, conversionDrop) * 1.2;
  let process =
    14 + Math.max(0, cycleIncrease) * 0.6 + (leakage?.leakagePct ?? 0) * 0.25 + timingLost * 2;
  let product = 8 + priceLost * 4;

  const total = market + people + process + product;
  const norm = (n: number) => Math.round((n / total) * 100);
  market = norm(market);
  people = norm(people);
  process = norm(process);
  product = 100 - market - people - process; // ensure sums to 100

  const unsorted: DiagnosticCategory[] = [
    {
      category: "Market",
      score: market,
      rationale: `Competitive losses (${competitorLost}) and mixed industry demand are moderate external factors.`,
      signals: [
        `${competitorLost} deals lost to competitors`,
        "Manufacturing demand softening (market signal)",
        "Healthcare and Technology demand rising",
      ],
    },
    {
      category: "People",
      score: people,
      rationale: `${weakReps} of ${scorecards.length} reps are below target; conversion has moved ${conversionDrop >= 0 ? "down" : "up"} ${Math.abs(conversionDrop).toFixed(0)} pts.`,
      signals: [
        `${weakReps} reps flagged Needs Attention or Critical`,
        `Team conversion ${kpi.conversionPct.toFixed(0)}% vs ${kpi.prevConversionPct.toFixed(0)}% prior`,
        "Qualification skill gaps in lower-coverage territories",
      ],
    },
    {
      category: "Process",
      score: process,
      rationale: `${bottleneck.stage} time changed ${bottleneck.changePct >= 0 ? "+" : ""}${bottleneck.changePct}% and ${leakage?.stage ?? "a mid-funnel"} stage shows the largest leakage.`,
      signals: [
        `${bottleneck.stage}: ${bottleneck.currentDays}d vs ${bottleneck.previousDays}d prior`,
        `Overall sales cycle ${cycle.changePct >= 0 ? "+" : ""}${cycle.changePct}%`,
        leakage
          ? `${leakage.stage} leakage at ${leakage.leakagePct?.toFixed(0)}%`
          : "Funnel leakage elevated",
      ],
    },
    {
      category: "Product",
      score: product,
      rationale: `${priceLost} deals lost to price or feature gaps — a smaller but real contributor.`,
      signals: [
        `${priceLost} losses attributed to price / missing features`,
        "Penetration below regional average in several accounts",
        "Value proposition strong in Analytics and Compliance",
      ],
    },
  ];
  const categories = [...unsorted].sort((a, b) => b.score - a.score);

  const top = categories[0];
  const headline = `The strongest intervention opportunity appears to be ${top.category.toLowerCase()} (${top.score}%): ${top.rationale}`;

  return { categories, headline };
}
