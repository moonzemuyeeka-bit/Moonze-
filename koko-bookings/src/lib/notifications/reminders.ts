import type { ReminderKind } from "@/generated/prisma";
import { prisma } from "@/lib/database/client";
import { getSettings } from "@/lib/database/settings";
import { channelAdapters, consoleChannel } from "@/lib/notifications/channels";
import { renderReminder } from "@/lib/notifications/templates";
import type { OutboundMessage } from "@/lib/notifications/types";
import { dbDateToDateKey, zonedToInstant } from "@/lib/time";

/**
 * Reminder scheduling.
 *
 * Rows are written when a booking is confirmed; a scheduler (cron job hitting
 * `/api/cron/reminders`) dispatches the ones that are due. Nothing is sent by
 * real SMS/WhatsApp until those channels are configured.
 */
export async function scheduleReminders(bookingId: string): Promise<void> {
  const [booking, settings] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId } }),
    getSettings(),
  ]);
  if (!booking || booking.status !== "CONFIRMED") return;

  const appointmentInstant = zonedToInstant(
    dbDateToDateKey(booking.appointmentDate),
    booking.startTime,
    settings.timezone,
  );

  const planned: { kind: ReminderKind; scheduledFor: Date }[] = [];
  if (settings.reminderDayBefore) {
    planned.push({
      kind: "DAY_BEFORE",
      scheduledFor: new Date(appointmentInstant.getTime() - 24 * 60 * 60_000),
    });
  }
  if (settings.reminderHoursBefore > 0) {
    planned.push({
      kind: "HOURS_BEFORE",
      scheduledFor: new Date(
        appointmentInstant.getTime() - settings.reminderHoursBefore * 60 * 60_000,
      ),
    });
  }

  for (const reminder of planned) {
    await prisma.reminder.upsert({
      where: { bookingId_kind: { bookingId, kind: reminder.kind } },
      update: { scheduledFor: reminder.scheduledFor, cancelledAt: null },
      create: { bookingId, kind: reminder.kind, scheduledFor: reminder.scheduledFor },
    });
  }
}

export async function dispatchDueReminders(
  now: Date = new Date(),
): Promise<{ sent: number; skipped: number }> {
  const settings = await getSettings();
  const due = await prisma.reminder.findMany({
    where: { sentAt: null, cancelledAt: null, scheduledFor: { lte: now } },
    include: {
      booking: {
        include: { customer: { select: { name: true, phone: true, email: true } } },
      },
    },
    take: 100,
  });

  let sent = 0;
  let skipped = 0;

  for (const reminder of due) {
    if (reminder.booking.status !== "CONFIRMED") {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { cancelledAt: now },
      });
      skipped += 1;
      continue;
    }

    const { subject, body } = renderReminder(reminder.kind, {
      booking: reminder.booking,
      businessName: settings.businessName,
      businessPhone: settings.businessPhone,
      hoursBefore: settings.reminderHoursBefore,
    });

    const smsAdapter = channelAdapters.SMS;
    const message: OutboundMessage = {
      event: "APPOINTMENT_REMINDER",
      channel: smsAdapter?.isConfigured() ? "SMS" : "CONSOLE",
      recipient: reminder.booking.customer.phone,
      subject,
      body,
    };
    const adapter = smsAdapter?.isConfigured() ? smsAdapter : consoleChannel;
    const result = await adapter.send(message);

    await prisma.notification.create({
      data: {
        bookingId: reminder.bookingId,
        event: "APPOINTMENT_REMINDER",
        channel: message.channel,
        recipient: message.recipient,
        message: `${subject} — ${body}`,
        status: result.delivered ? "SENT" : "FAILED",
        error: result.error ?? null,
        sentAt: result.delivered ? now : null,
      },
    });

    if (result.delivered) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { sentAt: now } });
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  return { sent, skipped };
}
