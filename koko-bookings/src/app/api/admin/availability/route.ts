import { requireAdminApi } from "@/lib/auth/guard";
import { prisma } from "@/lib/database/client";
import { apiSuccess, readJson, route } from "@/lib/http";
import { dateKeyToDbDate } from "@/lib/time";
import { availabilitySchema } from "@/schemas/admin";

/**
 * Marks a date available or unavailable. Marking it available simply removes the
 * override, so the weekly working hours apply again.
 */
export const POST = route(async (request: Request) => {
  await requireAdminApi();
  const { date, status, reason } = availabilitySchema.parse(await readJson(request));
  const dbDate = dateKeyToDbDate(date);

  if (status === "AVAILABLE") {
    await prisma.availability.deleteMany({ where: { date: dbDate } });
    return apiSuccess({ date, status, reason: null });
  }

  const record = await prisma.availability.upsert({
    where: { date: dbDate },
    update: { status, reason: reason ?? null },
    create: { date: dbDate, status, reason: reason ?? null },
  });

  return apiSuccess({ date, status: record.status, reason: record.reason });
});
