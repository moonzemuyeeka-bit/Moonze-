import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppProviders } from "@/components/providers/app-providers";
import { SidebarContent } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <AppProviders>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="fixed inset-y-0 w-64">
            <SidebarContent />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} />
          <main className="flex-1 px-4 py-6 md:px-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </AppProviders>
  );
}
