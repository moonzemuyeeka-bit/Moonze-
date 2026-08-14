import {
  cancelBooking,
  lookupBooking,
  toBookingDto,
} from "@/lib/booking/booking-service";
import { apiSuccess, readJson, route } from "@/lib/http";
import { clientKey, consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { cancelBookingSchema } from "@/schemas/booking";

/** Customer-initiated cancellation. Ownership is proven by reference + phone. */
export const POST = route(async (request: Request) => {
  consumeRateLimit(clientKey(request, "lookupBooking"), RATE_LIMITS.lookupBooking);

  const { reference, phone, reason } = cancelBookingSchema.parse(await readJson(request));
  const booking = await lookupBooking(reference, phone);
  const cancelled = await cancelBooking(booking.bookingReference, {
    reason,
    by: "customer",
  });

  return apiSuccess({ booking: toBookingDto(cancelled) });
});
