import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ExternalLink, Eye, ImageOff, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatDate } from "@/components/ui/timeline";
import { requirePageSupplier } from "@/lib/auth/guards";
import { getSupplierProduct } from "@/server/suppliers/queries";
import { getCategories } from "@/server/reference/queries";
import { NotFoundError } from "@/lib/errors";
import { formatZmw } from "@/lib/money";
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES, PRODUCT_UNIT_SHORT } from "@/lib/labels";
import { ProductForm } from "../product-form";
import { ProductImageUpload, ProductStatusForms, RemoveImageForm, StockDialog } from "../product-actions";

export const metadata: Metadata = {
  title: "Edit product",
};

/**
 * One listing.
 *
 * The form, the photographs and the status controls sit on one page because a
 * supplier fixing a listing usually needs more than one of them, and a wizard
 * would make them hunt.
 */
export default async function SupplierProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { productId } = await params;
  const query = await searchParams;
  const { supplier } = await requirePageSupplier(`/supplier/products/${productId}`);

  const [product, categories] = await Promise.all([
    getSupplierProduct(productId, supplier.id).catch((error: unknown) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }),
    getCategories(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={product.name}
        description={`${product.category.name} · ${formatZmw(product.priceMinor)} per ${PRODUCT_UNIT_SHORT[product.unit]} · added ${formatDate(product.createdAt)}`}
        breadcrumbs={[
          { label: "Products", href: "/supplier/products" },
          { label: product.name },
        ]}
        actions={
          product.status === "ACTIVE" ? (
            <Button asChild variant="outline">
              <Link href={`/marketplace/products/${product.id}`}>
                <ExternalLink />
                View as a customer
              </Link>
            </Button>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PRODUCT_STATUS_TONES[product.status]}>
            {PRODUCT_STATUS_LABELS[product.status]}
          </Badge>
          <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <Eye aria-hidden className="size-3.5" />
            {product.viewCount} view{product.viewCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <ShoppingBag aria-hidden className="size-3.5" />
            {product.orderedCount} order line{product.orderedCount === 1 ? "" : "s"}
          </span>
        </div>
      </PageHeader>

      {query.created === "1" ? (
        <Alert tone="success" title="Listing created">
          Add a photograph or two below — listings with photographs get far more enquiries. BuildLink
          will review the listing before customers can see it.
        </Alert>
      ) : null}

      {product.status === "REJECTED" && product.rejectionReason ? (
        <Alert tone="danger" title="BuildLink could not approve this listing">
          {product.rejectionReason} Make the change and send it for approval again.
        </Alert>
      ) : null}

      {product.status === "PENDING_APPROVAL" ? (
        <Alert tone="info" title="Waiting for approval">
          Customers cannot see this listing yet. You can keep editing it while it waits.
        </Alert>
      ) : null}

      {product.status === "ACTIVE" && product.stockQuantity <= 0 ? (
        <Alert tone="warning" title="This listing is live but out of stock">
          Nobody can buy it until you record stock. Update the figure, or hide the listing until you
          restock.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Listing details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm
              categories={categories}
              product={{
                id: product.id,
                name: product.name,
                brand: product.brand,
                description: product.description,
                categoryId: product.categoryId,
                unit: product.unit,
                priceMinor: product.priceMinor,
                minimumOrderQuantity: product.minimumOrderQuantity,
                stockQuantity: product.stockQuantity,
                lowStockThreshold: product.lowStockThreshold,
                deliveryAvailable: product.deliveryAvailable,
                status: product.status,
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Stock
              </CardTitle>
              <CardDescription>
                {product.stockQuantity} {PRODUCT_UNIT_SHORT[product.unit]}
                {product.stockQuantity === 1 ? "" : "s"} on hand
                {product.inventory?.quantityReserved
                  ? `, ${product.inventory.quantityReserved} committed to open orders`
                  : ""}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <StockDialog
                productId={product.id}
                productName={product.name}
                stockQuantity={product.stockQuantity}
                unit={product.unit}
              />
              {product.inventory?.restockedAt ? (
                <p className="text-xs text-foreground-muted">
                  Last restocked {formatDate(product.inventory.restockedAt)}.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Photographs
              </CardTitle>
              <CardDescription>{product.images.length} of 6 used.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {product.images.length === 0 ? (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-foreground-muted">
                  <ImageOff aria-hidden className="size-4" />
                  No photographs yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {product.images.map((image) => (
                    <li
                      key={image.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-2"
                    >
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                        {image.url ? (
                          <Image
                            src={image.url}
                            alt={image.altText ?? ""}
                            fill
                            sizes="3.5rem"
                            className="object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 text-xs text-foreground-muted">
                        {image.altText ?? "No description"}
                      </span>
                      <RemoveImageForm imageId={image.id} />
                    </li>
                  ))}
                </ul>
              )}

              {product.images.length < 6 ? <ProductImageUpload productId={product.id} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Availability
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProductStatusForms productId={product.id} status={product.status} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
