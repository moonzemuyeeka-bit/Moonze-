import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Receipt, TrendingDown, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/controls";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
import { requirePagePermission } from "@/lib/auth/guards";
import { listProjects } from "@/server/projects/queries";
import { db } from "@/lib/db";
import { formatZmw } from "@/lib/money";
import { summariseWallet, WALLET_CUSTODY_NOTICE } from "@/lib/domain/budget";

export const metadata: Metadata = {
  title: "Budget & wallet",
  description: "Your budget across every project, and the funds you have set aside.",
};

/**
 * Budget across all projects.
 *
 * With one project this is a thin wrapper, so it redirects straight to that
 * project's budget rather than making the customer click twice. With several it
 * earns its place as the roll-up.
 */
export default async function CustomerBudgetPage() {
  const user = await requirePagePermission("project:manage", "/customer/budget");
  const projects = await listProjects(user);

  if (projects.length === 1 && projects[0]) {
    redirect(`/customer/projects/${projects[0].id}/budget`);
  }

  if (projects.length === 0) {
    return (
      <div>
        <PageHeader
          title="Budget & wallet"
          description="Plan what your build will cost and keep every payment on record."
        />
        <EmptyState
          icon={Wallet}
          title="No budget yet"
          description="Create a project and BuildLink sets up a budget with the 16 standard construction categories."
          action={
            <Button asChild>
              <Link href="/customer/onboarding">Set up my build</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const walletEntries = await db.walletEntry.findMany({
    where: { project: { customerId: user.id, deletedAt: null } },
    select: { type: true, amountMinor: true },
  });
  const wallet = summariseWallet(walletEntries);

  const totals = projects.reduce(
    (accumulator, project) => ({
      plannedMinor: accumulator.plannedMinor + project.estimatedBudgetMinor,
      spentMinor: accumulator.spentMinor + project.spentMinor,
    }),
    { plannedMinor: 0, spentMinor: 0 },
  );
  const remainingMinor = totals.plannedMinor - totals.spentMinor;
  const consumedPercent =
    totals.plannedMinor > 0
      ? Math.min(100, Math.round((totals.spentMinor / totals.plannedMinor) * 100))
      : 0;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Budget & wallet"
        description={`Across ${projects.length} projects. Open a project for its category breakdown.`}
        breadcrumbs={[{ label: "Dashboard", href: "/customer/dashboard" }, { label: "Budget" }]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total budget"
          value={formatZmw(totals.plannedMinor, { compactDecimals: true })}
          icon={Wallet}
          tone="brand"
        />
        <StatCard
          label="Spent"
          value={formatZmw(totals.spentMinor, { compactDecimals: true })}
          hint={`${consumedPercent}% of budget`}
          icon={Receipt}
        />
        <StatCard
          label="Remaining"
          value={formatZmw(remainingMinor, { compactDecimals: true })}
          icon={TrendingDown}
          tone={remainingMinor < 0 ? "danger" : "success"}
        />
        <StatCard
          label="Wallet recorded"
          value={formatZmw(wallet.balanceMinor, { compactDecimals: true })}
          hint="Set aside, not held by BuildLink"
          tone="gold"
        />
      </div>

      <Alert tone="info" title="BuildLink does not hold your money">
        {WALLET_CUSTODY_NOTICE}
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            By project
          </CardTitle>
          <CardDescription>Open a project to plan its categories in detail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.map((project) => (
            <div key={project.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/customer/projects/${project.id}/budget`}
                  className="text-sm font-semibold hover:text-brand-700 hover:underline"
                >
                  {project.name}
                </Link>
                <span className="text-xs tabular-nums text-foreground-muted">
                  {formatZmw(project.spentMinor)} of {formatZmw(project.estimatedBudgetMinor)}
                </span>
              </div>
              <Progress
                value={project.consumedPercent}
                tone={project.isOverBudget ? "danger" : "brand"}
                label={`${project.name}: ${project.consumedPercent}% of budget spent`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href="/customer/projects">
          <FolderKanban />
          All projects
        </Link>
      </Button>
    </div>
  );
}
