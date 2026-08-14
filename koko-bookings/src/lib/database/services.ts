import type { Service } from "@/generated/prisma";
import { prisma } from "@/lib/database/client";
import { formatKwacha } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import type { ServiceDto } from "@/types";

export function toServiceDto(service: Service): ServiceDto {
  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    priceNgwee: service.priceNgwee,
    priceLabel: formatKwacha(service.priceNgwee, { from: service.priceFrom }),
    priceFrom: service.priceFrom,
    durationMinutes: service.durationMinutes,
    durationLabel: formatDuration(service.durationMinutes),
    featured: service.featured,
    active: service.active,
  };
}

export async function listActiveServices(): Promise<ServiceDto[]> {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return services.map(toServiceDto);
}

export async function listAllServices(): Promise<
  (ServiceDto & { bookingCount: number; sortOrder: number })[]
> {
  const services = await prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { bookings: true } } },
  });
  return services.map((service) => ({
    ...toServiceDto(service),
    sortOrder: service.sortOrder,
    bookingCount: service._count.bookings,
  }));
}

export async function getServiceById(id: string): Promise<Service | null> {
  return prisma.service.findUnique({ where: { id } });
}

export async function getActiveServiceById(id: string): Promise<Service | null> {
  return prisma.service.findFirst({ where: { id, active: true } });
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type ServiceInput = {
  name: string;
  description: string;
  priceNgwee: number;
  priceFrom: boolean;
  durationMinutes: number;
  active: boolean;
  featured: boolean;
  sortOrder?: number;
};

async function uniqueSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name) || "service";
  let candidate = base;
  let suffix = 2;
  // Slugs are user-facing identifiers, so keep them readable and unique.
  for (;;) {
    const clash = await prisma.service.findFirst({
      where: { slug: candidate, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

export async function createService(input: ServiceInput): Promise<Service> {
  const maxOrder = await prisma.service.aggregate({ _max: { sortOrder: true } });
  return prisma.service.create({
    data: {
      ...input,
      slug: await uniqueSlug(input.name),
      sortOrder: input.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateService(
  id: string,
  input: Partial<ServiceInput>,
): Promise<Service> {
  return prisma.service.update({
    where: { id },
    data: {
      ...input,
      ...(input.name ? { slug: await uniqueSlug(input.name, id) } : {}),
    },
  });
}

/**
 * Services with history are deactivated rather than deleted so past bookings,
 * revenue reports and customer records stay intact.
 */
export async function deleteOrDeactivateService(
  id: string,
): Promise<{ deleted: boolean }> {
  const bookingCount = await prisma.booking.count({ where: { serviceId: id } });
  if (bookingCount > 0) {
    await prisma.service.update({ where: { id }, data: { active: false } });
    return { deleted: false };
  }
  await prisma.service.delete({ where: { id } });
  return { deleted: true };
}
