import { serverEnv } from "@/lib/config";
import { MockPaymentProvider } from "@/lib/payments/mock-provider";
import type { PaymentProvider } from "@/lib/payments/types";

/**
 * Provider registry. Register a real Zambian gateway here and switch with the
 * `PAYMENT_PROVIDER` environment variable — the booking flow does not change.
 */
const registry = new Map<string, () => PaymentProvider>([
  ["mock", () => new MockPaymentProvider()],
]);

const cache = new Map<string, PaymentProvider>();

export function getPaymentProvider(id?: string): PaymentProvider {
  const providerId = id ?? serverEnv().PAYMENT_PROVIDER;
  const cached = cache.get(providerId);
  if (cached) return cached;

  const factory = registry.get(providerId);
  if (!factory) {
    throw new Error(
      `Unknown payment provider "${providerId}". Registered providers: ${[...registry.keys()].join(", ")}`,
    );
  }
  const provider = factory();
  cache.set(providerId, provider);
  return provider;
}

export function registerPaymentProvider(id: string, factory: () => PaymentProvider): void {
  registry.set(id, factory);
  cache.delete(id);
}
