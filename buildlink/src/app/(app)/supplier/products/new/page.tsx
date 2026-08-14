import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { requirePageSupplier } from "@/lib/auth/guards";
import { getCategories } from "@/server/reference/queries";
import { ProductForm } from "../product-form";

export const metadata: Metadata = {
  title: "Add a product",
  description: "List a material for sale on BuildLink.",
};

export default async function NewProductPage() {
  const { supplier } = await requirePageSupplier("/supplier/products/new");
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Add a product"
        description="One listing per thing you sell, priced per unit. Photographs and stock come next."
        breadcrumbs={[
          { label: "Products", href: "/supplier/products" },
          { label: "Add a product" },
        ]}
      />

      {supplier.verificationStatus !== "VERIFIED" ? (
        <Alert tone="info" title="You can list before you are verified">
          Your listings still go live once BuildLink approves them. Verified businesses simply rank
          higher and win more orders, so upload your documents when you have a moment.
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-5 sm:p-6">
          <ProductForm categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
