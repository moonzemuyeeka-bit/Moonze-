import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  ClipboardList,
  Handshake,
  Palette,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Progress } from "@/components/ui/controls";
import { PRODUCT_CATEGORIES } from "@/lib/catalogue";
import { formatZmw } from "@/lib/money";

export const metadata: Metadata = {
  title: "Build Better. Buy Smarter.",
  description:
    "Everything you need to build your home in Zambia, connected in one place. Compare building-material suppliers, order in Kwacha, arrange delivery and track your construction budget.",
};

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Tell us what you are building",
    body: "A three-bedroom house in Lusaka, a renovation in Kitwe, a boundary wall in Chipata. Set your budget and the stage you are at.",
    icon: ClipboardList,
  },
  {
    step: "2",
    title: "Find and compare materials",
    body: "Search cement, blocks, sand, quarry stone, roofing and more. Compare unit prices, distance, ratings and delivery side by side.",
    icon: Search,
  },
  {
    step: "3",
    title: "Order and agree the terms",
    body: "Add materials to your project, place the order and generate a clear written agreement covering quantity, price, deposit and delivery.",
    icon: Handshake,
  },
  {
    step: "4",
    title: "Take delivery and track spend",
    body: "Arrange supplier or third-party delivery, follow it to site, and watch every purchase land in your project budget automatically.",
    icon: Truck,
  },
] as const;

const FEATURES = [
  {
    icon: Search,
    title: "Find materials",
    body: "One search across every supplier on BuildLink, filtered by category, location, price, rating, stock and whether they deliver.",
    href: "/marketplace",
    linkLabel: "Browse the marketplace",
  },
  {
    icon: Scale,
    title: "Compare suppliers",
    body: "Put up to four options side by side: unit price, minimum order, approximate distance, rating and delivery availability.",
    href: "/marketplace/compare",
    linkLabel: "Compare prices",
  },
  {
    icon: ClipboardList,
    title: "Track your project",
    body: "Every project carries its stage, progress, orders and deliveries — so you always know what has been bought and what is next.",
    href: "/customer/projects",
    linkLabel: "See project tracking",
  },
  {
    icon: Wallet,
    title: "Manage your budget",
    body: "Budget across sixteen categories from foundation to finishing. Purchases post themselves, so remaining budget is always current.",
    href: "/customer/dashboard",
    linkLabel: "See budget tools",
  },
  {
    icon: Truck,
    title: "Arrange delivery",
    body: "Supplier delivery, an independent truck, or your own collection. Track it from pickup to site with proof of delivery.",
    href: "/marketplace",
    linkLabel: "How delivery works",
  },
  {
    icon: BadgeCheck,
    title: "Trusted suppliers",
    body: "Every business shows its real verification state and a trust score built from completed orders, ratings and delivery record.",
    href: "/marketplace/suppliers",
    linkLabel: "Meet the suppliers",
  },
] as const;

export default function LandingPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-brand-50 via-surface to-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-gold-200/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-brand-200/40 blur-3xl"
        />

        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-20">
          <div className="space-y-7">
            <Badge tone="accent" className="gap-2 px-3 py-1">
              <Sparkles aria-hidden className="size-3.5" />
              Built for Zambia · Priced in Kwacha
            </Badge>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Build Better.
                <br />
                <span className="text-brand-700">Buy Smarter.</span>
              </h1>
              <p className="max-w-xl text-lg text-foreground-muted">
                Everything you need to build your home, connected in one place. Compare
                building-material suppliers, order what you need, arrange delivery and keep your
                budget under control.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="sm:w-auto">
                <Link href="/register">
                  Start building
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/suppliers">Become a supplier</Link>
              </Button>
            </div>

            <dl className="grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-3">
              {[
                { label: "Categories", value: "15", detail: "Cement to finishing" },
                { label: "Provinces", value: "10", detail: "All of Zambia" },
                { label: "Currency", value: "ZMW", detail: "No hidden conversion" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-foreground">{item.value}</dd>
                  <dd className="text-xs text-foreground-muted">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ProjectPreview />
        </div>
      </section>

      {/* ---------------------------------------------------- Category shortcuts */}
      <section aria-labelledby="categories-heading" className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="categories-heading" className="text-2xl font-semibold tracking-tight">
                What do you need?
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Fifteen categories covering every stage of a build.
              </p>
            </div>
            <Button asChild variant="link" size="sm">
              <Link href="/marketplace">
                See everything
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PRODUCT_CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/marketplace?category=${category.slug}`}
                  className="group flex h-full items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-brand-300 hover:bg-brand-50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
                    <CategoryIcon name={category.iconName} />
                  </span>
                  <span className="min-w-0 text-sm font-medium text-foreground">
                    {category.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------- How it works */}
      <section id="how-it-works" aria-labelledby="how-heading" className="bg-surface-muted">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 id="how-heading" className="text-3xl font-semibold tracking-tight">
              How BuildLink works
            </h2>
            <p className="mt-2 text-foreground-muted">
              Four steps, from an idea on paper to materials on site.
            </p>
          </div>

          <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.step}>
                <Card className="h-full">
                  <CardContent className="space-y-3 p-5 pt-5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white">
                        {item.step}
                      </span>
                      <item.icon aria-hidden className="size-5 text-gold-600" />
                    </div>
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="text-sm text-foreground-muted">{item.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------- Features */}
      <section aria-labelledby="features-heading" className="bg-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 id="features-heading" className="text-3xl font-semibold tracking-tight">
              A marketplace, a project tracker and a budget book
            </h2>
            <p className="mt-2 text-foreground-muted">
              BuildLink answers three questions, over and over: what am I building, what do I need,
              and where can I get it?
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} interactive className="h-full">
                <CardContent className="flex h-full flex-col gap-3 p-5 pt-5">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <feature.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="text-base font-semibold">{feature.title}</h3>
                  <p className="flex-1 text-sm text-foreground-muted">{feature.body}</p>
                  <Link
                    href={feature.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                  >
                    {feature.linkLabel}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Finishes & estimator */}
      <section aria-labelledby="tools-heading" className="border-y border-border bg-brand-900">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div className="space-y-5 text-white">
            <Badge tone="accent" className="gap-2">
              <Palette aria-hidden className="size-3.5" />
              Finish & colour recommender
            </Badge>
            <h2 id="tools-heading" className="text-3xl font-semibold tracking-tight">
              Photograph your building. Get a finish palette that works.
            </h2>
            <p className="text-brand-100">
              Upload a photo of your house as it stands. BuildLink reads the colours actually in the
              image — the roof, the brickwork, the ground — and recommends coordinated wall, trim and
              roof finishes, then points you at the paint on the marketplace.
            </p>
            <ul className="space-y-2 text-sm text-brand-100">
              {[
                "Dominant colours extracted from your own photo, not a generic swatch book",
                "Complementary, analogous and neutral schemes with contrast checked for readability",
                "Every suggestion links to paint listed by real suppliers in Kwacha",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-400" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="accent">
                <Link href="/customer/finishes">Try the finish recommender</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <Link href="/customer/planner">Estimate my materials</Link>
              </Button>
            </div>
          </div>

          <PaletteExample />
        </div>
      </section>

      {/* -------------------------------------------------------------- Trust */}
      <section aria-labelledby="trust-heading" className="bg-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 id="trust-heading" className="text-3xl font-semibold tracking-tight">
              Honest about what we can and cannot promise
            </h2>
            <p className="mt-2 text-foreground-muted">
              Building a house is the largest purchase most families ever make. BuildLink will not
              dress up a guess as a guarantee.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <Card>
              <CardContent className="space-y-3 p-5 pt-5">
                <ShieldCheck aria-hidden className="size-5 text-brand-700" />
                <h3 className="text-base font-semibold">Verification is stated plainly</h3>
                <p className="text-sm text-foreground-muted">
                  Suppliers are shown as verified, pending or unverified — never implied. Verified
                  means BuildLink reviewed the business registration documents on file.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 p-5 pt-5">
                <Wallet aria-hidden className="size-5 text-brand-700" />
                <h3 className="text-base font-semibold">We record payments, we don&apos;t hold money</h3>
                <p className="text-sm text-foreground-muted">
                  Your deposit goes directly to the supplier. BuildLink keeps the record of what was
                  paid and what is outstanding. It is not a bank and not an escrow service.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 p-5 pt-5">
                <Calculator aria-hidden className="size-5 text-brand-700" />
                <h3 className="text-base font-semibold">Estimates are labelled as estimates</h3>
                <p className="text-sm text-foreground-muted">
                  Material and budget guidance is a planning aid. For structural work, use a
                  qualified engineer, architect or quantity surveyor.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Coming soon */}
      <section aria-labelledby="soon-heading" className="border-t border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <Badge tone="info">Coming soon</Badge>
              <h2 id="soon-heading" className="text-2xl font-semibold tracking-tight">
                Professionals & artisans
              </h2>
              <p className="text-sm text-foreground-muted">
                Architects, quantity surveyors, engineers and designers, plus bricklayers,
                carpenters, plumbers, electricians, tilers and painters — with portfolios,
                availability and ratings. The roles, permissions and profile structure are already
                built into BuildLink; we are onboarding the first cohort before switching them on.
              </p>
            </div>
            <ul className="grid shrink-0 grid-cols-2 gap-2 text-sm">
              {["Architects", "Quantity surveyors", "Engineers", "Designers", "Bricklayers", "Carpenters", "Plumbers", "Electricians"].map(
                (item) => (
                  <li
                    key={item}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-foreground-muted"
                  >
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Supplier band */}
      <section aria-labelledby="supplier-cta-heading" className="bg-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-gold-50 p-8 sm:p-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <h2 id="supplier-cta-heading" className="text-3xl font-semibold tracking-tight">
                  Sell building materials? Put your yard online.
                </h2>
                <p className="text-foreground-muted">
                  List your products with real prices and stock, receive orders from customers who
                  are already budgeting for them, and manage delivery and agreements in one console.
                  Registration is free; verification is reviewed by our team.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/register/supplier">
                    Register your business
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/suppliers">How it works for suppliers</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Static preview of a customer's project dashboard.
 *
 * Hand-built from the same components the real dashboard uses, with figures that
 * are clearly an illustration rather than an implied market quote.
 */
function ProjectPreview() {
  const budgetMinor = 65_000_000;
  const spentMinor = 8_550_000;

  return (
    <div className="relative">
      <Card className="overflow-hidden shadow-card-hover">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">My 3 Bedroom House</p>
            <p className="text-xs text-foreground-muted">Chalala, Lusaka · Walling stage</p>
          </div>
          <Badge tone="success">Active</Badge>
        </div>

        <CardContent className="space-y-5 p-5 pt-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Budget", value: formatZmw(budgetMinor, { compactDecimals: true }) },
              { label: "Spent", value: formatZmw(spentMinor, { compactDecimals: true }) },
              {
                label: "Remaining",
                value: formatZmw(budgetMinor - spentMinor, { compactDecimals: true }),
              },
              { label: "Progress", value: "18%" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                  {item.label}
                </p>
                <p className="tabular mt-1 text-base font-semibold">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Construction progress</span>
              <span className="text-foreground-muted">Walling · 18%</span>
            </div>
            <Progress value={18} label="Construction progress: 18 percent" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              Recent orders
            </p>
            {[
              { name: "Cement 32.5N", detail: "40 bags · confirmed", amount: 740_000 },
              { name: "Concrete blocks 6\"", detail: "1,200 pieces · out for delivery", amount: 1_560_000 },
              { name: "River sand", detail: "2 truck loads · delivered", amount: 1_900_000 },
            ].map((order) => (
              <div
                key={order.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{order.name}</p>
                  <p className="truncate text-xs text-foreground-muted">{order.detail}</p>
                </div>
                <p className="tabular shrink-0 text-sm font-semibold">
                  {formatZmw(order.amount, { compactDecimals: true })}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="mt-3 text-center text-xs text-foreground-subtle">
        Illustration of the customer dashboard. Figures are examples, not market quotes.
      </p>
    </div>
  );
}

/** Illustrative output of the finish-palette recommender. */
function PaletteExample() {
  const scheme = [
    { name: "Warm sand", hex: "#D9C4A3", role: "Walls" },
    { name: "Deep clay", hex: "#8C4A32", role: "Roof" },
    { name: "Off white", hex: "#F4F1EA", role: "Trim" },
    { name: "Slate green", hex: "#3D5A4C", role: "Accent" },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-surface-muted px-5 py-3">
        <p className="text-sm font-semibold">Recommended exterior scheme</p>
        <p className="text-xs text-foreground-muted">
          Generated from the colours in an uploaded photo
        </p>
      </div>
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="grid grid-cols-4 gap-2">
          {scheme.map((colour) => (
            <div key={colour.hex} className="space-y-2">
              <div
                className="h-20 w-full rounded-lg border border-border"
                style={{ backgroundColor: colour.hex }}
                aria-hidden
              />
              <div>
                <p className="text-xs font-semibold text-foreground">{colour.name}</p>
                <p className="text-[0.6875rem] text-foreground-muted">{colour.role}</p>
                <p className="tabular text-[0.6875rem] uppercase text-foreground-subtle">
                  {colour.hex}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-foreground-muted">
          A design suggestion based on colour harmony, not a paint-matching service. Always check a
          test patch on site before buying in quantity.
        </p>
      </CardContent>
    </Card>
  );
}
