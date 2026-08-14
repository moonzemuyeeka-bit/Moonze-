"use client";

import * as React from "react";
import {
  Check,
  Clock,
  UserPlus,
  X,
  ThumbsUp,
  Filter,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfidenceBadge } from "@/components/shared/confidence-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useActionStore } from "@/components/providers/action-store";
import { useCopilot } from "@/components/providers/copilot-provider";
import type { ActionStatus, RecommendedAction } from "@/lib/types";

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "muted"> = {
  High: "destructive",
  Medium: "warning",
  Low: "muted",
};

const STATUS_VARIANT: Record<ActionStatus, "muted" | "default" | "success" | "warning" | "secondary"> = {
  Open: "muted",
  Accepted: "default",
  Assigned: "secondary",
  Snoozed: "warning",
  Completed: "success",
  Dismissed: "muted",
};

export function ActionCentre({
  serverActions,
  owners,
}: {
  serverActions: RecommendedAction[];
  owners: string[];
}) {
  const store = useActionStore();
  const { openWith } = useCopilot();
  const [filter, setFilter] = React.useState<string>("active");

  const all = React.useMemo(
    () => [...store.custom, ...serverActions],
    [store.custom, serverActions],
  );

  const visible = all.filter((a) => {
    const status = store.statusOf(a.id);
    if (filter === "active") return status !== "Completed" && status !== "Dismissed";
    if (filter === "completed") return status === "Completed";
    if (filter === "all") return true;
    return status.toLowerCase() === filter;
  });

  const grouped: Record<string, RecommendedAction[]> = { High: [], Medium: [], Low: [] };
  visible.forEach((a) => grouped[a.priority].push(a));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="snoozed">Snoozed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          {visible.length} action{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Check} title="Nothing here" description="No actions match this filter. Try 'All' or ask the Copilot for recommendations." />
      ) : (
        (["High", "Medium", "Low"] as const).map((priority) =>
          grouped[priority].length === 0 ? null : (
            <div key={priority} className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Badge variant={PRIORITY_VARIANT[priority]}>{priority} priority</Badge>
                <span>{grouped[priority].length}</span>
              </p>
              {grouped[priority].map((a) => {
                const status = store.statusOf(a.id);
                const assignee = store.assignees[a.id];
                const settled = status === "Completed" || status === "Dismissed";
                return (
                  <Card key={a.id} className={`p-4 ${settled ? "opacity-70" : ""}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{a.title}</p>
                          <Badge variant="outline">{a.source}</Badge>
                          <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                          {assignee && <Badge variant="secondary">→ {assignee}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{a.reason}</p>
                        <p className="flex items-start gap-1.5 text-sm">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>{a.suggestedAction}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <ConfidenceBadge confidence={a.confidence} />
                          <span className="text-xs text-muted-foreground">Impact {a.impact.toFixed(0)} · Urgency {a.urgency.toFixed(0)} · Effort {a.effort.toFixed(0)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" variant={status === "Accepted" ? "secondary" : "outline"} onClick={() => store.setStatus(a.id, "Accepted")}>
                          <ThumbsUp className="h-3.5 w-3.5" /> Accept
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline"><UserPlus className="h-3.5 w-3.5" /> Assign</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                            <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {owners.map((o) => (
                              <DropdownMenuItem key={o} onClick={() => store.assign(a.id, o)}>{o}</DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="sm" variant="outline" onClick={() => store.setStatus(a.id, "Snoozed")}>
                          <Clock className="h-3.5 w-3.5" /> Snooze
                        </Button>
                        <Button size="sm" variant="default" onClick={() => store.setStatus(a.id, "Completed")}>
                          <Check className="h-3.5 w-3.5" /> Complete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => store.setStatus(a.id, "Dismissed")}>
                          <X className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ),
        )
      )}
    </div>
  );
}
