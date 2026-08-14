"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BUDGET_CATEGORY_COLOURS, BUDGET_CATEGORY_LABELS } from "@/lib/labels";
import { formatZmw, formatZmwShort, toKwacha } from "@/lib/money";
import type { BudgetCategoryKey } from "@prisma/client";

/**
 * Budget visualisations.
 *
 * Client components because Recharts measures the DOM, but they are handed
 * already-computed figures: no arithmetic happens in the browser, so the numbers
 * in a chart and the numbers in the table beside it cannot disagree.
 *
 * Each chart is paired with an accessible fallback — a chart alone is unusable
 * with a screen reader, so the underlying figures are always available as text.
 */

export type BudgetChartDatum = {
  key: BudgetCategoryKey;
  plannedMinor: number;
  spentMinor: number;
};

type TooltipEntry = { name?: string; value?: number; payload?: { key?: BudgetCategoryKey } };

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} className="text-foreground-muted">
          {entry.name}:{" "}
          <span className="font-semibold text-foreground">
            {formatZmw((entry.value ?? 0) * 100)}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Planned against spent, per category — the view that answers "where is it going?". */
export function BudgetCategoryBars({ data }: { data: BudgetChartDatum[] }) {
  const rows = data
    .filter((row) => row.plannedMinor > 0 || row.spentMinor > 0)
    .map((row) => ({
      key: row.key,
      name: BUDGET_CATEGORY_LABELS[row.key],
      Planned: toKwacha(row.plannedMinor),
      Spent: toKwacha(row.spentMinor),
    }));

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-foreground-muted">
        Set planned amounts or record spending to see this chart.
      </p>
    );
  }

  return (
    <figure className="w-full">
      <figcaption className="sr-only">
        Planned and spent amounts for each budget category, in Zambian Kwacha.
      </figcaption>
      <div className="h-[22rem] w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatZmwShort(value * 100)}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={132}
              tick={{ fontSize: 11, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<MoneyTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Planned" fill="#cbd5e1" radius={[0, 3, 3, 0]} barSize={9} />
            <Bar dataKey="Spent" radius={[0, 3, 3, 0]} barSize={9}>
              {rows.map((row) => (
                <Cell key={row.key} fill={BUDGET_CATEGORY_COLOURS[row.key]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Planned and spent per budget category</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Planned</th>
            <th scope="col">Spent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.name}</th>
              <td>{formatZmw(row.Planned * 100)}</td>
              <td>{formatZmw(row.Spent * 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Share of actual spend by category. */
export function SpendByCategoryPie({ data }: { data: BudgetChartDatum[] }) {
  const rows = data
    .filter((row) => row.spentMinor > 0)
    .sort((a, b) => b.spentMinor - a.spentMinor)
    .map((row) => ({
      key: row.key,
      name: BUDGET_CATEGORY_LABELS[row.key],
      value: toKwacha(row.spentMinor),
    }));

  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-foreground-muted">
        Record your first expense to see how your spending splits by category.
      </p>
    );
  }

  return (
    <figure className="w-full">
      <figcaption className="sr-only">Share of spending by budget category.</figcaption>
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius="52%"
              outerRadius="82%"
              paddingAngle={1.5}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {rows.map((row) => (
                <Cell key={row.key} fill={BUDGET_CATEGORY_COLOURS[row.key]} />
              ))}
            </Pie>
            <Tooltip content={<MoneyTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        {rows.slice(0, 8).map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: BUDGET_CATEGORY_COLOURS[row.key] }}
            />
            <span className="min-w-0 flex-1 truncate text-foreground-muted">{row.name}</span>
            <span className="font-medium tabular-nums">
              {total > 0 ? Math.round((row.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
