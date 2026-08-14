import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, FileText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { formatDate } from "@/components/ui/timeline";
import { requirePageSupplier } from "@/lib/auth/guards";
import { getSupplierVerification } from "@/server/suppliers/queries";
import {
  BUSINESS_REGISTRATION_STATUS_LABELS,
  DOCUMENT_REVIEW_STATUS_LABELS,
  DOCUMENT_REVIEW_STATUS_TONES,
  SUPPLIER_DOCUMENT_TYPE_HINTS,
  SUPPLIER_DOCUMENT_TYPE_LABELS,
  VERIFICATION_STATUS_EXPLAINERS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUS_TONES,
} from "@/lib/labels";
import { DocumentUploadForm, RemoveDocumentForm } from "./verification-forms";
import type { SupplierDocumentType } from "@prisma/client";

export const metadata: Metadata = {
  title: "Verification",
  description: "Send BuildLink your registration documents and follow the review.",
};

/**
 * The documents BuildLink asks for, and why.
 *
 * These three are what a customer sending money to a business they have never
 * met actually needs checked: that the company exists, that it is tax-registered,
 * and that a real, identifiable person stands behind it.
 */
const REQUIRED_DOCUMENTS: SupplierDocumentType[] = [
  "BUSINESS_REGISTRATION_CERTIFICATE",
  "TAX_CLEARANCE",
  "DIRECTOR_IDENTIFICATION",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Supplier verification.
 *
 * The page is honest about what verification does and does not mean: BuildLink
 * checks that documents exist and match the business, not that the business is
 * good at its job. Overstating it would be selling the customer a guarantee we
 * cannot make.
 */
export default async function SupplierVerificationPage() {
  const { supplier: context } = await requirePageSupplier("/supplier/verification");
  const { supplier, documents, verifications } = await getSupplierVerification(context.id);

  const uploadedTypes = new Set(documents.map((document) => document.type));
  const outstanding = REQUIRED_DOCUMENTS.filter((type) => !uploadedTypes.has(type));
  const rejected = documents.filter((document) => document.reviewStatus === "REJECTED");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Verification"
        description="A verified badge tells a customer that BuildLink has seen this business's registration documents. It is the single biggest lever on your trust score."
        actions={
          <Badge tone={VERIFICATION_STATUS_TONES[supplier.verificationStatus]} size="md">
            {VERIFICATION_STATUS_LABELS[supplier.verificationStatus]}
          </Badge>
        }
      />

      {supplier.isSuspended ? (
        <Alert tone="danger" title="Trading is suspended">
          {supplier.suspendedReason ??
            "BuildLink has suspended this business while an issue is reviewed."}{" "}
          Contact BuildLink support before uploading anything further.
        </Alert>
      ) : null}

      <Alert
        tone={
          supplier.verificationStatus === "VERIFIED"
            ? "success"
            : supplier.verificationStatus === "REJECTED"
              ? "danger"
              : "info"
        }
        title={VERIFICATION_STATUS_LABELS[supplier.verificationStatus]}
      >
        {VERIFICATION_STATUS_EXPLAINERS[supplier.verificationStatus]}
        {supplier.verifiedAt ? ` Verified ${formatDate(supplier.verifiedAt)}.` : ""}
      </Alert>

      {rejected.length > 0 ? (
        <Alert tone="warning" title="Some documents need replacing">
          {rejected.length === 1
            ? "One document could not be accepted."
            : `${rejected.length} documents could not be accepted.`}{" "}
          The reason is beside each one below — remove it and upload a replacement.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2 text-base">
            <ShieldCheck aria-hidden className="size-4 text-brand-700" />
            What BuildLink needs
          </CardTitle>
          <CardDescription>
            {outstanding.length === 0
              ? "You have sent all three. BuildLink reviews them in the order received."
              : `${outstanding.length} of ${REQUIRED_DOCUMENTS.length} still to send.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {REQUIRED_DOCUMENTS.map((type) => {
              const held = uploadedTypes.has(type);
              return (
                <li key={type} className="flex items-start gap-3">
                  {held ? (
                    <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success-600" />
                  ) : (
                    <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-300" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {SUPPLIER_DOCUMENT_TYPE_LABELS[type]}
                      <span className="sr-only">{held ? " — received" : " — not yet sent"}</span>
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {SUPPLIER_DOCUMENT_TYPE_HINTS[type]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 space-y-1 border-t border-border pt-4 text-xs text-foreground-muted">
            <p>
              Registration on file: {BUSINESS_REGISTRATION_STATUS_LABELS[supplier.businessRegistrationStatus]}
              {supplier.registrationNumber ? ` · ${supplier.registrationNumber}` : ""}
              {supplier.taxpayerNumber ? ` · TPIN ${supplier.taxpayerNumber}` : ""}
            </p>
            <p>
              Registration and TPIN numbers are edited in{" "}
              <Link href="/supplier/settings" className="font-medium underline">
                business settings
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Your documents
          </CardTitle>
          <CardDescription>
            {documents.length === 0
              ? "Nothing uploaded yet."
              : `${documents.length} document${documents.length === 1 ? "" : "s"} on file. Only BuildLink reviewers can open them.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {documents.length > 0 ? (
            <ul className="space-y-2">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3"
                >
                  <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground-muted" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {SUPPLIER_DOCUMENT_TYPE_LABELS[document.type]}
                    </p>
                    <p className="truncate text-xs text-foreground-muted">
                      <a href={document.url} className="hover:underline" target="_blank" rel="noreferrer">
                        {document.fileName}
                      </a>{" "}
                      · {formatBytes(document.sizeBytes)} · sent {formatDate(document.createdAt)}
                    </p>
                    {document.reviewNote ? (
                      <p
                        className={
                          document.reviewStatus === "REJECTED"
                            ? "text-xs text-danger-700"
                            : "text-xs text-foreground-muted"
                        }
                      >
                        {document.reviewNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={DOCUMENT_REVIEW_STATUS_TONES[document.reviewStatus]} size="sm">
                      {DOCUMENT_REVIEW_STATUS_LABELS[document.reviewStatus]}
                    </Badge>
                    {document.reviewStatus === "APPROVED" ? null : (
                      <RemoveDocumentForm
                        documentId={document.id}
                        documentLabel={SUPPLIER_DOCUMENT_TYPE_LABELS[document.type]}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="rounded-xl border border-dashed border-border p-4">
            <DocumentUploadForm defaultType={outstanding[0]} />
          </div>
        </CardContent>
      </Card>

      {verifications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Review history
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {verifications.map((review) => (
                <li key={review.id} className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Submitted {formatDate(review.submittedAt)}
                      {review.reviewedAt ? ` · reviewed ${formatDate(review.reviewedAt)}` : ""}
                    </p>
                    {review.decisionNote ? (
                      <p className="text-xs text-foreground-muted">{review.decisionNote}</p>
                    ) : null}
                  </div>
                  <Badge tone={VERIFICATION_STATUS_TONES[review.status]} size="sm">
                    {VERIFICATION_STATUS_LABELS[review.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-foreground-muted">
        Verification means BuildLink has seen documents showing this business is registered and that a
        named director stands behind it. It is not a guarantee of workmanship, stock or price, and
        customers are told so.
      </p>
    </div>
  );
}
