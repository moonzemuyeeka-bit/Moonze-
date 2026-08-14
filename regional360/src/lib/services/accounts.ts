import {
  getAccounts,
  getIssues,
  getOpportunities,
  getProducts,
  salespersonName,
  territoryName,
} from "@/lib/repositories";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/config";
import { clamp, daysBetween, formatCurrency, formatPercent } from "@/lib/utils";
import type { Account, AccountHealth, HealthTier } from "@/lib/types";
import type { AIAnswer } from "@/lib/ai/types";

const NOW = "2026-08-14T00:00:00Z";

export function openIssuesFor(accountId: string) {
  return getIssues().filter(
    (i) => i.accountId === accountId && i.status === "open",
  );
}

// Customer Health Score (0-100) from configurable signals.
export function accountHealth(
  account: Account,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): AccountHealth {
  const openIssues = openIssuesFor(account.id);
  const daysToRenewal = account.renewalDate
    ? daysBetween(NOW, account.renewalDate)
    : null;
  const daysSinceContact = daysBetween(account.lastContact, NOW);

  const signals: AccountHealth["signals"] = [];

  // 1. Revenue trend
  const revImpact = clamp(account.revenueTrendPct * 0.8, -22, 18);
  signals.push({
    label: "Revenue trend",
    impact: Math.round(revImpact),
    detail: `${account.revenueTrendPct > 0 ? "+" : ""}${account.revenueTrendPct}% vs prior period`,
  });

  // 2. Engagement trend
  const engImpact = clamp(account.engagementTrendPct * 0.6, -20, 15);
  signals.push({
    label: "Engagement",
    impact: Math.round(engImpact),
    detail: `${account.engagementTrendPct > 0 ? "+" : ""}${account.engagementTrendPct}% interaction volume`,
  });

  // 3. Open issues / complaints
  const issueImpact = -Math.min(24, openIssues.length * 6);
  signals.push({
    label: "Open issues",
    impact: issueImpact,
    detail: `${openIssues.length} open complaint${openIssues.length === 1 ? "" : "s"}`,
  });

  // 4. Recency of contact
  const contactImpact = daysSinceContact > 30 ? -10 : daysSinceContact < 10 ? 6 : 0;
  signals.push({
    label: "Recency of contact",
    impact: contactImpact,
    detail: `Last contact ${daysSinceContact} days ago`,
  });

  // 5. Renewal proximity risk
  const renewalImpact =
    daysToRenewal !== null && daysToRenewal < 60 ? -8 : 0;
  signals.push({
    label: "Renewal proximity",
    impact: renewalImpact,
    detail:
      daysToRenewal !== null
        ? `Renewal in ${daysToRenewal} days`
        : "No renewal date",
  });

  // 6. Product penetration
  const penetrationPct = (account.annualRevenue / account.potentialRevenue) * 100;
  const penImpact = penetrationPct > 70 ? 8 : penetrationPct < 45 ? -6 : 0;
  signals.push({
    label: "Product penetration",
    impact: penImpact,
    detail: `${penetrationPct.toFixed(0)}% of estimated potential`,
  });

  const base = 72;
  const raw = base + signals.reduce((a, b) => a + b.impact, 0);
  const healthScore = Math.round(clamp(raw, 3, 99));

  let tier: HealthTier;
  if (healthScore >= thresholds.accountHealthy) tier = "Healthy";
  else if (healthScore >= thresholds.accountAtRisk) tier = "At Risk";
  else tier = "Critical";

  const expansionPotential = Math.max(
    0,
    account.potentialRevenue - account.annualRevenue,
  );

  const openOpportunities = getOpportunities().filter(
    (o) =>
      o.accountId === account.id &&
      !["Closed Won", "Closed Lost"].includes(o.stage),
  ).length;

  return {
    account,
    ownerName: salespersonName(account.ownerId),
    territoryName: territoryName(account.territoryId),
    healthScore,
    tier,
    openIssues: openIssues.length,
    penetrationPct,
    expansionPotential,
    daysToRenewal,
    signals,
    openOpportunities,
  };
}

export function allAccountHealth(
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): AccountHealth[] {
  return getAccounts()
    .map((a) => accountHealth(a, thresholds))
    .sort((a, b) => a.healthScore - b.healthScore);
}

// AI retention / expansion recommendation for a single account, built with
// the transparent recommendation / why / supporting-data / confidence shape.
export function accountRetentionInsight(
  account: Account,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): AIAnswer {
  const h = accountHealth(account, thresholds);
  const cross = crossSellRecommendations(account)[0];
  const negatives = h.signals.filter((s) => s.impact < 0);

  const isRisk = h.tier !== "Healthy";
  const recs: string[] = [];
  if (h.openIssues > 0)
    recs.push(`Resolve the ${h.openIssues} outstanding service issue${h.openIssues === 1 ? "" : "s"} before renewal.`);
  if (h.daysToRenewal !== null && h.daysToRenewal < 60)
    recs.push(`Schedule an executive account review ahead of the ${h.daysToRenewal}-day renewal.`);
  if (cross)
    recs.push(`Explore ${cross.product.name} — used by ${cross.peerAdoptionPct}% of similar ${account.industry} accounts (~${formatCurrency(cross.estimatedValue, { compact: true })}).`);
  if (recs.length === 0) recs.push("Maintain cadence and pursue the largest expansion opportunity.");

  return {
    title: isRisk ? `Protect ${account.name}` : `Grow ${account.name}`,
    summary: isRisk
      ? `${account.name} is ${h.tier} (health ${h.healthScore}/100). Revenue is ${account.revenueTrendPct}% and engagement ${account.engagementTrendPct}% with ${h.openIssues} open issue${h.openIssues === 1 ? "" : "s"}.`
      : `${account.name} is Healthy (health ${h.healthScore}/100) with ${formatCurrency(h.expansionPotential, { compact: true })} of expansion headroom at ${formatPercent(h.penetrationPct)} penetration.`,
    diagnosis: [
      `Health score ${h.healthScore}/100 (${h.tier}).`,
      negatives.length
        ? `Largest drags: ${negatives.slice(0, 2).map((s) => `${s.label.toLowerCase()} (${s.detail})`).join(", ")}.`
        : "No material negative signals.",
      `Penetration ${formatPercent(h.penetrationPct)} of ${formatCurrency(account.potentialRevenue, { compact: true })} potential.`,
    ],
    recommendations: recs,
    why: `The health score weights revenue trend, engagement, open issues, contact recency, renewal proximity and product penetration. ${isRisk ? "Negative signals dominate, so protect before expanding." : "Signals are positive, so focus on expansion."}`,
    confidence: h.tier === "Critical" ? "High" : "Medium",
    confidenceReason:
      "Based on commercial and customer-experience data in the app. External relationship context should be confirmed with the account owner.",
    supportingData: [
      { label: "Health", value: `${h.healthScore}/100 (${h.tier})` },
      { label: "Revenue", value: formatCurrency(account.annualRevenue, { compact: true }) },
      { label: "Penetration", value: formatPercent(h.penetrationPct) },
      { label: "Open issues", value: String(h.openIssues) },
      { label: "Renewal", value: h.daysToRenewal !== null ? `${h.daysToRenewal} days` : "—" },
    ],
    suggestedActions: [
      { label: "Create account action", kind: "create-plan" },
      { label: "Open Accounts", kind: "open", href: "/accounts" },
    ],
    followUps: [
      "Which accounts are at risk?",
      "Where is our biggest growth opportunity?",
    ],
    source: "demo",
  };
}

// Cross-sell: products used by similar accounts (same industry) that this
// account does not yet own, ranked by adoption among peers.
export function crossSellRecommendations(account: Account) {
  const products = getProducts();
  const owned = new Set(account.products.map((p) => p.productId));
  const peers = getAccounts().filter(
    (a) => a.industry === account.industry && a.id !== account.id,
  );

  const candidates = products
    .filter((p) => !owned.has(p.id))
    .map((p) => {
      const peerAdoption = peers.length
        ? peers.filter((a) => a.products.some((x) => x.productId === p.id))
            .length / peers.length
        : 0;
      const estValue = Math.round(p.listPrice * (0.6 + peerAdoption * 0.6));
      return {
        product: p,
        peerAdoptionPct: Math.round(peerAdoption * 100),
        estimatedValue: estValue,
      };
    })
    .sort((a, b) => b.peerAdoptionPct - a.peerAdoptionPct);

  return candidates;
}
