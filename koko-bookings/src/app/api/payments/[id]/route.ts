import { toBookingDto, toPaymentDto } from "@/lib/booking/booking-service";
import { apiSuccess, route } from "@/lib/http";
import { refreshPaymentStatus } from "@/lib/payments/payment-service";
import { isSandboxProvider } from "@/lib/payments/types";
import { getPaymentProvider } from "@/lib/payments/provider";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Polled by the checkout screen. The provider is the source of truth: this
 * never marks a payment successful on its own.
 */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { payment, booking, message } = await refreshPaymentStatus(id);
    const provider = getPaymentProvider(payment.provider);

    return apiSuccess({
      payment: toPaymentDto(payment),
      booking: toBookingDto(booking),
      message,
      sandboxControls: isDemoMode() && isSandboxProvider(provider),
    });
  },
);
