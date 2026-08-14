import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMethod } from "@prisma/client";
import { env } from "@/lib/env";
import { ConfigurationError } from "@/lib/errors";
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentProvider,
  VerifyPaymentResult,
} from "@/lib/services/payments";

/**
 * Mobile-money / card aggregator adapter.
 *
 * Zambian mobile money (Airtel Money, MTN MoMo, Zamtel Kwacha) is normally
 * reached through an aggregator, and each one has its own request shape. This
 * adapter implements the surface BuildLink needs — collection request, status
 * check, refund — against a configurable JSON API, so onboarding a provider is a
 * matter of pointing the base URL at them and adjusting the two mapping
 * functions at the bottom of this file.
 *
 * It intentionally throws when credentials are absent rather than degrading to a
 * fake success. An unconfigured deployment offers recorded offline payments,
 * which are honest about what actually happened.
 */
export class MobileMoneyPaymentProvider implements PaymentProvider {
  readonly name = "mobile_money";
  readonly isSandbox = false;
  readonly supportedMethods: readonly PaymentMethod[] = [
    "MOBILE_MONEY",
    "CARD",
    "BANK_TRANSFER",
  ];

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    if (!env.MOBILE_MONEY_API_BASE_URL || !env.MOBILE_MONEY_API_KEY) {
      throw new ConfigurationError(
        "Online payment is not available: the mobile-money provider is selected but its API base URL " +
          "and key are not configured. Record an offline payment instead.",
      );
    }
    this.baseUrl = env.MOBILE_MONEY_API_BASE_URL.replace(/\/$/, "");
    this.apiKey = env.MOBILE_MONEY_API_KEY;
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!input.customerPhone && input.method === "MOBILE_MONEY") {
      throw new ConfigurationError(
        "A mobile-money payment needs the customer's mobile number. Add a phone number to your account first.",
      );
    }

    const response = await this.request("/collections", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountMinor / 100,
        currency: "ZMW",
        reference: input.reference,
        narration: input.description,
        customer: { name: input.customerName, phone: input.customerPhone },
        channel: channelFor(input.method),
        callback_url: input.returnUrl,
      }),
    });

    return {
      providerReference: String(response.id ?? response.reference ?? input.reference),
      status: mapProviderStatus(response.status) === "SUCCESSFUL" ? "SUCCESSFUL" : "PENDING",
      redirectUrl: typeof response.redirect_url === "string" ? response.redirect_url : undefined,
      instructions:
        typeof response.instructions === "string"
          ? response.instructions
          : "Approve the payment prompt on your phone to complete this payment.",
    };
  }

  async verify(providerReference: string): Promise<VerifyPaymentResult> {
    const response = await this.request(
      `/collections/${encodeURIComponent(providerReference)}`,
      { method: "GET" },
    );

    return {
      status: mapProviderStatus(response.status),
      providerReference,
      metadata: response,
      failureReason:
        typeof response.failure_reason === "string" ? response.failure_reason : undefined,
    };
  }

  async refund(input: {
    providerReference: string;
    amountMinor: number;
    reason: string;
  }): Promise<VerifyPaymentResult> {
    const response = await this.request("/refunds", {
      method: "POST",
      body: JSON.stringify({
        collection_id: input.providerReference,
        amount: input.amountMinor / 100,
        reason: input.reason,
      }),
    });

    return {
      status: mapProviderStatus(response.status) === "SUCCESSFUL" ? "REFUNDED" : "PENDING",
      providerReference: input.providerReference,
      metadata: response,
    };
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      // A payment call must not hang a request thread indefinitely.
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        typeof payload.message === "string"
          ? payload.message
          : `The payment provider rejected the request (${response.status}).`;
      throw new ConfigurationError(message);
    }

    return payload;
  }
}

function channelFor(method: PaymentMethod): string {
  switch (method) {
    case "CARD":
      return "card";
    case "BANK_TRANSFER":
      return "bank_transfer";
    default:
      return "mobile_money";
  }
}

/** Maps an aggregator's status vocabulary onto BuildLink's payment states. */
function mapProviderStatus(status: unknown): VerifyPaymentResult["status"] {
  const value = String(status ?? "").toLowerCase();
  if (["successful", "success", "completed", "paid"].includes(value)) return "SUCCESSFUL";
  if (["failed", "declined", "error"].includes(value)) return "FAILED";
  if (["cancelled", "canceled", "expired", "timeout"].includes(value)) return "CANCELLED";
  if (["refunded", "reversed"].includes(value)) return "REFUNDED";
  return "PENDING";
}

/**
 * Verifies a provider webhook signature.
 *
 * Webhooks are the one place an outside caller can change a payment's status, so
 * an unsigned or mis-signed request must be rejected before anything is read
 * from its body.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!env.MOBILE_MONEY_WEBHOOK_SECRET || !signature) return false;

  const expected = createHmac("sha256", env.MOBILE_MONEY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const provided = Buffer.from(signature.replace(/^sha256=/, ""));
  const computed = Buffer.from(expected);
  if (provided.length !== computed.length) return false;
  return timingSafeEqual(provided, computed);
}

export { mapProviderStatus };
