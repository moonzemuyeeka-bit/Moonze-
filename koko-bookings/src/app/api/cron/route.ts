import { expireReservations } from "@/lib/booking/booking-service";
import { serverEnv } from "@/lib/config";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { apiSuccess, route } from "@/lib/http";
import { dispatchDueReminders } from "@/lib/notifications/reminders";

/**
 * Scheduled maintenance, called by a cron job (Vercel Cron, GitHub Actions,
 * systemd timer…) with the shared secret:
 *
 *   POST /api/cron?task=release-expired
 *   POST /api/cron?task=reminders
 */
export const POST = route(async (request: Request) => {
  const url = new URL(request.url);
  const secret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret");

  if (secret !== serverEnv().CRON_SECRET) {
    throw new UnauthorizedError("Invalid cron secret.");
  }

  const task = url.searchParams.get("task") ?? "all";

  if (task === "release-expired") {
    return apiSuccess({ released: await expireReservations() });
  }
  if (task === "reminders") {
    return apiSuccess(await dispatchDueReminders());
  }
  if (task === "all") {
    const released = await expireReservations();
    const reminders = await dispatchDueReminders();
    return apiSuccess({ released, reminders });
  }

  throw new ValidationError("Unknown task. Use release-expired, reminders or all.");
});
