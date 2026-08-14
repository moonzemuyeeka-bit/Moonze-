import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";
import type { AIContext, AIModule } from "@/lib/ai/types";

const MODULES: AIModule[] = [
  "dashboard",
  "performance",
  "pipeline",
  "team",
  "accounts",
  "market",
  "campaigns",
  "actions",
  "reports",
  "general",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question: string = typeof body.question === "string" ? body.question : "";
    const rawModule: string = body?.context?.module ?? "general";
    const context: AIContext = {
      module: MODULES.includes(rawModule as AIModule)
        ? (rawModule as AIModule)
        : "general",
      entityId: body?.context?.entityId,
      label: body?.context?.label,
    };

    const provider = getAIProvider();
    const answer = await provider.ask(question, context);
    return NextResponse.json(answer);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate a response." },
      { status: 500 },
    );
  }
}
