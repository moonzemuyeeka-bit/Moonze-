import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StarRating } from "@/components/ui/star-rating";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { formatTimestamp } from "@/components/ui/timeline";
import { requirePageAdmin } from "@/lib/auth/guards";
import { ADMIN_PAGE_SIZE, listReviewsForAdmin } from "@/server/admin/queries";
import { ratingToBasisPoints } from "@/lib/money";
import {
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_TONES,
} from "@/lib/labels";
import { ReviewModerationControls } from "./review-moderation";
import type { ReviewStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Reviews",
  description: "What customers said about suppliers, and what BuildLink has moderated.",
};

function asStatus(value: string | undefined): ReviewStatus | "" {
  return REVIEW_STATUSES.find((status) => status === value) ?? "";
}

/**
 * Review moderation.
 *
 * Reported reviews come first because they are the only ones anyone is waiting
 * on. The rest of the list exists so an administrator can find a specific review
 * a supplier has complained about, and see the decision that was made on it.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/reviews");
  const params = await searchParams;

  const status = asStatus(typeof params.status === "string" ? params.status : undefined);
  const page = parsePage(params.page);

  const { reviews, total, pageCount } = await listReviewsForAdmin({
    status: status || undefined,
    page,
  });

  function hrefFor(next: { status?: ReviewStatus | ""; page?: number }): string {
    const query = new URLSearchParams();
    const targetStatus = next.status ?? status;
    if (targetStatus) query.set("status", targetStatus);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const suffix = query.toString();
    return suffix ? `/admin/reviews?${suffix}` : "/admin/reviews";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reviews"
        description="Every rating a customer has left, and the moderation decisions on them."
      />

      <Alert tone="info" title="Only verified buyers can review">
        A review can only be written by the customer on a completed order, so there are no anonymous
        ratings to police here. Hiding one is for abuse or personal information — not for being
        unflattering.
      </Alert>

      <nav aria-label="Filter reviews" className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={status === "" ? "secondary" : "ghost"}>
          <Link href={hrefFor({ status: "", page: 1 })}>All reviews</Link>
        </Button>
        {REVIEW_STATUSES.map((option) => (
          <Button
            key={option}
            asChild
            size="sm"
            variant={status === option ? "secondary" : "ghost"}
          >
            <Link href={hrefFor({ status: option, page: 1 })}>
              {REVIEW_STATUS_LABELS[option]}
            </Link>
          </Button>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title={status === "" ? "No review has been left yet" : "Nothing in this view"}
          description={
            status === ""
              ? "Reviews appear here once customers start completing orders and rating the suppliers who served them."
              : "Try another status."
          }
          action={
            status === "" ? null : (
              <Button asChild variant="outline">
                <Link href={hrefFor({ status: "", page: 1 })}>Show every review</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StarRating
                          ratingBps={ratingToBasisPoints(review.rating)}
                          size="sm"
                          showCount={false}
                        />
                        <Badge tone={REVIEW_STATUS_TONES[review.status]} size="sm">
                          {REVIEW_STATUS_LABELS[review.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground-muted">
                        {review.customer.name} on{" "}
                        <Link
                          href={`/admin/suppliers/${review.supplier.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {review.supplier.businessName}
                        </Link>{" "}
                        ·{" "}
                        <Link href={`/orders/${review.order.id}`} className="hover:underline">
                          {review.order.orderNumber}
                        </Link>{" "}
                        · {formatTimestamp(review.createdAt)}
                      </p>
                    </div>
                    <ReviewModerationControls
                      reviewId={review.id}
                      isHidden={review.status === "HIDDEN"}
                      amendmentAllowed={review.amendmentAllowed}
                    />
                  </div>

                  {review.comment ? (
                    <p className="whitespace-pre-line text-sm text-foreground">{review.comment}</p>
                  ) : (
                    <p className="text-sm text-foreground-subtle">
                      Rating only — no comment was written.
                    </p>
                  )}

                  {review.hiddenReason ? (
                    <p className="text-xs text-foreground-muted">
                      Hidden because: {review.hiddenReason}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {reviews.length > 0 ? (
        <Pagination
          page={page}
          totalPages={pageCount}
          totalCount={total}
          pageSize={ADMIN_PAGE_SIZE}
          itemNoun="review"
          buildHref={(target) => hrefFor({ page: target })}
        />
      ) : null}
    </div>
  );
}
