import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { readSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/database/settings";

export const metadata: Metadata = {
  title: "Business dashboard",
  robots: { index: false, follow: false },
};

/**
 * The admin shell is only rendered for a verified session. The login page lives
 * outside this layout, and middleware turns anonymous visitors away first.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, settings] = await Promise.all([readSession(), getSettings()]);

  if (!session) return <>{children}</>;

  return (
    <AdminShell businessName={settings.businessName} adminName={session.name}>
      {children}
    </AdminShell>
  );
}
