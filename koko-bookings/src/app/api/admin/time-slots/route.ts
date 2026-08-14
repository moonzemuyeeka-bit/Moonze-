import { requireAdminApi } from "@/lib/auth/guard";
import { prisma } from "@/lib/database/client";
import { ValidationError } from "@/lib/errors";
import { apiSuccess, readJson, route } from "@/lib/http";
import { dateKeyToDbDate } from "@/lib/time";
import { timeSlotSchema, timeSlotUpdateSchema } from "@/schemas/admin";

/** Adds a bespoke slot to a date (which then replaces that day's generated grid). */
export const POST = route(async (request: Request) => {
  await requireAdminApi();
  const input = timeSlotSchema.parse(await readJson(request));

  const existing = await prisma.timeSlot.findUnique({
    where: { date_startTime: { date: dateKeyToDbDate(input.date), startTime: input.startTime } },
  });
  if (existing) {
    throw new ValidationError("There is already a slot starting at that time.");
  }

  const slot = await prisma.timeSlot.create({
    data: {
      date: dateKeyToDbDate(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status,
      note: input.note ?? null,
    },
  });

  return apiSuccess({ slot }, 201);
});

/** Opens or blocks an existing slot. */
export const PATCH = route(async (request: Request) => {
  await requireAdminApi();
  const { id, status } = timeSlotUpdateSchema.parse(await readJson(request));
  const slot = await prisma.timeSlot.update({ where: { id }, data: { status } });
  return apiSuccess({ slot });
});

export const DELETE = route(async (request: Request) => {
  await requireAdminApi();
  const { id } = (await readJson<{ id?: string }>(request)) ?? {};
  if (!id) throw new ValidationError("Provide the slot id to remove.");

  await prisma.timeSlot.delete({ where: { id } });
  return apiSuccess({ deleted: true });
});
