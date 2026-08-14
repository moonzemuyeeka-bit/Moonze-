import "server-only";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { env, isProduction } from "@/lib/env";
import { ConfigurationError } from "@/lib/errors";

/**
 * Payment provider abstraction.
 *
 * BuildLink ships **no** working money-movement integration, and that is a
 * deliberate product decision: pretending a payment succeeded is the single most
 * damaging thing a marketplace can do to a customer building a house. What ships
 * is this interface, a clearly-labelled sandbox for development and tests, and a
 * mobile-money adapter that refuses to run until real credentials exist.
 *
 * Two honest paths exist in production:
 *  1. A configured provider actually moves the money and confirms it.
 *  2. No provider — the customer pays the supplier directly (bank transfer,
 *     cash, their own mobile money) and BuildLink records it, with the supplier
 *     confirming receipt. See `requiresManualConfirmation` in
 *     lib/domain/payment-status.ts.
 */

export type InitiatePaymentInput = {
  paymentId: string;
  reference: string;
  amountMinor: number;
  method: PaymentMethod;
  customerName: string;
  customerPhone: string | null;
  description: string;
  /** Where the provider should send the customer back to. */
  returnUrl: string;
};

export type InitiatePaymentResult = {
  providerReference: string;
  status: Extract<PaymentStatus, "INITIATED" | "PENDING" | "SUCCESSFUL" | "FAILED">;
  /** Send the customer here to authorise (card / hosted checkout flows). */
  redirectUrl?: string;
  /** Shown to the customer when authorisation happens on their handset. */
  instructions?: string;
};

export type VerifyPaymentResult = {
  status: PaymentStatus;
  providerReference: string;
  /** Raw provider response, stored on the immutable transaction row. */
  metadata?: Record<string, unknown>;
  failureReason?: string;
};

export type PaymentProvider = {
  readonly name: string;
  readonly isSandbox: boolean;
  readonly supportedMethods: readonly PaymentMethod[];
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verify(providerReference: string): Promise<VerifyPaymentResult>;
  refund(input: {
    providerReference: string;
    amountMinor: number;
    reason: string;
  }): Promise<VerifyPaymentResult>;
};

/**
 * Resolves the configured provider.
 *
 * The sandbox guard lives here rather than in environment validation because
 * `next build` runs with NODE_ENV=production: the check that matters is the one
 * at the moment a payment would be created.
 */
export async function getPaymentProvider(): Promise<PaymentProvider | null> {
  switch (env.PAYMENT_PROVIDER) {
    case "sandbox": {
      if (isProduction && !env.ALLOW_SANDBOX_PAYMENTS) {
        throw new ConfigurationError(
          "Online payment is not available. The sandbox payment provider cannot be used in production — " +
            "record an offline payment instead, or configure a real payment provider.",
        );
      }
      const { SandboxPaymentProvider } = await import("@/lib/services/payments/sandbox");
      return new SandboxPaymentProvider();
    }
    case "mobile_money": {
      const { MobileMoneyPaymentProvider } = await import(
        "@/lib/services/payments/mobile-money"
      );
      return new MobileMoneyPaymentProvider();
    }
    case "none":
      return null;
  }
}

/** True when the deployment can process a payment online at all. */
export function hasOnlinePaymentProvider(): boolean {
  if (env.PAYMENT_PROVIDER === "none") return false;
  if (env.PAYMENT_PROVIDER === "sandbox") return !isProduction || env.ALLOW_SANDBOX_PAYMENTS;
  return true;
}

/** Methods a customer may choose at checkout in this deployment. */
export function availablePaymentMethods(): PaymentMethod[] {
  const offline: PaymentMethod[] = [
    "RECORDED_MOBILE_MONEY",
    "RECORDED_BANK_TRANSFER",
    "RECORDED_CASH",
  ];

  if (!hasOnlinePaymentProvider()) return offline;
  if (env.PAYMENT_PROVIDER === "sandbox") return ["SANDBOX", ...offline];
  return ["MOBILE_MONEY", "CARD", "BANK_TRANSFER", ...offline];
}

/** Banner text shown at checkout so the payment situation is never ambiguous. */
export function paymentEnvironmentNotice(): { tone: "info" | "warning"; message: string } | null {
  if (env.PAYMENT_PROVIDER === "sandbox" && (!isProduction || env.ALLOW_SANDBOX_PAYMENTS)) {
    return {
      tone: "warning",
      message:
        "Sandbox payments are enabled on this deployment. Test payments move no real money and are marked as sandbox on every record.",
    };
  }
  if (env.PAYMENT_PROVIDER === "none") {
    return {
      tone: "info",
      message:
        "Online payment is not enabled on BuildLink yet. Pay your supplier directly and record the payment here — the supplier then confirms receipt.",
    };
  }
  return null;
}
