import { PageHeader } from "@/components/shared/page-header";
import { SetCopilotContext } from "@/components/layout/page-context";
import { ReportGenerator } from "@/components/reports/report-generator";
import { weeklyBusinessReview } from "@/lib/services/report";

export default function ReportsPage() {
  const sections = weeklyBusinessReview();

  return (
    <div className="space-y-6">
      <SetCopilotContext module="reports" label="Reports" />
      <PageHeader
        title="Reports"
        description="AI-generated Weekly Business Review, assembled from your regional performance, pipeline, team, accounts and market data."
      />
      <ReportGenerator sections={sections} period="Aug 14, 2026" />
    </div>
  );
}
