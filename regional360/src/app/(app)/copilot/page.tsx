import { PageHeader } from "@/components/shared/page-header";
import { SetCopilotContext } from "@/components/layout/page-context";
import { CopilotConsole } from "@/components/copilot/copilot-console";
import { aiProviderName } from "@/lib/ai";
import { Badge } from "@/components/ui/badge";

export default function CopilotPage() {
  return (
    <div className="space-y-6">
      <SetCopilotContext module="general" label="AI Copilot" />
      <PageHeader
        title="AI Copilot"
        description="Your regional decision-support assistant. It identifies the relevant data, diagnoses patterns, explains likely causes, and recommends actions you can execute."
        actions={<Badge variant="muted">Provider: {aiProviderName()}</Badge>}
      />
      <CopilotConsole />
    </div>
  );
}
