"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldRow } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  BUDGET_CATEGORY_KEYS,
  BUDGET_CATEGORY_LABELS,
  BUDGET_TRANSACTION_TYPE_LABELS,
} from "@/lib/labels";
import { formatZmw, toKwacha } from "@/lib/money";
import { WALLET_CUSTODY_NOTICE } from "@/lib/domain/budget";
import {
  addBudgetTransactionAction,
  recordWalletEntryAction,
  updateBudgetAllocationsAction,
} from "@/server/projects/actions";
import type { BudgetCategoryKey } from "@prisma/client";

export type AllocationRow = {
  id: string;
  key: BudgetCategoryKey;
  plannedMinor: number;
  spentMinor: number;
};

/**
 * Category allocation editor.
 *
 * The running total is computed as you type and compared against the project's
 * headline budget: the whole point of the screen is noticing that the categories
 * add up to more than you have before you order the roof sheets.
 */
export function AllocationsForm({
  projectId,
  rows,
  totalBudgetMinor,
}: {
  projectId: string;
  rows: AllocationRow[];
  totalBudgetMinor: number;
}) {
  const [state, formAction] = useActionState(updateBudgetAllocationsAction, null);

  const initial = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const key of BUDGET_CATEGORY_KEYS) {
      const row = rows.find((entry) => entry.key === key);
      map[key] = row && row.plannedMinor > 0 ? String(toKwacha(row.plannedMinor)) : "";
    }
    return map;
  }, [rows]);

  const [values, setValues] = React.useState(initial);

  const allocatedMinor = Object.values(values).reduce((total, value) => {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    return total + (Number.isFinite(parsed) ? Math.round(parsed * 100) : 0);
  }, 0);
  const differenceMinor = totalBudgetMinor - allocatedMinor;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />

      <div className="grid gap-3 sm:grid-cols-2">
        {BUDGET_CATEGORY_KEYS.map((key) => {
          const row = rows.find((entry) => entry.key === key);
          return (
            <Field
              key={key}
              name={`planned.${key}`}
              label={BUDGET_CATEGORY_LABELS[key]}
              error={fieldError(state, `planned.${key}`)}
              hint={
                row && row.spentMinor > 0 ? `${formatZmw(row.spentMinor)} spent` : undefined
              }
            >
              {(control) => (
                <Input
                  {...control}
                  inputMode="decimal"
                  placeholder="0"
                  value={values[key] ?? ""}
                  onChange={(event) =>
                    setValues((previous) => ({ ...previous, [key]: event.target.value }))
                  }
                />
              )}
            </Field>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-muted p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-foreground-muted">Total budget</span>
          <span className="font-semibold tabular-nums">{formatZmw(totalBudgetMinor)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground-muted">Allocated to categories</span>
          <span className="font-semibold tabular-nums">{formatZmw(allocatedMinor)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-1">
          <span className="text-foreground-muted">
            {differenceMinor < 0 ? "Over-allocated" : "Not yet allocated"}
          </span>
          <span
            className={
              differenceMinor < 0
                ? "font-semibold tabular-nums text-danger-700"
                : "font-semibold tabular-nums text-brand-700"
            }
          >
            {formatZmw(Math.abs(differenceMinor))}
          </span>
        </div>
      </div>

      {differenceMinor < 0 ? (
        <Alert tone="warning" title="Your categories add up to more than your budget">
          You can still save this — but either raise the project budget or trim a category, otherwise
          you will run short before the build is finished.
        </Alert>
      ) : null}

      <FormMessage state={state} successMessage="Budget allocations saved." />

      <SubmitButton>Save allocations</SubmitButton>
    </form>
  );
}

/** Records money spent on this project, whether or not it was bought on BuildLink. */
export function AddTransactionDialog({
  projectId,
  categories,
}: {
  projectId: string;
  categories: Array<{ id: string; key: BudgetCategoryKey }>;
}) {
  const [state, formAction] = useActionState(addBudgetTransactionAction, null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Record spending
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record spending</DialogTitle>
          <DialogDescription>
            Add anything you paid for this build — cement bought at a hardware, a bricklayer&apos;s
            wages, transport. Orders placed on BuildLink are recorded automatically.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="projectId" value={projectId} />

          <FieldRow>
            <Field name="amount" label="Amount (ZMW)" required error={fieldError(state, "amount")}>
              {(control) => <Input {...control} inputMode="decimal" placeholder="2500" />}
            </Field>
            <Field name="type" label="Type" required error={fieldError(state, "type")}>
              {(control) => (
                <NativeSelect {...control} defaultValue="EXPENSE">
                  {(["EXPENSE", "MATERIAL_PURCHASE", "REFUND", "ADJUSTMENT"] as const).map(
                    (type) => (
                      <option key={type} value={type}>
                        {BUDGET_TRANSACTION_TYPE_LABELS[type]}
                      </option>
                    ),
                  )}
                </NativeSelect>
              )}
            </Field>
          </FieldRow>

          <Field
            name="categoryId"
            label="Budget category"
            hint="Optional, but it is what makes the breakdown useful."
            error={fieldError(state, "categoryId")}
          >
            {(control) => (
              <NativeSelect {...control} defaultValue="">
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {BUDGET_CATEGORY_LABELS[category.key]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Field
            name="description"
            label="What was it for?"
            required
            error={fieldError(state, "description")}
          >
            {(control) => <Input {...control} placeholder="20 pockets of cement — Kabwe Road" />}
          </Field>

          <Field name="occurredAt" label="Date" hint="Defaults to today.">
            {(control) => <Input {...control} type="date" />}
          </Field>

          <FormMessage state={state} successMessage="Spending recorded." />

          <DialogFooter>
            <SubmitButton>Record spending</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Wallet entry.
 *
 * The custody notice is repeated inside the form, not just on the page: this is
 * the moment somebody might otherwise assume they are sending money to
 * BuildLink.
 */
export function RecordWalletEntryDialog({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(recordWalletEntryAction, null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Wallet />
          Record set-aside funds
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record funds set aside</DialogTitle>
          <DialogDescription>
            Keep a note of money you have put aside for this build, wherever it is held.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="projectId" value={projectId} />

          <Alert tone="info" title="BuildLink does not hold your money">
            {WALLET_CUSTODY_NOTICE}
          </Alert>

          <FieldRow>
            <Field name="amount" label="Amount (ZMW)" required error={fieldError(state, "amount")}>
              {(control) => <Input {...control} inputMode="decimal" placeholder="50000" />}
            </Field>
            <Field name="type" label="Entry" required error={fieldError(state, "type")}>
              {(control) => (
                <NativeSelect {...control} defaultValue="DEPOSIT_RECORDED">
                  <option value="DEPOSIT_RECORDED">Money set aside</option>
                  <option value="REFUND_RECORDED">Refund received</option>
                  <option value="ADJUSTMENT">Correction</option>
                </NativeSelect>
              )}
            </Field>
          </FieldRow>

          <Field
            name="description"
            label="Note"
            required
            error={fieldError(state, "description")}
          >
            {(control) => <Textarea {...control} rows={2} placeholder="Savings moved for roofing" />}
          </Field>

          <Field
            name="reference"
            label="Reference"
            hint="Optional — a bank or mobile money reference."
            error={fieldError(state, "reference")}
          >
            {(control) => <Input {...control} placeholder="MTN-88213" />}
          </Field>

          <FormMessage state={state} successMessage="Wallet entry recorded." />

          <DialogFooter>
            <SubmitButton>Record entry</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
