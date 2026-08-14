import { Ban, CalendarX, CheckCircle2, Clock3 } from "lucide-react";
import type { DayStatus } from "@/types";

/**
 * Status meanings are carried by an icon *and* a word, never by colour alone
 * (WCAG 1.4.1).
 */
export const DAY_STATUS_STYLES: Record<
  DayStatus,
  { label: string; Icon: typeof CheckCircle2; cell: string; legend: string }
> = {
  AVAILABLE: {
    label: "Available",
    Icon: CheckCircle2,
    cell: "border-mint-200 bg-mint-50 text-ink hover:border-blush-400 hover:bg-blush-50",
    legend: "text-mint-700",
  },
  LIMITED: {
    label: "Limited availability",
    Icon: Clock3,
    cell:
      "border-amber-soft-200 bg-amber-soft-50 text-ink hover:border-blush-400 hover:bg-blush-50",
    legend: "text-amber-soft-700",
  },
  FULL: {
    label: "Fully booked",
    Icon: CalendarX,
    cell: "border-rose-alert-200 bg-rose-alert-50 text-rose-alert-700",
    legend: "text-rose-alert-700",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    Icon: Ban,
    cell: "border-line bg-white/50 text-ink-muted",
    legend: "text-ink-muted",
  },
  PAST: {
    label: "Past",
    Icon: Ban,
    cell: "border-transparent bg-transparent text-ink-muted/60",
    legend: "text-ink-muted",
  },
};

const LEGEND_ORDER: DayStatus[] = ["AVAILABLE", "LIMITED", "FULL", "UNAVAILABLE"];

export function AvailabilityLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
      {LEGEND_ORDER.map((status) => {
        const { label, Icon, legend } = DAY_STATUS_STYLES[status];
        return (
          <li key={status} className={`flex items-center gap-1.5 ${legend}`}>
            <Icon className="size-3.5" aria-hidden />
            {label}
          </li>
        );
      })}
    </ul>
  );
}
