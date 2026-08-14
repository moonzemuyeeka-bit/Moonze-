import { requireAdminApi } from "@/lib/auth/guard";
import { updateSettings, updateWorkingHours } from "@/lib/database/settings";
import { apiSuccess, readJson, route } from "@/lib/http";
import { toNgwee } from "@/lib/money";
import { settingsSchema, workingHoursSchema } from "@/schemas/admin";

/** Business rules: deposit, slot interval, buffer, policies, notifications. */
export const PUT = route(async (request: Request) => {
  await requireAdminApi();
  const input = settingsSchema.parse(await readJson(request));

  const settings = await updateSettings({
    businessName: input.businessName,
    businessPhone: input.businessPhone,
    businessEmail: input.businessEmail,
    depositNgwee: toNgwee(input.depositKwacha),
    slotIntervalMinutes: input.slotIntervalMinutes,
    bufferMinutes: input.bufferMinutes,
    bookingWindowDays: input.bookingWindowDays,
    minNoticeHours: input.minNoticeHours,
    reservationMinutes: input.reservationMinutes,
    maxDailyBookings: input.maxDailyBookings,
    depositPolicy: input.depositPolicy,
    cancellationPolicy: input.cancellationPolicy,
    notifyWhatsapp: input.notifyWhatsapp,
    notifySms: input.notifySms,
    notifyEmail: input.notifyEmail,
    reminderDayBefore: input.reminderDayBefore,
    reminderHoursBefore: input.reminderHoursBefore,
  });

  return apiSuccess({ settings });
});

/** Weekly working hours. */
export const PATCH = route(async (request: Request) => {
  await requireAdminApi();
  const { days } = workingHoursSchema.parse(await readJson(request));
  return apiSuccess({ workingHours: await updateWorkingHours(days) });
});
