import { generateDataset } from "@/lib/demo/generate";
import type { DemoDataset } from "@/lib/types";

// The repository layer is the single swap point between the deterministic demo
// dataset and a future Prisma/PostgreSQL-backed implementation (Phase 3).
// Services and pages depend on these functions, never on the data source.

let cached: DemoDataset | null = null;

export function getDataset(): DemoDataset {
  if (!cached) {
    cached = generateDataset(42);
  }
  return cached;
}

export function getRegion() {
  return getDataset().region;
}
export function getTerritories() {
  return getDataset().territories;
}
export function getProducts() {
  return getDataset().products;
}
export function getSalespeople() {
  return getDataset().salespeople;
}
export function getAccounts() {
  return getDataset().accounts;
}
export function getOpportunities() {
  return getDataset().opportunities;
}
export function getIssues() {
  return getDataset().issues;
}
export function getCampaigns() {
  return getDataset().campaigns;
}
export function getMarketSignals() {
  return getDataset().marketSignals;
}

// -- Lookup helpers ----------------------------------------------------------
export function territoryName(id: string): string {
  return getTerritories().find((t) => t.id === id)?.name ?? "Unknown";
}
export function salespersonName(id: string): string {
  return getSalespeople().find((s) => s.id === id)?.name ?? "Unknown";
}
export function productName(id: string): string {
  return getProducts().find((p) => p.id === id)?.name ?? "Unknown";
}
export function accountName(id: string): string {
  return getAccounts().find((a) => a.id === id)?.name ?? "Unknown";
}
export function accountById(id: string) {
  return getAccounts().find((a) => a.id === id);
}
export function salespersonById(id: string) {
  return getSalespeople().find((s) => s.id === id);
}
