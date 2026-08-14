"use client";

import * as React from "react";
import { useActionState } from "react";
import { ImagePlus } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  uploadSupplierLogoAction,
  type SupplierActionState,
} from "@/server/suppliers/actions";

/**
 * Business logo or shopfront photograph.
 *
 * Kept out of the settings form so a supplier can change the picture without
 * resubmitting — and revalidating — every commercial term of their business.
 */
export function SupplierLogoForm() {
  const [state, formAction] = useActionState<SupplierActionState, FormData>(
    uploadSupplierLogoAction,
    null,
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <FormMessage state={state} successMessage="Your picture is updated." />

      <Field
        name="logo"
        label="Choose an image"
        hint="JPEG, PNG or WebP up to 5 MB. A photograph of your shopfront or yard works as well as a logo."
        error={fieldError(state, "logo")}
      >
        {(control) => (
          <Input
            {...control}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-800"
          />
        )}
      </Field>

      <SubmitButton size="sm" pendingText="Uploading…">
        <ImagePlus aria-hidden />
        Upload
      </SubmitButton>
    </form>
  );
}
