import { Building2, HeartPulse, AlertTriangle, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { AskAiButton } from "@/components/shared/ask-ai-button";
import { InsightBanner } from "@/components/shared/insight-banner";
import { SetCopilotContext } from "@/components/layout/page-context";
import { AccountsExplorer } from "@/components/accounts/accounts-explorer";
import { allAccountHealth } from "@/lib/services/accounts";
import { formatCurrency } from "@/lib/utils";

export default function AccountsPage() {
  const health = allAccountHealth();
  const withIndustry = health.map((h) => ({ ...h, industry: h.account.industry }));
  const industries = Array.from(new Set(health.map((h) => h.account.industry))).sort();
  const territories = Array.from(new Set(health.map((h) => h.territoryName))).sort();

  const atRisk = health.filter((h) => h.tier !== "Healthy");
  const critical = health.filter((h) => h.tier === "Critical");
  const revenueAtRisk = atRisk.reduce((a, b) => a + b.account.annualRevenue, 0);
  const totalExpansion = health.reduce((a, b) => a + b.expansionPotential, 0);
  const worst = health[0];

  return (
    <div className="space-y-6">
      <SetCopilotContext module="accounts" label="Accounts" />
      <PageHeader
        title="Accounts"
        description="B2B account management with a customer health score for every account — connecting commercial and customer-experience signals."
        actions={<AskAiButton question="Which customer is most at risk?" label="Most at-risk account?" />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Accounts" value={String(health.length)} icon={Building2} />
        <MetricCard label="Revenue at risk" value={formatCurrency(revenueAtRisk, { compact: true })} icon={AlertTriangle} emphasis="warning" />
        <MetricCard label="Critical accounts" value={String(critical.length)} icon={HeartPulse} emphasis="negative" />
        <MetricCard label="Expansion headroom" value={formatCurrency(totalExpansion, { compact: true })} icon={TrendingUp} emphasis="positive" />
      </div>

      <InsightBanner tone="negative" action={{ label: "Review account", href: `/accounts/${worst.account.id}` }}>
        {worst.account.name} is the most at-risk account (health {worst.healthScore}/100, {worst.openIssues} open issue{worst.openIssues === 1 ? "" : "s"}
        {worst.daysToRenewal !== null ? `, renewal in ${worst.daysToRenewal} days` : ""}). Resolve outstanding issues before renewal.
      </InsightBanner>

      <AccountsExplorer accounts={withIndustry} industries={industries} territories={territories} />
    </div>
  );
}
