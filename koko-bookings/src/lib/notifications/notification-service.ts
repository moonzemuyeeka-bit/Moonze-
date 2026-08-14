import type { NotificationChannel, NotificationEvent } from "@/generated/prisma";
import { prisma } from "@/lib/database/client";
import { getSettings } from "@/lib/database/settings";
import { channelAdapters, consoleChannel } from "@/lib/notifications/channels";
import { renderNotification } from "@/lib/notifications/templates";
import type { NotifiableBooking, OutboundMessage } from "@/lib/notifications/types";

/**
 * Sends a booking notification over every channel the owner has enabled and
 * that is actually configured, recording the outcome in `notifications` so the
 * admin can see exactly what a customer was told.
 */
export async function notify(
  event: NotificationEvent,
  booking: NotifiableBooking,
): Promise<void> {
  try {
    const settings = await getSettings();
    const { subject, body } = renderNotification(event, {
      booking,
      businessName: settings.businessName,
      businessPhone: settings.businessPhone,
    });

    const wanted: { channel: NotificationChannel; recipient: string }[] = [];
    if (settings.notifyWhatsapp) {
      wanted.push({ channel: "WHATSAPP", recipient: booking.customer.phone });
    }
    if (settings.notifySms) {
      wanted.push({ channel: "SMS", recipient: booking.customer.phone });
    }
    if (settings.notifyEmail && booking.customer.email) {
      wanted.push({ channel: "EMAIL", recipient: booking.customer.email });
    }

    let deliveredAnywhere = false;

    for (const target of wanted) {
      const adapter = channelAdapters[target.channel];
      const message: OutboundMessage = {
        event,
        channel: target.channel,
        recipient: target.recipient,
        subject,
        body,
      };

      if (!adapter?.isConfigured()) {
        await recordNotification(booking.id, message, "SKIPPED", `${target.channel} is not configured`);
        continue;
      }

      const result = await adapter.send(message);
      deliveredAnywhere = deliveredAnywhere || result.delivered;
      await recordNotification(
        booking.id,
        message,
        result.delivered ? "SENT" : "FAILED",
        result.error,
      );
    }

    // Nothing could actually leave the building: log it so the message is never
    // lost, and so the demo shows what the customer would have received.
    if (!deliveredAnywhere) {
      const message: OutboundMessage = {
        event,
        channel: "CONSOLE",
        recipient: booking.customer.phone,
        subject,
        body,
      };
      await consoleChannel.send(message);
      await recordNotification(booking.id, message, "SENT");
    }
  } catch (error) {
    // Notifications must never break a booking or a payment.
    console.error("[notification] failed to dispatch", event, error);
  }
}

async function recordNotification(
  bookingId: string | null,
  message: OutboundMessage,
  status: "SENT" | "FAILED" | "SKIPPED",
  error?: string,
): Promise<void> {
  await prisma.notification.create({
    data: {
      bookingId,
      event: message.event,
      channel: message.channel,
      recipient: message.recipient,
      message: `${message.subject} — ${message.body}`,
      status,
      error: error ?? null,
      sentAt: status === "SENT" ? new Date() : null,
    },
  });
}

export async function listRecentNotifications(limit = 30) {
  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { booking: { select: { bookingReference: true } } },
  });
}
