import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { formatDate } from "@/components/ui/timeline";
import { requirePageSupplier } from "@/lib/auth/guards";
import { listSupplierCustomers } from "@/server/suppliers/queries";
import { formatZmw } from "@/lib/money";

export const metadata: Metadata = {
  title: "Customers",
  description: "The people who buy from you, by how much they have spent.",
};

/**
 * Repeat customers.
 *
 * A yard's best asset is the builder who comes back, so this is ordered by spend
 * and shows a phone number: the point of the screen is to make it easy to pick up
 * the phone to somebody worth keeping.
 */
export default async function SupplierCustomersPage() {
  const { supplier } = await requirePageSupplier("/supplier/customers");
  const customers = await listSupplierCustomers(supplier.id);

  const totalSpendMinor = customers.reduce((running, customer) => running + customer.spendMinor, 0);
  const repeatCount = customers.filter((customer) => customer.orderCount > 1).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description={
          customers.length === 0
            ? "Once people order from you they appear here."
            : `${customers.length} customer${customers.length === 1 ? "" : "s"} · ${repeatCount} ${repeatCount === 1 ? "has" : "have"} ordered more than once · ${formatZmw(totalSpendMinor)} ordered in total.`
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Complete, well-photographed listings with accurate stock are what turn searches into orders. Your first customer will appear here as soon as one places an order."
          action={
            <Button asChild>
              <Link href="/supplier/products/new">Add a product</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper label="Your customers, by total ordered">
          <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead numeric>Orders</TableHead>
                    <TableHead numeric>Ordered</TableHead>
                    <TableHead>Last order</TableHead>
                    <TableHead>Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <span className="block font-medium text-foreground">{customer.name}</span>
                        <span className="block text-xs text-foreground-muted">
                          {customer.phone ? (
                            <a href={`tel:${customer.phone}`} className="hover:underline">
                              {customer.phone}
                            </a>
                          ) : (
                            customer.email
                          )}
                        </span>
                      </TableCell>
                      <TableCell numeric>{customer.orderCount}</TableCell>
                      <TableCell numeric>{formatZmw(customer.spendMinor)}</TableCell>
                      <TableCell>
                        {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
                      </TableCell>
                      <TableCell>
                        {customer.openOrders > 0 ? (
                          <Badge tone="warning" size="sm">
                            {customer.openOrders} in progress
                          </Badge>
                        ) : (
                          <span className="text-xs text-foreground-muted">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
          </Table>
        </TableWrapper>
      )}

      <p className="text-xs text-foreground-muted">
        Figures cover every order placed with you, including those still in progress. Contact details
        are shared so you can service an order — not for marketing.
      </p>
    </div>
  );
}
