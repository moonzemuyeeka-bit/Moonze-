import type {
  DeliveryResult,
  NotificationChannelAdapter,
  OutboundMessage,
} from "@/lib/notifications/types";

/**
 * Channel adapters.
 *
 * Only the console adapter is implemented — it is the honest default for a
 * system with no messaging credentials. WhatsApp/SMS/email adapters report
 * `isConfigured() === false` until their environment variables exist, so the
 * notification service records them as skipped instead of claiming delivery.
 * Adding a real provider means filling in one `send()` method.
 */

class ConsoleChannel implements NotificationChannelAdapter {
  readonly channel = "CONSOLE" as const;

  isConfigured(): boolean {
    return true;
  }

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    console.info(
      `[notification:${message.event}] → ${message.recipient}: ${message.body}`,
    );
    return { delivered: true };
  }
}

class WhatsAppChannel implements NotificationChannelAdapter {
  readonly channel = "WHATSAPP" as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
    );
  }

  async send(): Promise<DeliveryResult> {
    // Wire up the WhatsApp Cloud API (or an aggregator) here.
    return { delivered: false, error: "WhatsApp channel is not implemented yet" };
  }
}

class SmsChannel implements NotificationChannelAdapter {
  readonly channel = "SMS" as const;

  isConfigured(): boolean {
    return Boolean(process.env.SMS_API_KEY && process.env.SMS_SENDER_ID);
  }

  async send(): Promise<DeliveryResult> {
    // Wire up a Zambian SMS gateway here.
    return { delivered: false, error: "SMS channel is not implemented yet" };
  }
}

class EmailChannel implements NotificationChannelAdapter {
  readonly channel = "EMAIL" as const;

  isConfigured(): boolean {
    return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
  }

  async send(): Promise<DeliveryResult> {
    // Wire up a transactional email provider here.
    return { delivered: false, error: "Email channel is not implemented yet" };
  }
}

export const consoleChannel = new ConsoleChannel();

export const channelAdapters: Record<string, NotificationChannelAdapter> = {
  WHATSAPP: new WhatsAppChannel(),
  SMS: new SmsChannel(),
  EMAIL: new EmailChannel(),
  CONSOLE: consoleChannel,
};
