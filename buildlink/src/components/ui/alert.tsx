import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-lg border p-4 text-sm", {
  variants: {
    tone: {
      info: "border-info-500/25 bg-info-50 text-info-700",
      success: "border-success-500/25 bg-success-50 text-success-700",
      warning: "border-warning-500/25 bg-warning-50 text-warning-700",
      danger: "border-danger-500/25 bg-danger-50 text-danger-700",
      neutral: "border-border bg-surface-muted text-foreground-muted",
    },
  },
  defaultVariants: { tone: "info" },
});

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: ShieldAlert,
  neutral: Info,
} as const;

export type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    title?: React.ReactNode;
    hideIcon?: boolean;
  };

export function Alert({ className, tone = "info", title, hideIcon, children, ...props }: AlertProps) {
  const Icon = icons[tone ?? "info"];
  const isAssertive = tone === "danger";

  return (
    <div
      role={isAssertive ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {hideIcon ? null : <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="[&_a]:underline [&_a]:underline-offset-2">{children}</div> : null}
      </div>
    </div>
  );
}
