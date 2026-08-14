import {
  createReservation,
  toBookingDto,
} from "@/lib/booking/booking-service";
import { apiSuccess, readJson, route } from "@/lib/http";
import { clientKey, consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createBookingSchema } from "@/schemas/booking";

/**
 * Creates the reservation that holds a slot while the customer pays.
 * The response is deliberately not an appointment — `status` is PENDING_PAYMENT
 * until a payment succeeds.
 */
export const POST = route(async (request: Request) => {
  consumeRateLimit(clientKey(request, "createBooking"), RATE_LIMITS.createBooking);

  const payload = createBookingSchema.parse(await readJson(request));
  const { booking, reservationMinutes } = await createReservation({
    serviceId: payload.serviceId,
    date: payload.date,
    startTime: payload.startTime,
    customer: {
      name: payload.customer.name,
      phone: payload.customer.phone,
      email: payload.customer.email ?? null,
    },
    notes: payload.customer.notes ?? null,
    policyAccepted: payload.policyAccepted,
  });

  return apiSuccess(
    { booking: toBookingDto(booking), reservationMinutes },
    201,
  );
});
