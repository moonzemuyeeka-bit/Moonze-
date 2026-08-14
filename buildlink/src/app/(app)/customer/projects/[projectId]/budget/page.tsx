import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, TrendingDown, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/controls";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { formatDate } from "@/components/ui/timeline";
import { BudgetCategoryBars, SpendByCategoryPie } from "@/components/charts/budget-charts";
import { requirePagePermission } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/errors";
import { getProject, getProjectBudget } from "@/server/projects/queries";
import { formatZmw } from "@/lib/money";
import { WALLET_CUSTODY_NOTICE } from "@/lib/domain/budget";
import { BUDGET_CATEGORY_LABELS, BUDGET_TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import {
  AddTransactionDialog,
  AllocationsForm,
  RecordWalletEntryDialog,
} from "./budget-forms";
import type { BudgetTransactionType, WalletEntryType } from "@prisma/client";

export const metadata: Metadata = {
  title: "Budget & wallet",
  description: "Plan each category, record what you spend and keep every payment on file.",
};

const WALLET_ENTRY_LABELS: Record<WalletEntryType, string> = {
  DEPOSIT_RECORDED: "Set aside",
  ALLOCATION: "Committed to an order",
  ALLOCATION_RELEASED: "Released from an order",
  REFUND_RECORDED: "Refund received",
  ADJUSTMENT: "Correction",
};

/**
 * Project budget.
 *
 * Three questions, in order: how does the plan split, where has the money
 * actually gone, and what have I set aside. The charts sit above the editable
 * allocations so the effect of a change is visible on the same screen.
 */
export default async function ProjectBudgetPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requirePagePermission(
    "project:manage",
    `/customer/projects/${projectId}/budget`,
  );

  try {
    const [project, budget] = await Promise.all([
      getProject(projectId, user),
      getProjectBudget(projectId, user),
    ]);

    const { rollup } = budget;
    const chartData = rollup.categories.map((category) => ({
      key: category.key,
      plannedMinor: category.plannedMinor,
      spentMinor: category.spentMinor,
    }));
    const warnings = rollup.categories.filter(
      (category) => category.isOverBudget || category.isNearLimit,
    );

    return (
      <div className="space-y-7">
        <PageHeader
          title="Budget & wallet"
          description={`${project.name} — plan by category, record what you spend, and keep a note of funds set aside.`}
          breadcrumbs={[
            { label: "Projects", href: "/customer/projects" },
            { label: project.name, href: `/customer/projects/${project.id}` },
            { label: "Budget" },
          ]}
          actions={
            <>
              <RecordWalletEntryDialog projectId={project.id} />
              <AddTransactionDialog
                projectId={project.id}
                categories={rollup.categories.map((category) => ({
                  id: category.id,
                  key: category.key,
                }))}
              />
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total budget"
            value={formatZmw(rollup.plannedMinor, { compactDecimals: true })}
            hint={
              rollup.unallocatedMinor >= 0
                ? `${formatZmw(rollup.unallocatedMinor)} not yet allocated`
                : `${formatZmw(Math.abs(rollup.unallocatedMinor))} over-allocated`
            }
            icon={Wallet}
            tone="brand"
          />
          <StatCard
            label="Spent"
            value={formatZmw(rollup.spentMinor, { compactDecimals: true })}
            hint={`${rollup.consumedPercent}% of budget`}
            icon={Receipt}
          />
          <StatCard
            label="Remaining"
            value={formatZmw(rollup.remainingMinor, { compactDecimals: true })}
            hint={rollup.isOverBudget ? "Over the planned budget" : "Still available"}
            icon={TrendingDown}
            tone={rollup.isOverBudget ? "danger" : "success"}
          />
          <StatCard
            label="Wallet recorded"
            value={formatZmw(budget.wallet.balanceMinor, { compactDecimals: true })}
            hint={`${formatZmw(budget.wallet.allocatedMinor)} committed to orders`}
            tone="gold"
          />
        </div>

        {warnings.length > 0 ? (
          <Alert
            tone={warnings.some((category) => category.isOverBudget) ? "danger" : "warning"}
            title={
              warnings.some((category) => category.isOverBudget)
                ? "Some categories are over budget"
                : "Some categories are close to their limit"
            }
          >
            <ul className="mt-1 space-y-0.5">
              {warnings.map((category) => (
                <li key={category.id}>
                  <span className="font-medium">{BUDGET_CATEGORY_LABELS[category.key]}</span>:{" "}
                  {formatZmw(category.spentMinor)} of {formatZmw(category.plannedMinor)} (
                  {category.consumedPercent}%)
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Planned against spent
              </CardTitle>
              <CardDescription>Every category with a plan or recorded spending.</CardDescription>
            </CardHeader>
            <CardContent>
              <BudgetCategoryBars data={chartData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Where the money went
              </CardTitle>
              <CardDescription>Share of recorded spending by category.</CardDescription>
            </CardHeader>
            <CardContent>
              <SpendByCategoryPie data={chartData} />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="categories">
          <TabsList>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="spending">
              Spending ({budget.transactions.length})
            </TabsTrigger>
            <TabsTrigger value="wallet">Wallet ({budget.walletEntries.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  Category progress
                </CardTitle>
                <CardDescription>
                  Spend against plan for each of the 16 standard categories.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rollup.categories.map((category) => (
                  <div key={category.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{BUDGET_CATEGORY_LABELS[category.key]}</span>
                      <span className="tabular-nums text-foreground-muted">
                        {formatZmw(category.spentMinor)} of {formatZmw(category.plannedMinor)}
                        {category.isOverBudget ? (
                          <Badge tone="danger" size="sm" className="ml-2">
                            Over
                          </Badge>
                        ) : category.isNearLimit ? (
                          <Badge tone="warning" size="sm" className="ml-2">
                            Near limit
                          </Badge>
                        ) : null}
                      </span>
                    </div>
                    <Progress
                      value={category.consumedPercent}
                      tone={
                        category.isOverBudget
                          ? "danger"
                          : category.isNearLimit
                            ? "gold"
                            : "brand"
                      }
                      label={`${BUDGET_CATEGORY_LABELS[category.key]}: ${category.consumedPercent}% of plan spent`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  Adjust your plan
                </CardTitle>
                <CardDescription>
                  Amounts in Kwacha. Leave a category blank if it does not apply to your build.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AllocationsForm
                  projectId={project.id}
                  totalBudgetMinor={project.estimatedBudgetMinor}
                  rows={rollup.categories.map((category) => ({
                    id: category.id,
                    key: category.key,
                    plannedMinor: category.plannedMinor,
                    spentMinor: category.spentMinor,
                  }))}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="spending">
            {budget.transactions.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nothing recorded yet"
                description="Record what you spend — on BuildLink or anywhere else — and the breakdown above fills in."
              />
            ) : (
              <TableWrapper label="Recorded spending on this project">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead numeric>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budget.transactions.map((transaction) => {
                      const category = rollup.categories.find(
                        (entry) => entry.id === transaction.categoryId,
                      );
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(transaction.occurredAt)}
                          </TableCell>
                          <TableCell>
                            {transaction.description}
                            {transaction.orderId ? (
                              <Link
                                href={`/orders/${transaction.orderId}`}
                                className="ml-2 text-xs font-medium text-brand-700 underline"
                              >
                                {transaction.orderNumber}
                              </Link>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {category ? BUDGET_CATEGORY_LABELS[category.key] : "—"}
                          </TableCell>
                          <TableCell>
                            {BUDGET_TRANSACTION_TYPE_LABELS[
                              transaction.type as BudgetTransactionType
                            ]}
                          </TableCell>
                          <TableCell numeric>{formatZmw(transaction.amountMinor)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrapper>
            )}
          </TabsContent>

          <TabsContent value="wallet" className="space-y-4">
            <Alert tone="info" title="BuildLink does not hold your money">
              {WALLET_CUSTODY_NOTICE}
            </Alert>

            {budget.walletEntries.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No wallet entries"
                description="Keep a note of funds you have set aside for this build so your planning reflects what is actually available."
              />
            ) : (
              <TableWrapper label="Project wallet ledger">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead numeric>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budget.walletEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(entry.createdAt)}
                        </TableCell>
                        <TableCell>
                          {WALLET_ENTRY_LABELS[entry.type as WalletEntryType]}
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-xs text-foreground-muted">
                          {entry.reference ?? "—"}
                        </TableCell>
                        <TableCell numeric>{formatZmw(entry.amountMinor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
