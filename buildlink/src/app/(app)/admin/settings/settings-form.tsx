"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/controls";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { savePlatformSettingsAction, type SettingsActionState } from "@/server/admin/actions";
import {
  PLATFORM_SETTING_HINTS,
  PLATFORM_SETTING_LABELS,
  type PlatformSettings,
} from "@/lib/platform-settings";
import { basisPointsToPercent, toKwacha } from "@/lib/money";

/**
 * Platform settings form.
 *
 * Money is stored in ngwee and commission in basis points, but nobody thinks in
 * either, so the inputs take Kwacha and the hint spells out what the basis points
 * work out to as a percentage. The conversion happens once, in the schema, rather
 * than being repeated by every reader of the setting.
 */
export function PlatformSettingsForm({
  settings,
  canEdit,
}: {
  settings: PlatformSettings;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    savePlatformSettingsAction,
    null,
  );

  const commissionRate = Number(settings["commission.default_rate_bps"]);

  return (
    <form action={formAction} className="space-y-6">
      <FormMessage
        state={state}
        successMessage="Saved. The change applies to orders placed from now on."
      />

      {canEdit ? null : (
        <Alert tone="warning" title="You can read these but not change them">
          Only a super administrator can change platform settings, because a commission rate applies
          to every supplier on BuildLink.
        </Alert>
      )}

      <fieldset disabled={!canEdit} className="space-y-8 disabled:opacity-70">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Commission</h2>

          <CheckboxField
            id="commission-enabled"
            name="commission.enabled"
            defaultChecked={settings["commission.enabled"] === true}
            label={PLATFORM_SETTING_LABELS["commission.enabled"]}
            description={PLATFORM_SETTING_HINTS["commission.enabled"]}
          />

          <Field
            name="commission.default_rate_bps"
            label={`${PLATFORM_SETTING_LABELS["commission.default_rate_bps"]} (basis points)`}
            hint={`${PLATFORM_SETTING_HINTS["commission.default_rate_bps"]} The saved value is ${basisPointsToPercent(commissionRate).toFixed(2)}%.`}
            error={fieldError(state, "commission.default_rate_bps")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min="0"
                max="5000"
                step="1"
                defaultValue={commissionRate}
              />
            )}
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Supplier subscriptions
          </h2>

          <Field
            name="subscription.standard_price_minor"
            label={`${PLATFORM_SETTING_LABELS["subscription.standard_price_minor"]} (ZMW)`}
            hint={PLATFORM_SETTING_HINTS["subscription.standard_price_minor"]}
            error={fieldError(state, "subscription.standard_price_minor")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue={toKwacha(Number(settings["subscription.standard_price_minor"]))}
              />
            )}
          </Field>

          <Field
            name="subscription.premium_price_minor"
            label={`${PLATFORM_SETTING_LABELS["subscription.premium_price_minor"]} (ZMW)`}
            hint={PLATFORM_SETTING_HINTS["subscription.premium_price_minor"]}
            error={fieldError(state, "subscription.premium_price_minor")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue={toKwacha(Number(settings["subscription.premium_price_minor"]))}
              />
            )}
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Customer and order behaviour
          </h2>

          <Field
            name="budget.alert_threshold_percent"
            label={`${PLATFORM_SETTING_LABELS["budget.alert_threshold_percent"]} (%)`}
            hint={PLATFORM_SETTING_HINTS["budget.alert_threshold_percent"]}
            error={fieldError(state, "budget.alert_threshold_percent")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                step="1"
                defaultValue={Number(settings["budget.alert_threshold_percent"])}
              />
            )}
          </Field>

          <Field
            name="orders.auto_complete_after_days"
            label={`${PLATFORM_SETTING_LABELS["orders.auto_complete_after_days"]} (days)`}
            hint={PLATFORM_SETTING_HINTS["orders.auto_complete_after_days"]}
            error={fieldError(state, "orders.auto_complete_after_days")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min="0"
                max="365"
                step="1"
                defaultValue={Number(settings["orders.auto_complete_after_days"])}
              />
            )}
          </Field>
        </section>
      </fieldset>

      {canEdit ? (
        <SubmitButton pendingText="Saving…">Save platform settings</SubmitButton>
      ) : null}
    </form>
  );
}
