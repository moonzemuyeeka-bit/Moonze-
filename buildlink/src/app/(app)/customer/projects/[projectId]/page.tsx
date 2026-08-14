import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Calculator,
  MapPin,
  Palette,
  Pencil,
  Receipt,
  Ruler,
  Search,
  Wallet,
} from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/components/ui/timeline";
import { requirePagePermission } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/errors";
import { getProject, getProjectBudget, listProjectOrders } from "@/server/projects/queries";
import { formatZmw } from "@/lib/money";
import {
  CONSTRUCTION_STAGE_LABELS,
  CONSTRUCTION_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONES,
  PROPERTY_TYPE_LABELS,
} from "@/lib/labels";
import { AdvanceStageForm, DeleteProjectDialog } from "./project-actions";
import type { OrderStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Project" };

/**
 * Project detail.
 *
 * The single screen a customer opens to answer "where am I?": stage and progress
 * at the top, the money next to it, then the orders placed against this build.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requirePagePermission("project:manage", `/customer/projects/${projectId}`);

  try {
    const [project, budget, orders] = await Promise.all([
      getProject(projectId, user),
      getProjectBudget(projectId, user),
      listProjectOrders(projectId, user),
    ]);

    const { rollup } = budget;

    return (
      <div className="space-y-7">
        <PageHeader
          title={project.name}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <MapPin aria-hidden className="size-3.5" />
                {project.district?.name ? `${project.district.name}, ` : ""}
                {project.province.name}
              </span>
              <span>{PROPERTY_TYPE_LABELS[project.propertyType]}</span>
              <span>{CONSTRUCTION_TYPE_LABELS[project.constructionType]}</span>
              {project.approximateSizeSqm ? (
                <span className="flex items-center gap-1">
                  <Ruler aria-hidden className="size-3.5" />
                  {project.approximateSizeSqm} m²
                </span>
              ) : null}
            </span>
          }
          breadcrumbs={[
            { label: "Dashboard", href: "/customer/dashboard" },
            { label: "Projects", href: "/customer/projects" },
            { label: project.name },
          ]}
          actions={
            <>
              <Button asChild variant="outline">
                <Link href={`/customer/projects/${project.id}/edit`}>
                  <Pencil />
                  Edit details
                </Link>
              </Button>
              <Button asChild>
                <Link href="/marketplace">
                  <Search />
                  Buy materials
                </Link>
              </Button>
            </>
          }
        >
          <Badge tone={PROJECT_STATUS_TONES[project.status]}>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </PageHeader>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total budget"
            value={formatZmw(rollup.plannedMinor, { compactDecimals: true })}
            hint={
              rollup.unallocatedMinor !== 0
                ? `${formatZmw(Math.abs(rollup.unallocatedMinor))} ${rollup.unallocatedMinor > 0 ? "not yet allocated" : "over-allocated"}`
                : "Fully allocated across categories"
            }
            icon={Wallet}
            tone="brand"
          />
          <StatCard
            label="Spent so far"
            value={formatZmw(rollup.spentMinor, { compactDecimals: true })}
            hint={`${rollup.consumedPercent}% of budget`}
            icon={Receipt}
            href={`/customer/projects/${project.id}/budget`}
          />
          <StatCard
            label="Remaining"
            value={formatZmw(rollup.remainingMinor, { compactDecimals: true })}
            hint={rollup.isOverBudget ? "Over the planned budget" : "Still available"}
            tone={rollup.isOverBudget ? "danger" : "success"}
          />
          <StatCard
            label="Wallet recorded"
            value={formatZmw(budget.wallet.balanceMinor, { compactDecimals: true })}
            hint="Set aside, not held by BuildLink"
            tone="gold"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  Construction progress
                </CardTitle>
                <CardDescription>
                  Currently at {CONSTRUCTION_STAGE_LABELS[project.stage]}
                  {project.targetCompletionDate
                    ? ` · target completion ${formatDate(project.targetCompletionDate)}`
                    : ""}
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">
                      {CONSTRUCTION_STAGE_LABELS[project.stage]}
                    </span>
                    <span className="tabular-nums text-foreground-muted">
                      {project.progressPercent}%
                    </span>
                  </div>
                  <Progress
                    value={project.progressPercent}
                    label={`Construction progress: ${project.progressPercent}%`}
                  />
                </div>
                <AdvanceStageForm
                  projectId={project.id}
                  stage={project.stage}
                  progressPercent={project.progressPercent}
                />
              </CardContent>
            </Card>

            <section aria-labelledby="project-orders">
              <SectionHeading
                title="Orders for this project"
                description="Every order you have placed against this build."
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/orders">
                      All orders
                      <ArrowRight />
                    </Link>
                  </Button>
                }
              />
              {orders.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No orders yet"
                  description="Materials you buy for this project appear here, and their cost is added to your budget automatically."
                  action={
                    <Button asChild size="sm">
                      <Link href="/marketplace">Find materials</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-2.5">
                  {orders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{order.supplierName}</p>
                          <p className="mt-0.5 text-xs text-foreground-muted">
                            {order.orderNumber}
                            {order.placedAt ? ` · ${formatDate(order.placedAt)}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatZmw(order.totalMinor, { compactDecimals: true })}
                          </p>
                          <Badge
                            tone={ORDER_STATUS_TONES[order.status as OrderStatus]}
                            size="sm"
                            className="mt-1"
                          >
                            {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  Budget breakdown
                </CardTitle>
                <CardDescription>
                  {budget.categories.filter((category) => category.plannedMinor > 0).length} of 16
                  categories planned.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress
                  value={rollup.consumedPercent}
                  tone={rollup.isOverBudget ? "danger" : "brand"}
                  label={`${rollup.consumedPercent}% of budget spent`}
                />
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/customer/projects/${project.id}/budget`}>
                    <Wallet />
                    Open budget and wallet
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {project.description ? (
              <Card>
                <CardHeader>
                  <CardTitle as="h2" className="text-base">
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm text-foreground-muted">
                    {project.description}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  Plan before you buy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                  <Link href={`/customer/planner?projectId=${project.id}`}>
                    <Calculator />
                    Estimate materials
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                  <Link href={`/customer/finishes?projectId=${project.id}`}>
                    <Palette />
                    Finish and colour ideas
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <div className="flex flex-col items-start gap-1 rounded-xl border border-border bg-surface-muted p-4">
              <p className="text-xs text-foreground-muted">
                Created {formatDate(project.createdAt)} · updated {formatDate(project.updatedAt)}
              </p>
              <DeleteProjectDialog projectId={project.id} projectName={project.name} />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
