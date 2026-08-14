"use client";

import * as React from "react";
import type { AIAnswer, AIContext, AIModule } from "@/lib/ai/types";

export interface CopilotMessage {
  id: string;
  question: string;
  answer?: AIAnswer;
  pending?: boolean;
  error?: string;
}

interface CopilotValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  context: AIContext;
  setContext: (context: AIContext) => void;
  messages: CopilotMessage[];
  loading: boolean;
  ask: (question: string) => Promise<void>;
  openWith: (question?: string) => void;
  clear: () => void;
}

const CopilotContext = React.createContext<CopilotValue | null>(null);

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [context, setContext] = React.useState<AIContext>({ module: "general" });
  const [messages, setMessages] = React.useState<CopilotMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const contextRef = React.useRef(context);
  contextRef.current = context;

  const ask = React.useCallback(async (question: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMessages((prev) => [...prev, { id, question, pending: true }]);
    setLoading(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: contextRef.current }),
      });
      if (!res.ok) throw new Error("Request failed");
      const answer: AIAnswer = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, answer, pending: false } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, pending: false, error: "The Copilot could not respond. Please try again." }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const openWith = React.useCallback(
    (question?: string) => {
      setOpen(true);
      if (question) void ask(question);
    },
    [ask],
  );

  const clear = React.useCallback(() => setMessages([]), []);

  const value = React.useMemo<CopilotValue>(
    () => ({
      open,
      setOpen,
      context,
      setContext,
      messages,
      loading,
      ask,
      openWith,
      clear,
    }),
    [open, context, messages, loading, ask, openWith, clear],
  );

  return (
    <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>
  );
}

export function useCopilot() {
  const ctx = React.useContext(CopilotContext);
  if (!ctx) throw new Error("useCopilot must be used within CopilotProvider");
  return ctx;
}

// Register the current page's AI context so the Copilot understands what the
// manager is viewing (context-aware answers).
export function useCopilotContext(module: AIModule, label?: string) {
  const { setContext } = useCopilot();
  React.useEffect(() => {
    setContext({ module, label });
  }, [module, label, setContext]);
}
