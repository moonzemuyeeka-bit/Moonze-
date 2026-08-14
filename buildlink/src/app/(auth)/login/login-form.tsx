"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { loginAction, type AuthActionState } from "@/server/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = React.useActionState<AuthActionState, FormData>(loginAction, null);
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field name="email" label="Email address" error={fieldError(state, "email")} required>
        {(control) => (
          <Input
            {...control}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            autoFocus
          />
        )}
      </Field>

      <Field
        name="password"
        label="Password"
        error={fieldError(state, "password")}
        required
        labelSuffix={
          <Link
            href="/account/password-help"
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Forgot password?
          </Link>
        }
      >
        {(control) => (
          <div className="relative">
            <Input
              {...control}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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

      <SubmitButton block size="lg" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
