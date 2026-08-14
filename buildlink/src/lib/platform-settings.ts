/**
 * Platform configuration keys and their defaults.
 *
 * Commission rates, subscription pricing and alert thresholds are configuration
 * an administrator can change, not constants baked into a deployment. Defaults
 * live here — a pure module, so the seed script, the admin console and the
 * server-side reader all agree on the same shape.
 *
 * BuildLink launches with `commission.enabled` false: suppliers list for free
 * while the marketplace builds liquidity, and turning it on is an admin decision
 * rather than a code change.
 */

export const PLATFORM_SETTING_DEFAULTS = {
  "commission.default_rate_bps": 350,
  "commission.enabled": false,
  "subscription.standard_price_minor": 25_000_00,
  "subscription.premium_price_minor": 60_000_00,
  "budget.alert_threshold_percent": 85,
  "orders.auto_complete_after_days": 14,
} as const;

export type PlatformSettingKey = keyof typeof PLATFORM_SETTING_DEFAULTS;

export type PlatformSettings = Record<PlatformSettingKey, number | boolean>;

export const PLATFORM_SETTING_LABELS: Record<PlatformSettingKey, string> = {
  "commission.default_rate_bps": "Default commission rate",
  "commission.enabled": "Charge commission",
  "subscription.standard_price_minor": "Standard subscription (monthly)",
  "subscription.premium_price_minor": "Premium subscription (monthly)",
  "budget.alert_threshold_percent": "Budget alert threshold",
  "orders.auto_complete_after_days": "Auto-complete orders after",
};

export const PLATFORM_SETTING_HINTS: Record<PlatformSettingKey, string> = {
  "commission.default_rate_bps":
    "Applied to the goods value of each order, in basis points. 350 = 3.5%. A supplier-specific rate overrides this.",
  "commission.enabled":
    "While this is off, no commission is calculated, charged or shown to suppliers.",
  "subscription.standard_price_minor":
    "Indicative price for the Standard supplier tier. Billing is not yet implemented.",
  "subscription.premium_price_minor":
    "Indicative price for the Premium supplier tier. Billing is not yet implemented.",
  "budget.alert_threshold_percent":
    "Customers are warned once a budget category passes this share of its plan.",
  "orders.auto_complete_after_days":
    "Delivered orders count as complete in reporting after this many days.",
};

/** Settings stored as basis points or ngwee need different form controls. */
export const PLATFORM_SETTING_KINDS: Record<
  PlatformSettingKey,
  "boolean" | "basis_points" | "money" | "percent" | "days"
> = {
  "commission.default_rate_bps": "basis_points",
  "commission.enabled": "boolean",
  "subscription.standard_price_minor": "money",
  "subscription.premium_price_minor": "money",
  "budget.alert_threshold_percent": "percent",
  "orders.auto_complete_after_days": "days",
};

export const PLATFORM_SETTING_KEYS = Object.keys(
  PLATFORM_SETTING_DEFAULTS,
) as PlatformSettingKey[];
