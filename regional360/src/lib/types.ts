export type Stage =
  | "Prospect"
  | "Qualified"
  | "Discovery"
  | "Proposal"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost";

export const OPEN_STAGES: Stage[] = [
  "Prospect",
  "Qualified",
  "Discovery",
  "Proposal",
  "Negotiation",
];

export const ALL_KANBAN_STAGES: Stage[] = [
  "Prospect",
  "Qualified",
  "Discovery",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

export type PerformanceStatus = "Performing" | "Needs Attention" | "Critical";
export type HealthTier = "Healthy" | "At Risk" | "Critical";
export type Confidence = "High" | "Medium" | "Low";
export type ActionPriority = "High" | "Medium" | "Low";
export type ActionStatus =
  | "Open"
  | "Accepted"
  | "Snoozed"
  | "Assigned"
  | "Completed"
  | "Dismissed";

export interface Region {
  id: string;
  name: string;
  currency: string;
}

export interface Territory {
  id: string;
  name: string;
  regionId: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  listPrice: number;
}

export interface Salesperson {
  id: string;
  name: string;
  email: string;
  territoryId: string;
  tenureMonths: number;
  activityScore: number; // 0-100 relative activity level
}

export interface Contact {
  id: string;
  accountId: string;
  name: string;
  title: string;
  email: string;
}

export interface AccountProduct {
  productId: string;
  annualValue: number;
}

export interface CustomerIssue {
  id: string;
  accountId: string;
  title: string;
  severity: "Low" | "Medium" | "High";
  status: "open" | "resolved";
  openedAt: string;
  resolvedAt?: string;
}

export interface Account {
  id: string;
  name: string;
  industry: string;
  territoryId: string;
  ownerId: string;
  annualRevenue: number;
  potentialRevenue: number;
  revenueTrendPct: number; // YoY revenue change
  engagementTrendPct: number; // change in engagement
  products: AccountProduct[];
  lastContact: string;
  nextContact?: string;
  renewalDate?: string;
  relationshipStatus: "New" | "Growing" | "Stable" | "Declining";
  contacts: Contact[];
}

export interface Opportunity {
  id: string;
  name: string;
  accountId: string;
  ownerId: string;
  territoryId: string;
  productId: string;
  value: number;
  probability: number;
  stage: Stage;
  createdAt: string;
  expectedClose: string;
  closedAt?: string;
  daysInStage: number;
  ageDays: number;
  nextAction: string;
  riskStatus: "On Track" | "At Risk" | "Stalled";
  lostReason?: string;
  // furthest funnel stage index this opportunity reached (for funnel/leakage)
  maxStageIndex: number;
  // per cycle-stage durations in days (present for closed-won opportunities)
  cycle?: Record<CycleStageName, number>;
  // which cohort the opportunity was created in, for period comparisons
  cohort: "current" | "previous";
}

export type CycleStageName =
  | "Qualification"
  | "Discovery"
  | "Proposal"
  | "Approval"
  | "Negotiation"
  | "Closing";

export const CYCLE_STAGES: CycleStageName[] = [
  "Qualification",
  "Discovery",
  "Proposal",
  "Approval",
  "Negotiation",
  "Closing",
];

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  cost: number;
  leadsGenerated: number;
  qualifiedLeads: number;
  meetings: number;
  proposals: number;
  closedDeals: number;
  revenue: number;
}

export interface MarketSignal {
  id: string;
  industry: string;
  signalType: string;
  headline: string;
  opportunity: "High" | "Medium" | "Low";
  estimatedMarket: number;
  penetration: number;
  recommendedAction: string;
}

export interface PeriodTarget {
  period: string;
  amount: number;
}

export interface DemoDataset {
  region: Region;
  territories: Territory[];
  products: Product[];
  salespeople: Salesperson[];
  accounts: Account[];
  opportunities: Opportunity[];
  issues: CustomerIssue[];
  campaigns: Campaign[];
  marketSignals: MarketSignal[];
  // monthly revenue history keyed by period label
  revenueHistory: { period: string; revenue: number; target: number; prevYear: number }[];
  // period targets/actuals per salesperson id (current period), skill-driven
  salespersonTargets: Record<string, number>;
  salespersonActuals: Record<string, number>;
  salespersonPrevActuals: Record<string, number>;
  regionTarget: number;
  regionRevenue: number;
  regionPrevRevenue: number;
  territoryTargets: Record<string, number>;
  generatedAt: string;
}

// ---- Derived / computed view models ----------------------------------------

export interface Trend {
  value: number;
  direction: "up" | "down" | "flat";
  label: string;
}

export interface KpiSummary {
  revenue: number;
  revenueTarget: number;
  achievementPct: number;
  revenueGrowthPct: number;
  pipelineValue: number;
  weightedPipeline: number;
  pipelineCoverage: number;
  newCustomers: number;
  retentionPct: number;
  churnPct: number;
  conversionPct: number;
  prevConversionPct: number;
  avgDealSize: number;
  avgSalesCycleDays: number;
  prevSalesCycleDays: number;
  performingReps: number;
  needsAttentionReps: number;
  criticalReps: number;
  totalReps: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  value: number;
  conversionToNextPct: number | null;
  prevConversionToNextPct: number | null;
  leakagePct: number | null;
}

export interface CycleStage {
  stage: string;
  currentDays: number;
  previousDays: number;
  changePct: number;
}

export interface DiagnosticCategory {
  category: "Market" | "People" | "Process" | "Product";
  score: number;
  rationale: string;
  signals: string[];
}

export interface RepScorecard {
  salesperson: Salesperson;
  territoryName: string;
  target: number;
  actual: number;
  achievementPct: number;
  pipeline: number;
  pipelineCoverage: number;
  conversionPct: number;
  avgDealSize: number;
  salesCycleDays: number;
  newAccounts: number;
  retentionPct: number;
  activityScore: number;
  trendPct: number;
  status: PerformanceStatus;
  attentionReason: string;
}

export interface RecommendedAction {
  id: string;
  title: string;
  reason: string;
  priority: ActionPriority;
  source:
    | "Performance"
    | "Team"
    | "Accounts"
    | "Pipeline"
    | "Market"
    | "Customer Risk"
    | "Process";
  impact: number; // 0-100 business impact
  urgency: number; // 0-100
  confidence: Confidence;
  effort: number; // 0-100 (higher = more effort)
  relatedType?: "account" | "salesperson" | "territory" | "opportunity";
  relatedId?: string;
  suggestedAction: string;
}

export interface AccountHealth {
  account: Account;
  ownerName: string;
  territoryName: string;
  healthScore: number;
  tier: HealthTier;
  openIssues: number;
  penetrationPct: number;
  expansionPotential: number;
  daysToRenewal: number | null;
  signals: { label: string; impact: number; detail: string }[];
  openOpportunities: number;
}
