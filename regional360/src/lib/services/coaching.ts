import { formatPercent } from "@/lib/utils";
import { repScorecard } from "@/lib/services/team";
import { salespersonById } from "@/lib/repositories";
import type { RepScorecard } from "@/lib/types";

export interface CoachingPlan {
  scorecard: RepScorecard;
  summary: string;
  strengths: string[];
  developmentAreas: string[];
  likelyCauses: string[];
  recommendedCoaching: string;
  weeks: { week: number; focus: string; activities: { id: string; label: string }[] }[];
}

export function coachingPlan(salespersonId: string): CoachingPlan | null {
  const sp = salespersonById(salespersonId);
  if (!sp) return null;
  const s = repScorecard(sp);

  const lowCoverage = s.pipelineCoverage < 2.2;
  const lowConversion = s.conversionPct < 22;
  const lowActivity = s.activityScore < 65;

  const strengths: string[] = [];
  if (s.activityScore >= 70) strengths.push(`Strong activity level (${s.activityScore}/100).`);
  if (s.avgDealSize > 90000) strengths.push("Wins larger-than-average deals.");
  if (s.retentionPct >= 85) strengths.push(`Good account retention (${formatPercent(s.retentionPct)}).`);
  if (s.trendPct > 0) strengths.push(`Positive revenue trend (+${s.trendPct.toFixed(0)}%).`);
  if (strengths.length === 0) strengths.push("Engaged and coachable; responds to structured plans.");

  const developmentAreas: string[] = [];
  if (lowCoverage) developmentAreas.push(`Pipeline coverage (${s.pipelineCoverage.toFixed(1)}x) below the 3x target.`);
  if (lowConversion) developmentAreas.push(`Conversion (${formatPercent(s.conversionPct)}) below the healthy range.`);
  if (lowActivity) developmentAreas.push("Prospecting cadence and activity volume.");
  if (developmentAreas.length === 0) developmentAreas.push("Consistency of forecast accuracy.");

  const likelyCauses: string[] = [];
  if (lowCoverage && !lowActivity)
    likelyCauses.push("Insufficient qualified pipeline rather than low activity — targeting/qualification gap.");
  if (lowConversion)
    likelyCauses.push("Deals stalling mid-funnel; discovery may be too shallow to build urgency.");
  if (lowActivity) likelyCauses.push("Prospecting volume too low to sustain coverage.");
  if (likelyCauses.length === 0) likelyCauses.push("Execution is broadly sound; refine forecasting discipline.");

  const summary = `${sp.name} is at ${formatPercent(s.achievementPct)} of target with ${s.pipelineCoverage.toFixed(1)}x coverage and ${formatPercent(s.conversionPct)} conversion (${s.status}). ${
    lowCoverage
      ? "The primary issue appears to be insufficient qualified pipeline rather than low activity. Coaching should focus on prospect qualification and territory targeting."
      : lowConversion
        ? "The primary issue appears to be mid-funnel conversion. Coaching should focus on discovery depth and closing technique."
        : "Performance is close to target; focus on consistency and forecast accuracy."
  }`;

  const recommendedCoaching = lowCoverage
    ? "Weekly qualification reviews and a territory-targeting plan to rebuild coverage."
    : lowConversion
      ? "Deal-clinic reviews on discovery and closing, paired with a top performer."
      : "Bi-weekly forecast reviews and selective stretch opportunities.";

  const weeks = [
    {
      week: 1,
      focus: "Qualification",
      activities: [
        { id: `${sp.id}-w1a`, label: "Audit open pipeline against qualification criteria" },
        { id: `${sp.id}-w1b`, label: "Disqualify or re-plan 3 low-quality opportunities" },
      ],
    },
    {
      week: 2,
      focus: "Prospecting",
      activities: [
        { id: `${sp.id}-w2a`, label: "Build a target account list in high-performing sectors" },
        { id: `${sp.id}-w2b`, label: "Complete 20 qualified outbound touches" },
      ],
    },
    {
      week: 3,
      focus: "Discovery",
      activities: [
        { id: `${sp.id}-w3a`, label: "Run 3 structured discovery calls with manager review" },
        { id: `${sp.id}-w3b`, label: "Document business impact for each active deal" },
      ],
    },
    {
      week: 4,
      focus: "Review",
      activities: [
        { id: `${sp.id}-w4a`, label: "Review coverage, conversion and cycle vs baseline" },
        { id: `${sp.id}-w4b`, label: "Agree next 30-day targets" },
      ],
    },
  ];

  return {
    scorecard: s,
    summary,
    strengths,
    developmentAreas,
    likelyCauses,
    recommendedCoaching,
    weeks,
  };
}
