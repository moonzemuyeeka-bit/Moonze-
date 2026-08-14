"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatZmw, formatZmwShort, toKwacha } from "@/lib/money";

/**
 * Supplier trading charts.
 *
 * Client components because Recharts measures the DOM, but every figure is
 * computed on the server and passed in, so a chart can never disagree with the
 * table beside it. Each one carries a screen-reader table: a supplier using a
 * reader still needs to know which month was good.
 */

const BAR_COLOURS = ["#166534", "#15803d", "#16a34a", "#ca8a04", "#a16207", "#854d0e"];

type MoneyTooltipPayload = {
  name?: string;
  value?: number;
  payload?: { orders?: number };
};

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: MoneyTooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const orders = payload[0]?.payload?.orders;

  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} className="text-foreground-muted">
          {entry.name}:{" "}
          <span className="font-semibold text-foreground">{formatZmw((entry.value ?? 0) * 100)}</span>
        </p>
      ))}
      {typeof orders === "number" ? (
        <p className="text-foreground-muted">
          Orders: <span className="font-semibold text-foreground">{orders}</span>
        </p>
      ) : null}
    </div>
  );
}

export type MonthlyTradingDatum = {
  label: string;
  orders: number;
  revenueMinor: number;
};

/** Revenue by month — the shape of the trading year. */
export function MonthlyRevenueChart({ data }: { data: MonthlyTradingDatum[] }) {
  const rows = data.map((row) => ({
    label: row.label,
    orders: row.orders,
    Revenue: toKwacha(row.revenueMinor),
  }));

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-foreground-muted">
        Complete an order and your monthly trading appears here.
      </p>
    );
  }

  return (
    <figure className="w-full">
      <figcaption className="sr-only">
        Revenue from delivered and completed orders, by month, in Zambian Kwacha.
      </figcaption>
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value: number) => formatZmwShort(value * 100)}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="Revenue" fill="#166534" radius={[3, 3, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Orders and revenue by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Orders</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.orders}</td>
              <td>{formatZmw(row.Revenue * 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export type CategoryRevenueDatum = {
  category: string;
  revenueMinor: number;
};

/** Which categories the money actually comes from. */
export function CategoryRevenueChart({ data }: { data: CategoryRevenueDatum[] }) {
  const rows = data
    .filter((row) => row.revenueMinor > 0)
    .map((row) => ({ name: row.category, Revenue: toKwacha(row.revenueMinor) }));

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-foreground-muted">
        Once orders complete, this shows which categories earn you the most.
      </p>
    );
  }

  return (
    <figure className="w-full">
      <figcaption className="sr-only">
        Revenue by product category, in Zambian Kwacha.
      </figcaption>
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
              width={124}
              tick={{ fontSize: 11, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="Revenue" radius={[0, 3, 3, 0]} maxBarSize={22}>
              {rows.map((row, index) => (
                <Cell key={row.name} fill={BAR_COLOURS[index % BAR_COLOURS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Revenue by category</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{formatZmw(row.Revenue * 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
