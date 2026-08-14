import { findNextAvailableDates, getDaySlots } from "@/lib/booking/availability";
import { expireReservations } from "@/lib/booking/booking-service";
import { getActiveServiceById } from "@/lib/database/services";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { apiSuccess, route } from "@/lib/http";
import { isDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Time grid for one date: /api/availability/slots?date=2026-08-15&serviceId=… */
export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const serviceId = url.searchParams.get("serviceId");

  if (!date || !isDateKey(date)) throw new ValidationError("Provide a date as YYYY-MM-DD.");
  if (!serviceId) throw new ValidationError("Provide a serviceId.");

  const service = await getActiveServiceById(serviceId);
  if (!service) throw new NotFoundError("That service is no longer available.");

  await expireReservations();
  const day = await getDaySlots(date, service);

  return apiSuccess({
    ...day,
    // Offered when a date has nothing left, so the customer is never stuck.
    suggestions:
      day.slots.some((slot) => slot.available)
        ? []
        : await findNextAvailableDates(service, { from: date, limit: 3 }),
  });
});
