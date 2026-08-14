import { FlaskConical, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="muted" className={cn("gap-1", className)}>
      <FlaskConical className="h-3 w-3" />
      Demo data
    </Badge>
  );
}

export function AiBadge({ label = "AI-generated", className }: { label?: string; className?: string }) {
  return (
    <Badge variant="default" className={cn("gap-1", className)}>
      <Sparkles className="h-3 w-3" />
      {label}
    </Badge>
  );
}
