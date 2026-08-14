"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Database,
  Lightbulb,
  ListChecks,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfidenceBadge } from "@/components/shared/confidence-badge";
import { useActionStore } from "@/components/providers/action-store";
import { useCopilot } from "@/components/providers/copilot-provider";
import type { AIAnswer, AISuggestedAction } from "@/lib/ai/types";
import type { RecommendedAction } from "@/lib/types";
import { cn } from "@/lib/utils";

function answerToAction(answer: AIAnswer): RecommendedAction {
  return {
    id: `ai-${answer.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
    title: answer.title,
    reason: answer.summary,
    priority: answer.confidence === "High" ? "High" : "Medium",
    source: "Performance",
    impact: 70,
    urgency: 60,
    confidence: answer.confidence,
    effort: 40,
    suggestedAction: answer.recommendations[0] ?? answer.summary,
  };
}

export function AiAnswerCard({
  answer,
  compact = false,
}: {
  answer: AIAnswer;
  compact?: boolean;
}) {
  const [showData, setShowData] = React.useState(false);
  const [created, setCreated] = React.useState(false);
  const { addCustom } = useActionStore();
  const { ask } = useCopilot();

  const handleAction = (a: AISuggestedAction) => {
    if (a.kind === "create-plan") {
      addCustom(answerToAction(answer));
      setCreated(true);
    }
  };

  const kindIcon = (kind?: string) =>
    kind === "investigate" ? (
      <Search className="h-4 w-4" />
    ) : kind === "view-data" ? (
      <Database className="h-4 w-4" />
    ) : kind === "create-plan" ? (
      <ListChecks className="h-4 w-4" />
    ) : (
      <ArrowRight className="h-4 w-4" />
    );

  return (
    <Card className={cn("space-y-4 p-4", compact && "shadow-none")}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{answer.title}</p>
          <p className="text-sm text-foreground/90">{answer.summary}</p>
        </div>
      </div>

      {answer.diagnosis.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Diagnosis
          </p>
          <ul className="space-y-1.5">
            {answer.diagnosis.map((d, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer.recommendations.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" /> Recommended actions
          </p>
          <ul className="space-y-1.5">
            {answer.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer.why && (
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Why
          </p>
          <p className="mt-1 text-sm text-foreground/90">{answer.why}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBadge confidence={answer.confidence} />
        {answer.supportingData.length > 0 && (
          <button
            onClick={() => setShowData((s) => !s)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Database className="h-3.5 w-3.5" />
            {showData ? "Hide" : "View"} supporting data
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showData && "rotate-180")}
            />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{answer.confidenceReason}</p>

      {showData && answer.supportingData.length > 0 && (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          {answer.supportingData.map((d, i) => (
            <div key={i} className="flex items-center justify-between bg-card px-3 py-2">
              <span className="text-xs text-muted-foreground">{d.label}</span>
              <span className="text-sm font-medium">{d.value}</span>
            </div>
          ))}
        </div>
      )}

      {answer.suggestedActions.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-wrap gap-2">
            {answer.suggestedActions.map((a, i) =>
              a.href ? (
                <Button key={i} asChild variant="outline" size="sm">
                  <Link href={a.href}>
                    {kindIcon(a.kind)}
                    {a.label}
                  </Link>
                </Button>
              ) : (
                <Button
                  key={i}
                  variant={a.kind === "create-plan" && created ? "secondary" : "default"}
                  size="sm"
                  onClick={() => handleAction(a)}
                  disabled={a.kind === "create-plan" && created}
                >
                  {a.kind === "create-plan" && created ? (
                    <>
                      <Check className="h-4 w-4" /> Added to Action Centre
                    </>
                  ) : (
                    <>
                      {kindIcon(a.kind)}
                      {a.label}
                    </>
                  )}
                </Button>
              ),
            )}
          </div>
        </>
      )}

      {answer.followUps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {answer.followUps.map((f, i) => (
            <button
              key={i}
              onClick={() => ask(f)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
