import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/app/(auth)/register/register-form";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME_PATH } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a free BuildLink Zambia account to plan your build, compare material prices and track your construction budget.",
};

export default async function RegisterPage({
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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Start building smarter
        </h1>
        <p className="text-foreground-muted">
          Create a free account to plan your project, compare supplier prices and keep your budget
          under control.
        </p>
      </div>

      <RegisterForm next={next} />

      <p className="border-t border-border pt-6 text-sm text-foreground-muted">
        Supplying building materials instead?{" "}
        <Link href="/register/supplier" className="font-medium text-brand-700 hover:underline">
          Register your business
        </Link>
      </p>
    </div>
  );
}
