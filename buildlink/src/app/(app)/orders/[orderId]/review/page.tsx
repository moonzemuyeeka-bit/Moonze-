import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/components/ui/timeline";
import { requirePageUser } from "@/lib/auth/guards";
import { getOrderDetail } from "@/server/orders/queries";
import { getReviewForOrder } from "@/server/reviews/queries";
import { NotFoundError } from "@/lib/errors";
import { formatZmw } from "@/lib/money";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = {
  title: "Review your order",
};

/**
 * Review a completed order.
 *
 * Only the customer on a completed order lands here, and only once — a supplier
 * rating is worth something precisely because every review behind it is attached
 * to a real transaction that finished.
 */
export default async function ReviewOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await requirePageUser(`/orders/${orderId}/review`);

  const order = await getOrderDetail(orderId, user).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  if (!order.viewer.isCustomer) redirect(`/orders/${orderId}`);

  const existing = await getReviewForOrder(order.id);
  if (existing && !existing.amendmentAllowed) redirect(`/orders/${orderId}`);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={`Review ${order.supplier.businessName}`}
        description={`Order ${order.orderNumber}${
          order.completedAt ? `, completed ${formatDate(order.completedAt)}` : ""
        } · ${formatZmw(order.totalMinor)}`}
        breadcrumbs={[
          { label: "My orders", href: "/orders" },
          { label: order.orderNumber, href: `/orders/${order.id}` },
          { label: "Review" },
        ]}
      />

      {order.status !== "COMPLETED" ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <Alert tone="info" title="This order is not complete yet">
              You can review a supplier once you have confirmed everything arrived. That way a
              rating always reflects a finished job.
            </Alert>
            <Button asChild variant="outline">
              <Link href={`/orders/${order.id}`}>Back to the order</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-5 sm:p-6">
              <ReviewForm
                orderId={order.id}
                supplierName={order.supplier.businessName}
                {...(existing ? { initial: existing } : {})}
              />
            </CardContent>
          </Card>

          <p className="flex items-start gap-2 text-xs text-foreground-muted">
            <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            Reviews are published with your name and cannot be edited afterwards. BuildLink only
            removes a review if it breaks the community rules — never because a supplier asked.
          </p>
        </>
      )}
    </div>
  );
}
