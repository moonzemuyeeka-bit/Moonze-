import type { PaymentMethod, PaymentStatus } from "@/generated/prisma";
import type { MobileMoneyProviderId } from "@/lib/phone";

/**
 * Payment-provider abstraction.
 *
 * Booking logic only ever talks to this interface, so a Zambian gateway
 * (Flutterwave, Lenco, Broadpay, a direct MNO integration…) can be added by
 * implementing one class and changing `PAYMENT_PROVIDER` — no changes to the
 * booking flow.
 */

export type ProviderPaymentStatus = Extract<
  PaymentStatus,
  "PENDING" | "PROCESSING" | "SUCCESSFUL" | "FAILED" | "CANCELLED" | "EXPIRED"
>;

/** Non-sensitive descriptor of the instrument used. Never a PAN, CVV or PIN. */
export type PaymentInstrument = {
  brand?: string;
  last4?: string;
  payerReference?: string;
};

export type CreatePaymentInput = {
  bookingReference: string;
  amountNgwee: number;
  currency: string;
  method: PaymentMethod;
  description: string;
  customer: { name: string; phone: string; email?: string | null };
  /** Mobile money: which wallet to charge. */
  mobileMoney?: { provider: MobileMoneyProviderId; phone: string };
  /** Cards: a token minted by the provider's hosted fields — never raw card data. */
  card?: { token: string };
  returnUrl?: string;
};

export type PaymentIntent = {
  providerReference: string;
  status: ProviderPaymentStatus;
  /** Customer-facing next step, e.g. "Approve the prompt on your phone". */
  instruction?: string;
  /** Hosted checkout / 3-D Secure URL when the provider needs a redirect. */
  redirectUrl?: string;
  instrument?: PaymentInstrument;
  expiresAt?: Date;
};

export type PaymentStatusResult = {
  providerReference: string;
  status: ProviderPaymentStatus;
  failureReason?: string;
  paidAt?: Date;
  instrument?: PaymentInstrument;
};

export type WebhookRequest = {
  rawBody: string;
  signature: string | null;
};

export type WebhookResult = {
  handled: boolean;
  providerReference?: string;
  status?: ProviderPaymentStatus;
  failureReason?: string;
  paidAt?: Date;
  reason?: string;
};

export type RefundResult = {
  refunded: boolean;
  refundReference?: string;
  error?: string;
};

export interface PaymentProvider {
  readonly id: string;
  readonly displayName: string;
  /** True when no real money moves — the UI must say so plainly. */
  readonly sandbox: boolean;
  supports(method: PaymentMethod): boolean;
  createPayment(input: CreatePaymentInput): Promise<PaymentIntent>;
  checkPaymentStatus(providerReference: string): Promise<PaymentStatusResult>;
  handleWebhook(request: WebhookRequest): Promise<WebhookResult>;
  refundPayment(providerReference: string, amountNgwee: number): Promise<RefundResult>;
}

/** Implemented by sandbox providers so the demo UI can settle a payment. */
export interface SandboxPaymentProvider extends PaymentProvider {
  readonly sandbox: true;
  settleSandboxPayment(
    providerReference: string,
    outcome: "approve" | "decline" | "cancel",
  ): Promise<PaymentStatusResult>;
}

export function isSandboxProvider(
  provider: PaymentProvider,
): provider is SandboxPaymentProvider {
  return (
    provider.sandbox === true &&
    typeof (provider as SandboxPaymentProvider).settleSandboxPayment === "function"
  );
}

export const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = [
  "SUCCESSFUL",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
];

const ALLOWED_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["PROCESSING", "SUCCESSFUL", "FAILED", "CANCELLED", "EXPIRED"],
  PROCESSING: ["SUCCESSFUL", "FAILED", "CANCELLED", "EXPIRED"],
  SUCCESSFUL: ["REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
};

/** The payment state machine — a booking is only ever confirmed via SUCCESSFUL. */
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}
