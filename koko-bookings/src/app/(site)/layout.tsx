import { MobileNav } from "@/components/site/mobile-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getSettings } from "@/lib/database/settings";

export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader businessName={settings.businessName} />
      <main id="main" className="flex-1 pb-20 sm:pb-0">
        {children}
      </main>
      <SiteFooter
        businessName={settings.businessName}
        businessPhone={settings.businessPhone}
        businessEmail={settings.businessEmail}
      />
      <MobileNav />
    </div>
  );
}
