"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldHint, Input, Select } from "@/components/ui/field";
import { formatKwacha } from "@/lib/money";
import { detectMobileMoneyProvider, MOBILE_MONEY_PROVIDERS, type MobileMoneyProviderId } from "@/lib/phone";

/**
 * Mobile money: the customer confirms which wallet to charge, then approves the
 * prompt on their handset. No PIN is ever entered in this app.
 */
export function MobileMoneyPayment({
  depositNgwee,
  defaultPhone,
  submitting,
  fieldErrors,
  onPay,
}: {
  depositNgwee: number;
  defaultPhone: string;
  submitting: boolean;
  fieldErrors?: Record<string, string>;
  onPay: (details: { provider: MobileMoneyProviderId; phone: string }) => void;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [provider, setProvider] = useState<MobileMoneyProviderId>(
    detectMobileMoneyProvider(defaultPhone) ?? "airtel",
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onPay({ provider, phone });
      }}
    >
      <Field
        label="Mobile money number"
        htmlFor="momo-phone"
        required
        error={fieldErrors?.phone}
        hint="The wallet that will be charged."
      >
        <Input
          id="momo-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            const detected = detectMobileMoneyProvider(event.target.value);
            if (detected) setProvider(detected);
          }}
          placeholder="+260 97X XXX XXX"
        />
      </Field>

      <Field
        label="Wallet"
        htmlFor="momo-provider"
        required
        error={fieldErrors?.provider ?? fieldErrors?.["mobileMoney.provider"]}
      >
        <Select
          id="momo-provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value as MobileMoneyProviderId)}
        >
          {MOBILE_MONEY_PROVIDERS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} ({option.prefixes})
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" size="lg" full loading={submitting} loadingText="Sending prompt…">
        <Smartphone aria-hidden />
        Pay {formatKwacha(depositNgwee)} with Mobile Money
      </Button>

      <FieldHint>
        You will get a prompt on your phone. Enter your wallet PIN there — never share
        it with anyone, including us.
      </FieldHint>
    </form>
  );
}
