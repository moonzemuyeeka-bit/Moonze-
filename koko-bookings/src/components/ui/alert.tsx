import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  info: {
    className: "border-blush-200 bg-blush-50 text-blush-800",
    Icon: Info,
  },
  success: {
    className: "border-mint-200 bg-mint-50 text-mint-700",
    Icon: CheckCircle2,
  },
  warning: {
    className: "border-amber-soft-200 bg-amber-soft-50 text-amber-soft-700",
    Icon: AlertTriangle,
  },
  danger: {
    className: "border-rose-alert-200 bg-rose-alert-50 text-rose-alert-700",
    Icon: XCircle,
  },
} as const;

export type AlertTone = keyof typeof TONES;

/** Errors and notices always pair an icon with text — never colour alone. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { tone?: AlertTone; title?: string }) {
  const { className: toneClass, Icon } = TONES[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-2xl border p-4 text-sm", toneClass, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="[&_p]:leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}
