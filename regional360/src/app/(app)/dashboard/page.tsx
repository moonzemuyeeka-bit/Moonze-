import Link from "next/link";
import {
  Banknote,
  Target as TargetIcon,
  TrendingUp,
  Layers,
  Gauge,
  Percent,
  Handshake,
  Clock,
  Users,
  UserPlus,
  HeartPulse,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { InsightBanner } from "@/components/shared/insight-banner";
import { AskAiButton } from "@/components/shared/ask-ai-button";
import { PerformancePill } from "@/components/shared/status-pill";
import { SetCopilotContext } from "@/components/layout/page-context";
import { RevenueTrendChart } from "@/components/charts/revenue-trend-chart";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { getDataset } from "@/lib/repositories";
import { getKpiSummary, territoryCoverage } from "@/lib/services/metrics";
import { diagnosePerformance } from "@/lib/services/diagnostics";
import { allScorecards } from "@/lib/services/team";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export default function DashboardPage() {
  const ds = getDataset();
  const kpi = getKpiSummary();
  const diag = diagnosePerformance();
  const coverage = territoryCoverage();
  const scorecards = allScorecards();

  const behind = kpi.achievementPct < 100;

  return (
    <div className="space-y-6">
      <SetCopilotContext module="dashboard" label="Executive Dashboard" />
      <PageHeader
        title="Executive Dashboard"
        description={`${ds.region.name} · regional performance at a glance, with the diagnosis and the next action behind every metric.`}
        actions={
          <>
            <AskAiButton question="Summarise this week's performance." label="Summarise week" />
            <AskAiButton question="Why are we behind target?" label="Why behind target?" variant="default" />
          </>
        }
      />

      <InsightBanner
        tone={behind ? "warning" : "default"}
        action={{ label: "Diagnose performance", href: "/performance" }}
      >
        Revenue is at <strong>{formatPercent(kpi.achievementPct)}</strong> of target
        ({formatCurrency(kpi.revenue, { compact: true })} of {formatCurrency(kpi.revenueTarget, { compact: true })}).
        Leading diagnosis: <strong>{diag.categories[0].category} ({diag.categories[0].score}%)</strong>. {diag.headline}
      </InsightBanner>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={formatCurrency(kpi.revenue, { compact: true })}
          sub={`Target ${formatCurrency(kpi.revenueTarget, { compact: true })}`}
          trend={{ value: kpi.revenueGrowthPct }}
          icon={Banknote}
          emphasis={behind ? "warning" : "positive"}
          diagnosis="Pipeline contraction is the largest contributor."
          action={{ label: "Investigate", href: "/performance" }}
        />
        <MetricCard
          label="Target achievement"
          value={formatPercent(kpi.achievementPct)}
          sub={`${formatCurrency(kpi.revenueTarget - kpi.revenue, { compact: true })} gap to target`}
          icon={TargetIcon}
          emphasis={behind ? "negative" : "positive"}
        />
        <MetricCard
          label="Pipeline value"
          value={formatCurrency(kpi.pipelineValue, { compact: true })}
          sub={`Weighted ${formatCurrency(kpi.weightedPipeline, { compact: true })}`}
          icon={Layers}
          action={{ label: "View pipeline", href: "/pipeline" }}
        />
        <MetricCard
          label="Pipeline coverage"
          value={`${kpi.pipelineCoverage.toFixed(1)}x`}
          sub="Target 3.0x"
          icon={Gauge}
          emphasis={kpi.pipelineCoverage < 3 ? "warning" : "positive"}
          diagnosis={`Coverage below target constrains future revenue.`}
        />
        <MetricCard
          label="Conversion rate"
          value={formatPercent(kpi.conversionPct)}
          sub={`Was ${formatPercent(kpi.prevConversionPct)}`}
          trend={{ value: kpi.conversionPct - kpi.prevConversionPct }}
          icon={Percent}
          action={{ label: "Why?", href: "/performance" }}
        />
        <MetricCard
          label="Avg deal size"
          value={formatCurrency(kpi.avgDealSize, { compact: true })}
          icon={Handshake}
        />
        <MetricCard
          label="Avg sales cycle"
          value={`${Math.round(kpi.avgSalesCycleDays)} days`}
          sub={`Was ${Math.round(kpi.prevSalesCycleDays)} days`}
          trend={{ value: ((kpi.avgSalesCycleDays - kpi.prevSalesCycleDays) / (kpi.prevSalesCycleDays || 1)) * 100, invert: true }}
          icon={Clock}
          emphasis={kpi.avgSalesCycleDays > kpi.prevSalesCycleDays ? "warning" : "positive"}
          action={{ label: "Sales cycle", href: "/performance" }}
        />
        <MetricCard
          label="Revenue growth"
          value={formatPercent(kpi.revenueGrowthPct, 1)}
          sub="vs previous period"
          trend={{ value: kpi.revenueGrowthPct }}
          icon={TrendingUp}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="New customers" value={formatNumber(kpi.newCustomers)} icon={UserPlus} />
        <MetricCard
          label="Retention"
          value={formatPercent(kpi.retentionPct)}
          icon={HeartPulse}
          emphasis="positive"
        />
        <MetricCard
          label="Churn"
          value={formatPercent(kpi.churnPct)}
          icon={HeartPulse}
          emphasis={kpi.churnPct > 12 ? "warning" : "default"}
        />
        <MetricCard
          label="Team status"
          value={`${kpi.performingReps}/${kpi.totalReps}`}
          sub={`${kpi.needsAttentionReps} watch · ${kpi.criticalReps} critical`}
          icon={Users}
          action={{ label: "Team", href: "/team" }}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue vs target</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={ds.revenueHistory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Territory coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              horizontal
              height={240}
              format="multiple"
              data={coverage.map((c) => ({
                label: c.territory.name,
                value: Number(c.coverage.toFixed(2)),
                color: c.coverage < 2 ? "var(--chart-5)" : c.coverage < 3 ? "var(--chart-4)" : "var(--chart-3)",
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Team snapshot */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Reps needing attention</CardTitle>
          <Link href="/team" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View team <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {scorecards
            .filter((s) => s.status !== "Performing")
            .slice(0, 4)
            .map((s) => (
              <div
                key={s.salesperson.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.salesperson.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.territoryName} · {formatPercent(s.achievementPct)} to target · {s.pipelineCoverage.toFixed(1)}x coverage
                  </p>
                </div>
                <PerformancePill status={s.status} />
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
