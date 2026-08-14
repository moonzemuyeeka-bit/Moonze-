import type { Confidence } from "@/lib/types";

export type AIModule =
  | "dashboard"
  | "performance"
  | "pipeline"
  | "team"
  | "accounts"
  | "market"
  | "campaigns"
  | "actions"
  | "reports"
  | "general";

export interface AIContext {
  module: AIModule;
  entityId?: string; // e.g. a salesperson or account id currently in view
  label?: string; // human label for the entity/page
}

export interface AISupportingItem {
  label: string;
  value: string;
}

export interface AISuggestedAction {
  label: string;
  // when present, links to a concrete recommended action in the Action Centre
  actionId?: string;
  kind?: "create-plan" | "investigate" | "view-data" | "open";
  href?: string;
}

// Every major AI recommendation is transparent: recommendation, why,
// supporting data, confidence, and a suggested action (AI safety / trust).
export interface AIAnswer {
  title: string;
  summary: string;
  diagnosis: string[];
  recommendations: string[];
  why: string;
  confidence: Confidence;
  confidenceReason: string;
  supportingData: AISupportingItem[];
  suggestedActions: AISuggestedAction[];
  followUps: string[];
  source: "demo" | "openai";
}

export interface AIProvider {
  name: string;
  ask(question: string, context: AIContext): Promise<AIAnswer>;
}
