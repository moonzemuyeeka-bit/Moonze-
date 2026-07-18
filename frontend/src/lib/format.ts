export const kwacha = (n: number) =>
  `ZMW ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function bandColor(band: string | null): string {
  switch (band) {
    case "A":
      return "#21c07a";
    case "B":
      return "#4cc9f0";
    case "C":
      return "#f5a623";
    case "D":
      return "#ff8c42";
    default:
      return "#ff5c72";
  }
}

export function statusBadge(status: string): string {
  switch (status) {
    case "repaid":
    case "disbursed":
    case "approved":
      return "green";
    case "overdue":
    case "defaulted":
    case "rejected":
      return "red";
    case "pending":
    case "submitted":
      return "amber";
    default:
      return "gray";
  }
}

export function severityBadge(sev: string): string {
  switch (sev) {
    case "critical":
    case "high":
      return "red";
    case "medium":
      return "amber";
    case "low":
      return "blue";
    default:
      return "gray";
  }
}
