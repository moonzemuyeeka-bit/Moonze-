import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/components/ui/timeline";
import { requirePagePermission } from "@/lib/auth/guards";
import { listContracts } from "@/server/contracts/queries";
import { formatZmw } from "@/lib/money";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONES } from "@/lib/labels";

export const metadata: Metadata = {
  title: "My agreements",
  description: "Every agreement between you and a supplier, and which ones need your response.",
};

/**
 * Customer agreements.
 *
 * Sorted so the ones waiting on this customer come first: an agreement nobody
 * responds to is an order that never happens, and the list should make that
 * impossible to miss.
 */
export default async function CustomerContractsPage() {
  const user = await requirePagePermission("contract:respond_as_customer", "/customer/contracts");
  const agreements = await listContracts({ kind: "customer", userId: user.id });

  const awaiting = agreements.filter((agreement) => agreement.awaitingMe);
  const rest = agreements.filter((agreement) => !agreement.awaitingMe);

  return (
    <div className="space-y-5">
      <PageHeader
        title="My agreements"
        description="Each order creates an agreement recording the items, prices, deposit and terms you and the supplier settled on."
      />

      {agreements.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No agreements yet"
          description="When you place an order, BuildLink draws up an agreement with that supplier and puts it here."
          action={
            <Button asChild>
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {awaiting.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Waiting for your response</h2>
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
        A BuildLink agreement is a record of what was agreed, not a lawyer-drafted contract. For
        high-value work, have one prepared by a qualified legal practitioner.
      </p>
    </div>
  );
}

function AgreementRow({
  agreement,
  highlight,
}: {
  agreement: Awaited<ReturnType<typeof listContracts>>[number];
  highlight?: boolean;
}) {
  return (
    <li>
      <Card className={highlight ? "border-gold-300 bg-gold-50/40" : undefined}>
        <CardContent className="p-4 sm:p-5">
          <Link href={`/agreements/${agreement.id}`} className="block space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{agreement.supplierName}</p>
                <p className="text-xs text-foreground-muted">
                  {agreement.contractNumber}
                  {agreement.orderNumber ? ` · order ${agreement.orderNumber}` : ""}
                  {agreement.projectName ? ` · ${agreement.projectName}` : ""}
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
