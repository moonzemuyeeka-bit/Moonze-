"use client";

import type * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatZmw, formatZmwShort, toKwacha } from "@/lib/money";

/**
 * Platform-wide charts for the administration console.
 *
 * Same contract as the supplier charts: the server computes every figure and
 * passes it in, the client only draws. Each chart ships a screen-reader table
 * with the same numbers, so the page is usable without seeing the graphics at
 * all — these are summaries of the tables beside them, never the only source.
 */

const SERIES_COLOURS = [
  "#166534",
  "#15803d",
  "#16a34a",
  "#4ade80",
  "#ca8a04",
  "#a16207",
  "#854d0e",
  "#475569",
];

type TooltipEntry = { name?: string | number; value?: string | number };

function TooltipCard({
  label,
  children,
}: {
  label?: string | number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {children}
    </div>
  );
}

/**
 * Recharts hands the tooltip a loosely typed payload, so each chart supplies its
 * own renderer rather than a `formatter` callback — that way the money formatting
 * lives in one place per chart and nothing has to be cast at the call site.
 */
function TrendTooltip({
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
    <TooltipCard label={label}>
      {payload.map((entry) => (
        <p key={String(entry.name)} className="text-foreground-muted">
          {entry.name}:{" "}
          <span className="font-semibold text-foreground">
            {entry.name === "Goods value"
              ? formatZmw(Number(entry.value ?? 0) * 100)
              : Number(entry.value ?? 0)}
          </span>
        </p>
      ))}
    </TooltipCard>
  );
}

function MoneyTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];

  return (
    <TooltipCard label={entry?.name}>
      <p className="font-semibold text-foreground">{formatZmw(Number(entry?.value ?? 0) * 100)}</p>
    </TooltipCard>
  );
}

function ShareTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  total: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const value = Number(entry?.value ?? 0);

  return (
    <TooltipCard label={entry?.name}>
      <p className="font-semibold text-foreground">
        {value} ({total === 0 ? 0 : Math.round((value / total) * 100)}%)
      </p>
    </TooltipCard>
  );
}

export type PlatformMonthDatum = {
  label: string;
  orders: number;
  gmvMinor: number;
};

/**
 * Orders and goods value by month.
 *
 * Two axes because the two questions are different — "is the marketplace being
 * used" is a count, "is it carrying real value" is money — and reading them
 * against each other is how you tell a busy month of small orders from a quiet
 * month of large ones.
 */
export function PlatformTrendChart({ data }: { data: PlatformMonthDatum[] }) {
  const rows = data.map((row) => ({
    label: row.label,
    Orders: row.orders,
    "Goods value": toKwacha(row.gmvMinor),
  }));

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-foreground-muted">
        No orders have been placed in this window yet.
      </p>
    );
  }

  return (
    <figure className="w-full">
      <figcaption className="sr-only">
        Orders placed and value of goods sold, by month, in Zambian Kwacha.
      </figcaption>
      <div className="h-72 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="money"
              tickFormatter={(value: number) => formatZmwShort(value * 100)}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar
              yAxisId="money"
              dataKey="Goods value"
              fill="#166534"
              radius={[3, 3, 0, 0]}
              maxBarSize={44}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="Orders"
              stroke="#ca8a04"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Orders and goods value by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Orders</th>
            <th scope="col">Goods value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.Orders}</td>
              <td>{formatZmw(row["Goods value"] * 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export type NamedCountDatum = {
  name: string;
  count: number;
};

/** A share-of-total breakdown: roles, fulfilment methods, provinces. */
export function ShareChart({
  data,
  caption,
  emptyMessage,
}: {
  data: NamedCountDatum[];
  caption: string;
  emptyMessage: string;
}) {
  const rows = data.filter((row) => row.count > 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-foreground-muted">{emptyMessage}</p>;
  }

  return (
    <figure className="w-full">
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="name"
              innerRadius="48%"
              outerRadius="78%"
              paddingAngle={2}
            >
              {rows.map((row, index) => (
                <Cell key={row.name} fill={SERIES_COLOURS[index % SERIES_COLOURS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ShareTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted">
        {rows.map((row, index) => (
          <li key={row.name} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: SERIES_COLOURS[index % SERIES_COLOURS.length] }}
            />
            {row.name}
            <span className="font-medium text-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export type CategoryValueDatum = {
  name: string;
  valueMinor: number;
};

/** Where the money is, by category or by supplier. */
export function ValueByNameChart({
  data,
  caption,
  emptyMessage,
}: {
  data: CategoryValueDatum[];
  caption: string;
  emptyMessage: string;
}) {
  const rows = data
    .filter((row) => row.valueMinor > 0)
    .map((row) => ({ name: row.name, Value: toKwacha(row.valueMinor) }));

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-foreground-muted">{emptyMessage}</p>;
  }

  return (
    <figure className="w-full">
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
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
              width={140}
              tick={{ fontSize: 11, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="Value" radius={[0, 3, 3, 0]} maxBarSize={22}>
              {rows.map((row, index) => (
                <Cell key={row.name} fill={SERIES_COLOURS[index % SERIES_COLOURS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{formatZmw(row.Value * 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
