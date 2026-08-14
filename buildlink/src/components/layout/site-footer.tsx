import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PRODUCT_CATEGORIES } from "@/lib/catalogue";

const FOOTER_SECTIONS = [
  {
    title: "Marketplace",
    links: [
      { href: "/marketplace", label: "Browse materials" },
      { href: "/marketplace/suppliers", label: "Find suppliers" },
      { href: "/marketplace?sort=lowest_price", label: "Best prices" },
      { href: "/marketplace?verified=1", label: "Verified suppliers" },
    ],
  },
  {
    title: "For customers",
    links: [
      { href: "/register", label: "Create an account" },
      { href: "/customer/dashboard", label: "My dashboard" },
      { href: "/customer/projects", label: "My projects" },
      { href: "/customer/finishes", label: "Finish & colour ideas" },
    ],
  },
  {
    title: "For businesses",
    links: [
      { href: "/suppliers", label: "Sell on BuildLink" },
      { href: "/register/supplier", label: "Register a business" },
      { href: "/register/delivery", label: "Deliver with BuildLink" },
      { href: "/supplier/dashboard", label: "Supplier console" },
    ],
  },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Logo showTagline />
            <p className="max-w-sm text-sm text-foreground-muted">
              A digital construction marketplace for Zambia. Find materials, compare suppliers,
              order, arrange delivery and keep your building budget under control — all priced in
              Kwacha.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground-muted hover:text-brand-700 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Popular categories
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {PRODUCT_CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/marketplace?category=${category.slug}`}
                  className="text-xs text-foreground-muted hover:text-brand-700 hover:underline"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 space-y-3 border-t border-border pt-6 text-xs text-foreground-subtle">
          <p>
            BuildLink records payments made between customers and suppliers. BuildLink is not a
            bank, an escrow service or a payment institution, and does not hold or transmit
            customer funds.
          </p>
          <p>
            Quantity estimates, budget guidance and finish suggestions in BuildLink are planning
            aids only. They are not certified quantities and do not replace advice from a qualified
            engineer, architect or quantity surveyor.
          </p>
          <p>
            © {year} BuildLink Zambia. Prices are shown in Zambian Kwacha (ZMW) as listed by each
            supplier.
          </p>
        </div>
      </div>
    </footer>
  );
}
