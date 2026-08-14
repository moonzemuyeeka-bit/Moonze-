"use client";

import * as React from "react";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { EnrichedOpportunity } from "@/lib/services/pipeline";
import type { Stage } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const RISK_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  "On Track": "success",
  "At Risk": "warning",
  Stalled: "destructive",
};

const STAGE_ACCENT: Record<string, string> = {
  Prospect: "border-t-chart-2",
  Qualified: "border-t-chart-2",
  Discovery: "border-t-chart-1",
  Proposal: "border-t-chart-4",
  Negotiation: "border-t-chart-4",
  "Closed Won": "border-t-chart-3",
  "Closed Lost": "border-t-chart-5",
};

export function PipelineBoard({
  opportunities,
  stages,
  territories,
  owners,
}: {
  opportunities: EnrichedOpportunity[];
  stages: Stage[];
  territories: { id: string; name: string }[];
  owners: { id: string; name: string }[];
}) {
  const [territory, setTerritory] = React.useState("all");
  const [owner, setOwner] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const filtered = opportunities.filter((o) => {
    if (territory !== "all" && o.territoryId !== territory) return false;
    if (owner !== "all" && o.ownerId !== owner) return false;
    if (query && !`${o.accountName} ${o.name} ${o.ownerName}`.toLowerCase().includes(query.toLowerCase()))
      return false;
    return true;
  });

  const byStage = (stage: Stage) => filtered.filter((o) => o.stage === stage);

  return (
    <Tabs defaultValue="kanban" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="kanban">
            <LayoutGrid className="h-4 w-4" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="table">
            <TableIcon className="h-4 w-4" /> Table
          </TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search deals…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full sm:w-44"
          />
          <Select value={territory} onValueChange={setTerritory}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Territory" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All territories</SelectItem>
              {territories.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reps</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TabsContent value="kanban" className="mt-0">
        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
          {stages.map((stage) => {
            const items = byStage(stage);
            const value = items.reduce((a, b) => a + b.value, 0);
            return (
              <div key={stage} className="w-72 shrink-0">
                <div className={`rounded-t-lg border-t-2 ${STAGE_ACCENT[stage] ?? "border-t-border"} bg-muted/50 px-3 py-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{stage}</span>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(value, { compact: true })}
                  </p>
                </div>
                <div className="space-y-2 rounded-b-lg bg-muted/20 p-2">
                  {items.length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">No deals</p>
                  )}
                  {items.slice(0, 40).map((o) => (
                    <div key={o.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{o.accountName}</p>
                        <Badge variant={RISK_VARIANT[o.riskStatus]} className="shrink-0">{o.riskStatus}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.productName}</p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-semibold">{formatCurrency(o.value, { compact: true })}</span>
                        <span className="text-muted-foreground">{o.probability}%</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="truncate">{o.ownerName}</span>
                        <span>{o.daysInStage}d in stage</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="table" className="mt-0">
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Prob.</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Close</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered
                .sort((a, b) => b.value - a.value)
                .slice(0, 120)
                .map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate font-medium">{o.accountName}</p>
                      <p className="truncate text-xs text-muted-foreground">{o.productName}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{o.ownerName}</TableCell>
                    <TableCell className="text-sm">{o.territoryName}</TableCell>
                    <TableCell><Badge variant="secondary">{o.stage}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(o.value, { compact: true })}</TableCell>
                    <TableCell className="text-right text-sm">{o.probability}%</TableCell>
                    <TableCell className="text-right text-sm">{o.daysInStage}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {o.stage.startsWith("Closed") ? "—" : formatDate(o.expectedClose)}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">{o.nextAction}</TableCell>
                    <TableCell><Badge variant={RISK_VARIANT[o.riskStatus]}>{o.riskStatus}</Badge></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
