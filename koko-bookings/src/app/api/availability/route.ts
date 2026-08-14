import { expireReservations } from "@/lib/booking/booking-service";
import { getMonthAvailability } from "@/lib/booking/availability";
import { getActiveServiceById } from "@/lib/database/services";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { apiSuccess, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Month calendar statuses for a service: /api/availability?month=2026-08&serviceId=… */
export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const serviceId = url.searchParams.get("serviceId");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new ValidationError("Provide a month as YYYY-MM.");
  }
  if (!serviceId) throw new ValidationError("Provide a serviceId.");

  const service = await getActiveServiceById(serviceId);
  if (!service) throw new NotFoundError("That service is no longer available.");

  // Free up any lapsed reservations so the calendar tells the truth.
  await expireReservations();

  return apiSuccess({
    month,
    serviceId,
    days: await getMonthAvailability(month, service),
  });
});
