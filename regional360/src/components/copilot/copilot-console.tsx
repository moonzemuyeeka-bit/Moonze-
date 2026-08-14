"use client";

import * as React from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiAnswerCard } from "@/components/shared/ai-answer-card";
import { useCopilot } from "@/components/providers/copilot-provider";

const SUGGESTIONS = [
  "Why are we behind target?",
  "Which salesperson needs attention?",
  "Which accounts are at risk?",
  "Which customers should I call today?",
  "Where is our biggest growth opportunity?",
  "Why has conversion declined?",
  "What is causing our sales cycle to increase?",
  "Give me a plan to close the revenue gap.",
  "Prepare my regional performance meeting.",
  "Summarise this week's performance.",
  "Which territory should receive more attention?",
  "What are the biggest risks in my region?",
];

export function CopilotConsole() {
  const { messages, loading, ask } = useCopilot();
  const [input, setInput] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    void ask(q);
  };

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Ask the Regional Copilot</p>
              <p className="text-xs text-muted-foreground">
                Answers are diagnosed from your regional data, with the reasoning and supporting evidence behind each one.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-5">
        {messages.map((m) => (
          <div key={m.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                {m.question}
              </div>
            </div>
            {m.pending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analysing your regional data…
              </div>
            )}
            {m.error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {m.error}
              </div>
            )}
            {m.answer && (
              <div className="max-w-3xl">
                <AiAnswerCard answer={m.answer} />
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="sticky bottom-4 flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about performance, pipeline, team, accounts or market…"
          className="border-0 shadow-none focus-visible:ring-0"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </Button>
      </form>
    </div>
  );
}
