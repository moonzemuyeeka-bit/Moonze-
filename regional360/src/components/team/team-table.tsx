"use client";

import * as React from "react";
import { Check, GraduationCap, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PerformancePill } from "@/components/shared/status-pill";
import { Trend } from "@/components/shared/trend";
import { useCopilot } from "@/components/providers/copilot-provider";
import type { CoachingPlan } from "@/lib/services/coaching";
import { formatCurrency, formatPercent } from "@/lib/utils";

function useCoachingProgress() {
  const [done, setDone] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("r360-coaching");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = (id: string) =>
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("r360-coaching", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return { done, toggle };
}

export function TeamTable({ plans }: { plans: CoachingPlan[] }) {
  const [active, setActive] = React.useState<CoachingPlan | null>(null);
  const { done, toggle } = useCoachingProgress();
  const { openWith } = useCopilot();

  return (
    <>
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Salesperson</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Achv.</TableHead>
              <TableHead className="text-right">Coverage</TableHead>
              <TableHead className="text-right">Conv.</TableHead>
              <TableHead className="text-right">Cycle</TableHead>
              <TableHead className="text-right">Trend</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Coach</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => {
              const s = p.scorecard;
              return (
                <TableRow key={s.salesperson.id}>
                  <TableCell>
                    <p className="font-medium">{s.salesperson.name}</p>
                    <p className="text-xs text-muted-foreground">{s.territoryName}</p>
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(s.target, { compact: true })}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(s.actual, { compact: true })}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatPercent(s.achievementPct)}</TableCell>
                  <TableCell className="text-right text-sm">{s.pipelineCoverage.toFixed(1)}x</TableCell>
                  <TableCell className="text-right text-sm">{formatPercent(s.conversionPct)}</TableCell>
                  <TableCell className="text-right text-sm">{s.salesCycleDays}d</TableCell>
                  <TableCell className="text-right"><Trend value={s.trendPct} /></TableCell>
                  <TableCell><PerformancePill status={s.status} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setActive(p)}>
                      <GraduationCap className="h-4 w-4" /> Coach
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 scrollbar-thin sm:max-w-lg">
          {active && (
            <>
              <SheetHeader className="border-b border-border">
                <div className="flex items-center gap-2 pr-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <SheetTitle>{active.scorecard.salesperson.name}</SheetTitle>
                    <SheetDescription>
                      {active.scorecard.territoryName} · AI Coaching Assistant
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5 p-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Achievement", value: formatPercent(active.scorecard.achievementPct) },
                    { label: "Coverage", value: `${active.scorecard.pipelineCoverage.toFixed(1)}x` },
                    { label: "Conversion", value: formatPercent(active.scorecard.conversionPct) },
                  ].map((k) => (
                    <div key={k.label} className="rounded-lg border border-border p-3 text-center">
                      <p className="text-lg font-semibold">{k.value}</p>
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-muted/60 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Performance summary</p>
                  {active.summary}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strengths</p>
                    <ul className="space-y-1 text-sm">
                      {active.strengths.map((x, i) => <li key={i} className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />{x}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Development areas</p>
                    <ul className="space-y-1 text-sm">
                      {active.developmentAreas.map((x, i) => <li key={i} className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />{x}</li>)}
                    </ul>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Likely causes</p>
                  <ul className="space-y-1 text-sm">
                    {active.likelyCauses.map((x, i) => <li key={i} className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{x}</li>)}
                  </ul>
                </div>

                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended coaching</p>
                  {active.recommendedCoaching}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">30-day development plan</p>
                    <Badge variant="muted">
                      {active.weeks.reduce((a, w) => a + w.activities.filter((act) => done[act.id]).length, 0)}
                      /{active.weeks.reduce((a, w) => a + w.activities.length, 0)} done
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {active.weeks.map((w) => (
                      <div key={w.week} className="rounded-lg border border-border p-3">
                        <p className="mb-2 text-sm font-medium">Week {w.week}: {w.focus}</p>
                        <div className="space-y-1.5">
                          {w.activities.map((act) => (
                            <label key={act.id} className="flex cursor-pointer items-start gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={!!done[act.id]}
                                onChange={() => toggle(act.id)}
                                className="mt-0.5 h-4 w-4 rounded border-input accent-[var(--primary)]"
                              />
                              <span className={done[act.id] ? "text-muted-foreground line-through" : ""}>{act.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openWith(`Give me a coaching plan for ${active.scorecard.salesperson.name}.`)}
                >
                  <Sparkles className="h-4 w-4" /> Ask Copilot about {active.scorecard.salesperson.name.split(" ")[0]}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
