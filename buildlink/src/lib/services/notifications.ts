import "server-only";
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { db, type DatabaseClient } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Notification service.
 *
 * In-app notifications are fully implemented and are the channel BuildLink
 * guarantees. Email, SMS and WhatsApp are real interfaces with a logging
 * implementation: until credentials are configured, an attempt is recorded as
 * `SKIPPED_NOT_CONFIGURED` rather than silently dropped or falsely marked sent.
 * That way the audit trail tells the truth about what a customer was actually
 * told, and adding a provider later needs no changes above this file.
 */

export type NotificationRequest = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  payload?: Prisma.InputJsonValue;
  /** Defaults to in-app only. */
  channels?: readonly NotificationChannel[];
};

export type OutboundMessage = {
  to: string;
  subject: string;
  body: string;
  linkUrl?: string;
};

export type NotificationChannelAdapter = {
  readonly channel: NotificationChannel;
  readonly isConfigured: boolean;
  send(message: OutboundMessage): Promise<{ status: NotificationDeliveryStatus; error?: string }>;
};

/**
 * Placeholder adapter used whenever a channel has no credentials.
 *
 * It logs and reports `SKIPPED_NOT_CONFIGURED`. It is deliberately not a fake
 * "sent" — a supplier chasing a customer who "was notified" deserves to know
 * that no message actually left the building.
 */
class LoggingChannel implements NotificationChannelAdapter {
  readonly isConfigured = false;

  constructor(readonly channel: NotificationChannel) {}

  async send(message: OutboundMessage) {
    console.info(
      `[buildlink] ${this.channel} channel not configured; would have sent to ${message.to}: ${message.subject}`,
    );
    return { status: "SKIPPED_NOT_CONFIGURED" as const };
  }
}

function adapterFor(channel: NotificationChannel): NotificationChannelAdapter {
  switch (channel) {
    case "EMAIL":
      // `smtp` support is the next adapter to add; the driver switch is here so
      // nothing else needs to change when it lands.
      return new LoggingChannel("EMAIL");
    case "SMS":
      return new LoggingChannel("SMS");
    case "WHATSAPP":
      return new LoggingChannel("WHATSAPP");
    case "IN_APP":
      throw new Error("In-app notifications are stored directly, not sent through an adapter.");
  }
}

export function configuredChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = ["IN_APP"];
  if (env.NOTIFICATION_EMAIL_DRIVER !== "log") channels.push("EMAIL");
  if (env.NOTIFICATION_SMS_DRIVER !== "log") channels.push("SMS");
  if (env.NOTIFICATION_WHATSAPP_DRIVER !== "log") channels.push("WHATSAPP");
  return channels;
}

/**
 * Creates a notification. Never throws into the caller: a failure to notify must
 * not roll back the order, payment or delivery that triggered it.
 */
export async function notify(
  request: NotificationRequest,
  client: DatabaseClient = db,
): Promise<void> {
  const channels = request.channels ?? ["IN_APP"];

  try {
    for (const channel of channels) {
      if (channel === "IN_APP") {
        await client.notification.create({
          data: {
            userId: request.userId,
            type: request.type,
            channel: "IN_APP",
            title: request.title,
            body: request.body,
            linkUrl: request.linkUrl ?? null,
            payload: request.payload,
            deliveryStatus: "SENT",
          },
        });
        continue;
      }

      const recipient = await client.user.findUnique({
        where: { id: request.userId },
        select: { email: true, phone: true },
      });
      const to = channel === "EMAIL" ? recipient?.email : recipient?.phone;
      if (!to) continue;

      const adapter = adapterFor(channel);
      const result = await adapter.send({
        to,
        subject: request.title,
        body: request.body,
        linkUrl: request.linkUrl,
      });

      await client.notification.create({
        data: {
          userId: request.userId,
          type: request.type,
          channel,
          title: request.title,
          body: request.body,
          linkUrl: request.linkUrl ?? null,
          payload: request.payload,
          deliveryStatus: result.status,
          deliveryError: result.error ?? null,
        },
      });
    }
  } catch (error) {
    console.error("[buildlink] failed to create notification:", request.type, error);
  }
}

/** Fan-out helper for events that concern several people (order + delivery). */
export async function notifyMany(
  requests: readonly NotificationRequest[],
  client: DatabaseClient = db,
): Promise<void> {
  for (const request of requests) {
    await notify(request, client);
  }
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await db.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null, channel: "IN_APP" } });
}
