import "server-only";
import { db, type DatabaseClient } from "@/lib/db";
import { ratingToBasisPoints } from "@/lib/money";

/**
 * Supplier rating aggregate.
 *
 * Recomputed from the published reviews rather than nudged incrementally: a
 * hidden review, an amended rating or a deleted account would all leave a
 * running average subtly wrong, and a supplier's rating is the number customers
 * trust most.
 */
export async function recalculateSupplierRating(
  supplierId: string,
  client: DatabaseClient = db,
): Promise<{ ratingAverageBps: number; ratingCount: number }> {
  const aggregate = await client.review.aggregate({
    where: { supplierId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const ratingCount = aggregate._count._all;
  const ratingAverageBps = ratingCount > 0 ? ratingToBasisPoints(aggregate._avg.rating ?? 0) : 0;

  await client.supplierProfile.update({
    where: { id: supplierId },
    data: { ratingAverageBps, ratingCount },
  });

  return { ratingAverageBps, ratingCount };
}
