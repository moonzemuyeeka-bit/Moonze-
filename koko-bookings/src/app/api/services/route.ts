import { apiSuccess, route } from "@/lib/http";
import { listActiveServices } from "@/lib/database/services";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  return apiSuccess({ services: await listActiveServices() });
});
