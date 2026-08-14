import { describe, expect, it } from "vitest";
import { calculateTrustScore, TRUST_BAND_LABELS, type TrustScoreInput } from "@/lib/domain/trust-score";
import { ratingToBasisPoints } from "@/lib/money";

function input(overrides: Partial<TrustScoreInput> = {}): TrustScoreInput {
  return {
    verificationStatus: "UNVERIFIED",
    ratingAverageBps: 0,
    ratingCount: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalOrders: 0,
    deliveriesCompleted: 0,
    deliveriesAttempted: 0,
    openDisputes: 0,
    resolvedDisputes: 0,
    averageResponseMinutes: null,
    ...overrides,
  };
}

describe("calculateTrustScore", () => {
  it("stays within 0-100 for a brand new supplier", () => {
    const result = calculateTrustScore(input());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.band).toBe("caution");
  });

  it("awards close to full marks to an exemplary verified supplier", () => {
    const result = calculateTrustScore(
      input({
        verificationStatus: "VERIFIED",
        ratingAverageBps: ratingToBasisPoints(4.9),
        ratingCount: 64,
        completedOrders: 210,
        cancelledOrders: 2,
        totalOrders: 215,
        deliveriesCompleted: 200,
        deliveriesAttempted: 202,
        averageResponseMinutes: 25,
      }),
    );

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.band).toBe("excellent");
  });

  it("explains every component so the score can be shown, not just asserted", () => {
    const result = calculateTrustScore(input({ verificationStatus: "VERIFIED" }));
    const keys = result.factors.map((factor) => factor.key);

    expect(keys).toEqual([
      "verification",
      "ratings",
      "experience",
      "reliability",
      "delivery",
      "responsiveness",
    ]);
    for (const factor of result.factors) {
      expect(factor.detail.length).toBeGreaterThan(0);
      expect(factor.points).toBeLessThanOrEqual(factor.maxPoints);
    }
  });

  it("scores verification as one component, not the whole score", () => {
    const verified = calculateTrustScore(input({ verificationStatus: "VERIFIED" }));
    const pending = calculateTrustScore(input({ verificationStatus: "PENDING" }));
    const unverified = calculateTrustScore(input());

    expect(verified.score).toBeGreaterThan(pending.score);
    expect(pending.score).toBeGreaterThan(unverified.score);
    // Verification alone must not be enough to look excellent.
    expect(verified.score).toBeLessThan(80);
  });

  it("lets a proven unverified supplier outscore a bare verified one", () => {
    const proven = calculateTrustScore(
      input({
        ratingAverageBps: ratingToBasisPoints(4.8),
        ratingCount: 40,
        completedOrders: 120,
        totalOrders: 122,
        cancelledOrders: 2,
        deliveriesCompleted: 118,
        deliveriesAttempted: 120,
        averageResponseMinutes: 30,
      }),
    );
    const bareVerified = calculateTrustScore(input({ verificationStatus: "VERIFIED" }));

    expect(proven.score).toBeGreaterThan(bareVerified.score);
  });

  it("scores rejected and suspended suppliers no verification credit", () => {
    for (const status of ["REJECTED", "SUSPENDED"] as const) {
      const result = calculateTrustScore(input({ verificationStatus: status }));
      const verification = result.factors.find((factor) => factor.key === "verification")!;
      expect(verification.points).toBe(0);
    }
  });

  it("discounts a single glowing review against a long record", () => {
    const oneReview = calculateTrustScore(
      input({ ratingAverageBps: ratingToBasisPoints(5), ratingCount: 1 }),
    );
    const manyReviews = calculateTrustScore(
      input({ ratingAverageBps: ratingToBasisPoints(5), ratingCount: 30 }),
    );
    const oneReviewPoints = oneReview.factors.find((f) => f.key === "ratings")!.points;
    const manyReviewPoints = manyReviews.factors.find((f) => f.key === "ratings")!.points;

    expect(oneReviewPoints).toBeLessThan(manyReviewPoints);
  });

  it("penalises cancellations and failed deliveries", () => {
    const reliable = calculateTrustScore(
      input({ completedOrders: 50, totalOrders: 50, deliveriesCompleted: 50, deliveriesAttempted: 50 }),
    );
    const unreliable = calculateTrustScore(
      input({
        completedOrders: 30,
        cancelledOrders: 20,
        totalOrders: 50,
        deliveriesCompleted: 20,
        deliveriesAttempted: 50,
      }),
    );

    expect(unreliable.score).toBeLessThan(reliable.score);
  });

  it("subtracts a capped penalty for disputes", () => {
    const clean = calculateTrustScore(input({ verificationStatus: "VERIFIED" }));
    const disputed = calculateTrustScore(
      input({ verificationStatus: "VERIFIED", openDisputes: 2, resolvedDisputes: 1 }),
    );
    const flooded = calculateTrustScore(
      input({ verificationStatus: "VERIFIED", openDisputes: 40, resolvedDisputes: 40 }),
    );

    expect(disputed.score).toBeLessThan(clean.score);
    expect(disputed.factors.some((factor) => factor.key === "disputes")).toBe(true);
    expect(clean.factors.some((factor) => factor.key === "disputes")).toBe(false);
    // The cap keeps disputes from wiping out an otherwise good record entirely.
    expect(clean.score - flooded.score).toBeLessThanOrEqual(18);
    expect(flooded.score).toBeGreaterThanOrEqual(0);
  });

  it("rewards faster responses monotonically", () => {
    const points = [30, 120, 600, 5_000].map(
      (minutes) =>
        calculateTrustScore(input({ averageResponseMinutes: minutes })).factors.find(
          (factor) => factor.key === "responsiveness",
        )!.points,
    );
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it("labels every band", () => {
    for (const band of ["excellent", "good", "fair", "building", "caution"] as const) {
      expect(TRUST_BAND_LABELS[band].length).toBeGreaterThan(0);
    }
  });
});
