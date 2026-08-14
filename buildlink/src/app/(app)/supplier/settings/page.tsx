import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { requirePageSupplier } from "@/lib/auth/guards";
import { getSupplierSettings } from "@/server/suppliers/queries";
import { getCategories, getProvinces } from "@/server/reference/queries";
import { fileUrl } from "@/lib/services/storage";
import { basisPointsToPercent } from "@/lib/money";
import { SUBSCRIPTION_TIER_LABELS } from "@/lib/labels";
import { SupplierLogoForm } from "./logo-form";
import { SupplierSettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Business settings",
  description: "Your business details, categories and delivery terms.",
};

/**
 * Supplier business settings.
 *
 * Everything on this page is what a customer sees or is quoted, so it is worth a
 * supplier's time to get right: the description, the categories they will be
 * found under, and the delivery terms they will be held to.
 */
export default async function SupplierSettingsPage() {
  const { supplier: context } = await requirePageSupplier("/supplier/settings");

  const [supplier, provinces, categories] = await Promise.all([
    getSupplierSettings(context.id),
    getProvinces(),
    getCategories(),
  ]);

  const logoUrl = fileUrl(supplier.logoKey);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Business settings"
        description="How your business appears to customers, and the terms they are quoted at checkout."
        actions={
          <Button asChild variant="outline">
            <Link href={`/marketplace/suppliers/${supplier.slug}`}>
              <ExternalLink />
              View public profile
            </Link>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{SUBSCRIPTION_TIER_LABELS[supplier.subscriptionTier]} plan</Badge>
          {supplier.isDemo ? <Badge tone="neutral">Demonstration business</Badge> : null}
          {supplier.commissionRateBps !== null ? (
            <span className="text-xs text-foreground-muted">
              Commission {basisPointsToPercent(supplier.commissionRateBps).toFixed(1)}% per order
            </span>
          ) : null}
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Your picture
          </CardTitle>
          <CardDescription>
            Shown on your profile and beside your listings in search results.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-muted">
            {logoUrl ? (
              <Image src={logoUrl} alt="" fill sizes="6rem" className="object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-ink-300">
                <Store aria-hidden className="size-7" />
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <SupplierLogoForm />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <SupplierSettingsForm
            provinces={provinces}
            categories={categories}
            supplier={{
              businessName: supplier.businessName,
              description: supplier.description,
              phone: supplier.phone,
              email: supplier.email,
              provinceId: supplier.provinceId,
              districtId: supplier.districtId,
              address: supplier.address,
              yearsOperating: supplier.yearsOperating,
              registrationNumber: supplier.registrationNumber,
              taxpayerNumber: supplier.taxpayerNumber,
              deliveryAvailable: supplier.deliveryAvailable,
              deliveryNotes: supplier.deliveryNotes,
              minimumOrderMinor: supplier.minimumOrderMinor,
              deliveryBaseFeeMinor: supplier.deliveryBaseFeeMinor,
              deliveryFreeAboveMinor: supplier.deliveryFreeAboveMinor,
              categoryIds: supplier.categories.map((category) => category.id),
            }}
          />
        </CardContent>
      </Card>

      <Alert tone="info" hideIcon>
        Changing your registration number sends it back to BuildLink for verification. Your documents
        live in{" "}
        <Link href="/supplier/verification" className="font-semibold underline">
          verification
        </Link>
        , and your login and password in{" "}
        <Link href="/account" className="font-semibold underline">
          account settings
        </Link>
        .
      </Alert>
    </div>
  );
}
