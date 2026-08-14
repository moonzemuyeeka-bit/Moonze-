import { zonedToInstant } from "@/lib/time";
import type { BookingDto } from "@/types";

/** iCalendar timestamp: 20260815T120000Z */
function toIcsStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeIcsText(value: string): string {
  return value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

/**
 * Builds a calendar invite for the appointment so "Add to Calendar" works on
 * every device without a third-party service.
 */
export function buildBookingIcs(
  booking: BookingDto,
  options: { businessName: string; timezone?: string; location?: string },
): string {
  const timezone = options.timezone ?? "Africa/Lusaka";
  const start = zonedToInstant(booking.date, booking.startTime, timezone);
  const end = zonedToInstant(booking.date, booking.endTime, timezone);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Koko's Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.reference}@kokosbookings`,
    `DTSTAMP:${toIcsStamp(new Date())}`,
    `DTSTART:${toIcsStamp(start)}`,
    `DTEND:${toIcsStamp(end)}`,
    `SUMMARY:${escapeIcsText(`${booking.serviceName} at ${options.businessName}`)}`,
    `DESCRIPTION:${escapeIcsText(
      `Booking reference ${booking.reference}. Balance payable on the day.`,
    )}`,
    ...(options.location ? [`LOCATION:${escapeIcsText(options.location)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(`${options.businessName} appointment in 2 hours`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.join("\r\n")}\r\n`;
}

export function icsDataUrl(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
