import "server-only";
import { randomUUID } from "node:crypto";
import type { PaymentMethod } from "@prisma/client";
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentProvider,
  VerifyPaymentResult,
} from "@/lib/services/payments";

/**
 * Development and test payment provider.
 *
 * Every payment it creates is labelled `SANDBOX` in the database and in the UI,
 * and it never claims success on its own: `initiate` returns PENDING and the
 * checkout screen shows explicit "simulate success" / "simulate failure"
 * controls. That mirrors a real handset-authorised mobile-money flow closely
 * enough to be a useful rehearsal, while making it impossible to mistake a test
 * payment for a real one.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox";
  readonly isSandbox = true;
  readonly supportedMethods: readonly PaymentMethod[] = ["SANDBOX"];

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    return {
      providerReference: `SBX-${randomUUID().slice(0, 12).toUpperCase()}`,
      status: "PENDING",
      instructions:
        "Sandbox payment created. No real money has moved. Use the sandbox controls on this page to " +
        `simulate the customer approving or declining ${formatSandboxAmount(input.amountMinor)}.`,
    };
  }

  /**
   * Reads the outcome encoded into the reference by `settle()`. An unsettled
   * reference stays PENDING, exactly as a real provider would report a payment
   * the customer has not yet authorised on their phone.
   */
  async verify(providerReference: string): Promise<VerifyPaymentResult> {
    if (providerReference.endsWith(":FAILED")) {
      return {
        status: "FAILED",
        providerReference,
        failureReason: "Sandbox payment declined by the simulated customer.",
        metadata: { sandbox: true, outcome: "failed" },
      };
    }
    if (providerReference.endsWith(":SUCCESSFUL")) {
      return {
        status: "SUCCESSFUL",
        providerReference,
        metadata: { sandbox: true, outcome: "successful" },
      };
    }
    return { status: "PENDING", providerReference, metadata: { sandbox: true } };
  }

  async refund(input: {
    providerReference: string;
    amountMinor: number;
    reason: string;
  }): Promise<VerifyPaymentResult> {
    return {
      status: "REFUNDED",
      providerReference: input.providerReference,
      metadata: { sandbox: true, refundedAmountMinor: input.amountMinor, reason: input.reason },
    };
  }

  /**
   * Sandbox-only: encodes the simulated outcome onto the reference so `verify`
   * returns it. The real providers have no equivalent — the customer's handset
   * decides.
   */
  settle(providerReference: string, outcome: "SUCCESSFUL" | "FAILED"): string {
    const base = providerReference.split(":")[0] ?? providerReference;
    return `${base}:${outcome}`;
  }
}

function formatSandboxAmount(amountMinor: number): string {
  return `ZMW ${(amountMinor / 100).toFixed(2)}`;
}
