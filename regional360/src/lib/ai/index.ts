import { DemoAIProvider } from "@/lib/ai/demo-provider";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import type { AIProvider } from "@/lib/ai/types";

// Provider abstraction: the app is never hard-coded to a single AI vendor.
// Selected via AI_PROVIDER; defaults to the deterministic demo provider so the
// app works with no external credentials. Keys are read server-side only.
export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "demo").toLowerCase();
  if (provider === "openai") return new OpenAIProvider();
  return new DemoAIProvider();
}

export function aiProviderName(): string {
  const provider = (process.env.AI_PROVIDER || "demo").toLowerCase();
  if (provider === "openai" && process.env.OPENAI_API_KEY) return "OpenAI";
  return "Demo (deterministic)";
}
