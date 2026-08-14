import type { NotificationEvent } from "@/generated/prisma";
import { formatKwacha } from "@/lib/money";
import { dbDateToDateKey, formatDateLong } from "@/lib/time";
import type { NotifiableBooking } from "@/lib/notifications/types";

type TemplateContext = {
  booking: NotifiableBooking;
  businessName: string;
  businessPhone: string;
};

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function appointmentLine(booking: NotifiableBooking): string {
  return `${booking.serviceName} on ${formatDateLong(
    dbDateToDateKey(booking.appointmentDate),
  )} at ${booking.startTime}`;
}

export function renderNotification(
  event: NotificationEvent,
  context: TemplateContext,
): { subject: string; body: string } {
  const { booking, businessName, businessPhone } = context;
  const name = firstName(booking.customer.name);
  const reference = booking.bookingReference;

  switch (event) {
    case "BOOKING_CREATED":
      return {
        subject: `${businessName}: complete your deposit to secure ${reference}`,
        body: `Hi ${name} 👋 We are holding ${appointmentLine(booking)} for you. Pay the ${formatKwacha(
          booking.depositNgwee,
        )} deposit to confirm it. Reference ${reference}.`,
      };
    case "PAYMENT_SUCCESSFUL":
      return {
        subject: `${businessName}: deposit received`,
        body: `Thank you ${name}! We received your ${formatKwacha(
          booking.depositNgwee,
        )} deposit for ${reference}. Balance on the day: ${formatKwacha(booking.remainingNgwee)}.`,
      };
    case "BOOKING_CONFIRMED":
      return {
        subject: `${businessName}: appointment confirmed 🎉`,
        body: `Hi ${name}, your appointment is confirmed 🎉 ${appointmentLine(
          booking,
        )}. Reference ${reference}. Balance of ${formatKwacha(
          booking.remainingNgwee,
        )} is payable at the salon. Questions? ${businessPhone}`,
      };
    case "BOOKING_CANCELLED":
      return {
        subject: `${businessName}: appointment cancelled`,
        body: `Hi ${name}, your appointment ${reference} (${appointmentLine(
          booking,
        )}) has been cancelled. Call ${businessPhone} if this was not you.`,
      };
    case "APPOINTMENT_REMINDER":
      return {
        subject: `${businessName}: appointment reminder`,
        body: `Hi ${name} 👋 Your ${businessName} appointment is tomorrow at ${booking.startTime}.`,
      };
    case "APPOINTMENT_COMPLETED":
      return {
        subject: `${businessName}: thank you`,
        body: `Thank you for visiting ${businessName}, ${name}! We hope you love your lashes. Book your refill any time.`,
      };
    default:
      return {
        subject: businessName,
        body: `Update for booking ${reference}.`,
      };
  }
}

/** Reminder wording depends on how close the appointment is. */
export function renderReminder(
  kind: "DAY_BEFORE" | "HOURS_BEFORE",
  context: TemplateContext & { hoursBefore: number },
): { subject: string; body: string } {
  const name = firstName(context.booking.customer.name);
  if (kind === "DAY_BEFORE") {
    return {
      subject: `${context.businessName}: appointment tomorrow`,
      body: `Hi ${name} 👋 Your ${context.businessName} appointment is tomorrow at ${context.booking.startTime}.`,
    };
  }
  return {
    subject: `${context.businessName}: appointment soon`,
    body: `Your ${context.businessName} appointment starts in ${context.hoursBefore} hour${
      context.hoursBefore === 1 ? "" : "s"
    }.`,
  };
}
