import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ServiceDto } from "@/types";

/** Homepage service list — a preview of step 1 of the booking flow. */
export function ServiceShowcase({ services }: { services: ServiceDto[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <li key={service.id}>
          <Card interactive className="h-full">
            <CardContent className="flex h-full flex-col gap-3 p-5 pt-5 sm:p-6 sm:pt-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="flex items-center gap-2 font-display text-lg text-ink">
                  <Sparkles className="size-4 text-blush-500" aria-hidden />
                  {service.name}
                </h3>
                <span className="shrink-0 rounded-full bg-blush-100 px-3 py-1 text-sm font-semibold text-blush-800">
                  {service.priceLabel}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-ink-soft">{service.description}</p>

              <p className="mt-auto flex items-center gap-1.5 text-xs text-ink-muted">
                <Clock className="size-3.5" aria-hidden />
                Approx. {service.durationLabel}
              </p>

              <Button asChild variant="secondary" size="sm" full>
                <Link href={`/book?service=${service.slug}`}>
                  Book {service.name}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
