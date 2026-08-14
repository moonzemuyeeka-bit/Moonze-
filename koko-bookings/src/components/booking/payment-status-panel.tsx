"use client";

import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatKwacha } from "@/lib/money";
import type { PaymentDto } from "@/types";

const STATUS_TONE: Record<
  PaymentDto["status"],
  { tone: "info" | "success" | "warning" | "danger"; label: string }
> = {
  PENDING: { tone: "info", label: "Pending" },
  PROCESSING: { tone: "info", label: "Processing" },
  SUCCESSFUL: { tone: "success", label: "Successful" },
  FAILED: { tone: "danger", label: "Failed" },
  CANCELLED: { tone: "warning", label: "Cancelled" },
  EXPIRED: { tone: "danger", label: "Expired" },
  REFUNDED: { tone: "warning", label: "Refunded" },
};

/**
 * Live payment state. The wording never claims success before the provider has
 * confirmed it.
 */
export function PaymentStatusPanel({
  payment,
  message,
  instruction,
  sandboxControls,
  settling,
  onSandboxSettle,
  onRetry,
}: {
  payment: PaymentDto;
  message: string;
  instruction?: string | null;
  sandboxControls: boolean;
  settling: boolean;
  onSandboxSettle: (outcome: "approve" | "decline") => void;
  onRetry: () => void;
}) {
  const inFlight = payment.status === "PENDING" || payment.status === "PROCESSING";
  const { tone, label } = STATUS_TONE[payment.status];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">
              Deposit payment
            </p>
            <p className="font-display text-2xl text-ink">
              {formatKwacha(payment.amountNgwee)}
            </p>
            <p className="text-xs text-ink-muted">
              {payment.method === "MOBILE_MONEY" ? "Mobile Money" : "Bank card"}
              {payment.instrumentBrand ? ` · ${payment.instrumentBrand}` : ""}
              {payment.instrumentLast4 ? ` ••${payment.instrumentLast4}` : ""}
            </p>
          </div>

          <Badge
            tone={
              tone === "success"
                ? "success"
                : tone === "danger"
                  ? "danger"
                  : tone === "warning"
                    ? "warning"
                    : "brand"
            }
          >
            {inFlight ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : payment.status === "SUCCESSFUL" ? (
              <CheckCircle2 aria-hidden />
            ) : (
              <XCircle aria-hidden />
            )}
            {label}
          </Badge>
        </div>

        <p className="mt-4 text-sm text-ink-soft" role="status" aria-live="polite">
          {instruction && inFlight ? instruction : message}
        </p>

        <p className="mt-3 text-xs text-ink-muted">
          Provider reference: <span className="font-mono">{payment.providerReference}</span>
        </p>
      </div>

      {payment.status === "FAILED" || payment.status === "CANCELLED" ? (
        <Alert tone="danger" title="That payment did not go through">
          <p>{payment.failureReason ?? message}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            Try another way to pay
          </Button>
        </Alert>
      ) : null}

      {sandboxControls && inFlight ? (
        <div className="rounded-3xl border-2 border-dashed border-amber-soft-200 bg-amber-soft-50 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-soft-700">
            <ShieldAlert className="size-4" aria-hidden />
            Sandbox payment simulator
          </p>
          <p className="mt-1 text-xs text-amber-soft-700">
            No money moves in sandbox mode. This stands in for the wallet prompt or bank
            authorisation, and the result is delivered back through the provider webhook.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              size="md"
              full
              loading={settling}
              loadingText="Confirming…"
              onClick={() => onSandboxSettle("approve")}
            >
              Approve payment
            </Button>
            <Button
              variant="secondary"
              size="md"
              full
              disabled={settling}
              onClick={() => onSandboxSettle("decline")}
            >
              Decline payment
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
