import { requireAdminApi } from "@/lib/auth/guard";
import { deleteOrDeactivateService, updateService } from "@/lib/database/services";
import { apiSuccess, readJson, route } from "@/lib/http";
import { toNgwee } from "@/lib/money";
import { serviceSchema } from "@/schemas/admin";

type Context = { params: Promise<{ id: string }> };

export const PATCH = route(async (request: Request, { params }: Context) => {
  await requireAdminApi();
  const { id } = await params;
  const input = serviceSchema.partial().parse(await readJson(request));

  const service = await updateService(id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.priceKwacha !== undefined ? { priceNgwee: toNgwee(input.priceKwacha) } : {}),
    ...(input.priceFrom !== undefined ? { priceFrom: input.priceFrom } : {}),
    ...(input.durationMinutes !== undefined
      ? { durationMinutes: input.durationMinutes }
      : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.featured !== undefined ? { featured: input.featured } : {}),
  });

  return apiSuccess({ service });
});

/** Deactivates rather than deletes when the service has booking history. */
export const DELETE = route(async (_request: Request, { params }: Context) => {
  await requireAdminApi();
  const { id } = await params;
  const result = await deleteOrDeactivateService(id);

  return apiSuccess({
    ...result,
    message: result.deleted
      ? "Service deleted."
      : "This service has bookings, so it was deactivated instead of deleted.",
  });
});
