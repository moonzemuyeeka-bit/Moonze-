"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Submit button wired to the enclosing form's pending state.
 *
 * `useFormStatus` means every form gets a correct loading state and
 * double-submit protection without threading a boolean through props — which
 * matters most on the slow connections this product is built for.
 */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} loadingText={pendingText} {...props}>
      {children}
    </Button>
  );
}
