import type { Payment, PaymentMethod, PaymentStatus } from "@/generated/prisma";
import {
  expireReservations,
  getBookingByReference,
  isReservationStillValid,
  type BookingWithRelations,
} from "@/lib/booking/booking-service";
import { prisma } from "@/lib/database/client";
import { getSettings } from "@/lib/database/settings";
import {
  AppError,
  NotFoundError,
  PaymentError,
  ReservationExpiredError,
  SlotUnavailableError,
  ValidationError,
} from "@/lib/errors";
import { notify } from "@/lib/notifications/notification-service";
import { scheduleReminders } from "@/lib/notifications/reminders";
import { normalisePhone, detectMobileMoneyProvider, type MobileMoneyProviderId } from "@/lib/phone";
import { getPaymentProvider } from "@/lib/payments/provider";
import {
  canTransition,
  isSandboxProvider,
  type PaymentStatusResult,
  type ProviderPaymentStatus,
} from "@/lib/payments/types";
import { buildSandboxWebhook } from "@/lib/payments/mock-provider";
import { formatKwacha } from "@/lib/money";

export type InitiatePaymentInput = {
  bookingReference: string;
  method: PaymentMethod;
  mobileMoney?: { provider?: MobileMoneyProviderId; phone?: string };
  card?: { token: string };
};

export type InitiatePaymentResult = {
  payment: Payment;
  booking: BookingWithRelations;
  instruction?: string;
  redirectUrl?: string;
  sandbox: boolean;
  provider: string;
  reservationExpiresAt: string | null;
};

/**
 * Starts a deposit payment for a held slot.
 *
 * The reservation is re-validated first: an expired or stolen slot must never
 * reach a payment page, and money must never be requested for an appointment
 * the customer cannot have.
 */
export async function initiatePayment(
  input: InitiatePaymentInput,
): Promise<InitiatePaymentResult> {
  await expireReservations();

  const booking = await getBookingByReference(input.bookingReference);
  if (!booking) throw new NotFoundError("We could not find that booking.");

  if (booking.status === "CONFIRMED") {
    throw new ValidationError("This appointment is already confirmed.");
  }
  if (booking.status !== "PENDING_PAYMENT") {
    throw new ReservationExpiredError();
  }
  if (booking.reservationExpiresAt && booking.reservationExpiresAt <= new Date()) {
    await expireReservations();
    throw new ReservationExpiredError();
  }
  if (!(await isReservationStillValid(booking))) {
    throw new SlotUnavailableError();
  }

  const settings = await getSettings();
  const provider = getPaymentProvider();
  if (!provider.supports(input.method)) {
    throw new ValidationError("That payment method is not available right now.");
  }

  // An in-flight attempt for another method is abandoned rather than left dangling.
  const existing = booking.payments.find((payment) =>
    ["PENDING", "PROCESSING"].includes(payment.status),
  );
  if (existing) {
    if (existing.method === input.method) {
      return {
        payment: existing,
        booking,
        sandbox: provider.sandbox,
        provider: provider.id,
        instruction: undefined,
        reservationExpiresAt: booking.reservationExpiresAt?.toISOString() ?? null,
      };
    }
    await applyPaymentStatus(existing, "CANCELLED", "api", "Replaced by another payment method");
  }

  let mobileMoney: { provider: MobileMoneyProviderId; phone: string } | undefined;
  if (input.method === "MOBILE_MONEY") {
    const phone = normalisePhone(input.mobileMoney?.phone ?? booking.customer.phone);
    if (!phone) {
      throw new ValidationError("Enter the mobile money number to charge.", {
        phone: "Use the format +260 97X XXX XXX.",
      });
    }
    const walletProvider =
      input.mobileMoney?.provider ?? detectMobileMoneyProvider(phone) ?? undefined;
    if (!walletProvider) {
      throw new ValidationError("Choose your mobile money provider.", {
        provider: "Select Airtel Money, MTN MoMo or Zamtel Kwacha.",
      });
    }
    mobileMoney = { provider: walletProvider, phone };
  }

  if (input.method === "BANK_CARD" && !input.card?.token) {
    throw new ValidationError("Choose a card to pay with.", {
      card: "Select a card to continue.",
    });
  }

  const intent = await provider
    .createPayment({
      bookingReference: booking.bookingReference,
      amountNgwee: booking.depositNgwee,
      currency: settings.currency,
      method: input.method,
      description: `${settings.businessName} deposit ${formatKwacha(booking.depositNgwee)} — ${booking.serviceName}`,
      customer: {
        name: booking.customer.name,
        phone: booking.customer.phone,
        email: booking.customer.email,
      },
      mobileMoney,
      card: input.card,
    })
    .catch((error: unknown) => {
      console.error("[payments] provider rejected createPayment", error);
      throw new PaymentError(
        "We could not start that payment. Please try again or use another method.",
        "PAYMENT_INIT_FAILED",
      );
    });

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      amountNgwee: booking.depositNgwee,
      currency: settings.currency,
      method: input.method,
      provider: provider.id,
      providerReference: intent.providerReference,
      status: intent.status,
      payerReference: intent.instrument?.payerReference ?? mobileMoney?.phone ?? null,
      instrumentBrand: intent.instrument?.brand ?? null,
      instrumentLast4: intent.instrument?.last4 ?? null,
      events: {
        create: {
          toStatus: intent.status,
          source: "api",
          detail: `Payment created with ${provider.displayName}`,
        },
      },
    },
  });

  return {
    payment,
    booking,
    instruction: intent.instruction,
    redirectUrl: intent.redirectUrl,
    sandbox: provider.sandbox,
    provider: provider.id,
    reservationExpiresAt: booking.reservationExpiresAt?.toISOString() ?? null,
  };
}

export type PaymentSnapshot = {
  payment: Payment;
  booking: BookingWithRelations;
  message: string;
};

/**
 * Polled by the checkout screen. Asks the provider for the truth, applies any
 * transition, and returns a message describing where things stand.
 */
export async function refreshPaymentStatus(paymentId: string): Promise<PaymentSnapshot> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new NotFoundError("We could not find that payment.");

  let current = payment;
  if (["PENDING", "PROCESSING"].includes(current.status)) {
    const provider = getPaymentProvider(current.provider);
    const result = await provider
      .checkPaymentStatus(current.providerReference)
      .catch((error: unknown) => {
        console.error("[payments] checkPaymentStatus failed", error);
        return null;
      });

    if (result && result.status !== current.status) {
      current = await applyPaymentStatus(current, result.status, "poll", result.failureReason);
    }
  }

  const booking = await getBookingByReference(
    (await prisma.booking.findUniqueOrThrow({
      where: { id: current.bookingId },
      select: { bookingReference: true },
    })).bookingReference,
  );
  if (!booking) throw new NotFoundError("We could not find that booking.");

  return { payment: current, booking, message: describePaymentState(current, booking) };
}

export function describePaymentState(
  payment: Payment,
  booking: BookingWithRelations,
): string {
  switch (payment.status) {
    case "PENDING":
      return "Waiting for the payment to start…";
    case "PROCESSING":
      return payment.method === "MOBILE_MONEY"
        ? "Your payment is still processing. Approve the prompt on your phone."
        : "Your payment is still processing.";
    case "SUCCESSFUL":
      return "Deposit received — your appointment is confirmed.";
    case "FAILED":
      return booking.status === "PENDING_PAYMENT"
        ? `${payment.failureReason ?? "Payment failed"}. Your slot is still held — please try again.`
        : "Payment failed. Your slot has been released.";
    case "CANCELLED":
      return "That payment was cancelled.";
    case "EXPIRED":
      return "Payment failed. Your slot has been released.";
    case "REFUNDED":
      return "This deposit has been refunded.";
    default:
      return "";
  }
}

/**
 * The single place a payment changes state. Confirms the appointment on success
 * — and only on success.
 */
export async function applyPaymentStatus(
  payment: Payment,
  next: PaymentStatus,
  source: "api" | "webhook" | "poll" | "sweeper" | "admin",
  detail?: string,
): Promise<Payment> {
  if (!canTransition(payment.status, next)) {
    if (payment.status === next) return payment;
    throw new AppError(
      "INVALID_PAYMENT_TRANSITION",
      `A ${payment.status.toLowerCase()} payment cannot become ${next.toLowerCase()}.`,
      409,
    );
  }

  const { updated, confirmedBooking } = await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction so two webhooks cannot both confirm.
    const fresh = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (!canTransition(fresh.status, next)) {
      return { updated: fresh, confirmedBooking: null };
    }

    const updatedPayment = await tx.payment.update({
      where: { id: fresh.id },
      data: {
        status: next,
        failureReason: ["FAILED", "CANCELLED", "EXPIRED"].includes(next)
          ? detail ?? fresh.failureReason ?? "Payment was not completed"
          : fresh.failureReason,
        paidAt: next === "SUCCESSFUL" ? new Date() : fresh.paidAt,
        events: {
          create: { fromStatus: fresh.status, toStatus: next, source, detail },
        },
      },
    });

    if (next !== "SUCCESSFUL") return { updated: updatedPayment, confirmedBooking: null };

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: fresh.bookingId },
    });
    if (booking.status !== "PENDING_PAYMENT" && booking.status !== "CONFIRMED") {
      // Reservation lapsed before the money landed: keep the successful payment
      // on record so the owner can refund or reschedule, but do not invent an
      // appointment.
      return { updated: updatedPayment, confirmedBooking: null };
    }
    if (booking.status === "CONFIRMED") {
      return { updated: updatedPayment, confirmedBooking: null };
    }

    const confirmed = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        reservationExpiresAt: null,
      },
      include: {
        payments: { orderBy: { createdAt: "desc" } },
        customer: { select: { name: true, phone: true, email: true } },
      },
    });
    return { updated: updatedPayment, confirmedBooking: confirmed };
  });

  if (confirmedBooking) {
    await notify("PAYMENT_SUCCESSFUL", confirmedBooking);
    await notify("BOOKING_CONFIRMED", confirmedBooking);
    await scheduleReminders(confirmedBooking.id);
  }

  return updated;
}

/** Entry point for provider webhooks. */
export async function handlePaymentWebhook(
  rawBody: string,
  signature: string | null,
  providerId?: string,
): Promise<{ handled: boolean; reason?: string; status?: PaymentStatus }> {
  const provider = getPaymentProvider(providerId);
  const result = await provider.handleWebhook({ rawBody, signature });

  if (!result.handled || !result.providerReference || !result.status) {
    return { handled: false, reason: result.reason ?? "Webhook ignored" };
  }

  const payment = await prisma.payment.findUnique({
    where: { providerReference: result.providerReference },
  });
  if (!payment) return { handled: false, reason: "Unknown payment reference" };

  if (payment.status === result.status) {
    return { handled: true, status: payment.status };
  }

  const updated = await applyPaymentStatus(
    payment,
    result.status,
    "webhook",
    result.failureReason,
  );
  return { handled: true, status: updated.status };
}

/**
 * Sandbox only: stands in for the customer approving the wallet prompt. The
 * result travels back through the same signed-webhook path a real provider
 * would use, so no code path exists that "just confirms" a booking.
 */
export async function settleSandboxPayment(
  paymentId: string,
  outcome: "approve" | "decline" | "cancel",
): Promise<PaymentSnapshot> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new NotFoundError("We could not find that payment.");

  const provider = getPaymentProvider(payment.provider);
  if (!isSandboxProvider(provider)) {
    throw new ValidationError("This payment provider has no sandbox controls.");
  }

  const result: PaymentStatusResult = await provider.settleSandboxPayment(
    payment.providerReference,
    outcome,
  );
  const webhook = buildSandboxWebhook(result);
  await handlePaymentWebhook(webhook.rawBody, webhook.signature, provider.id);

  return refreshPaymentStatus(paymentId);
}

export async function refundPayment(
  paymentId: string,
  amountNgwee?: number,
): Promise<Payment> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new NotFoundError("We could not find that payment.");
  if (payment.status !== "SUCCESSFUL") {
    throw new ValidationError("Only a successful deposit can be refunded.");
  }

  const amount = amountNgwee ?? payment.amountNgwee - payment.refundedNgwee;
  const provider = getPaymentProvider(payment.provider);
  const result = await provider.refundPayment(payment.providerReference, amount);
  if (!result.refunded) {
    throw new PaymentError(
      result.error ?? "The provider declined the refund.",
      "REFUND_FAILED",
    );
  }

  const refundedTotal = payment.refundedNgwee + amount;
  return prisma.payment.update({
    where: { id: payment.id },
    data: {
      refundedNgwee: refundedTotal,
      status: refundedTotal >= payment.amountNgwee ? "REFUNDED" : payment.status,
      events: {
        create: {
          fromStatus: payment.status,
          toStatus: refundedTotal >= payment.amountNgwee ? "REFUNDED" : payment.status,
          source: "admin",
          detail: `Refunded ${formatKwacha(amount)} (${result.refundReference ?? "no reference"})`,
        },
      },
    },
  });
}

export function providerStatusToPaymentStatus(
  status: ProviderPaymentStatus,
): PaymentStatus {
  return status;
}
