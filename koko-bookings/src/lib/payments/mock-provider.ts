import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PaymentMethod } from "@/generated/prisma";
import { formatKwacha } from "@/lib/money";
import { formatPhone, MOBILE_MONEY_PROVIDERS } from "@/lib/phone";
import type {
  CreatePaymentInput,
  PaymentInstrument,
  PaymentIntent,
  PaymentStatusResult,
  ProviderPaymentStatus,
  RefundResult,
  SandboxPaymentProvider,
  WebhookRequest,
  WebhookResult,
} from "@/lib/payments/types";

/**
 * Sandbox payment provider.
 *
 * It behaves like a real gateway — asynchronous authorisation, status polling,
 * signed webhooks — but moves no money. Nothing is ever reported as successful
 * unless the sandbox "authorises" it, mirroring the rule that a booking is
 * confirmed only on genuine provider confirmation.
 */

type SandboxIntent = {
  providerReference: string;
  method: PaymentMethod;
  amountNgwee: number;
  status: ProviderPaymentStatus;
  instrument?: PaymentInstrument;
  failureReason?: string;
  paidAt?: Date;
  /** Cards authorise on their own (like a real gateway); wallets wait for the customer. */
  autoSettleAt?: number;
  autoOutcome?: "approve" | "decline";
  expiresAt: Date;
  refundedNgwee: number;
};

/** Sandbox card tokens. Selecting one of these never involves real card data. */
export const SANDBOX_TEST_CARDS = [
  {
    token: "tok_sandbox_visa_success",
    brand: "Visa",
    last4: "4242",
    label: "Visa ending 4242",
    outcome: "approve" as const,
    description: "Authorises after a short delay",
  },
  {
    token: "tok_sandbox_mastercard_success",
    brand: "Mastercard",
    last4: "5454",
    label: "Mastercard ending 5454",
    outcome: "approve" as const,
    description: "Authorises after a short delay",
  },
  {
    token: "tok_sandbox_visa_declined",
    brand: "Visa",
    last4: "0002",
    label: "Visa ending 0002",
    outcome: "decline" as const,
    description: "Always declined — use to test the failure path",
  },
];

const AUTO_SETTLE_DELAY_MS = 3_000;
const INTENT_TTL_MS = 15 * 60_000;

// Survives hot reloads in development.
const store = globalThis as unknown as {
  __kokoSandboxIntents?: Map<string, SandboxIntent>;
};
store.__kokoSandboxIntents ??= new Map<string, SandboxIntent>();
const intents = store.__kokoSandboxIntents;

function webhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET ?? "koko-dev-webhook-secret";
}

export function signWebhookPayload(rawBody: string): string {
  return createHmac("sha256", webhookSecret()).update(rawBody).digest("hex");
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = signWebhookPayload(rawBody);
  const provided = Buffer.from(signature, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

export class MockPaymentProvider implements SandboxPaymentProvider {
  readonly id = "mock";
  readonly displayName = "Koko Sandbox";
  readonly sandbox = true as const;

  supports(method: PaymentMethod): boolean {
    return method === "MOBILE_MONEY" || method === "BANK_CARD";
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
    const providerReference = `MOCK-${randomBytes(5).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + INTENT_TTL_MS);

    if (input.method === "MOBILE_MONEY") {
      const wallet = input.mobileMoney;
      if (!wallet) throw new Error("Mobile money details are required");
      const walletName =
        MOBILE_MONEY_PROVIDERS.find((provider) => provider.id === wallet.provider)?.name ??
        "Mobile Money";

      intents.set(providerReference, {
        providerReference,
        method: input.method,
        amountNgwee: input.amountNgwee,
        status: "PROCESSING",
        instrument: { brand: walletName, payerReference: wallet.phone },
        expiresAt,
        refundedNgwee: 0,
      });

      return {
        providerReference,
        status: "PROCESSING",
        instruction: `Approve the ${formatKwacha(input.amountNgwee)} ${walletName} prompt sent to ${formatPhone(
          wallet.phone,
        )}, then enter your PIN.`,
        instrument: { brand: walletName, payerReference: wallet.phone },
        expiresAt,
      };
    }

    const card = SANDBOX_TEST_CARDS.find((entry) => entry.token === input.card?.token);
    if (!card) throw new Error("Unknown sandbox card token");

    intents.set(providerReference, {
      providerReference,
      method: input.method,
      amountNgwee: input.amountNgwee,
      status: "PROCESSING",
      instrument: { brand: card.brand, last4: card.last4 },
      autoSettleAt: Date.now() + AUTO_SETTLE_DELAY_MS,
      autoOutcome: card.outcome,
      expiresAt,
      refundedNgwee: 0,
    });

    return {
      providerReference,
      status: "PROCESSING",
      instruction: `Authorising your ${card.brand} card ending ${card.last4} with the bank…`,
      instrument: { brand: card.brand, last4: card.last4 },
      expiresAt,
    };
  }

  async checkPaymentStatus(providerReference: string): Promise<PaymentStatusResult> {
    const intent = intents.get(providerReference);
    if (!intent) {
      return { providerReference, status: "FAILED", failureReason: "Unknown payment reference" };
    }

    if (intent.status === "PROCESSING") {
      if (intent.autoSettleAt && Date.now() >= intent.autoSettleAt) {
        applyOutcome(intent, intent.autoOutcome ?? "approve");
      } else if (Date.now() > intent.expiresAt.getTime()) {
        intent.status = "EXPIRED";
        intent.failureReason = "The payment request timed out";
      }
    }

    return {
      providerReference,
      status: intent.status,
      failureReason: intent.failureReason,
      paidAt: intent.paidAt,
      instrument: intent.instrument,
    };
  }

  /** Stands in for the customer approving a wallet prompt or the bank replying. */
  async settleSandboxPayment(
    providerReference: string,
    outcome: "approve" | "decline" | "cancel",
  ): Promise<PaymentStatusResult> {
    const intent = intents.get(providerReference);
    if (!intent) {
      return { providerReference, status: "FAILED", failureReason: "Unknown payment reference" };
    }
    applyOutcome(intent, outcome);
    return {
      providerReference,
      status: intent.status,
      failureReason: intent.failureReason,
      paidAt: intent.paidAt,
      instrument: intent.instrument,
    };
  }

  async handleWebhook(request: WebhookRequest): Promise<WebhookResult> {
    if (!verifySignature(request.rawBody, request.signature)) {
      return { handled: false, reason: "Invalid webhook signature" };
    }

    let payload: {
      providerReference?: string;
      status?: ProviderPaymentStatus;
      failureReason?: string;
      paidAt?: string;
    };
    try {
      payload = JSON.parse(request.rawBody);
    } catch {
      return { handled: false, reason: "Malformed webhook payload" };
    }

    if (!payload.providerReference || !payload.status) {
      return { handled: false, reason: "Missing providerReference or status" };
    }

    return {
      handled: true,
      providerReference: payload.providerReference,
      status: payload.status,
      failureReason: payload.failureReason,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
    };
  }

  async refundPayment(
    providerReference: string,
    amountNgwee: number,
  ): Promise<RefundResult> {
    const intent = intents.get(providerReference);
    if (!intent) return { refunded: false, error: "Unknown payment reference" };
    if (intent.status !== "SUCCESSFUL") {
      return { refunded: false, error: "Only successful payments can be refunded" };
    }
    if (intent.refundedNgwee + amountNgwee > intent.amountNgwee) {
      return { refunded: false, error: "Refund exceeds the amount captured" };
    }
    intent.refundedNgwee += amountNgwee;
    return { refunded: true, refundReference: `MOCKRF-${randomBytes(4).toString("hex").toUpperCase()}` };
  }
}

function applyOutcome(intent: SandboxIntent, outcome: "approve" | "decline" | "cancel") {
  if (intent.status !== "PROCESSING" && intent.status !== "PENDING") return;
  if (outcome === "approve") {
    intent.status = "SUCCESSFUL";
    intent.paidAt = new Date();
    intent.failureReason = undefined;
    return;
  }
  if (outcome === "cancel") {
    intent.status = "CANCELLED";
    intent.failureReason = "Cancelled by the customer";
    return;
  }
  intent.status = "FAILED";
  intent.failureReason =
    intent.method === "BANK_CARD"
      ? "The bank declined this card"
      : "The wallet declined the payment (insufficient funds or no PIN entered)";
}

/** Builds the exact webhook body the sandbox would post to us. */
export function buildSandboxWebhook(result: PaymentStatusResult): {
  rawBody: string;
  signature: string;
} {
  const rawBody = JSON.stringify({
    providerReference: result.providerReference,
    status: result.status,
    failureReason: result.failureReason,
    paidAt: result.paidAt?.toISOString(),
  });
  return { rawBody, signature: signWebhookPayload(rawBody) };
}
