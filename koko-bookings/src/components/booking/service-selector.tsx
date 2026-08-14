"use client";

import { Check, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { ServiceDto } from "@/types";

export function ServiceCard({
  service,
  selected,
  onSelect,
}: {
  service: ServiceDto;
  selected: boolean;
  onSelect: (service: ServiceDto) => void;
}) {
  return (
    <Card
      interactive
      selected={selected}
      className={cn("h-full", selected && "bg-blush-50/70")}
    >
      <CardContent className="flex h-full flex-col gap-3 p-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 font-display text-lg text-ink">
              {service.name}
              {service.featured ? (
                <Sparkles className="size-4 text-blush-400" aria-label="Popular" />
              ) : null}
            </h3>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Clock className="size-3.5" aria-hidden />
              Approx. {service.durationLabel}
            </p>
          </div>
          <p className="shrink-0 font-display text-xl text-blush-800">
            {service.priceLabel}
          </p>
        </div>

        <p className="text-sm leading-relaxed text-ink-soft">{service.description}</p>

        <Button
          variant={selected ? "primary" : "secondary"}
          size="md"
          full
          className="mt-auto"
          onClick={() => onSelect(service)}
          aria-pressed={selected}
        >
          {selected ? (
            <>
              <Check aria-hidden /> Selected
            </>
          ) : (
            "Select"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ServiceSelector({
  services,
  selectedServiceId,
  onSelect,
}: {
  services: ServiceDto[];
  selectedServiceId: string | null;
  onSelect: (service: ServiceDto) => void;
}) {
  if (services.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles />}
        title="No services are bookable right now"
        description="Please check back shortly or call the studio and we will help you book."
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {services.map((service) => (
        <li key={service.id}>
          <ServiceCard
            service={service}
            selected={service.id === selectedServiceId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
