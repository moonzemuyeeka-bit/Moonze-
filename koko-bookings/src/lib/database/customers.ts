import type { Customer, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/database/client";
import { normalisePhone } from "@/lib/phone";

export type CustomerInput = {
  name: string;
  phone: string;
  email?: string | null;
};

/**
 * Customers are keyed by phone number — the one thing a lash client always
 * remembers. Repeat visitors are recognised without needing an account.
 */
export async function upsertCustomer(
  input: CustomerInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<Customer> {
  const phone = normalisePhone(input.phone);
  if (!phone) throw new Error(`Invalid Zambian mobile number: ${input.phone}`);

  return tx.customer.upsert({
    where: { phone },
    update: {
      name: input.name,
      ...(input.email ? { email: input.email } : {}),
    },
    create: { name: input.name, phone, email: input.email ?? null },
  });
}

export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const normalised = normalisePhone(phone);
  if (!normalised) return null;
  return prisma.customer.findUnique({ where: { phone: normalised } });
}

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: Date;
  bookingCount: number;
  completedCount: number;
  lastAppointment: { date: Date; startTime: string } | null;
  totalSpentNgwee: number;
  depositsPaidNgwee: number;
};

/** Customer list with the aggregates the owner actually cares about. */
export async function listCustomers(search?: string): Promise<CustomerSummary[]> {
  const term = search?.trim();
  const customers = await prisma.customer.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { phone: { contains: term.replace(/\s/g, "") } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      bookings: {
        orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
        select: {
          status: true,
          appointmentDate: true,
          startTime: true,
          totalNgwee: true,
          depositNgwee: true,
        },
      },
    },
  });

  return customers.map((customer) => {
    const relevant = customer.bookings.filter(
      (booking) => booking.status !== "EXPIRED" && booking.status !== "PENDING_PAYMENT",
    );
    const completed = relevant.filter((booking) => booking.status === "COMPLETED");
    const depositsPaid = relevant.filter((booking) =>
      ["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"].includes(booking.status),
    );
    const last = relevant[0] ?? null;

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      createdAt: customer.createdAt,
      bookingCount: relevant.length,
      completedCount: completed.length,
      lastAppointment: last
        ? { date: last.appointmentDate, startTime: last.startTime }
        : null,
      totalSpentNgwee: completed.reduce((sum, booking) => sum + booking.totalNgwee, 0),
      depositsPaidNgwee: depositsPaid.reduce(
        (sum, booking) => sum + booking.depositNgwee,
        0,
      ),
    };
  });
}

export async function getCustomerWithHistory(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
        include: { payments: { orderBy: { createdAt: "desc" } } },
      },
    },
  });
}
