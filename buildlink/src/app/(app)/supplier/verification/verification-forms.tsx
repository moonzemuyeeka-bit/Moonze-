"use client";

import * as React from "react";
import { useActionState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  removeSupplierDocumentAction,
  uploadSupplierDocumentAction,
  type DocumentActionState,
} from "@/server/suppliers/actions";
import { SUPPLIER_DOCUMENT_TYPES, SUPPLIER_DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import type { SupplierDocumentType } from "@prisma/client";

/**
 * Verification document upload.
 *
 * One form for every document type rather than a fixed set of slots, because a
 * business may hold two directors' NRCs, or an old and a renewed tax clearance,
 * and refusing the second one would just push the supplier into emailing it.
 */
export function DocumentUploadForm({
  defaultType,
}: {
  defaultType?: SupplierDocumentType;
}) {
  const [state, formAction] = useActionState<DocumentActionState, FormData>(
    uploadSupplierDocumentAction,
    null,
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage
        state={state}
        successMessage="Document received. BuildLink will review it and update your status."
      />

      <Field
        name="type"
        label="Which document is this?"
        required
        error={fieldError(state, "type")}
      >
        {(control) => (
          <NativeSelect {...control} defaultValue={defaultType ?? SUPPLIER_DOCUMENT_TYPES[0]}>
            {SUPPLIER_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {SUPPLIER_DOCUMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field
        name="document"
        label="File"
        required
        hint="PDF, JPEG, PNG or WebP, up to 10 MB. A clear photograph taken on a phone is fine."
        error={fieldError(state, "document")}
      >
        {(control) => (
          <Input
            {...control}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-800"
          />
        )}
      </Field>

      <SubmitButton pendingText="Uploading…">
        <Upload aria-hidden />
        Upload document
      </SubmitButton>
    </form>
  );
}

export function RemoveDocumentForm({
  documentId,
  documentLabel,
}: {
  documentId: string;
  documentLabel: string;
}) {
  const [state, formAction] = useActionState<DocumentActionState, FormData>(
    removeSupplierDocumentAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="documentId" value={documentId} />
      <FormMessage state={state} />
      <SubmitButton size="sm" variant="ghost" pendingText="Removing…">
        <Trash2 aria-hidden />
        <span className="sr-only">Remove {documentLabel}</span>
        <span aria-hidden className="hidden sm:inline">
          Remove
        </span>
      </SubmitButton>
    </form>
  );
}
