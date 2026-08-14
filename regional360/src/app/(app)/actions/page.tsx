import { PageHeader } from "@/components/shared/page-header";
import { AskAiButton } from "@/components/shared/ask-ai-button";
import { SetCopilotContext } from "@/components/layout/page-context";
import { ActionCentre } from "@/components/actions/action-centre";
import { buildRecommendedActions } from "@/lib/services/actions";
import { getSalespeople } from "@/lib/repositories";

export default function ActionsPage() {
  const actions = buildRecommendedActions();
  const owners = getSalespeople().map((s) => s.name);

  return (
    <div className="space-y-6">
      <SetCopilotContext module="actions" label="Action Centre" />
      <PageHeader
        title="Action Centre"
        description="What should I do? Prioritised recommendations aggregated from performance, team, accounts, pipeline, market and customer risk — ranked by impact, urgency, confidence and effort."
        actions={<AskAiButton question="Prepare my regional performance meeting." label="Prepare meeting" />}
      />
      <ActionCentre serverActions={actions} owners={owners} />
    </div>
  );
}
