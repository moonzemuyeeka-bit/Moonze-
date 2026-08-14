import type { VerificationStatus } from "@prisma/client";
import { ratingFromBasisPoints } from "@/lib/money";

/**
 * Supplier trust score.
 *
 * A single 0-100 figure a customer can act on, built only from things BuildLink
 * can actually observe. Every component is named and returned so the supplier
 * profile can explain the score instead of asking people to trust a number —
 * and so a supplier can see exactly what to improve.
 *
 * Verification is a *component* of trust, never a synonym for it: an unverified
 * supplier with a long record of completed orders can outscore a newly verified
 * one, and the badge shown next to the score always states the real
 * verification state.
 */

export type TrustScoreInput = {
  verificationStatus: VerificationStatus;
  ratingAverageBps: number;
  ratingCount: number;
  completedOrders: number;
  cancelledOrders: number;
  totalOrders: number;
  /** Deliveries marked delivered without a failure, over deliveries attempted. */
  deliveriesCompleted: number;
  deliveriesAttempted: number;
  openDisputes: number;
  resolvedDisputes: number;
  averageResponseMinutes: number | null;
};

export type TrustFactor = {
  key:
    | "verification"
    | "ratings"
    | "experience"
    | "reliability"
    | "delivery"
    | "responsiveness"
    | "disputes";
  label: string;
  /** Points contributed, which may be negative for penalties. */
  points: number;
  maxPoints: number;
  detail: string;
};

export type TrustScoreResult = {
  score: number;
  band: "excellent" | "good" | "fair" | "building" | "caution";
  factors: TrustFactor[];
};

const WEIGHTS = {
  verification: 28,
  ratings: 24,
  experience: 16,
  reliability: 14,
  delivery: 10,
  responsiveness: 8,
} as const;

/** Penalty applied per unresolved dispute, capped. */
const DISPUTE_PENALTY_PER_CASE = 6;
const DISPUTE_PENALTY_CAP = 18;

export function calculateTrustScore(input: TrustScoreInput): TrustScoreResult {
  const factors: TrustFactor[] = [];

  // --- Verification --------------------------------------------------------
  const verificationPoints = (() => {
    switch (input.verificationStatus) {
      case "VERIFIED":
        return WEIGHTS.verification;
      case "PENDING":
        return Math.round(WEIGHTS.verification * 0.3);
      case "UNVERIFIED":
        return 0;
      case "REJECTED":
      case "SUSPENDED":
        return 0;
    }
  })();

  factors.push({
    key: "verification",
    label: "Business verification",
    points: verificationPoints,
    maxPoints: WEIGHTS.verification,
    detail:
      input.verificationStatus === "VERIFIED"
        ? "Registration documents reviewed by BuildLink."
        : input.verificationStatus === "PENDING"
          ? "Documents submitted, review in progress."
          : "No verified registration documents on file.",
  });

  // --- Ratings -------------------------------------------------------------
  // Confidence-weighted so one five-star review does not outrank a long record.
  const stars = ratingFromBasisPoints(input.ratingAverageBps);
  const confidence = input.ratingCount === 0 ? 0 : Math.min(1, input.ratingCount / 10);
  const ratingPoints = Math.round((stars / 5) * WEIGHTS.ratings * confidence);

  factors.push({
    key: "ratings",
    label: "Customer ratings",
    points: ratingPoints,
    maxPoints: WEIGHTS.ratings,
    detail:
      input.ratingCount === 0
        ? "No customer reviews yet."
        : `${stars.toFixed(1)} out of 5 from ${input.ratingCount} completed order${input.ratingCount === 1 ? "" : "s"}.`,
  });

  // --- Experience ----------------------------------------------------------
  // Logarithmic: the difference between 0 and 10 orders matters far more than
  // between 200 and 300.
  const experiencePoints =
    input.completedOrders <= 0
      ? 0
      : Math.round(
          Math.min(1, Math.log10(input.completedOrders + 1) / Math.log10(101)) *
            WEIGHTS.experience,
        );

  factors.push({
    key: "experience",
    label: "Completed orders",
    points: experiencePoints,
    maxPoints: WEIGHTS.experience,
    detail:
      input.completedOrders === 0
        ? "No orders completed through BuildLink yet."
        : `${input.completedOrders} order${input.completedOrders === 1 ? "" : "s"} completed through BuildLink.`,
  });

  // --- Reliability (cancellations) ----------------------------------------
  const decidedOrders = Math.max(input.totalOrders, input.completedOrders + input.cancelledOrders);
  const cancellationRate = decidedOrders === 0 ? 0 : input.cancelledOrders / decidedOrders;
  const reliabilityPoints =
    decidedOrders === 0
      ? Math.round(WEIGHTS.reliability * 0.4)
      : Math.round(Math.max(0, 1 - cancellationRate * 2) * WEIGHTS.reliability);

  factors.push({
    key: "reliability",
    label: "Order reliability",
    points: reliabilityPoints,
    maxPoints: WEIGHTS.reliability,
    detail:
      decidedOrders === 0
        ? "Not enough order history to assess cancellations."
        : `${Math.round(cancellationRate * 100)}% of orders cancelled by this supplier.`,
  });

  // --- Delivery ------------------------------------------------------------
  const deliveryRate =
    input.deliveriesAttempted === 0
      ? null
      : input.deliveriesCompleted / input.deliveriesAttempted;
  const deliveryPoints =
    deliveryRate === null
      ? Math.round(WEIGHTS.delivery * 0.4)
      : Math.round(deliveryRate * WEIGHTS.delivery);

  factors.push({
    key: "delivery",
    label: "Delivery completion",
    points: deliveryPoints,
    maxPoints: WEIGHTS.delivery,
    detail:
      deliveryRate === null
        ? "No deliveries arranged through BuildLink yet."
        : `${Math.round(deliveryRate * 100)}% of deliveries completed successfully.`,
  });

  // --- Responsiveness -----------------------------------------------------
  const responsePoints = (() => {
    if (input.averageResponseMinutes === null) return Math.round(WEIGHTS.responsiveness * 0.4);
    if (input.averageResponseMinutes <= 60) return WEIGHTS.responsiveness;
    if (input.averageResponseMinutes <= 240) return Math.round(WEIGHTS.responsiveness * 0.75);
    if (input.averageResponseMinutes <= 1440) return Math.round(WEIGHTS.responsiveness * 0.5);
    return Math.round(WEIGHTS.responsiveness * 0.2);
  })();

  factors.push({
    key: "responsiveness",
    label: "Response time",
    points: responsePoints,
    maxPoints: WEIGHTS.responsiveness,
    detail:
      input.averageResponseMinutes === null
        ? "No response-time history yet."
        : `Typically responds to orders in ${formatMinutes(input.averageResponseMinutes)}.`,
  });

  // --- Disputes (penalty) -------------------------------------------------
  const disputePenalty = Math.min(
    DISPUTE_PENALTY_CAP,
    input.openDisputes * DISPUTE_PENALTY_PER_CASE +
      input.resolvedDisputes * Math.round(DISPUTE_PENALTY_PER_CASE / 3),
  );

  if (disputePenalty > 0) {
    factors.push({
      key: "disputes",
      label: "Disputes",
      points: -disputePenalty,
      maxPoints: 0,
      detail: `${input.openDisputes} open and ${input.resolvedDisputes} resolved dispute${input.resolvedDisputes === 1 ? "" : "s"}.`,
    });
  }

  const raw = factors.reduce((total, factor) => total + factor.points, 0);
  const score = Math.max(0, Math.min(100, raw));

  return { score, band: bandFor(score), factors };
}

function bandFor(score: number): TrustScoreResult["band"] {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 45) return "fair";
  if (score >= 25) return "building";
  return "caution";
}

export const TRUST_BAND_LABELS: Record<TrustScoreResult["band"], string> = {
  excellent: "Excellent track record",
  good: "Good track record",
  fair: "Fair track record",
  building: "Still building a record",
  caution: "Little history — take care",
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
