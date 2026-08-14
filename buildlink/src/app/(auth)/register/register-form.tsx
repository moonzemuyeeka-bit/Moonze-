"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { registerCustomerAction, type AuthActionState } from "@/server/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction] = React.useActionState<AuthActionState, FormData>(
    registerCustomerAction,
    null,
  );
  const [showPassword, setShowPassword] = React.useState(false);
  const [acceptTerms, setAcceptTerms] = React.useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field name="name" label="Your full name" error={fieldError(state, "name")} required>
        {(control) => (
          <Input {...control} autoComplete="name" placeholder="Chanda Mulenga" autoFocus />
        )}
      </Field>

      <Field name="email" label="Email address" error={fieldError(state, "email")} required>
        {(control) => (
          <Input
            {...control}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
        )}
      </Field>

      <Field
        name="phone"
        label="Mobile number"
        hint="Optional for now. Suppliers use it to reach you about deliveries."
        error={fieldError(state, "phone")}
      >
        {(control) => (
          <Input
            {...control}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0977 123 456"
          />
        )}
      </Field>

      <Field
        name="password"
        label="Password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters, including a number.`}
        error={fieldError(state, "password")}
        required
      >
        {(control) => (
          <div className="relative">
            <Input
              {...control}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-11"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        )}
      </Field>

      <Field
        name="confirmPassword"
        label="Confirm password"
        error={fieldError(state, "confirmPassword")}
        required
      >
        {(control) => (
          <Input {...control} type={showPassword ? "text" : "password"} autoComplete="new-password" />
        )}
      </Field>

      <div className="space-y-2">
        <CheckboxField
          id="acceptTerms"
          name="acceptTerms"
          checked={acceptTerms}
          onCheckedChange={(checked) => setAcceptTerms(checked === true)}
          label="I understand how BuildLink handles payments"
          description="Payments go directly to suppliers. BuildLink records what was paid and outstanding — it does not hold or guarantee funds."
        />
        {fieldError(state, "acceptTerms") ? (
          <p className="text-xs text-danger-700">{fieldError(state, "acceptTerms")?.join(" ")}</p>
        ) : null}
        {/* Radix's checkbox is not a native input, so mirror its value for the form action. */}
        <input type="hidden" name="acceptTerms" value={acceptTerms ? "on" : ""} />
      </div>

      <SubmitButton block size="lg" pendingText="Creating your account…">
        Create my account
      </SubmitButton>

      <p className="text-center text-sm text-foreground-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
