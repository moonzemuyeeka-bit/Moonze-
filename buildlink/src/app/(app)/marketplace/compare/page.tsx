import type { Metadata } from "next";
import Link from "next/link";
import { Columns3, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { StarRating } from "@/components/ui/star-rating";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { listProductsForComparison } from "@/server/marketplace/queries";
import { formatZmw } from "@/lib/money";
import { PRODUCT_UNIT_SHORT, VERIFICATION_STATUS_LABELS } from "@/lib/labels";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { z } from "zod";

export const metadata: Metadata = {
  title: "Compare products",
  description: "Price, stock, delivery and supplier trust side by side.",
};

/**
 * Side-by-side comparison.
 *
 * A table, transposed so each product is a column: comparing four cement prices
 * means reading across one row, which is the only layout that works for the
 * decision being made. The cheapest price and the best-rated supplier are marked
 * so the answer is visible without reading every cell.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const idsParam = Array.isArray(raw.ids) ? raw.ids[0] : raw.ids;
  const ids = (idsParam ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => z.uuid().safeParse(value).success)
    .slice(0, 4);

  const products = await listProductsForComparison(ids);
  const user = await getCurrentUser();

  if (products.length > 1) {
    await track({
      name: ANALYTICS_EVENTS.productsCompared,
      userId: user?.id ?? null,
      properties: { productCount: products.length },
    });
  }

  if (products.length === 0) {
    return (
      <div>
        <PageHeader
          title="Compare products"
          description="Pick products from a category page to compare them here."
          breadcrumbs={[{ label: "Marketplace", href: "/marketplace" }, { label: "Compare" }]}
        />
        <EmptyState
          icon={Columns3}
          title="Nothing to compare yet"
          description="Open a product and use “Compare these side by side” to line up alternatives from different suppliers."
          action={
            <Button asChild>
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const cheapestMinor = Math.min(...products.map((product) => product.priceMinor));
  const bestRatingBps = Math.max(...products.map((product) => product.supplier.ratingAverageBps));

  return (
    <div>
      <PageHeader
        title="Compare products"
        description={`${products.length} products, cheapest first.`}
        breadcrumbs={[{ label: "Marketplace", href: "/marketplace" }, { label: "Compare" }]}
      />

      <TableWrapper label="Product comparison">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Detail</TableHead>
              {products.map((product) => (
                <TableHead key={product.id} className="min-w-48 normal-case">
                  <Link
                    href={`/marketplace/products/${product.id}`}
                    className="text-sm font-semibold text-foreground hover:text-brand-700 hover:underline"
                  >
                    {product.name}
                  </Link>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Price</TableCell>
              {products.map((product) => (
                <TableCell key={product.id}>
                  <span className="tabular font-semibold">{formatZmw(product.priceMinor)}</span>
                  <span className="text-xs text-foreground-muted">
                    {" "}
                    / {PRODUCT_UNIT_SHORT[product.unit]}
                  </span>
                  {product.priceMinor === cheapestMinor ? (
                    <Badge tone="success" size="sm" className="ml-2">
                      Cheapest
                    </Badge>
                  ) : null}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Brand</TableCell>
              {products.map((product) => (
                <TableCell key={product.id}>{product.brand ?? "—"}</TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Supplier</TableCell>
              {products.map((product) => (
                <TableCell key={product.id}>
                  <Link
                    href={`/marketplace/suppliers/${product.supplier.slug}`}
                    className="font-medium hover:text-brand-700 hover:underline"
                  >
                    {product.supplier.businessName}
                  </Link>
                  {product.supplier.verificationStatus === "VERIFIED" ? (
                    <ShieldCheck
                      aria-label="Verified supplier"
                      className="ml-1 inline size-3.5 text-brand-600"
                    />
                  ) : null}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Verification</TableCell>
              {products.map((product) => (
                <TableCell key={product.id} className="text-xs">
                  {VERIFICATION_STATUS_LABELS[product.supplier.verificationStatus]}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Supplier rating</TableCell>
              {products.map((product) => (
                <TableCell key={product.id}>
                  <StarRating
                    ratingBps={product.supplier.ratingAverageBps}
                    reviewCount={product.supplier.ratingCount}
                    size="sm"
                  />
                  {product.supplier.ratingAverageBps === bestRatingBps && bestRatingBps > 0 ? (
                    <Badge tone="info" size="sm" className="ml-1">
                      Best rated
                    </Badge>
                  ) : null}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Trust score</TableCell>
              {products.map((product) => (
                <TableCell key={product.id} numeric>
                  {product.supplier.trustScore}/100
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Minimum order</TableCell>
              {products.map((product) => (
                <TableCell key={product.id}>
                  {product.minimumOrderQuantity} {PRODUCT_UNIT_SHORT[product.unit]}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">In stock</TableCell>
              {products.map((product) => (
                <TableCell key={product.id}>
                  {product.stockQuantity > 0 ? (
                    `${product.stockQuantity} ${PRODUCT_UNIT_SHORT[product.unit]}`
                  ) : (
                    <Badge tone="danger" size="sm">
                      Out of stock
                    </Badge>
                  )}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Delivery</TableCell>
              {products.map((product) => (
                <TableCell key={product.id}>
                  {product.deliveryAvailable ? "Available" : "Collection only"}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Location</TableCell>
              {products.map((product) => (
                <TableCell key={product.id} className="text-xs">
                  {product.supplier.districtName
                    ? `${product.supplier.districtName}, `
                    : ""}
                  {product.supplier.provinceName}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Open</TableCell>
              {products.map((product) => (
                <TableCell key={product.id}>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/marketplace/products/${product.id}`}>View product</Link>
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableWrapper>

      <p className="mt-4 text-xs text-foreground-subtle">
        Prices are per unit as listed by each supplier and exclude delivery. Delivery is quoted per
        supplier at checkout.
      </p>
    </div>
  );
}
