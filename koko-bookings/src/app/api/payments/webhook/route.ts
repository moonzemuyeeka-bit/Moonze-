import { apiFailure, apiSuccess, route } from "@/lib/http";
import { handlePaymentWebhook } from "@/lib/payments/payment-service";

/**
 * Payment-provider webhook. The raw body is read verbatim so the provider's
 * signature can be verified before anything is trusted.
 */
export const POST = route(async (request: Request) => {
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-koko-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("verif-hash");

  const result = await handlePaymentWebhook(rawBody, signature);
  if (!result.handled) {
    return apiFailure("WEBHOOK_REJECTED", result.reason ?? "Webhook ignored", 400);
  }
  return apiSuccess({ received: true, status: result.status });
});
