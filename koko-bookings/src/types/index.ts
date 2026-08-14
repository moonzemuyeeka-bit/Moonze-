import type {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma";

export type { BookingStatus, PaymentMethod, PaymentStatus };

/**
 * Serialisable shapes crossing the server → client boundary. Dates are always
 * strings so they survive JSON without timezone surprises.
 */

export type ServiceDto = {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceNgwee: number;
  priceLabel: string;
  priceFrom: boolean;
  durationMinutes: number;
  durationLabel: string;
  featured: boolean;
  active: boolean;
};

export type DayStatus = "AVAILABLE" | "LIMITED" | "FULL" | "UNAVAILABLE" | "PAST";

export type CalendarDayDto = {
  date: string; // YYYY-MM-DD
  status: DayStatus;
  label: string;
  totalSlots: number;
  availableSlots: number;
  reason?: string | null;
};

export type SlotDto = {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  available: boolean;
  reason?: string;
};

export type DaySlotsDto = {
  date: string;
  serviceId: string;
  slots: SlotDto[];
  dayStatus: DayStatus;
  reason?: string | null;
};

export type BookingAmounts = {
  totalNgwee: number;
  depositNgwee: number;
  remainingNgwee: number;
};

export type BookingDto = {
  reference: string;
  status: BookingStatus;
  statusLabel: string;
  serviceName: string;
  serviceId: string;
  date: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
  amounts: BookingAmounts;
  depositPaid: boolean;
  policyAccepted: boolean;
  policySnapshot: string;
  reservationExpiresAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
  payment: PaymentDto | null;
};

export type PaymentDto = {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  provider: string;
  providerReference: string;
  amountNgwee: number;
  currency: string;
  instrumentBrand: string | null;
  instrumentLast4: string | null;
  payerReference: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: { code: string; message: string; fields?: Record<string, string> };
};
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
