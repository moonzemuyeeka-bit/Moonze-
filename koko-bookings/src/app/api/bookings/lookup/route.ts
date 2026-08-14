import { lookupBooking, toBookingDto } from "@/lib/booking/booking-service";
import { apiSuccess, readJson, route } from "@/lib/http";
import { clientKey, consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { bookingLookupSchema } from "@/schemas/booking";

/** Customer booking lookup: reference + the phone number used to book. */
export const POST = route(async (request: Request) => {
  consumeRateLimit(clientKey(request, "lookupBooking"), RATE_LIMITS.lookupBooking);

  const { reference, phone } = bookingLookupSchema.parse(await readJson(request));
  const booking = await lookupBooking(reference, phone);

  return apiSuccess({ booking: toBookingDto(booking) });
});
