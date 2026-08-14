import "server-only";
import { db } from "@/lib/db";

/**
 * Review reads.
 *
 * A review is always reached through its order, so the caller has already
 * established who is allowed to see it.
 */

export type ReviewDraft = {
  id: string;
  rating: number;
  productQualityRating: number | null;
  priceRating: number | null;
  deliveryRating: number | null;
  communicationRating: number | null;
  reliabilityRating: number | null;
  comment: string | null;
  amendmentAllowed: boolean;
};

export async function getReviewForOrder(orderId: string): Promise<ReviewDraft | null> {
  return db.review.findUnique({
    where: { orderId },
    select: {
      id: true,
      rating: true,
      productQualityRating: true,
      priceRating: true,
      deliveryRating: true,
      communicationRating: true,
      reliabilityRating: true,
      comment: true,
      amendmentAllowed: true,
    },
  });
}

/** Published reviews for a supplier profile, newest first. */
export async function listSupplierReviews(supplierId: string, take = 10) {
  return db.review.findMany({
    where: { supplierId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
  });
}
