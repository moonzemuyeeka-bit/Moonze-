import { ServiceManager } from "@/components/admin/service-manager";
import { requireAdminPage } from "@/lib/auth/guard";
import { listAllServices } from "@/lib/database/services";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  await requireAdminPage("/admin/services");
  const services = await listAllServices();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Services &amp; prices</h1>
        <p className="text-sm text-ink-soft">
          Change a price and every new booking uses it. Services with history are retired
          rather than deleted, so past bookings and reports stay accurate.
        </p>
      </div>

      <ServiceManager
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          priceNgwee: service.priceNgwee,
          priceFrom: service.priceFrom,
          durationMinutes: service.durationMinutes,
          active: service.active,
          featured: service.featured,
          bookingCount: service.bookingCount,
        }))}
      />
    </div>
  );
}
