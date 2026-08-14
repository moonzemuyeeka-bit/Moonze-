"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ApiClientError, apiRequest } from "@/lib/api-client";

export function AdminLoginForm({
  next,
  demoEmail,
}: {
  next: string;
  demoEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(demoEmail ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await apiRequest("/api/admin/session", {
        method: "POST",
        json: { email, password },
      });
      router.push(next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fields ?? {});
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6 pt-6">
        {error ? (
          <Alert tone="danger" title="Sign in failed">
            <p>{error}</p>
          </Alert>
        ) : null}

        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field label="Email" htmlFor="admin-email" required error={fieldErrors.email}>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>

          <Field
            label="Password"
            htmlFor="admin-password"
            required
            error={fieldErrors.password}
          >
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>

          <Button type="submit" size="lg" full loading={loading} loadingText="Signing in…">
            <LogIn aria-hidden />
            Sign in
          </Button>
        </form>

        {demoEmail ? (
          <Alert tone="info" title="Demo mode">
            <p>
              Seeded admin: <span className="font-medium">{demoEmail}</span>. The password
              is the <span className="font-mono text-xs">ADMIN_PASSWORD</span> value from
              your environment file. Set{" "}
              <span className="font-mono text-xs">DEMO_MODE=false</span> in production.
            </p>
          </Alert>
        ) : null}

        <p className="text-center text-sm text-ink-muted">
          <Link className="hover:text-blush-700" href="/">
            Back to the customer site
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
