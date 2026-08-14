"use client";

import * as React from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EnrichedOpportunity } from "@/lib/services/pipeline";
import { formatCurrency, cn } from "@/lib/utils";

const FUNNEL = [
  { label: "Prospects", index: 0 },
  { label: "Qualified", index: 1 },
  { label: "Discovery", index: 2 },
  { label: "Proposal", index: 3 },
  { label: "Negotiation", index: 4 },
  { label: "Closed Won", index: 5 },
];

export function FunnelExplorer({
  opportunities,
  territories,
  owners,
  products,
  industries,
}: {
  opportunities: EnrichedOpportunity[];
  territories: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  products: { id: string; name: string }[];
  industries: string[];
}) {
  const [territory, setTerritory] = React.useState("all");
  const [owner, setOwner] = React.useState("all");
  const [product, setProduct] = React.useState("all");
  const [industry, setIndustry] = React.useState("all");
  const [selected, setSelected] = React.useState<string>("Proposal");

  const applyFilter = (cohort: "current" | "previous") =>
    opportunities.filter((o) => {
      if (o.cohort !== cohort) return false;
      if (territory !== "all" && o.territoryId !== territory) return false;
      if (owner !== "all" && o.ownerId !== owner) return false;
      if (product !== "all" && o.productId !== product) return false;
      if (industry !== "all" && o.industry !== industry) return false;
      return true;
    });

  const current = applyFilter("current");
  const previous = applyFilter("previous");

  const countAtOrPast = (list: EnrichedOpportunity[], idx: number) =>
    list.filter((o) => o.maxStageIndex >= idx).length;
  const valueAtOrPast = (list: EnrichedOpportunity[], idx: number) =>
    list.filter((o) => o.maxStageIndex >= idx).reduce((a, b) => a + b.value, 0);

  const rows = FUNNEL.map((stage, i) => {
    const count = countAtOrPast(current, stage.index);
    const value = valueAtOrPast(current, stage.index);
    const next = FUNNEL[i + 1];
    let conversion: number | null = null;
    let prevConversion: number | null = null;
    if (next) {
      conversion = count ? (countAtOrPast(current, next.index) / count) * 100 : 0;
      const pCur = countAtOrPast(previous, stage.index);
      prevConversion = pCur ? (countAtOrPast(previous, next.index) / pCur) * 100 : 0;
    }
    return { ...stage, count, value, conversion, prevConversion };
  });

  const maxCount = Math.max(1, rows[0].count);
  const leakageRows = rows.filter((r) => r.conversion !== null);
  const worst = leakageRows.reduce(
    (acc, r) => ((100 - (r.conversion ?? 0)) > (100 - (acc?.conversion ?? 0)) ? r : acc),
    leakageRows[0],
  );

  const selectedIdx = FUNNEL.find((f) => f.label === selected)?.index ?? 3;
  const drill = current
    .filter((o) => o.maxStageIndex >= selectedIdx)
    .sort((a, b) => b.value - a.value)
    .slice(0, 25);
  const lostAtStage = current.filter(
    (o) => o.stage === "Closed Lost" && o.maxStageIndex === selectedIdx,
  );
  const lostReasons = lostAtStage.reduce<Record<string, number>>((acc, o) => {
    const r = o.lostReason ?? "Unknown";
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: territory, set: setTerritory, all: "All territories", opts: territories.map((t) => ({ id: t.id, name: t.name })) },
          { v: owner, set: setOwner, all: "All reps", opts: owners },
          { v: product, set: setProduct, all: "All products", opts: products },
        ].map((f, i) => (
          <Select key={i} value={f.v} onValueChange={f.set}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{f.all}</SelectItem>
              {f.opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {worst && (worst.conversion ?? 100) < 100 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            <strong>{worst.label} → next</strong> is the largest funnel leakage at{" "}
            <strong>{(100 - (worst.conversion ?? 0)).toFixed(0)}%</strong>
            {worst.prevConversion !== null && (
              <> (conversion {worst.conversion?.toFixed(0)}% vs {worst.prevConversion?.toFixed(0)}% previously).</>
            )}
          </span>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Sales funnel</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r) => {
            const width = 30 + (r.count / maxCount) * 70;
            const isSelected = r.label === selected;
            const leak = r.conversion === null ? null : 100 - r.conversion;
            return (
              <button
                key={r.label}
                onClick={() => setSelected(r.label)}
                className="block w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-2.5 transition-colors",
                        isSelected ? "ring-2 ring-primary" : "",
                      )}
                      style={{
                        width: `${width}%`,
                        background: worst && r.label === worst.label ? "var(--warning)" : "var(--primary)",
                        opacity: worst && r.label === worst.label ? 0.9 : 0.85,
                        color: "var(--primary-foreground)",
                      }}
                    >
                      <span className="text-sm font-medium">{r.label}</span>
                      <span className="text-xs">{r.count} · {formatCurrency(r.value, { compact: true })}</span>
                    </div>
                  </div>
                  <div className="w-28 shrink-0 text-xs text-muted-foreground">
                    {r.conversion !== null ? (
                      <span>
                        {r.conversion.toFixed(0)}% →{" "}
                        {leak !== null && (
                          <span className={leak > 50 ? "text-destructive" : ""}>{leak.toFixed(0)}% leak</span>
                        )}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-1 text-base">
            {selected} <ChevronRight className="h-4 w-4 text-muted-foreground" /> drill-down
          </CardTitle>
          {Object.keys(lostReasons).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(lostReasons).map(([r, n]) => (
                <Badge key={r} variant="muted">{r}: {n}</Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drill.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.accountName}</TableCell>
                  <TableCell className="text-sm">{o.ownerName}</TableCell>
                  <TableCell className="text-sm">{o.territoryName}</TableCell>
                  <TableCell><Badge variant="secondary">{o.stage}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(o.value, { compact: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
