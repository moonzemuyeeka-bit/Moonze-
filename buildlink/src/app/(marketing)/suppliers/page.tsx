import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  FileText,
  Package,
  Receipt,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Sell on BuildLink",
  description:
    "List your building materials on BuildLink Zambia. Reach customers who are already budgeting for cement, blocks, sand, roofing and finishing materials.",
};

const BENEFITS = [
  {
    icon: Users,
    title: "Customers with a budget already set",
    body: "People arrive at BuildLink with a project, a stage and a budget. When they search for cement, they are ready to buy it.",
  },
  {
    icon: Package,
    title: "A catalogue you control",
    body: "Set your own prices, units, minimum order quantities and stock. Update a price once and every listing and comparison follows.",
  },
  {
    icon: Receipt,
    title: "Orders, payments and balances in one place",
    body: "See what has been ordered, what has been paid, what is outstanding and which deliveries are due — without a WhatsApp archaeology dig.",
  },
  {
    icon: FileText,
    title: "Written agreements as standard",
    body: "Generate a clear agreement for each order covering items, quantities, deposit, balance, delivery date and cancellation terms.",
  },
  {
    icon: Truck,
    title: "Delivery that is not your problem alone",
    body: "Deliver yourself, or hand the job to an independent transporter on BuildLink and track it to site with proof of delivery.",
  },
  {
    icon: BarChart3,
    title: "Know what actually sells",
    body: "Revenue, order volume, best-selling products and customer ratings, so you stock what your area is buying.",
  },
] as const;

const STEPS = [
  {
    title: "Register your business",
    body: "Business name, contact person, phone, email, province and district, the categories you supply and whether you deliver.",
  },
  {
    title: "Upload your documents",
    body: "PACRA certificate, tax clearance and director identification. Documents are visible only to BuildLink's verification team.",
  },
  {
    title: "We review and verify",
    body: "Our team checks the documents against the business details. You trade while pending — your status is always shown honestly to customers.",
  },
  {
    title: "List products and take orders",
    body: "Add products with prices, units, minimum order and stock. Approved listings appear in search, comparison and category pages.",
  },
] as const;

export default function SupplierMarketingPage() {
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-gold-50 via-surface to-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl space-y-6">
            <Badge tone="accent">For suppliers, manufacturers and hardware stores</Badge>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Put your yard where the builders are looking.
            </h1>
            <p className="text-lg text-foreground-muted">
              BuildLink Zambia connects material suppliers, brick and block makers, quarries, sand
              haulers, timber yards, hardware stores and roofing, plumbing and electrical merchants
              with people who are building right now.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register/supplier">
                  Register your business
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/marketplace/suppliers">See suppliers on BuildLink</Link>
              </Button>
            </div>
            <p className="text-sm text-foreground-muted">
              Registration and listing are free. Commission and subscription options are configured
              by BuildLink and always shown to you before they apply to an order.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="benefits-heading" className="bg-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 id="benefits-heading" className="text-3xl font-semibold tracking-tight">
            What you get
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <Card key={benefit.title} className="h-full">
                <CardContent className="space-y-3 p-5 pt-5">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <benefit.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="text-base font-semibold">{benefit.title}</h3>
                  <p className="text-sm text-foreground-muted">{benefit.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="border-y border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 id="steps-heading" className="text-3xl font-semibold tracking-tight">
              Getting listed
            </h2>
            <p className="mt-2 text-foreground-muted">
              Four steps. Most businesses finish registration in under ten minutes.
            </p>
          </div>

          <ol className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <CardContent className="space-y-3 p-5 pt-5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="text-sm text-foreground-muted">{step.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>

          <Alert tone="info" title="Verification is never implied" className="mt-8">
            <p>
              A new business appears as <strong>pending verification</strong> until our team has
              reviewed its documents, and customers see exactly that. BuildLink will not describe a
              business as verified before it has been checked — that protection is the reason
              customers trust the marketplace at all.
            </p>
          </Alert>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <BadgeCheck aria-hidden className="mx-auto size-10 text-brand-700" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            Ready to receive your first order?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-foreground-muted">
            Register your business, add your products and start appearing in customer searches and
            price comparisons across your province.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register/supplier">Register your business</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in to your console</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
