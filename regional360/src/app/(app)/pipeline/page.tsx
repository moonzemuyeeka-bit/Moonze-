import { Layers, Scale, Gauge, Handshake, Clock, Zap } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { AskAiButton } from "@/components/shared/ask-ai-button";
import { SetCopilotContext } from "@/components/layout/page-context";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { getSalespeople, getTerritories } from "@/lib/repositories";
import {
  enrichedOpportunities,
  KANBAN_STAGES,
  pipelineMetrics,
} from "@/lib/services/pipeline";
import { formatCurrency } from "@/lib/utils";

export default function PipelinePage() {
  const m = pipelineMetrics();
  const opps = enrichedOpportunities();
  const territories = getTerritories();
  const owners = getSalespeople().map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <SetCopilotContext module="pipeline" label="Sales Pipeline" />
      <PageHeader
        title="Sales Pipeline"
        description="Manage open opportunities across stages. Track coverage, velocity and risk — and act on stalled deals."
        actions={<AskAiButton question="Where are we losing the most deals?" label="Where are we losing deals?" />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <MetricCard label="Total pipeline" value={formatCurrency(m.total, { compact: true })} icon={Layers} />
        <MetricCard label="Weighted" value={formatCurrency(m.weighted, { compact: true })} icon={Scale} />
        <MetricCard
          label="Coverage"
          value={`${m.coverage.toFixed(1)}x`}
          icon={Gauge}
          emphasis={m.coverage < 3 ? "warning" : "positive"}
        />
        <MetricCard label="Avg deal" value={formatCurrency(m.avgDealSize, { compact: true })} icon={Handshake} />
        <MetricCard label="Avg cycle" value={`${Math.round(m.avgCycleDays)}d`} icon={Clock} />
        <MetricCard label="Velocity" value={`${formatCurrency(m.velocityPerDay, { compact: true })}/d`} icon={Zap} />
      </div>

      <PipelineBoard
        opportunities={opps}
        stages={KANBAN_STAGES}
        territories={territories.map((t) => ({ id: t.id, name: t.name }))}
        owners={owners}
      />
    </div>
  );
}
