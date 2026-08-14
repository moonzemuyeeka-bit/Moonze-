"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopilot } from "@/components/providers/copilot-provider";

export function AskAiButton({
  question,
  label,
  variant = "outline",
  size = "sm",
}: {
  question: string;
  label?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default";
}) {
  const { openWith } = useCopilot();
  return (
    <Button variant={variant} size={size} onClick={() => openWith(question)}>
      <Sparkles className="h-4 w-4" />
      {label ?? "Ask AI"}
    </Button>
  );
}
