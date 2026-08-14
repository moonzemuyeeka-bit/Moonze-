import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Service } from "@/generated/prisma";
import { getDaySlots } from "@/lib/booking/availability";
import {
  cancelBooking,
  createReservation,
  expireReservations,
  lookupBooking,
  setBookingStatus,
} from "@/lib/booking/booking-service";
import { prisma } from "@/lib/database/client";
import {
  DayUnavailableError,
  NotFoundError,
  SlotUnavailableError,
  ValidationError,
} from "@/lib/errors";
import { dateKeyToDbDate, type DateKey } from "@/lib/time";
import {
  CUSTOMER,
  OTHER_CUSTOMER,
  resetDatabase,
  seedBaseline,
  tradingDateKey,
} from "../helpers/fixtures";

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

function reservation(overrides: Partial<Parameters<typeof createReservation>[0]> = {}) {
  return createReservation({
    serviceId: service.id,
    date,
    startTime: "11:00",
    customer: CUSTOMER,
    policyAccepted: true,
    ...overrides,
  });
}

describe("holding a slot", () => {
  it("creates a pending reservation with a reference and the right amounts", async () => {
    const { booking, reservationMinutes } = await reservation();

    expect(booking.bookingReference).toMatch(/^KOKO-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(booking.status).toBe("PENDING_PAYMENT");
    expect(booking.totalNgwee).toBe(28_000);
    expect(booking.depositNgwee).toBe(5_000);
    expect(booking.remainingNgwee).toBe(23_000);
    expect(booking.endTime).toBe("13:00");
    expect(booking.policyAccepted).toBe(true);
    expect(booking.policySnapshot).toContain("K50 deposit");
    expect(reservationMinutes).toBe(10);
    expect(booking.reservationExpiresAt).toBeInstanceOf(Date);
  });

  it("does not expose the internal id as the customer-facing reference", async () => {
    const { booking } = await reservation();
    expect(booking.bookingReference).not.toContain(booking.id);
  });

  it("records the customer once and reuses them for the next booking", async () => {
    await reservation();
    await reservation({ startTime: "14:00" });

    const customers = await prisma.customer.findMany();
    expect(customers).toHaveLength(1);
    expect(customers[0].phone).toBe("+260977123456");
  });

  it("takes the time out of circulation for the next customer", async () => {
    const before = await getDaySlots(date, service);
    expect(before.slots.find((slot) => slot.startTime === "11:00")?.available).toBe(true);

    await reservation();

    const after = await getDaySlots(date, service);
    const eleven = after.slots.find((slot) => slot.startTime === "11:00");
    expect(eleven?.available).toBe(false);
    expect(eleven?.reason).toBe("Booked");
    expect(after.dayStatus).toBe("LIMITED");
  });

  it("refuses a time another customer already holds", async () => {
    await reservation();
    await expect(reservation({ customer: OTHER_CUSTOMER })).rejects.toThrow(
      SlotUnavailableError,
    );
  });

  it("refuses a time that overlaps an existing appointment's buffer", async () => {
    await reservation({ startTime: "11:00" });
    // 12:30 would start inside the 11:00–13:00 set.
    await expect(
      reservation({ startTime: "12:30", customer: OTHER_CUSTOMER }),
    ).rejects.toThrow(SlotUnavailableError);
  });

  it("lets exactly one of two simultaneous bookings win the same slot", async () => {
    const results = await Promise.allSettled([
      reservation(),
      reservation({ customer: OTHER_CUSTOMER }),
      reservation({ customer: { name: "Chanda", phone: "0955111222" } }),
    ]);

    const confirmed = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(confirmed).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    for (const failure of rejected) {
      expect((failure as PromiseRejectedResult).reason).toBeInstanceOf(SlotUnavailableError);
    }

    const held = await prisma.booking.findMany({
      where: { status: { in: ["PENDING_PAYMENT", "CONFIRMED"] } },
    });
    expect(held).toHaveLength(1);
  });

  it("refuses a date the owner has blocked", async () => {
    await prisma.availability.create({
      data: { date: dateKeyToDbDate(date), status: "UNAVAILABLE", reason: "Personal day" },
    });

    await expect(reservation()).rejects.toThrow(DayUnavailableError);
    await expect(reservation()).rejects.toThrow(/Personal day/);
  });

  it("refuses a time outside working hours", async () => {
    await expect(reservation({ startTime: "07:00" })).rejects.toThrow(SlotUnavailableError);
  });

  it("refuses a booking that has not accepted the deposit policy", async () => {
    await expect(reservation({ policyAccepted: false })).rejects.toThrow(ValidationError);
    expect(await prisma.booking.count()).toBe(0);
  });

  it("refuses an invalid phone number and an unknown service", async () => {
    await expect(
      reservation({ customer: { ...CUSTOMER, phone: "12345" } }),
    ).rejects.toThrow(ValidationError);
    await expect(reservation({ serviceId: "does-not-exist" })).rejects.toThrow(NotFoundError);
  });

  it("refuses a service the owner has deactivated", async () => {
    await prisma.service.update({ where: { id: service.id }, data: { active: false } });
    await expect(reservation()).rejects.toThrow(NotFoundError);
  });
});

describe("reservations that are never paid", () => {
  it("expires and releases the slot", async () => {
    const { booking } = await reservation();
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });

    const released = await expireReservations();
    expect(released).toBe(1);

    const refreshed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(refreshed.status).toBe("EXPIRED");

    const slots = await getDaySlots(date, service);
    expect(slots.slots.find((slot) => slot.startTime === "11:00")?.available).toBe(true);
  });

  it("lets the next customer take the released time", async () => {
    const { booking } = await reservation();
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });

    const second = await reservation({ customer: OTHER_CUSTOMER });
    expect(second.booking.status).toBe("PENDING_PAYMENT");
    expect(second.booking.bookingReference).not.toBe(booking.bookingReference);
  });

  it("leaves paid appointments alone", async () => {
    const { booking } = await reservation();
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", reservationExpiresAt: null },
    });

    expect(await expireReservations()).toBe(0);
    const refreshed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(refreshed.status).toBe("CONFIRMED");
  });
});

describe("finding and managing a booking", () => {
  it("finds a booking from the reference and phone number the customer used", async () => {
    const { booking } = await reservation();

    const found = await lookupBooking(booking.bookingReference.toLowerCase(), "0977123456");
    expect(found.id).toBe(booking.id);
    expect(found.customer.name).toBe("Jane Doe");
  });

  it("gives nothing away when the phone number does not match", async () => {
    const { booking } = await reservation();

    await expect(lookupBooking(booking.bookingReference, "0966555444")).rejects.toThrow(
      NotFoundError,
    );
    await expect(lookupBooking("KOKO-ZZZZZZ", "0977123456")).rejects.toThrow(
      /could not find a booking with that reference and phone number/i,
    );
  });

  it("cancels a booking, frees the slot and stops its reminders", async () => {
    const { booking } = await reservation();
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", reservationExpiresAt: null },
    });
    await prisma.reminder.create({
      data: {
        bookingId: booking.id,
        kind: "DAY_BEFORE",
        scheduledFor: new Date(Date.now() + 86_400_000),
      },
    });

    const cancelled = await cancelBooking(booking.bookingReference, { by: "customer" });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect(cancelled.cancellationReason).toMatch(/customer/i);

    const reminder = await prisma.reminder.findFirstOrThrow({
      where: { bookingId: booking.id },
    });
    expect(reminder.cancelledAt).not.toBeNull();

    const slots = await getDaySlots(date, service);
    expect(slots.slots.find((slot) => slot.startTime === "11:00")?.available).toBe(true);
  });

  it("will not cancel the same booking twice", async () => {
    const { booking } = await reservation();
    await cancelBooking(booking.bookingReference);
    await expect(cancelBooking(booking.bookingReference)).rejects.toThrow(ValidationError);
  });

  it("refuses to confirm a booking that has not been paid for", async () => {
    const { booking } = await reservation();
    await expect(setBookingStatus(booking.bookingReference, "CONFIRMED")).rejects.toThrow(
      /no successful deposit payment/i,
    );
  });

  it("lets the owner mark an appointment completed or a no-show", async () => {
    const { booking } = await reservation();
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", reservationExpiresAt: null },
    });

    const completed = await setBookingStatus(booking.bookingReference, "COMPLETED");
    expect(completed.status).toBe("COMPLETED");

    const { booking: second } = await reservation({
      startTime: "14:00",
      customer: OTHER_CUSTOMER,
    });
    const noShow = await setBookingStatus(second.bookingReference, "NO_SHOW");
    expect(noShow.status).toBe("NO_SHOW");
  });
});

describe("service price changes", () => {
  it("does not rewrite the price on bookings already taken", async () => {
    const { booking } = await reservation();

    await prisma.service.update({
      where: { id: service.id },
      data: { priceNgwee: 32_000, name: "Classic Lashes (2026)" },
    });

    const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(unchanged.totalNgwee).toBe(28_000);
    expect(unchanged.remainingNgwee).toBe(23_000);
    expect(unchanged.serviceName).toBe("Classic Lashes");
  });

  it("uses the new price for the next booking", async () => {
    await prisma.service.update({
      where: { id: service.id },
      data: { priceNgwee: 32_000 },
    });

    const { booking } = await reservation({ startTime: "14:00" });
    expect(booking.totalNgwee).toBe(32_000);
    expect(booking.depositNgwee).toBe(5_000);
    expect(booking.remainingNgwee).toBe(27_000);
  });

  it("keeps the deposit at the service price when the service is cheaper than K50", async () => {
    const cheap = await prisma.service.create({
      data: {
        name: "Lash Patch Test",
        slug: "lash-patch-test",
        description: "Sensitivity check before a first set.",
        priceNgwee: 4_000,
        durationMinutes: 30,
      },
    });

    const { booking } = await reservation({ serviceId: cheap.id, startTime: "15:00" });
    expect(booking.depositNgwee).toBe(4_000);
    expect(booking.remainingNgwee).toBe(0);
  });
});
