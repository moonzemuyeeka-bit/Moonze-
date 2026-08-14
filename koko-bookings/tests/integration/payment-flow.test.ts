import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Service } from "@/generated/prisma";
import { getDaySlots } from "@/lib/booking/availability";
import { createReservation, expireReservations } from "@/lib/booking/booking-service";
import { prisma } from "@/lib/database/client";
import { ReservationExpiredError, ValidationError } from "@/lib/errors";
import { buildSandboxWebhook, SANDBOX_TEST_CARDS } from "@/lib/payments/mock-provider";
import {
  handlePaymentWebhook,
  initiatePayment,
  refreshPaymentStatus,
  refundPayment,
  settleSandboxPayment,
} from "@/lib/payments/payment-service";
import { type DateKey } from "@/lib/time";
import { CUSTOMER, resetDatabase, seedBaseline, tradingDateKey } from "../helpers/fixtures";

let service: Service;
let date: DateKey;

beforeEach(async () => {
  await resetDatabase();
  ({ service } = await seedBaseline());
  date = tradingDateKey();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function heldSlot(startTime = "11:00") {
  const { booking } = await createReservation({
    serviceId: service.id,
    date,
    startTime,
    customer: CUSTOMER,
    policyAccepted: true,
  });
  return booking;
}

describe("starting a deposit payment", () => {
  it("asks the wallet for the K50 deposit without confirming anything", async () => {
    const booking = await heldSlot();
    const result = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });

    expect(result.payment.status).toBe("PROCESSING");
    expect(result.payment.amountNgwee).toBe(5_000);
    expect(result.payment.currency).toBe("ZMW");
    expect(result.sandbox).toBe(true);
    expect(result.instruction).toMatch(/Approve the K50 Airtel Money prompt/);

    const stillPending = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stillPending.status).toBe("PENDING_PAYMENT");
    expect(stillPending.confirmedAt).toBeNull();
  });

  it("stores no card credentials, only the brand and last four digits", async () => {
    const booking = await heldSlot();
    const card = SANDBOX_TEST_CARDS[0];
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "BANK_CARD",
      card: { token: card.token },
    });

    expect(payment.instrumentBrand).toBe("Visa");
    expect(payment.instrumentLast4).toBe("4242");

    const columns = Object.keys(payment).join(" ").toLowerCase();
    expect(columns).not.toMatch(/cvv|pin|cardnumber|pan/);
    expect(JSON.stringify(payment)).not.toContain(card.token);
  });

  it("reuses the in-flight attempt instead of charging twice", async () => {
    const booking = await heldSlot();
    const first = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });
    const second = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });

    expect(second.payment.id).toBe(first.payment.id);
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it("abandons the wallet attempt when the customer switches to a card", async () => {
    const booking = await heldSlot();
    const wallet = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });
    await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "BANK_CARD",
      card: { token: SANDBOX_TEST_CARDS[0].token },
    });

    const cancelled = await prisma.payment.findUniqueOrThrow({ where: { id: wallet.payment.id } });
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("will not take money for a reservation that has already lapsed", async () => {
    const booking = await heldSlot();
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(
      initiatePayment({
        bookingReference: booking.bookingReference,
        method: "MOBILE_MONEY",
        mobileMoney: { provider: "airtel", phone: "0977123456" },
      }),
    ).rejects.toThrow(ReservationExpiredError);

    expect(await prisma.payment.count()).toBe(0);
  });

  it("requires the details each method needs", async () => {
    const booking = await heldSlot();
    await expect(
      initiatePayment({ bookingReference: booking.bookingReference, method: "BANK_CARD" }),
    ).rejects.toThrow(ValidationError);
    await expect(
      initiatePayment({
        bookingReference: booking.bookingReference,
        method: "MOBILE_MONEY",
        mobileMoney: { phone: "12345" },
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("a successful deposit", () => {
  it("confirms the appointment, schedules reminders and notifies the customer", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });

    const settled = await settleSandboxPayment(payment.id, "approve");

    expect(settled.payment.status).toBe("SUCCESSFUL");
    expect(settled.payment.paidAt).toBeInstanceOf(Date);
    expect(settled.booking.status).toBe("CONFIRMED");
    expect(settled.booking.confirmedAt).toBeInstanceOf(Date);
    expect(settled.booking.reservationExpiresAt).toBeNull();
    expect(settled.message).toMatch(/appointment is confirmed/i);

    const reminders = await prisma.reminder.findMany({ where: { bookingId: booking.id } });
    expect(reminders.map((reminder) => reminder.kind).sort()).toEqual([
      "DAY_BEFORE",
      "HOURS_BEFORE",
    ]);

    const events = await prisma.notification.findMany({ where: { bookingId: booking.id } });
    expect(events.map((event) => event.event)).toContain("BOOKING_CONFIRMED");
  });

  it("keeps the confirmed slot out of circulation", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });
    await settleSandboxPayment(payment.id, "approve");

    // Even after the reservation window would have closed, the paid slot stays taken.
    await expireReservations(prisma, new Date(Date.now() + 60 * 60_000));

    const slots = await getDaySlots(date, service);
    expect(slots.slots.find((slot) => slot.startTime === "11:00")?.available).toBe(false);
  });

  it("records every state change in the payment audit trail", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });
    await settleSandboxPayment(payment.id, "approve");

    const events = await prisma.paymentEvent.findMany({
      where: { paymentId: payment.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => event.toStatus)).toEqual(["PROCESSING", "SUCCESSFUL"]);
    expect(events.at(-1)?.source).toBe("webhook");
  });

  it("treats a repeated webhook as a no-op", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });
    await settleSandboxPayment(payment.id, "approve");

    const replay = buildSandboxWebhook({
      providerReference: payment.providerReference,
      status: "SUCCESSFUL",
    });
    const result = await handlePaymentWebhook(replay.rawBody, replay.signature, "mock");

    expect(result).toEqual({ handled: true, status: "SUCCESSFUL" });
    const confirmations = await prisma.paymentEvent.count({
      where: { paymentId: payment.id, toStatus: "SUCCESSFUL" },
    });
    expect(confirmations).toBe(1);
  });

  it("refunds a deposit when the owner approves it", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });
    await settleSandboxPayment(payment.id, "approve");

    const refunded = await refundPayment(payment.id);
    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.refundedNgwee).toBe(5_000);
  });

  it("will not refund a deposit that was never captured", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });
    await expect(refundPayment(payment.id)).rejects.toThrow(ValidationError);
  });
});

describe("a deposit that does not go through", () => {
  it("fails the payment and leaves the appointment unconfirmed", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });

    const declined = await settleSandboxPayment(payment.id, "decline");

    expect(declined.payment.status).toBe("FAILED");
    expect(declined.payment.failureReason).toMatch(/declined/i);
    expect(declined.booking.status).toBe("PENDING_PAYMENT");
    expect(declined.booking.confirmedAt).toBeNull();
    expect(declined.message).toMatch(/slot is still held/i);
  });

  it("declines the sandbox card that always fails", async () => {
    const booking = await heldSlot();
    const declinedCard = SANDBOX_TEST_CARDS.find((card) => card.outcome === "decline");
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "BANK_CARD",
      card: { token: declinedCard!.token },
    });

    const settled = await settleSandboxPayment(payment.id, "decline");
    expect(settled.payment.status).toBe("FAILED");
    expect(settled.payment.failureReason).toMatch(/bank declined/i);
  });

  it("lets the customer try again on the slot they still hold", async () => {
    const booking = await heldSlot();
    const first = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });
    await settleSandboxPayment(first.payment.id, "decline");

    const retry = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "BANK_CARD",
      card: { token: SANDBOX_TEST_CARDS[0].token },
    });
    const settled = await settleSandboxPayment(retry.payment.id, "approve");

    expect(settled.booking.status).toBe("CONFIRMED");
    expect(retry.payment.id).not.toBe(first.payment.id);
  });

  it("cancels cleanly when the customer dismisses the wallet prompt", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });

    const cancelled = await settleSandboxPayment(payment.id, "cancel");
    expect(cancelled.payment.status).toBe("CANCELLED");
    expect(cancelled.booking.status).toBe("PENDING_PAYMENT");
  });

  it("releases the slot when the reservation expires mid-payment", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });
    await expireReservations();

    const expired = await refreshPaymentStatus(payment.id);
    expect(expired.payment.status).toBe("EXPIRED");
    expect(expired.booking.status).toBe("EXPIRED");
    expect(expired.message).toMatch(/slot has been released/i);

    const slots = await getDaySlots(date, service);
    expect(slots.slots.find((slot) => slot.startTime === "11:00")?.available).toBe(true);
  });

  it("does not invent an appointment when money lands after the slot is gone", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "EXPIRED", reservationExpiresAt: new Date(Date.now() - 60_000) },
    });

    const late = buildSandboxWebhook({
      providerReference: payment.providerReference,
      status: "SUCCESSFUL",
      paidAt: new Date(),
    });
    await handlePaymentWebhook(late.rawBody, late.signature, "mock");

    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const stillExpired = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });

    // The money is on record for the owner to refund, but no appointment exists.
    expect(paid.status).toBe("SUCCESSFUL");
    expect(stillExpired.status).toBe("EXPIRED");
    expect(stillExpired.confirmedAt).toBeNull();
  });
});

describe("webhook authenticity", () => {
  it("ignores a webhook that is not signed with our secret", async () => {
    const booking = await heldSlot();
    const { payment } = await initiatePayment({
      bookingReference: booking.bookingReference,
      method: "MOBILE_MONEY",
      mobileMoney: { provider: "airtel", phone: "0977123456" },
    });

    const forged = JSON.stringify({
      providerReference: payment.providerReference,
      status: "SUCCESSFUL",
    });
    const result = await handlePaymentWebhook(forged, "not-a-real-signature", "mock");

    expect(result.handled).toBe(false);
    expect(result.reason).toMatch(/signature/i);

    const untouched = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(untouched.status).toBe("PENDING_PAYMENT");
  });

  it("ignores a correctly signed webhook for a payment we do not know", async () => {
    const stranger = buildSandboxWebhook({
      providerReference: "MOCK-DOES-NOT-EXIST",
      status: "SUCCESSFUL",
    });
    const result = await handlePaymentWebhook(stranger.rawBody, stranger.signature, "mock");
    expect(result.handled).toBe(false);
  });
});
