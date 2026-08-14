import { requireAdminApi } from "@/lib/auth/guard";
import { createService, listAllServices } from "@/lib/database/services";
import { apiSuccess, readJson, route } from "@/lib/http";
import { toNgwee } from "@/lib/money";
import { serviceSchema } from "@/schemas/admin";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdminApi();
  return apiSuccess({ services: await listAllServices() });
});

export const POST = route(async (request: Request) => {
  await requireAdminApi();
  const input = serviceSchema.parse(await readJson(request));

  const service = await createService({
    name: input.name,
    description: input.description,
    priceNgwee: toNgwee(input.priceKwacha),
    priceFrom: input.priceFrom,
    durationMinutes: input.durationMinutes,
    active: input.active,
    featured: input.featured,
  });

  return apiSuccess({ service }, 201);
});
