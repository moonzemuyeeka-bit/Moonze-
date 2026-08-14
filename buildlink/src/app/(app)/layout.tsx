import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AppSidebar, LogoutForm, MobileNav } from "@/components/layout/app-nav";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { getCurrentUser } from "@/lib/auth/session";
import { fileUrl } from "@/lib/services/storage";
import { getShellCounts } from "@/server/shell/queries";

/**
 * Application shell.
 *
 * One shell serves every signed-in role and guests browsing the marketplace:
 * the sidebar and bottom bar are generated from the role's navigation, so a
 * customer, supplier, delivery provider and administrator each get their own
 * surface without a separate layout to keep in sync.
 *
 * Below `lg` the sidebar disappears and a fixed bottom bar takes over, which is
 * how most Zambian customers will use BuildLink — the `pb-20` on the main
 * column reserves room for it.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const counts = await getShellCounts(user);

  return (
    <div className="min-h-dvh bg-background">
      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
          <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
            <Link href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-brand-600">
              <Logo size="sm" />
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AppSidebar role={user?.role ?? null} counts={counts} />
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-col">
          <AppTopBar
            user={user ? { name: user.name, email: user.email, role: user.role } : null}
            counts={counts}
            avatarUrl={fileUrl(user?.avatarKey)}
          />
          <main id="main-content" className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pb-10 sm:pt-6">
            {children}
          </main>
        </div>
      </div>

      <MobileNav
        role={user?.role ?? null}
        counts={counts}
        userName={user?.name ?? ""}
        isSignedIn={user !== null}
      />
      {user ? <LogoutForm /> : null}
    </div>
  );
}
