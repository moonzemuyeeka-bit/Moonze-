import { Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { AskAiButton } from "@/components/shared/ask-ai-button";
import { SetCopilotContext } from "@/components/layout/page-context";
import { DiagnosisPanel } from "@/components/performance/diagnosis-panel";
import { FunnelExplorer } from "@/components/performance/funnel-explorer";
import { getProducts, getSalespeople, getTerritories, accountName, salespersonName } from "@/lib/repositories";
import { enrichedOpportunities } from "@/lib/services/pipeline";
import { diagnosePerformance } from "@/lib/services/diagnostics";
import { getKpiSummary } from "@/lib/services/metrics";
import {
  cycleStageBreakdown,
  bottleneckStage,
  totalCycle,
  affectedOpportunities,
} from "@/lib/services/cycle";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default function PerformancePage() {
  const kpi = getKpiSummary();
  const { categories, headline } = diagnosePerformance();
  const opps = enrichedOpportunities();
  const industries = Array.from(new Set(opps.map((o) => o.industry))).sort();

  const cycle = cycleStageBreakdown();
  const bottleneck = bottleneckStage();
  const total = totalCycle();
  const affected = affectedOpportunities();
  const maxCycle = Math.max(...cycle.map((c) => Math.max(c.currentDays, c.previousDays)), 1);

  const problems = [
    `Revenue is ${formatPercent(100 - kpi.achievementPct)} below target`,
    "Conversion has declined vs the previous period",
    "Sales cycle is lengthening",
    "Pipeline coverage is below target",
  ];

  return (
    <div className="space-y-6">
      <SetCopilotContext module="performance" label="Performance Diagnostics" />
      <PageHeader
        title="Performance"
        description="Diagnose the revenue gap across market, people, process and product; inspect the sales funnel; and find the bottlenecks lengthening your sales cycle."
        actions={<AskAiButton question="Why are we behind target?" label="Why behind target?" variant="default" />}
      />

      <Tabs defaultValue="diagnosis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
          <TabsTrigger value="funnel">Sales Funnel</TabsTrigger>
          <TabsTrigger value="cycle">Sales Cycle</TabsTrigger>
        </TabsList>

        <TabsContent value="diagnosis">
          <DiagnosisPanel categories={categories} headline={headline} problems={problems} />
        </TabsContent>

        <TabsContent value="funnel">
          <FunnelExplorer
            opportunities={opps}
            territories={getTerritories().map((t) => ({ id: t.id, name: t.name }))}
            owners={getSalespeople().map((s) => ({ id: s.id, name: s.name }))}
            products={getProducts().map((p) => ({ id: p.id, name: p.name }))}
            industries={industries}
          />
        </TabsContent>

        <TabsContent value="cycle" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg sales cycle</p>
              <p className="mt-1 text-2xl font-semibold">{total.current} days</p>
              <p className="text-xs text-muted-foreground">Was {total.previous} days ({total.changePct >= 0 ? "+" : ""}{total.changePct}%)</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Largest contributor</p>
              <p className="mt-1 text-2xl font-semibold">{bottleneck.stage}</p>
              <p className="text-xs text-muted-foreground">{bottleneck.currentDays}d vs {bottleneck.previousDays}d ({bottleneck.changePct >= 0 ? "+" : ""}{bottleneck.changePct}%)</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Affected open deals</p>
              <p className="mt-1 text-2xl font-semibold">{affected.length}</p>
              <p className="text-xs text-muted-foreground">Stalled or long time-in-stage</p>
            </Card>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              <strong>{bottleneck.stage}</strong> is the largest contributor to the change in overall
              sales cycle ({bottleneck.previousDays}d → {bottleneck.currentDays}d).
            </span>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Cycle by stage</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cycle.map((c) => (
                <div key={c.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={c.stage === bottleneck.stage ? "font-semibold" : ""}>{c.stage}</span>
                    <span className="text-muted-foreground">
                      {c.currentDays}d
                      <span className={c.changePct > 0 ? "ml-1 text-destructive" : "ml-1 text-success"}>
                        ({c.changePct >= 0 ? "+" : ""}{c.changePct}%)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-2.5 rounded-full"
                      style={{ width: `${(c.currentDays / maxCycle) * 100}%`, background: c.stage === bottleneck.stage ? "var(--warning)" : "var(--chart-1)" }}
                    />
                    <div
                      className="h-2.5 rounded-full bg-muted"
                      style={{ width: `${(c.previousDays / maxCycle) * 100}%` }}
                      title={`Previous: ${c.previousDays}d`}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Coloured bar = current period · grey bar = previous period.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Affected opportunities</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Days in stage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affected.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{accountName(o.accountId)}</TableCell>
                      <TableCell className="text-sm">{salespersonName(o.ownerId)}</TableCell>
                      <TableCell><Badge variant="secondary">{o.stage}</Badge></TableCell>
                      <TableCell className="text-right text-sm">{o.daysInStage}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(o.value, { compact: true })}</TableCell>
                      <TableCell><Badge variant={o.riskStatus === "Stalled" ? "destructive" : "warning"}>{o.riskStatus}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
