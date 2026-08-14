import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME_PATH } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to BuildLink Zambia to manage your projects, orders and budget.",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME_PATH[user.role]);

  const { next } = await searchParams;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back</h1>
        <p className="text-foreground-muted">
          Sign in to your projects, orders and budget.
        </p>
      </div>

      <LoginForm next={next} />

      <div className="space-y-3 border-t border-border pt-6 text-sm">
        <p className="text-foreground-muted">
          New to BuildLink?{" "}
          <Link href="/register" className="font-medium text-brand-700 hover:underline">
            Create a free account
          </Link>
        </p>
        <p className="text-foreground-muted">
          Supplying building materials?{" "}
          <Link href="/register/supplier" className="font-medium text-brand-700 hover:underline">
            Register your business
          </Link>
        </p>
      </div>
    </div>
  );
}
