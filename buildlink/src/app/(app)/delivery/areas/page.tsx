import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageDeliveryProvider } from "@/lib/auth/guards";
import { listServiceAreas } from "@/server/delivery/queries";
import { getProvinces } from "@/server/reference/queries";
import { formatZmw } from "@/lib/money";
import { RemoveServiceAreaForm, ServiceAreaForm } from "./area-forms";

export const metadata: Metadata = {
  title: "Service areas",
  description: "The provinces and districts where you deliver building materials.",
};

export default async function ServiceAreasPage() {
  const { providerId } = await requirePageDeliveryProvider("/delivery/areas");
  const [areas, provinces] = await Promise.all([listServiceAreas(providerId), getProvinces()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Service areas"
        description="Jobs are matched to where you deliver. Cover a whole province, or name the districts you actually reach."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Where you deliver
            </CardTitle>
            <CardDescription>
              {areas.length === 0
                ? "You have not added an area yet, so no jobs are being offered to you."
                : `${areas.length} ${areas.length === 1 ? "area" : "areas"} covered.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {areas.length === 0 ? (
              <p className="text-sm text-foreground-muted">
                Add your first area using the form beside this list.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {areas.map((area) => (
                  <li
                    key={area.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <MapPin aria-hidden className="size-3.5 text-brand-700" />
                        {area.district?.name ?? area.province.name}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {area.district ? area.province.name : "Anywhere in this province"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={area.feeMinor > 0 ? "info" : "neutral"} size="sm">
                        {area.feeMinor > 0 ? formatZmw(area.feeMinor) : "Fee on request"}
                      </Badge>
                      <RemoveServiceAreaForm serviceAreaId={area.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Add or update an area
            </CardTitle>
            <CardDescription>
              Saving an area you already cover simply updates its guide fee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceAreaForm provinces={provinces} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
