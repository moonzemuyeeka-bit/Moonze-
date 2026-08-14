import { toBookingDto, toPaymentDto } from "@/lib/booking/booking-service";
import { apiSuccess, readJson, route } from "@/lib/http";
import { initiatePayment } from "@/lib/payments/payment-service";
import { clientKey, consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { initiatePaymentSchema } from "@/schemas/booking";

/** Starts the deposit payment for a held slot. */
export const POST = route(async (request: Request) => {
  consumeRateLimit(clientKey(request, "initiatePayment"), RATE_LIMITS.initiatePayment);

  const payload = initiatePaymentSchema.parse(await readJson(request));
  const result = await initiatePayment({
    bookingReference: payload.bookingReference,
    method: payload.method,
    mobileMoney: payload.mobileMoney,
    card: payload.card,
  });

  return apiSuccess(
    {
      payment: toPaymentDto(result.payment),
      booking: toBookingDto(result.booking),
      instruction: result.instruction ?? null,
      redirectUrl: result.redirectUrl ?? null,
      sandbox: result.sandbox,
      provider: result.provider,
      reservationExpiresAt: result.reservationExpiresAt,
    },
    201,
  );
});
