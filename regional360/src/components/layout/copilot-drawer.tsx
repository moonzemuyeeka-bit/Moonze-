"use client";

import * as React from "react";
import { Send, Sparkles, Loader2, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiAnswerCard } from "@/components/shared/ai-answer-card";
import { useCopilot } from "@/components/providers/copilot-provider";

const STARTERS = [
  "Why are we behind target?",
  "Which salesperson needs attention?",
  "Which accounts are at risk?",
  "Give me a plan to close the revenue gap.",
  "Which customers should I call today?",
];

export function CopilotDrawer() {
  const { open, setOpen, messages, loading, ask, clear } = useCopilot();
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    void ask(q);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <SheetTitle>Regional Copilot</SheetTitle>
                <SheetDescription className="text-xs">
                  Context-aware answers from your regional data
                </SheetDescription>
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" onClick={clear} aria-label="Clear conversation">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Ask about performance, pipeline, team, accounts or market. The
                Copilot diagnoses causes and recommends actions — with the
                reasoning and supporting data behind each answer.
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Try asking
                </p>
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                  {m.question}
                </div>
              </div>
              {m.pending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analysing your regional data…
                </div>
              )}
              {m.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {m.error}
                </div>
              )}
              {m.answer && <AiAnswerCard answer={m.answer} />}
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the Regional Copilot…"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
