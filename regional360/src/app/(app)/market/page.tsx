import { Radar, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { AskAiButton } from "@/components/shared/ask-ai-button";
import { DemoBadge } from "@/components/shared/demo-badge";
import { SetCopilotContext } from "@/components/layout/page-context";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { getMarketSignals } from "@/lib/repositories";
import { formatCurrency } from "@/lib/utils";

const OPP_VARIANT: Record<string, "success" | "warning" | "muted"> = {
  High: "success",
  Medium: "warning",
  Low: "muted",
};

export default function MarketPage() {
  const signals = getMarketSignals();
  const ranked = [...signals].sort((a, b) => b.estimatedMarket - a.estimatedMarket);

  return (
    <div className="space-y-6">
      <SetCopilotContext module="market" label="Market Radar" />
      <PageHeader
        title="Market Radar"
        description="Market trends, competitor activity and territory opportunity. Use the Opportunity Radar to prioritise where to expand."
        actions={
          <>
            <DemoBadge />
            <AskAiButton question="Where is our biggest growth opportunity?" label="Biggest opportunity?" />
          </>
        }
      />

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Radar className="mt-0.5 h-4 w-4 shrink-0" />
        Market signals shown here are demo/generated data for illustration and are not
        verified real-world facts. Connect an external market-intelligence source in production.
      </div>

      <Card>
        <CardHeader><CardTitle>Estimated market by industry</CardTitle></CardHeader>
        <CardContent>
          <SimpleBarChart
            horizontal
            height={260}
            format="currency"
            data={ranked.map((s) => ({
              label: s.industry,
              value: s.estimatedMarket,
              color: s.opportunity === "High" ? "var(--chart-3)" : s.opportunity === "Medium" ? "var(--chart-4)" : "var(--chart-5)",
            }))}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="h-5 w-5 text-muted-foreground" /> Opportunity Radar
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ranked.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{s.industry}</CardTitle>
                  <Badge variant={OPP_VARIANT[s.opportunity]}>{s.opportunity}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{s.headline}</p>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold">{formatCurrency(s.estimatedMarket, { compact: true })}</span>
                  <Badge variant="outline">{s.signalType}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Current penetration</span>
                    <span>{s.penetration}%</span>
                  </div>
                  <Progress value={s.penetration} />
                </div>
                <div className="flex items-start gap-1.5 rounded-lg bg-muted/60 p-2.5 text-sm">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {s.recommendedAction}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
