/**
 * Demo seed: realistic services, customers, bookings, payments and blocked
 * dates so the app is immediately usable after installation.
 *
 * Run with `npm run db:seed`. It clears booking data first, so never point it
 * at a production database.
 */
import { PrismaClient } from "../src/generated/prisma";
import { DEFAULT_SETTINGS, DEFAULT_WORKING_HOURS } from "../src/lib/config";
import { hashPassword } from "../src/lib/auth/password";
import { generateBookingReference } from "../src/lib/booking/reference";
import {
  addDaysToDateKey,
  businessNow,
  dateKeyToDbDate,
  dayOfWeekForDateKey,
  minutesToTime,
  timeToMinutes,
} from "../src/lib/time";
import { toNgwee } from "../src/lib/money";

const prisma = new PrismaClient();

const SERVICES = [
  {
    name: "Classic Lashes",
    description:
      "One extension per natural lash for a soft, your-lashes-but-better finish.",
    priceKwacha: 280,
    durationMinutes: 120,
    featured: true,
  },
  {
    name: "Natural Lashes",
    description: "Lightweight, everyday length that keeps things effortless.",
    priceKwacha: 280,
    durationMinutes: 120,
    featured: false,
  },
  {
    name: "Manga Sets",
    description: "Spiky, doll-eye clusters for a bold, defined lash line.",
    priceKwacha: 350,
    durationMinutes: 150,
    featured: true,
  },
  {
    name: "Wet Sets",
    description: "Glossy, wispy spikes with that just-out-of-the-water look.",
    priceKwacha: 350,
    durationMinutes: 150,
    featured: true,
  },
  {
    name: "Volume",
    description: "Handmade fans for maximum fullness and a glamorous finish.",
    priceKwacha: 500,
    durationMinutes: 180,
    featured: true,
  },
  {
    name: "Lash Removal",
    description: "Gentle, safe removal of existing extensions with aftercare.",
    priceKwacha: 100,
    durationMinutes: 45,
    featured: false,
  },
  {
    name: "Refills",
    description:
      "Top up your existing set within three weeks. Priced from, depending on the set.",
    priceKwacha: 280,
    priceFrom: true,
    durationMinutes: 90,
    featured: false,
  },
];

const CUSTOMERS = [
  { name: "Chanda Mwale", phone: "+260977123456", email: "chanda.mwale@example.zm" },
  { name: "Natasha Banda", phone: "+260966234567", email: "natasha.banda@example.zm" },
  { name: "Mutinta Hachipuka", phone: "+260955345678", email: null },
  { name: "Lindiwe Phiri", phone: "+260977456789", email: "lindiwe.phiri@example.zm" },
  { name: "Bwalya Kabwe", phone: "+260966567890", email: null },
  { name: "Thandiwe Zulu", phone: "+260955678901", email: "thandiwe.zulu@example.zm" },
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Nearest date on or after `from` that the salon is open. */
function nextOpenDate(from: string, offset = 0): string {
  let date = addDaysToDateKey(from, offset);
  for (let guard = 0; guard < 14; guard += 1) {
    const day = DEFAULT_WORKING_HOURS.find(
      (entry) => entry.dayOfWeek === dayOfWeekForDateKey(date),
    );
    if (day && !day.closed) return date;
    date = addDaysToDateKey(date, 1);
  }
  return date;
}

async function main() {
  const today = businessNow(DEFAULT_SETTINGS.timezone).date;

  console.log("→ clearing existing demo data");
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.service.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.timeSlot.deleteMany();

  console.log("→ business settings & working hours");
  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: { ...DEFAULT_SETTINGS },
    create: { id: "default", ...DEFAULT_SETTINGS },
  });
  for (const day of DEFAULT_WORKING_HOURS) {
    await prisma.workingHours.upsert({
      where: { dayOfWeek: day.dayOfWeek },
      update: { openTime: day.openTime, closeTime: day.closeTime, closed: day.closed },
      create: { ...day },
    });
  }

  console.log("→ admin account");
  const adminEmail = (process.env.ADMIN_EMAIL ?? "owner@kokosbookings.zm").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "KokoLashes2026!";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: await hashPassword(adminPassword) },
    create: {
      name: process.env.ADMIN_NAME ?? "Koko",
      email: adminEmail,
      phone: DEFAULT_SETTINGS.businessPhone,
      role: "ADMIN",
      passwordHash: await hashPassword(adminPassword),
    },
  });

  console.log("→ services");
  const services = [];
  for (const [index, service] of SERVICES.entries()) {
    services.push(
      await prisma.service.create({
        data: {
          name: service.name,
          slug: slugify(service.name),
          description: service.description,
          priceNgwee: toNgwee(service.priceKwacha),
          priceFrom: service.priceFrom ?? false,
          durationMinutes: service.durationMinutes,
          featured: service.featured,
          active: true,
          sortOrder: index + 1,
        },
      }),
    );
  }
  const serviceByName = new Map(services.map((service) => [service.name, service]));

  console.log("→ customers");
  const customers = [];
  for (const customer of CUSTOMERS) {
    customers.push(await prisma.customer.create({ data: customer }));
  }
  const customerByName = new Map(customers.map((customer) => [customer.name, customer]));

  console.log("→ blocked dates");
  await prisma.availability.create({
    data: {
      date: dateKeyToDbDate(nextOpenDate(today, 3)),
      status: "UNAVAILABLE",
      reason: "Personal day",
    },
  });
  await prisma.availability.create({
    data: {
      date: dateKeyToDbDate(nextOpenDate(today, 10)),
      status: "UNAVAILABLE",
      reason: "Lash training workshop",
    },
  });

  console.log("→ hand-crafted slots for a busy Saturday");
  const saturday = (() => {
    let date = today;
    for (let guard = 0; guard < 14; guard += 1) {
      if (dayOfWeekForDateKey(date) === 6 && date !== today) return date;
      date = addDaysToDateKey(date, 1);
    }
    return date;
  })();
  for (const start of ["09:00", "11:30", "14:00"]) {
    await prisma.timeSlot.create({
      data: {
        date: dateKeyToDbDate(saturday),
        startTime: start,
        endTime: minutesToTime(timeToMinutes(start) + 150),
        status: "OPEN",
        note: "Saturday express slots",
      },
    });
  }

  console.log("→ bookings, deposits and payment history");
  const settings = DEFAULT_SETTINGS;

  type SeedBooking = {
    customer: string;
    service: string;
    date: string;
    startTime: string;
    status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "PENDING_PAYMENT";
    paid: boolean;
    notes?: string;
  };

  const seedBookings: SeedBooking[] = [
    // History
    { customer: "Chanda Mwale", service: "Classic Lashes", date: nextOpenDate(addDaysToDateKey(today, -21)), startTime: "09:00", status: "COMPLETED", paid: true },
    { customer: "Chanda Mwale", service: "Refills", date: nextOpenDate(addDaysToDateKey(today, -9)), startTime: "11:30", status: "COMPLETED", paid: true },
    { customer: "Natasha Banda", service: "Volume", date: nextOpenDate(addDaysToDateKey(today, -14)), startTime: "13:00", status: "COMPLETED", paid: true },
    { customer: "Mutinta Hachipuka", service: "Wet Sets", date: nextOpenDate(addDaysToDateKey(today, -7)), startTime: "10:00", status: "NO_SHOW", paid: true },
    { customer: "Lindiwe Phiri", service: "Manga Sets", date: nextOpenDate(addDaysToDateKey(today, -4)), startTime: "14:30", status: "COMPLETED", paid: true },
    { customer: "Bwalya Kabwe", service: "Lash Removal", date: nextOpenDate(addDaysToDateKey(today, -2)), startTime: "16:00", status: "CANCELLED", paid: true },

    // Today
    { customer: "Natasha Banda", service: "Classic Lashes", date: today, startTime: "09:00", status: "CONFIRMED", paid: true, notes: "Prefers a softer look" },
    { customer: "Thandiwe Zulu", service: "Wet Sets", date: today, startTime: "12:00", status: "CONFIRMED", paid: true },
    { customer: "Lindiwe Phiri", service: "Refills", date: today, startTime: "15:00", status: "CONFIRMED", paid: true },

    // Upcoming
    { customer: "Mutinta Hachipuka", service: "Volume", date: nextOpenDate(today, 1), startTime: "09:30", status: "CONFIRMED", paid: true },
    { customer: "Chanda Mwale", service: "Manga Sets", date: nextOpenDate(today, 1), startTime: "13:30", status: "CONFIRMED", paid: true },
    { customer: "Bwalya Kabwe", service: "Classic Lashes", date: nextOpenDate(today, 2), startTime: "10:00", status: "CONFIRMED", paid: true },
    { customer: "Thandiwe Zulu", service: "Volume", date: nextOpenDate(today, 4), startTime: "09:00", status: "CONFIRMED", paid: true, notes: "Bridal shoot the next day" },
    { customer: "Natasha Banda", service: "Refills", date: nextOpenDate(today, 5), startTime: "11:00", status: "CONFIRMED", paid: true },
    { customer: "Lindiwe Phiri", service: "Wet Sets", date: nextOpenDate(today, 6), startTime: "14:00", status: "CONFIRMED", paid: true },

    // A checkout in progress: holds the slot, not yet an appointment
    { customer: "Mutinta Hachipuka", service: "Classic Lashes", date: nextOpenDate(today, 2), startTime: "14:00", status: "PENDING_PAYMENT", paid: false },
  ];

  for (const seed of seedBookings) {
    const service = serviceByName.get(seed.service)!;
    const customer = customerByName.get(seed.customer)!;
    const deposit = Math.min(settings.depositNgwee, service.priceNgwee);
    const startMinutes = timeToMinutes(seed.startTime);
    const confirmedAt = ["CONFIRMED", "COMPLETED", "NO_SHOW"].includes(seed.status)
      ? new Date()
      : null;

    const booking = await prisma.booking.create({
      data: {
        bookingReference: generateBookingReference(),
        customerId: customer.id,
        serviceId: service.id,
        serviceName: service.name,
        appointmentDate: dateKeyToDbDate(seed.date),
        startTime: seed.startTime,
        endTime: minutesToTime(startMinutes + service.durationMinutes),
        bufferMinutes: settings.bufferMinutes,
        status: seed.status,
        totalNgwee: service.priceNgwee,
        depositNgwee: deposit,
        remainingNgwee: service.priceNgwee - deposit,
        policyAccepted: true,
        policyAcceptedAt: new Date(),
        policySnapshot: settings.depositPolicy,
        notes: seed.notes ?? null,
        confirmedAt,
        cancelledAt: seed.status === "CANCELLED" ? new Date() : null,
        cancellationReason:
          seed.status === "CANCELLED" ? "Customer rescheduled by phone" : null,
        reservationExpiresAt:
          seed.status === "PENDING_PAYMENT" ? new Date(Date.now() + 9 * 60_000) : null,
      },
    });

    const method = Math.random() > 0.35 ? "MOBILE_MONEY" : "BANK_CARD";
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amountNgwee: deposit,
        currency: settings.currency,
        method,
        provider: "mock",
        providerReference: `MOCK-SEED-${booking.id.slice(-8).toUpperCase()}`,
        status: seed.paid ? "SUCCESSFUL" : "PROCESSING",
        payerReference: method === "MOBILE_MONEY" ? customer.phone : null,
        instrumentBrand: method === "MOBILE_MONEY" ? "Airtel Money" : "Visa",
        instrumentLast4: method === "BANK_CARD" ? "4242" : null,
        paidAt: seed.paid ? new Date() : null,
        events: {
          create: [
            { toStatus: "PROCESSING", source: "api", detail: "Payment created with Koko Sandbox" },
            ...(seed.paid
              ? [
                  {
                    fromStatus: "PROCESSING" as const,
                    toStatus: "SUCCESSFUL" as const,
                    source: "webhook",
                    detail: "Sandbox confirmed the deposit",
                  },
                ]
              : []),
          ],
        },
      },
    });
  }

  const counts = {
    services: await prisma.service.count(),
    customers: await prisma.customer.count(),
    bookings: await prisma.booking.count(),
    payments: await prisma.payment.count(),
    blockedDates: await prisma.availability.count(),
  };
  console.log("✔ seed complete", counts);
  console.log(`  admin login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
