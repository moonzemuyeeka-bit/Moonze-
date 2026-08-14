import { getKpiSummary, territoryCoverage } from "@/lib/services/metrics";
import { allScorecards } from "@/lib/services/team";
import { allAccountHealth } from "@/lib/services/accounts";
import { diagnosePerformance } from "@/lib/services/diagnostics";
import { cycleStageBreakdown } from "@/lib/services/cycle";
import { buildFunnel } from "@/lib/services/funnel";
import { DemoAIProvider } from "@/lib/ai/demo-provider";
import type { AIAnswer, AIContext, AIProvider } from "@/lib/ai/types";

// Compact, structured snapshot of the app's data so the model answers from
// real numbers rather than hallucinating. Server-side only.
function buildDataContext() {
  const kpi = getKpiSummary();
  return {
    kpi,
    territories: territoryCoverage().map((t) => ({
      name: t.territory.name,
      coverage: Number(t.coverage.toFixed(2)),
      achievementPct: Math.round(t.achievementPct),
    })),
    team: allScorecards().map((s) => ({
      name: s.salesperson.name,
      achievementPct: Math.round(s.achievementPct),
      coverage: Number(s.pipelineCoverage.toFixed(2)),
      conversionPct: Math.round(s.conversionPct),
      status: s.status,
    })),
    accounts: allAccountHealth()
      .slice(0, 12)
      .map((a) => ({
        name: a.account.name,
        health: a.healthScore,
        tier: a.tier,
        openIssues: a.openIssues,
        daysToRenewal: a.daysToRenewal,
        revenueTrendPct: a.account.revenueTrendPct,
      })),
    diagnosis: diagnosePerformance().categories,
    cycle: cycleStageBreakdown(),
    funnel: buildFunnel(),
  };
}

const SYSTEM_PROMPT = `You are the Regional360 Copilot, an AI decision-support assistant for a Regional Sales Manager.
You are given a JSON snapshot of the region's real data. Answer the manager's question using ONLY that data.
Follow the loop: identify relevant data, diagnose patterns, explain likely causes, recommend actions, and explain your reasoning.
Never claim certainty when data is insufficient; note when external/market factors are unverified.
Respond with a STRICT JSON object matching this TypeScript type (no markdown, no extra text):
{
  "title": string,
  "summary": string,
  "diagnosis": string[],
  "recommendations": string[],
  "why": string,
  "confidence": "High" | "Medium" | "Low",
  "confidenceReason": string,
  "supportingData": { "label": string, "value": string }[],
  "suggestedActions": { "label": string, "kind"?: "create-plan"|"investigate"|"view-data"|"open", "href"?: string }[],
  "followUps": string[]
}`;

export class OpenAIProvider implements AIProvider {
  name = "openai";
  private fallback = new DemoAIProvider();

  async ask(question: string, context: AIContext): Promise<AIAnswer> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return this.fallback.ask(question, context);

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const data = buildDataContext();

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Current page/module: ${context.module}${context.label ? ` (${context.label})` : ""}.\nData snapshot:\n${JSON.stringify(data)}\n\nQuestion: ${question}`,
            },
          ],
        }),
      });

      if (!res.ok) return this.fallback.ask(question, context);
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) return this.fallback.ask(question, context);
      const parsed = JSON.parse(content);
      return {
        title: parsed.title ?? "Regional360 Copilot",
        summary: parsed.summary ?? "",
        diagnosis: parsed.diagnosis ?? [],
        recommendations: parsed.recommendations ?? [],
        why: parsed.why ?? "",
        confidence: parsed.confidence ?? "Medium",
        confidenceReason: parsed.confidenceReason ?? "",
        supportingData: parsed.supportingData ?? [],
        suggestedActions: parsed.suggestedActions ?? [],
        followUps: parsed.followUps ?? [],
        source: "openai",
      };
    } catch {
      return this.fallback.ask(question, context);
    }
  }
}
