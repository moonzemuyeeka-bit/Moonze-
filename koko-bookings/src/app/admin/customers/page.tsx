import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { requireAdminPage } from "@/lib/auth/guard";
import { listCustomers } from "@/lib/database/customers";
import { formatKwacha } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { dbDateToDateKey, formatDateShort } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminPage("/admin/customers");
  const { q } = await searchParams;
  const customers = await listCustomers(q);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Customers</h1>
        <p className="text-sm text-ink-soft">
          {customers.length} customer{customers.length === 1 ? "" : "s"} with booking history.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 pt-4">
          <form className="flex flex-col gap-2 sm:flex-row" action="/admin/customers">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                name="q"
                defaultValue={q ?? ""}
                aria-label="Search customers"
                className="pl-11"
                placeholder="Search by name, phone or email"
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {customers.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No customers found."
          description={q ? "Try a different name or number." : "Customers appear here after their first booking."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-2 p-4 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg text-ink">
                        {customer.name}
                      </h2>
                      <p className="truncate text-xs text-ink-soft">
                        {formatPhone(customer.phone)}
                      </p>
                      {customer.email ? (
                        <p className="truncate text-xs text-ink-muted">{customer.email}</p>
                      ) : null}
                    </div>
                    <Badge tone="brand">
                      {customer.bookingCount} booking{customer.bookingCount === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <dl className="mt-1 space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-muted">Last appointment</dt>
                      <dd className="text-ink">
                        {customer.lastAppointment
                          ? formatDateShort(dbDateToDateKey(customer.lastAppointment.date))
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-muted">Total spent</dt>
                      <dd className="font-medium text-ink">
                        {formatKwacha(customer.totalSpentNgwee)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-muted">Deposits paid</dt>
                      <dd className="text-ink">{formatKwacha(customer.depositsPaidNgwee)}</dd>
                    </div>
                  </dl>

                  <Button asChild variant="secondary" size="sm" full className="mt-auto">
                    <Link href={`/admin/customers/${customer.id}`}>View profile</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
