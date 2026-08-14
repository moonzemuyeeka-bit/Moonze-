import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Product analytics.
 *
 * Privacy-conscious by construction: events carry an id and a small set of
 * declared properties, never page contents, never free-text a customer typed
 * into a private field, and never a raw IP address. The `db` sink keeps the data
 * inside BuildLink's own database; swapping in a third-party provider means
 * implementing one `AnalyticsSink`.
 */

export const ANALYTICS_EVENTS = {
  userRegistered: "user_registered",
  userSignedIn: "user_signed_in",
  onboardingCompleted: "onboarding_completed",
  projectCreated: "project_created",
  projectStageAdvanced: "project_stage_advanced",
  budgetUpdated: "budget_updated",
  productSearched: "product_searched",
  productViewed: "product_viewed",
  supplierViewed: "supplier_viewed",
  productsCompared: "products_compared",
  productAddedToCart: "product_added_to_cart",
  checkoutStarted: "checkout_started",
  orderCreated: "order_created",
  paymentInitiated: "payment_initiated",
  paymentCompleted: "payment_completed",
  contractSent: "contract_sent",
  contractAccepted: "contract_accepted",
  deliveryRequested: "delivery_requested",
  deliveryCompleted: "delivery_completed",
  reviewSubmitted: "review_submitted",
  paletteAnalysed: "palette_analysed",
  materialsEstimated: "materials_estimated",
  supplierApplied: "supplier_applied",
  productListed: "product_listed",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type TrackInput = {
  name: AnalyticsEventName;
  userId?: string | null;
  /**
   * Small, declared properties only — counts, enums, ids, durations. Never
   * personal data or free text.
   */
  properties?: Record<string, string | number | boolean | null>;
};

export type AnalyticsSink = {
  readonly name: string;
  record(input: TrackInput): Promise<void>;
};

class DatabaseSink implements AnalyticsSink {
  readonly name = "db";

  async record(input: TrackInput): Promise<void> {
    await db.analyticsEvent.create({
      data: {
        name: input.name,
        userId: input.userId ?? null,
        properties: (input.properties ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}

class LogSink implements AnalyticsSink {
  readonly name = "log";

  async record(input: TrackInput): Promise<void> {
    console.info(`[analytics] ${input.name}`, input.properties ?? {});
  }
}

class NullSink implements AnalyticsSink {
  readonly name = "none";
  async record(): Promise<void> {}
}

let sink: AnalyticsSink | null = null;

function analyticsSink(): AnalyticsSink {
  if (sink) return sink;
  sink =
    env.ANALYTICS_DRIVER === "db"
      ? new DatabaseSink()
      : env.ANALYTICS_DRIVER === "log"
        ? new LogSink()
        : new NullSink();
  return sink;
}

/**
 * Records a product event. Analytics must never break a user flow, so all
 * failures are logged and swallowed.
 */
export async function track(input: TrackInput): Promise<void> {
  try {
    await analyticsSink().record(input);
  } catch (error) {
    console.error("[buildlink] analytics sink failed:", input.name, error);
  }
}

/** Test hook: rebuilds the sink after `env` changes. */
export function resetAnalyticsSink(): void {
  sink = null;
}
