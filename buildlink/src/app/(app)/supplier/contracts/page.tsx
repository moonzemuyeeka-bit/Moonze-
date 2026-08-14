import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/components/ui/timeline";
import { requirePageSupplier } from "@/lib/auth/guards";
import { listContracts, type ContractListItem } from "@/server/contracts/queries";
import { formatZmw } from "@/lib/money";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONES } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Agreements",
  description: "The written terms behind every order you have taken.",
};

/**
 * Supplier agreements.
 *
 * The ones waiting on this supplier come first. An unanswered agreement is a
 * customer wondering whether their order is real, and BuildLink's whole promise
 * to them is that they will know.
 */
export default async function SupplierContractsPage() {
  const { supplier } = await requirePageSupplier("/supplier/contracts");
  const agreements = await listContracts({ kind: "supplier", supplierId: supplier.id });

  const awaiting = agreements.filter((agreement) => agreement.awaitingMe);
  const rest = agreements.filter((agreement) => !agreement.awaitingMe);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agreements"
        description="Every order comes with an agreement setting out the items, prices, deposit and delivery. Accepting one is how you confirm you will supply."
      />

      {agreements.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No agreements yet"
          description="When a customer places an order with you, BuildLink draws up the agreement and puts it here for you to accept."
          action={
            <Button asChild>
              <Link href="/supplier/products">Check your listings</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {awaiting.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                Waiting for you to accept or reject
              </h2>
              <ul className="space-y-3">
                {awaiting.map((agreement) => (
                  <AgreementRow key={agreement.id} agreement={agreement} highlight />
                ))}
              </ul>
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section className="space-y-3">
              {awaiting.length > 0 ? (
                <h2 className="text-sm font-semibold text-foreground">Everything else</h2>
              ) : null}
              <ul className="space-y-3">
                {rest.map((agreement) => (
                  <AgreementRow key={agreement.id} agreement={agreement} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <p className="text-xs text-foreground-muted">
        A BuildLink agreement records what was agreed. It is not a lawyer-drafted contract; for
        high-value supply, have one prepared by a qualified legal practitioner.
      </p>
    </div>
  );
}

function AgreementRow({
  agreement,
  highlight,
}: {
  agreement: ContractListItem;
  highlight?: boolean;
}) {
  return (
    <li>
      <Card className={highlight ? "border-gold-300 bg-gold-50/40" : undefined}>
        <CardContent className="p-4 sm:p-5">
          <Link href={`/agreements/${agreement.id}`} className="block space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{agreement.customerName}</p>
                <p className="text-xs text-foreground-muted">
                  {agreement.contractNumber}
                  {agreement.orderNumber ? ` · order ${agreement.orderNumber}` : ""}
                </p>
              </div>
              <Badge tone={CONTRACT_STATUS_TONES[agreement.status]}>
                {CONTRACT_STATUS_LABELS[agreement.status]}
              </Badge>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-xs text-foreground-muted">
                {agreement.itemCount} {agreement.itemCount === 1 ? "line" : "lines"} ·{" "}
                {agreement.sentAt
                  ? `sent ${formatDate(agreement.sentAt)}`
                  : `drawn up ${formatDate(agreement.createdAt)}`}
                {agreement.respondedAt ? ` · answered ${formatDate(agreement.respondedAt)}` : ""}
              </p>
              <p className="tabular text-base font-semibold">{formatZmw(agreement.totalMinor)}</p>
            </div>

            {agreement.awaitingMe ? (
              <p className="text-xs font-medium text-gold-800">
                Read it and accept or reject it →
              </p>
            ) : null}
          </Link>
        </CardContent>
      </Card>
    </li>
  );
}
