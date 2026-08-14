"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, Textarea } from "@/components/ui/field";
import { customerDetailsSchema, type CustomerDetailsInput } from "@/schemas/booking";

export type CustomerDetailsValues = {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
};

/**
 * Only what is needed to run the appointment: name, phone, optional email and
 * notes. No account, no extra personal data.
 */
export function CustomerDetailsForm({
  formId,
  defaultValues,
  serverFieldErrors,
  onSubmit,
}: {
  formId: string;
  defaultValues?: Partial<CustomerDetailsValues>;
  serverFieldErrors?: Record<string, string>;
  onSubmit: (values: CustomerDetailsValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerDetailsInput>({
    resolver: zodResolver(customerDetailsSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      notes: defaultValues?.notes ?? "",
    },
    mode: "onTouched",
  });

  return (
    <form
      id={formId}
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit((values) =>
        onSubmit({
          name: values.name.trim(),
          phone: values.phone.trim(),
          email: values.email?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
        }),
      )}
    >
      <Field
        label="Full name"
        htmlFor="customer-name"
        required
        error={errors.name?.message ?? serverFieldErrors?.["customer.name"]}
        className="sm:col-span-2"
      >
        <Input
          id="customer-name"
          autoComplete="name"
          placeholder="e.g. Chanda Mwale"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor="customer-phone"
        required
        hint="We send your confirmation and reminders here."
        error={errors.phone?.message ?? serverFieldErrors?.["customer.phone"]}
      >
        <Input
          id="customer-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+260 97X XXX XXX"
          aria-invalid={Boolean(errors.phone)}
          {...register("phone")}
        />
      </Field>

      <Field
        label="Email"
        htmlFor="customer-email"
        hint="Optional — for your receipt."
        error={errors.email?.message ?? serverFieldErrors?.["customer.email"]}
      >
        <Input
          id="customer-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>

      <Field
        label="Notes for your lash artist"
        htmlFor="customer-notes"
        hint="Optional — style preferences, allergies, anything helpful."
        error={errors.notes?.message}
        className="sm:col-span-2"
      >
        <Textarea
          id="customer-notes"
          rows={3}
          placeholder="e.g. I would like a softer, natural look."
          {...register("notes")}
        />
      </Field>
    </form>
  );
}
