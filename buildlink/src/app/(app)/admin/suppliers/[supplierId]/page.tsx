import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Mail, MapPin, Phone, Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/controls";
import { formatDate, formatTimestamp } from "@/components/ui/timeline";
import { requirePageAdmin } from "@/lib/auth/guards";
import { getSupplierForAdmin } from "@/server/admin/queries";
import { getPlatformSettings } from "@/server/reference/queries";
import { NotFoundError } from "@/lib/errors";
import { TRUST_BAND_LABELS } from "@/lib/domain/trust-score";
import { formatRating, formatZmw } from "@/lib/money";
import {
  BUSINESS_REGISTRATION_STATUS_LABELS,
  DOCUMENT_REVIEW_STATUS_LABELS,
  DOCUMENT_REVIEW_STATUS_TONES,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONES,
  SUBSCRIPTION_TIER_LABELS,
  SUPPLIER_DOCUMENT_TYPE_LABELS,
  USER_STATUS_LABELS,
  VERIFICATION_STATUS_EXPLAINERS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUS_TONES,
} from "@/lib/labels";
import {
  CommercialsForm,
  DocumentDecisionForms,
  SuspendSupplierDialog,
  VerificationDecisionForms,
} from "./supplier-actions";

export const metadata: Metadata = {
  title: "Supplier",
};

/**
 * One business, with everything a verification decision needs on one screen.
 *
 * The documents come first and the trading record sits beside them, because the
 * question is never just "is this paperwork real?" but "should a customer in
 * Kabwe trust this business with ZMW 40,000?".
 */
export default async function AdminSupplierPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;
  await requirePageAdmin(`/admin/suppliers/${supplierId}`);

  const [supplier, settings] = await Promise.all([
    getSupplierForAdmin(supplierId).catch((error: unknown) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }),
    getPlatformSettings(),
  ]);

  const approvedDocuments = supplier.documents.filter(
    (document) => document.reviewStatus === "APPROVED",
  ).length;
  const pendingDocuments = supplier.documents.filter(
    (document) => document.reviewStatus === "PENDING",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.businessName}
        description={`${supplier.user.name} · registered ${formatDate(supplier.createdAt)}.`}
        breadcrumbs={[
          { label: "Suppliers", href: "/admin/suppliers" },
          { label: supplier.businessName },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={VERIFICATION_STATUS_TONES[supplier.verificationStatus]} size="md">
              {VERIFICATION_STATUS_LABELS[supplier.verificationStatus]}
            </Badge>
            <SuspendSupplierDialog
              supplierId={supplier.id}
              businessName={supplier.businessName}
              isSuspended={supplier.isSuspended}
            />
            <Button asChild variant="ghost" size="sm">
              <Link href={`/marketplace/suppliers/${supplier.slug}`}>
                <ExternalLink aria-hidden />
                Public profile
              </Link>
            </Button>
          </div>
        }
      />

      {supplier.isSuspended ? (
        <Alert tone="danger" title="Trading is suspended">
          {supplier.suspendedReason ?? "No reason was recorded."}
        </Alert>
      ) : null}

      {supplier.isDemo ? (
        <Alert tone="warning" title="Demo business">
          This business is seeded demonstration data. Its prices are indicative, not live market
          prices.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Trust score"
          value={`${supplier.trust.score}/100`}
          hint={TRUST_BAND_LABELS[supplier.trust.band]}
          tone="brand"
        >
          <Progress value={supplier.trust.score} label="Trust score" />
        </StatCard>
        <StatCard
          label="Goods sold"
          value={formatZmw(supplier.revenueMinor)}
          hint={`${supplier.completedOrders} of ${supplier.totalOrders} orders completed`}
        />
        <StatCard
          label="Rating"
          value={
            supplier.ratingCount === 0 ? "—" : `${formatRating(supplier.ratingAverageBps)} / 5`
          }
          hint={`${supplier.ratingCount} review${supplier.ratingCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Disputes"
          value={supplier.disputes.open}
          hint={`${supplier.disputes.resolved} resolved`}
          tone={supplier.disputes.open > 0 ? "danger" : "default"}
          href="/admin/disputes"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Documents
              </CardTitle>
              <CardDescription>
                {supplier.documents.length === 0
                  ? "Nothing has been uploaded yet."
                  : `${approvedDocuments} accepted, ${pendingDocuments} awaiting review.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {supplier.documents.length === 0 ? (
                <p className="text-sm text-foreground-muted">
                  This business cannot be verified until it uploads its registration documents. It
                  can still trade, and customers see that BuildLink has not checked it.
                </p>
              ) : (
                <ul className="space-y-3">
                  {supplier.documents.map((document) => (
                    <li key={document.id} className="space-y-3 rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <FileText aria-hidden className="size-3.5 text-foreground-muted" />
                            {SUPPLIER_DOCUMENT_TYPE_LABELS[document.type]}
                          </p>
                          <p className="text-xs text-foreground-muted">
                            {document.fileName} ·{" "}
                            {Math.max(1, Math.round(document.sizeBytes / 1024))} KB · uploaded{" "}
                            {formatDate(document.createdAt)}
                          </p>
                        </div>
                        <Badge tone={DOCUMENT_REVIEW_STATUS_TONES[document.reviewStatus]} size="sm">
                          {DOCUMENT_REVIEW_STATUS_LABELS[document.reviewStatus]}
                        </Badge>
                      </div>

                      {document.mimeType.startsWith("image/") ? (
                        <Image
                          src={document.url}
                          alt={`${SUPPLIER_DOCUMENT_TYPE_LABELS[document.type]} uploaded by ${supplier.businessName}`}
                          width={520}
                          height={340}
                          className="max-h-72 w-auto rounded-lg border border-border object-contain"
                        />
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <a href={document.url} target="_blank" rel="noreferrer">
                            <ExternalLink aria-hidden />
                            Open the file
                          </a>
                        </Button>
                        <DocumentDecisionForms
                          documentId={document.id}
                          reviewStatus={document.reviewStatus}
                        />
                      </div>

                      {document.reviewNote ? (
                        <p className="text-xs text-foreground-muted">
                          <span className="font-medium text-foreground">Note: </span>
                          {document.reviewNote}
                          {document.reviewedBy ? ` — ${document.reviewedBy.name}` : ""}
                          {document.reviewedAt ? `, ${formatDate(document.reviewedAt)}` : ""}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Business details as declared
              </CardTitle>
              <CardDescription>
                {BUSINESS_REGISTRATION_STATUS_LABELS[supplier.businessRegistrationStatus]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Detail label="PACRA registration number" value={supplier.registrationNumber} />
                <Detail label="ZRA taxpayer number" value={supplier.taxpayerNumber} />
                <Detail
                  label="Years operating"
                  value={supplier.yearsOperating ? String(supplier.yearsOperating) : null}
                />
                <Detail
                  label="Location"
                  value={
                    supplier.district?.name
                      ? `${supplier.district.name}, ${supplier.province.name}`
                      : supplier.province.name
                  }
                />
                <Detail label="Trading address" value={supplier.address} />
                <Detail
                  label="Categories supplied"
                  value={
                    supplier.categories.length === 0
                      ? null
                      : supplier.categories.map((category) => category.name).join(", ")
                  }
                />
                <Detail
                  label="Delivery"
                  value={
                    supplier.deliveryAvailable
                      ? "Delivers to customers"
                      : "Collection from the yard only"
                  }
                />
                <Detail
                  label="Minimum order"
                  value={
                    supplier.minimumOrderMinor > 0
                      ? formatZmw(supplier.minimumOrderMinor)
                      : "No minimum"
                  }
                />
              </dl>

              {supplier.description ? (
                <p className="mt-4 rounded-lg bg-surface-muted p-3 text-sm text-foreground-muted">
                  {supplier.description}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Commercial terms
              </CardTitle>
              <CardDescription>
                Currently {SUBSCRIPTION_TIER_LABELS[supplier.subscriptionTier]}
                {supplier.commissionRateBps === null
                  ? " on the platform default commission rate."
                  : ` on a ${(supplier.commissionRateBps / 100).toFixed(2)}% commission override.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CommercialsForm
                supplierId={supplier.id}
                subscriptionTier={supplier.subscriptionTier}
                commissionRateBps={supplier.commissionRateBps}
                defaultRateBps={Number(settings["commission.default_rate_bps"])}
                commissionEnabled={settings["commission.enabled"] === true}
              />
            </CardContent>
          </Card>

          {supplier.verifications.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  Verification history
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border text-sm">
                  {supplier.verifications.map((review) => (
                    <li key={review.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge tone={VERIFICATION_STATUS_TONES[review.status]} size="sm">
                          {VERIFICATION_STATUS_LABELS[review.status]}
                        </Badge>
                        <span className="text-xs text-foreground-muted">
                          Submitted {formatDate(review.submittedAt)}
                          {review.reviewedAt
                            ? ` · decided ${formatTimestamp(review.reviewedAt)}`
                            : " · not yet decided"}
                          {review.reviewedBy ? ` by ${review.reviewedBy.name}` : ""}
                        </span>
                      </div>
                      {review.decisionNote ? (
                        <p className="text-xs text-foreground-muted">{review.decisionNote}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Verification decision
              </CardTitle>
              <CardDescription>
                {VERIFICATION_STATUS_EXPLAINERS[supplier.verificationStatus]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VerificationDecisionForms
                supplierId={supplier.id}
                businessName={supplier.businessName}
                approvedDocuments={approvedDocuments}
                isVerified={supplier.verificationStatus === "VERIFIED"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Owner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {supplier.logoUrl ? (
                <Image
                  src={supplier.logoUrl}
                  alt={`${supplier.businessName} logo`}
                  width={120}
                  height={120}
                  className="size-16 rounded-lg border border-border object-contain"
                />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border-strong text-ink-300">
                  <Store aria-hidden className="size-6" />
                </span>
              )}
              <p className="font-medium">{supplier.user.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                <Mail aria-hidden className="size-3.5" />
                <a href={`mailto:${supplier.email}`} className="hover:underline">
                  {supplier.email}
                </a>
              </p>
              <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                <Phone aria-hidden className="size-3.5" />
                <a href={`tel:${supplier.phone}`} className="hover:underline">
                  {supplier.phone}
                </a>
              </p>
              <p className="flex items-start gap-1.5 text-xs text-foreground-muted">
                <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {supplier.district?.name
                  ? `${supplier.district.name}, ${supplier.province.name}`
                  : supplier.province.name}
              </p>
              <p className="text-xs text-foreground-muted">
                Account status: {USER_STATUS_LABELS[supplier.user.status]}
              </p>
              <Button asChild size="sm" variant="outline" block>
                <Link href={`/admin/users/${supplier.user.id}`}>Open the account</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Recent listings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.products.length === 0 ? (
                <p className="text-sm text-foreground-muted">Nothing listed yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {supplier.products.map((product) => (
                    <li key={product.id} className="flex items-start justify-between gap-2">
                      <Link
                        href={`/marketplace/products/${product.id}`}
                        className="min-w-0 flex-1 truncate hover:text-brand-700 hover:underline"
                      >
                        {product.name}
                      </Link>
                      <Badge tone={PRODUCT_STATUS_TONES[product.status]} size="sm">
                        {PRODUCT_STATUS_LABELS[product.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild size="sm" variant="ghost" className="mt-3" block>
                <Link href={`/admin/products?q=${encodeURIComponent(supplier.businessName)}`}>
                  All their listings
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                How the trust score is made up
              </p>
              <ul className="space-y-1 text-xs text-foreground-muted">
                {supplier.trust.factors.map((factor) => (
                  <li key={factor.label} className="flex items-baseline justify-between gap-2">
                    <span>{factor.label}</span>
                    <span className="tabular font-medium text-foreground">
                      {factor.points}/{factor.maxPoints}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        {label}
      </dt>
      <dd className="text-sm text-foreground">
        {value ?? <span className="text-foreground-subtle">Not provided</span>}
      </dd>
    </div>
  );
}
