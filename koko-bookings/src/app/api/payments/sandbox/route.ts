import { toBookingDto, toPaymentDto } from "@/lib/booking/booking-service";
import { isDemoMode } from "@/lib/config";
import { ForbiddenError } from "@/lib/errors";
import { apiSuccess, readJson, route } from "@/lib/http";
import { settleSandboxPayment } from "@/lib/payments/payment-service";
import { clientKey, consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sandboxSettleSchema } from "@/schemas/booking";

/**
 * Sandbox-only: stands in for the customer approving a wallet prompt or a bank
 * responding to a card authorisation. Disabled unless DEMO_MODE is on, and the
 * outcome still travels back through the signed-webhook path.
 */
export const POST = route(async (request: Request) => {
  if (!isDemoMode()) {
    throw new ForbiddenError("Sandbox payment controls are disabled.");
  }
  consumeRateLimit(clientKey(request, "sandboxSettle"), RATE_LIMITS.sandboxSettle);

  const { paymentId, outcome } = sandboxSettleSchema.parse(await readJson(request));
  const { payment, booking, message } = await settleSandboxPayment(paymentId, outcome);

  return apiSuccess({
    payment: toPaymentDto(payment),
    booking: toBookingDto(booking),
    message,
  });
});
