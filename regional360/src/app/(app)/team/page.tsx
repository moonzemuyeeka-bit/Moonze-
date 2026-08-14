import { Users, UserCheck, UserMinus, UserX } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { AskAiButton } from "@/components/shared/ask-ai-button";
import { InsightBanner } from "@/components/shared/insight-banner";
import { SetCopilotContext } from "@/components/layout/page-context";
import { TeamTable } from "@/components/team/team-table";
import { getSalespeople } from "@/lib/repositories";
import { allScorecards } from "@/lib/services/team";
import { coachingPlan } from "@/lib/services/coaching";

export default function TeamPage() {
  const scorecards = allScorecards();
  const plans = getSalespeople()
    .map((sp) => coachingPlan(sp.id)!)
    .sort((a, b) => a.scorecard.achievementPct - b.scorecard.achievementPct);

  const performing = scorecards.filter((s) => s.status === "Performing").length;
  const attention = scorecards.filter((s) => s.status === "Needs Attention").length;
  const critical = scorecards.filter((s) => s.status === "Critical").length;
  const worst = scorecards[0];

  return (
    <div className="space-y-6">
      <SetCopilotContext module="team" label="Team Command Centre" />
      <PageHeader
        title="Team Command Centre"
        description="Performance, coverage and conversion for every salesperson — with AI coaching plans. Statuses derive from configurable thresholds."
        actions={<AskAiButton question="Which salesperson needs attention?" label="Who needs coaching?" />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Team size" value={String(scorecards.length)} icon={Users} />
        <MetricCard label="Performing" value={String(performing)} icon={UserCheck} emphasis="positive" />
        <MetricCard label="Needs attention" value={String(attention)} icon={UserMinus} emphasis="warning" />
        <MetricCard label="Critical" value={String(critical)} icon={UserX} emphasis="negative" />
      </div>

      <InsightBanner tone="warning">
        {worst.salesperson.name} needs the most support — {worst.attentionReason} Use the Coach button to open the AI-recommended 30-day development plan.
      </InsightBanner>

      <TeamTable plans={plans} />
    </div>
  );
}
