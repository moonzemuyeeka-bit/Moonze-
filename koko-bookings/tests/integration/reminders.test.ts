import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Service } from "@/generated/prisma";
import { createReservation } from "@/lib/booking/booking-service";
import { prisma } from "@/lib/database/client";
import { dispatchDueReminders, scheduleReminders } from "@/lib/notifications/reminders";
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

/** A confirmed appointment, without going through a payment provider. */
async function confirmedBooking(startTime = "11:00") {
  const { booking } = await createReservation({
    serviceId: service.id,
    date,
    startTime,
    customer: CUSTOMER,
    policyAccepted: true,
  });
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED", confirmedAt: new Date(), reservationExpiresAt: null },
  });
  return booking;
}

describe("appointment reminders", () => {
  it("schedules one reminder a day before and one a few hours before", async () => {
    const booking = await confirmedBooking();
    await scheduleReminders(booking.id);

    const reminders = await prisma.reminder.findMany({
      where: { bookingId: booking.id },
      orderBy: { scheduledFor: "asc" },
    });

    expect(reminders).toHaveLength(2);
    expect(reminders[0].kind).toBe("DAY_BEFORE");
    expect(reminders[1].kind).toBe("HOURS_BEFORE");

    // 11:00 in Lusaka is 09:00 UTC; the second reminder is two hours before that.
    expect(reminders[1].scheduledFor.toISOString()).toBe(`${date}T07:00:00.000Z`);
    const dayBeforeGap =
      reminders[1].scheduledFor.getTime() - reminders[0].scheduledFor.getTime();
    expect(dayBeforeGap).toBe(22 * 60 * 60_000);
  });

  it("honours the owner's reminder preferences", async () => {
    await prisma.businessSettings.update({
      where: { id: "default" },
      data: { reminderDayBefore: false, reminderHoursBefore: 0 },
    });

    const booking = await confirmedBooking();
    await scheduleReminders(booking.id);

    expect(await prisma.reminder.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it("does not schedule reminders for an unpaid reservation", async () => {
    const { booking } = await createReservation({
      serviceId: service.id,
      date,
      startTime: "14:00",
      customer: CUSTOMER,
      policyAccepted: true,
    });
    await scheduleReminders(booking.id);

    expect(await prisma.reminder.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it("sends the reminders that are due and leaves the rest alone", async () => {
    const booking = await confirmedBooking();
    await scheduleReminders(booking.id);

    const dayBefore = await prisma.reminder.findFirstOrThrow({
      where: { bookingId: booking.id, kind: "DAY_BEFORE" },
    });
    const result = await dispatchDueReminders(
      new Date(dayBefore.scheduledFor.getTime() + 60_000),
    );

    expect(result).toEqual({ sent: 1, skipped: 0 });

    const sentReminder = await prisma.reminder.findUniqueOrThrow({
      where: { id: dayBefore.id },
    });
    expect(sentReminder.sentAt).not.toBeNull();

    const stillWaiting = await prisma.reminder.findFirstOrThrow({
      where: { bookingId: booking.id, kind: "HOURS_BEFORE" },
    });
    expect(stillWaiting.sentAt).toBeNull();

    const logged = await prisma.notification.findFirstOrThrow({
      where: { bookingId: booking.id, event: "APPOINTMENT_REMINDER" },
    });
    expect(logged.status).toBe("SENT");
    expect(logged.message).toMatch(/tomorrow/i);
  });

  it("never sends the same reminder twice", async () => {
    const booking = await confirmedBooking();
    await scheduleReminders(booking.id);

    const later = new Date(Date.now() + 400 * 24 * 60 * 60_000);
    expect(await dispatchDueReminders(later)).toEqual({ sent: 2, skipped: 0 });
    expect(await dispatchDueReminders(later)).toEqual({ sent: 0, skipped: 0 });
  });

  it("drops reminders for an appointment that was cancelled", async () => {
    const booking = await confirmedBooking();
    await scheduleReminders(booking.id);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    const later = new Date(Date.now() + 400 * 24 * 60 * 60_000);
    expect(await dispatchDueReminders(later)).toEqual({ sent: 0, skipped: 2 });

    const reminders = await prisma.reminder.findMany({ where: { bookingId: booking.id } });
    expect(reminders.every((reminder) => reminder.cancelledAt !== null)).toBe(true);
  });

  it("logs the real channels as skipped until their credentials exist", async () => {
    const booking = await confirmedBooking();
    await scheduleReminders(booking.id);
    await dispatchDueReminders(new Date(Date.now() + 400 * 24 * 60 * 60_000));

    const channels = await prisma.notification.findMany({
      where: { bookingId: booking.id, event: "APPOINTMENT_REMINDER" },
      select: { channel: true, status: true },
    });
    expect(channels.every((entry) => entry.channel === "CONSOLE")).toBe(true);
    expect(channels.every((entry) => entry.status === "SENT")).toBe(true);
  });
});
