import type { Booking, BookingStatus, Payment, Prisma } from "@/generated/prisma";
import {
  loadScheduleContext,
  scheduleForDate,
  LIVE_BOOKING_STATUSES,
} from "@/lib/booking/availability";
import { computeBookingAmounts } from "@/lib/booking/pricing";
import { generateUniqueBookingReference, normaliseBookingReference } from "@/lib/booking/reference";
import { prisma } from "@/lib/database/client";
import { upsertCustomer } from "@/lib/database/customers";
import { getActiveServiceById } from "@/lib/database/services";
import { getBusinessConfig } from "@/lib/database/settings";
import {
  DayUnavailableError,
  NotFoundError,
  SlotUnavailableError,
  ValidationError,
} from "@/lib/errors";
import { notify } from "@/lib/notifications/notification-service";
import { normalisePhone } from "@/lib/phone";
import {
  dateKeyToDbDate,
  dbDateToDateKey,
  formatDateLong,
  isDateKey,
  isTimeString,
  minutesToTime,
  timeToMinutes,
  type DateKey,
  type TimeString,
} from "@/lib/time";
import type { BookingDto, PaymentDto } from "@/types";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
  EXPIRED: "Expired",
};

export type CreateReservationInput = {
  serviceId: string;
  date: DateKey;
  startTime: TimeString;
  customer: { name: string; phone: string; email?: string | null };
  notes?: string | null;
  policyAccepted: boolean;
};

export type BookingWithRelations = Booking & {
  payments: Payment[];
  customer: { name: string; phone: string; email: string | null };
};

/**
 * Postgres advisory lock key for a calendar day. Two customers checking out for
 * the same day are serialised here, which is what makes the availability
 * re-check inside the transaction trustworthy.
 */
async function lockDay(tx: Prisma.TransactionClient, date: DateKey): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`koko-day:${date}`}))`;
}

/**
 * Step 1 of the payment flow: hold the slot.
 *
 * The booking is created as PENDING_PAYMENT with a reservation window (10
 * minutes by default). It occupies the slot but is *not* an appointment — only
 * a confirmed payment does that.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<{ booking: BookingWithRelations; reservationMinutes: number }> {
  if (!input.policyAccepted) {
    throw new ValidationError("Please accept the booking policy to continue.", {
      policyAccepted: "You must accept the booking policy.",
    });
  }
  if (!isDateKey(input.date)) throw new ValidationError("Please choose a valid date.");
  if (!isTimeString(input.startTime)) {
    throw new ValidationError("Please choose a valid time.");
  }
  const phone = normalisePhone(input.customer.phone);
  if (!phone) {
    throw new ValidationError("Please enter a valid Zambian mobile number.", {
      phone: "Use the format +260 97X XXX XXX.",
    });
  }

  const [config, service] = await Promise.all([
    getBusinessConfig(),
    getActiveServiceById(input.serviceId),
  ]);
  if (!service) throw new NotFoundError("That service is no longer available.");

  const amounts = computeBookingAmounts(service.priceNgwee, config.depositNgwee);
  const endTime = minutesToTime(timeToMinutes(input.startTime) + service.durationMinutes);
  const reservationExpiresAt = new Date(Date.now() + config.reservationMinutes * 60_000);

  const booking = await prisma.$transaction(
    async (tx) => {
      await lockDay(tx, input.date);
      await expireReservations(tx);

      const context = await loadScheduleContext(tx, input.date, input.date, { config });
      const schedule = scheduleForDate(context, input.date, service);

      if (schedule.slots.length === 0) {
        throw new DayUnavailableError(
          schedule.reason ?? "No available appointments on this date.",
        );
      }
      const slot = schedule.slots.find((entry) => entry.startTime === input.startTime);
      if (!slot) throw new SlotUnavailableError("That time is not offered on this date.");
      if (!slot.available) throw new SlotUnavailableError();

      const customer = await upsertCustomer(
        { name: input.customer.name.trim(), phone, email: input.customer.email ?? null },
        tx,
      );

      const reference = await generateUniqueBookingReference(async (candidate) => {
        const existing = await tx.booking.findUnique({
          where: { bookingReference: candidate },
          select: { id: true },
        });
        return existing !== null;
      });

      return tx.booking.create({
        data: {
          bookingReference: reference,
          customerId: customer.id,
          serviceId: service.id,
          serviceName: service.name,
          appointmentDate: dateKeyToDbDate(input.date),
          startTime: input.startTime,
          endTime,
          bufferMinutes: config.bufferMinutes,
          status: "PENDING_PAYMENT",
          totalNgwee: amounts.totalNgwee,
          depositNgwee: amounts.depositNgwee,
          remainingNgwee: amounts.remainingNgwee,
          policyAccepted: true,
          policyAcceptedAt: new Date(),
          policySnapshot: config.depositPolicy,
          notes: input.notes?.trim() || null,
          reservationExpiresAt,
        },
        include: {
          payments: true,
          customer: { select: { name: true, phone: true, email: true } },
        },
      });
    },
    { timeout: 15_000 },
  ).catch(rethrowSlotClash);

  await notify("BOOKING_CREATED", booking);
  return { booking, reservationMinutes: config.reservationMinutes };
}

/**
 * The database's partial unique index is the last line of defence against two
 * simultaneous bookings for the same start time; translate it into the message
 * the customer needs to see.
 */
function rethrowSlotClash(error: unknown): never {
  const code = (error as { code?: string })?.code;
  if (code === "P2002") throw new SlotUnavailableError();
  throw error;
}

/**
 * Releases reservations whose payment window has closed, and expires the
 * payment attempts that were still in flight.
 */
export async function expireReservations(
  db: Prisma.TransactionClient | typeof prisma = prisma,
  now: Date = new Date(),
): Promise<number> {
  const expired = await db.booking.findMany({
    where: { status: "PENDING_PAYMENT", reservationExpiresAt: { lt: now } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;

  const ids = expired.map((booking) => booking.id);
  await db.booking.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } });
  await db.payment.updateMany({
    where: { bookingId: { in: ids }, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "EXPIRED", failureReason: "Reservation window closed" },
  });
  return ids.length;
}

export async function getBookingByReference(
  reference: string,
): Promise<BookingWithRelations | null> {
  return prisma.booking.findUnique({
    where: { bookingReference: normaliseBookingReference(reference) },
    include: {
      payments: { orderBy: { createdAt: "desc" } },
      customer: { select: { name: true, phone: true, email: true } },
    },
  });
}

/** Customer-facing lookup: reference plus the phone number used to book. */
export async function lookupBooking(
  reference: string,
  phone: string,
): Promise<BookingWithRelations> {
  const normalisedPhone = normalisePhone(phone);
  const booking = await getBookingByReference(reference);

  // One deliberately vague message for both failures so references cannot be
  // enumerated by guessing.
  if (!booking || !normalisedPhone || booking.customer.phone !== normalisedPhone) {
    throw new NotFoundError(
      "We could not find a booking with that reference and phone number.",
    );
  }
  return booking;
}

export async function cancelBooking(
  reference: string,
  options: { reason?: string; by: "customer" | "admin" } = { by: "customer" },
): Promise<BookingWithRelations> {
  const booking = await getBookingByReference(reference);
  if (!booking) throw new NotFoundError("We could not find that booking.");
  if (["CANCELLED", "COMPLETED", "NO_SHOW", "EXPIRED"].includes(booking.status)) {
    throw new ValidationError(
      `This booking is already ${BOOKING_STATUS_LABEL[booking.status].toLowerCase()}.`,
    );
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason:
        options.reason?.trim() ||
        (options.by === "admin" ? "Cancelled by the salon" : "Cancelled by the customer"),
    },
    include: {
      payments: { orderBy: { createdAt: "desc" } },
      customer: { select: { name: true, phone: true, email: true } },
    },
  });

  await prisma.reminder.updateMany({
    where: { bookingId: booking.id, sentAt: null },
    data: { cancelledAt: new Date() },
  });
  await notify("BOOKING_CANCELLED", updated);
  return updated;
}

export async function setBookingStatus(
  reference: string,
  status: BookingStatus,
  options: { reason?: string } = {},
): Promise<BookingWithRelations> {
  if (status === "CANCELLED") {
    return cancelBooking(reference, { reason: options.reason, by: "admin" });
  }

  const booking = await getBookingByReference(reference);
  if (!booking) throw new NotFoundError("We could not find that booking.");

  if (status === "CONFIRMED" && booking.status === "PENDING_PAYMENT") {
    const paid = booking.payments.some((payment) => payment.status === "SUCCESSFUL");
    if (!paid) {
      throw new ValidationError(
        "This booking has no successful deposit payment yet, so it cannot be confirmed.",
      );
    }
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status,
      ...(status === "CONFIRMED" ? { confirmedAt: booking.confirmedAt ?? new Date() } : {}),
    },
    include: {
      payments: { orderBy: { createdAt: "desc" } },
      customer: { select: { name: true, phone: true, email: true } },
    },
  });

  if (status === "COMPLETED") await notify("APPOINTMENT_COMPLETED", updated);
  return updated;
}

/** Re-checks that a held slot is still valid, e.g. if the owner blocked the day. */
export async function isReservationStillValid(
  booking: Pick<Booking, "id" | "appointmentDate" | "startTime" | "serviceId" | "status" | "reservationExpiresAt">,
): Promise<boolean> {
  if (booking.status !== "PENDING_PAYMENT") return booking.status === "CONFIRMED";
  if (booking.reservationExpiresAt && booking.reservationExpiresAt < new Date()) return false;

  const service = await prisma.service.findUnique({ where: { id: booking.serviceId } });
  if (!service) return false;

  const date = dbDateToDateKey(booking.appointmentDate);
  const context = await loadScheduleContext(prisma, date, date);
  const schedule = scheduleForDate(context, date, service, {
    ignoreBookingId: booking.id,
  });
  return schedule.slots.some(
    (slot) => slot.startTime === booking.startTime && slot.available,
  );
}

export function toPaymentDto(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    status: payment.status,
    method: payment.method,
    provider: payment.provider,
    providerReference: payment.providerReference,
    amountNgwee: payment.amountNgwee,
    currency: payment.currency,
    instrumentBrand: payment.instrumentBrand,
    instrumentLast4: payment.instrumentLast4,
    payerReference: payment.payerReference,
    failureReason: payment.failureReason,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function toBookingDto(booking: BookingWithRelations): BookingDto {
  const date = dbDateToDateKey(booking.appointmentDate);
  const latestPayment = booking.payments[0] ?? null;
  const successfulPayment = booking.payments.find(
    (payment) => payment.status === "SUCCESSFUL",
  );

  return {
    reference: booking.bookingReference,
    status: booking.status,
    statusLabel: BOOKING_STATUS_LABEL[booking.status],
    serviceName: booking.serviceName,
    serviceId: booking.serviceId,
    date,
    dateLabel: formatDateLong(date),
    startTime: booking.startTime,
    endTime: booking.endTime,
    durationMinutes: timeToMinutes(booking.endTime) - timeToMinutes(booking.startTime),
    customerName: booking.customer.name,
    customerPhone: booking.customer.phone,
    customerEmail: booking.customer.email,
    notes: booking.notes,
    amounts: {
      totalNgwee: booking.totalNgwee,
      depositNgwee: booking.depositNgwee,
      remainingNgwee: booking.remainingNgwee,
    },
    depositPaid: Boolean(successfulPayment),
    policyAccepted: booking.policyAccepted,
    policySnapshot: booking.policySnapshot,
    reservationExpiresAt: booking.reservationExpiresAt?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
    confirmedAt: booking.confirmedAt?.toISOString() ?? null,
    payment: latestPayment ? toPaymentDto(latestPayment) : null,
  };
}

export { LIVE_BOOKING_STATUSES };
