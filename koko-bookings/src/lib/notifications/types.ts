import type { NotificationChannel, NotificationEvent } from "@/generated/prisma";

/** The booking fields any notification template may rely on. */
export type NotifiableBooking = {
  id: string;
  bookingReference: string;
  serviceName: string;
  appointmentDate: Date;
  startTime: string;
  totalNgwee: number;
  depositNgwee: number;
  remainingNgwee: number;
  customer: { name: string; phone: string; email: string | null };
};

export type OutboundMessage = {
  event: NotificationEvent;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
};

export type DeliveryResult = { delivered: boolean; error?: string };

/**
 * A messaging channel (WhatsApp, SMS, email…). Adapters report whether they are
 * configured so the app can degrade to logging instead of silently pretending a
 * message was sent.
 */
export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  isConfigured(): boolean;
  send(message: OutboundMessage): Promise<DeliveryResult>;
}
