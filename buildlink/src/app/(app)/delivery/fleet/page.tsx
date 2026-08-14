import type { Metadata } from "next";
import { Blocks, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requirePageDeliveryProvider } from "@/lib/auth/guards";
import { listVehicles } from "@/server/delivery/queries";
import { VEHICLE_TYPE_LABELS } from "@/lib/labels";
import { ToggleVehicleForm, VehicleDialog } from "./fleet-forms";

export const metadata: Metadata = {
  title: "My vehicles",
  description: "The vehicles you use to deliver building materials.",
};

export default async function FleetPage() {
  const { providerId } = await requirePageDeliveryProvider("/delivery/fleet");
  const vehicles = await listVehicles(providerId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="My vehicles"
        description="Suppliers pick a vehicle when they assign you a job, and customers see what is bringing their materials."
        actions={<VehicleDialog />}
      />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Blocks}
          title="No vehicles yet"
          description="Add the vehicles you deliver with. Load capacity helps suppliers match you to the right job — nobody sends three tons of cement in a pickup."
          action={<VehicleDialog />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {vehicles.map((vehicle) => (
            <li key={vehicle.id}>
              <Card className={vehicle.isActive ? undefined : "opacity-70"}>
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {VEHICLE_TYPE_LABELS[vehicle.type]}
                      </p>
                      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                        {vehicle.registration}
                      </p>
                    </div>
                    <Badge tone={vehicle.isActive ? "success" : "neutral"} size="sm">
                      {vehicle.isActive ? "In service" : "Out of service"}
                    </Badge>
                  </div>

                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-foreground-muted">
                    {vehicle.capacityKg !== null ? (
                      <div>
                        <dt className="inline font-medium text-foreground">Load: </dt>
                        <dd className="inline">{vehicle.capacityKg.toLocaleString("en-ZM")} kg</dd>
                      </div>
                    ) : null}
                    {vehicle.capacityCubicMetres !== null ? (
                      <div>
                        <dt className="inline font-medium text-foreground">Volume: </dt>
                        <dd className="inline">{vehicle.capacityCubicMetres} m³</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="inline font-medium text-foreground">Deliveries: </dt>
                      <dd className="inline">{vehicle._count.deliveries}</dd>
                    </div>
                  </dl>

                  {vehicle.description ? (
                    <p className="text-xs text-foreground-muted">{vehicle.description}</p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <VehicleDialog
                      vehicle={{
                        id: vehicle.id,
                        type: vehicle.type,
                        registration: vehicle.registration,
                        description: vehicle.description,
                        capacityKg: vehicle.capacityKg,
                        capacityCubicMetres: vehicle.capacityCubicMetres,
                      }}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Pencil aria-hidden />
                          Edit
                        </Button>
                      }
                    />
                    <ToggleVehicleForm vehicleId={vehicle.id} isActive={vehicle.isActive} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
