import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarHeart } from "lucide-react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { readSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { getSettings } from "@/lib/database/settings";

export const metadata: Metadata = {
  title: "Business sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [session, settings, { next }] = await Promise.all([
    readSession(),
    getSettings(),
    searchParams,
  ]);

  if (session) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-blush-500 to-blush-700 text-white shadow-soft">
          <CalendarHeart className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl text-ink">{settings.businessName}</h1>
          <p className="text-sm text-ink-soft">Business sign in</p>
        </div>
      </div>

      <AdminLoginForm
        next={next ?? "/admin"}
        demoEmail={isDemoMode() ? process.env.ADMIN_EMAIL ?? null : null}
      />
    </div>
  );
}
