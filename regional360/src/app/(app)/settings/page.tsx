import { PageHeader } from "@/components/shared/page-header";
import { SetCopilotContext } from "@/components/layout/page-context";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { CsvImport } from "@/components/settings/csv-import";
import { aiProviderName } from "@/lib/ai";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SetCopilotContext module="general" label="Settings" />
      <PageHeader
        title="Settings"
        description="Configure demo mode, status thresholds, the AI provider, and import your own data."
      />
      <SettingsPanel providerName={aiProviderName()} />
      <CsvImport />
    </div>
  );
}
