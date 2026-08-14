import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Confidence } from "@/lib/types";

const MAP: Record<Confidence, "success" | "warning" | "muted"> = {
  High: "success",
  Medium: "warning",
  Low: "muted",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <Badge variant={MAP[confidence]} className="gap-1">
      <ShieldCheck className="h-3 w-3" />
      Confidence: {confidence}
    </Badge>
  );
}
