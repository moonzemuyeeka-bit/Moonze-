import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function InsightBanner({
  children,
  action,
  tone = "default",
}: {
  children: React.ReactNode;
  action?: { label: string; href: string };
  tone?: "default" | "warning" | "negative";
}) {
  const toneClass =
    tone === "warning"
      ? "border-warning/40 bg-warning/10"
      : tone === "negative"
        ? "border-destructive/40 bg-destructive/10"
        : "border-primary/30 bg-primary/5";
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between", toneClass)}>
      <div className="flex items-start gap-2 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>{children}</span>
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
