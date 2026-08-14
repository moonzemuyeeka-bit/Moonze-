"use client";

import { useCopilotContext } from "@/components/providers/copilot-provider";
import type { AIModule } from "@/lib/ai/types";

// Registers the current page's module/entity with the Copilot so it gives
// context-aware answers. Renders nothing.
export function SetCopilotContext({
  module,
  label,
}: {
  module: AIModule;
  label?: string;
}) {
  useCopilotContext(module, label);
  return null;
}
