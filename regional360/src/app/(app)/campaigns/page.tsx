import { Megaphone, DollarSign, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { AskAiButton } from "@/components/shared/ask-ai-button";
import { SetCopilotContext } from "@/components/layout/page-context";
import { getCampaigns } from "@/lib/repositories";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default function CampaignsPage() {
  const campaigns = getCampaigns();

  const totals = campaigns.reduce(
    (acc, c) => ({
      leads: acc.leads + c.leadsGenerated,
      qualified: acc.qualified + c.qualifiedLeads,
      meetings: acc.meetings + c.meetings,
      proposals: acc.proposals + c.proposals,
      closed: acc.closed + c.closedDeals,
      revenue: acc.revenue + c.revenue,
      cost: acc.cost + c.cost,
    }),
    { leads: 0, qualified: 0, meetings: 0, proposals: 0, closed: 0, revenue: 0, cost: 0 },
  );

  const roi = totals.cost ? ((totals.revenue - totals.cost) / totals.cost) * 100 : 0;
  const cpa = totals.closed ? totals.cost / totals.closed : 0;

  const stages = [
    { label: "Leads", value: totals.leads },
    { label: "Qualified", value: totals.qualified },
    { label: "Meetings", value: totals.meetings },
    { label: "Proposals", value: totals.proposals },
    { label: "Closed deals", value: totals.closed },
  ];
  const maxStage = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-6">
      <SetCopilotContext module="campaigns" label="Campaign Intelligence" />
      <PageHeader
        title="Campaigns"
        description="Marketing and sales alignment: trace each campaign from leads to revenue and see whether marketing activity is producing commercial results."
        actions={<AskAiButton question="Where is our biggest growth opportunity?" label="Ask AI" />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Marketing revenue" value={formatCurrency(totals.revenue, { compact: true })} icon={TrendingUp} emphasis="positive" />
        <MetricCard label="Campaign spend" value={formatCurrency(totals.cost, { compact: true })} icon={DollarSign} />
        <MetricCard label="Blended ROI" value={formatPercent(roi)} icon={TrendingUp} emphasis={roi > 0 ? "positive" : "negative"} />
        <MetricCard label="Cost per acquisition" value={formatCurrency(cpa, { compact: true })} icon={Target} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-muted-foreground" /> Campaign → revenue funnel</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {stages.map((s, i) => {
            const width = 30 + (s.value / maxStage) * 70;
            const prev = stages[i - 1];
            const conv = prev ? (s.value / prev.value) * 100 : null;
            return (
              <div key={s.label} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-between rounded-md px-3 py-2.5 text-primary-foreground"
                  style={{ width: `${width}%`, background: "var(--primary)", opacity: 0.85 }}
                >
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-xs">{s.value.toLocaleString()}</span>
                </div>
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {conv !== null ? `${conv.toFixed(0)}%` : ""}
                </span>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {formatCurrency(totals.revenue, { compact: true })} revenue from {totals.closed} closed deals across {campaigns.length} campaigns.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Campaign performance</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Qualified</TableHead>
                <TableHead className="text-right">Closed</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">CPA</TableHead>
                <TableHead className="text-right">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns
                .map((c) => ({
                  ...c,
                  cpa: c.closedDeals ? c.cost / c.closedDeals : 0,
                  roi: c.cost ? ((c.revenue - c.cost) / c.cost) * 100 : 0,
                }))
                .sort((a, b) => b.roi - a.roi)
                .map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="secondary">{c.channel}</Badge></TableCell>
                    <TableCell className="text-right text-sm">{c.leadsGenerated.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">{c.qualifiedLeads.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">{c.closedDeals}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(c.revenue, { compact: true })}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(c.cpa, { compact: true })}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={c.roi > 100 ? "success" : c.roi > 0 ? "warning" : "destructive"}>
                        {formatPercent(c.roi)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
