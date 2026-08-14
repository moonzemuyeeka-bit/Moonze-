"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AiBadge } from "@/components/shared/demo-badge";
import { AskAiButton } from "@/components/shared/ask-ai-button";
import { DonutChart } from "@/components/charts/donut-chart";
import type { DiagnosticCategory } from "@/lib/types";

const CATEGORY_COLOR: Record<string, string> = {
  Process: "var(--chart-1)",
  People: "var(--chart-4)",
  Market: "var(--chart-2)",
  Product: "var(--chart-5)",
};

export function DiagnosisPanel({
  categories,
  headline,
  problems,
}: {
  categories: DiagnosticCategory[];
  headline: string;
  problems: string[];
}) {
  const [problem, setProblem] = React.useState(problems[0]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Diagnose Performance <AiBadge label="AI diagnostic" />
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a performance problem to analyse across four root-cause categories.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={problem} onValueChange={setProblem}>
              <SelectTrigger className="w-full sm:w-96">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {problems.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AskAiButton question="Give me a plan to close the revenue gap." label="Build recovery plan" variant="default" />
          </div>

          <div className="grid items-center gap-6 lg:grid-cols-[220px_1fr]">
            <div className="relative">
              <DonutChart
                data={categories.map((c) => ({
                  label: c.category,
                  value: c.score,
                  color: CATEGORY_COLOR[c.category],
                }))}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold">{categories[0].score}%</span>
                <span className="text-xs text-muted-foreground">{categories[0].category}</span>
              </div>
            </div>
            <div className="space-y-3">
              {categories.map((c) => (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: CATEGORY_COLOR[c.category] }}
                      />
                      {c.category}
                    </span>
                    <span className="text-sm font-semibold">{c.score}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${c.score}%`, background: CATEGORY_COLOR[c.category] }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{c.rationale}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <span className="font-medium">Assessment: </span>
            {headline}
          </div>
          <p className="text-xs text-muted-foreground">
            These are AI-generated diagnostic assessments based on available in-app data,
            not scientifically validated predictions.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((c) => (
          <Card key={c.category}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                {c.category}
                <Badge variant={c.score >= 30 ? "warning" : "muted"}>{c.score}%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {c.signals.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
