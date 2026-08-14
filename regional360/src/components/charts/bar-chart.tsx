"use client";

import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Datum {
  label: string;
  value: number;
  color?: string;
}

export type ValueFormat = "currency" | "number" | "multiple" | "percent";

function makeFormatter(format?: ValueFormat) {
  switch (format) {
    case "currency":
      return (v: number) => formatCurrency(v, { compact: true });
    case "multiple":
      return (v: number) => `${v.toFixed(1)}x`;
    case "percent":
      return (v: number) => `${v.toFixed(0)}%`;
    case "number":
      return (v: number) => formatNumber(v, true);
    default:
      return undefined;
  }
}

export function SimpleBarChart({
  data,
  height = 240,
  format,
  horizontal = false,
}: {
  data: Datum[];
  height?: number;
  format?: ValueFormat;
  horizontal?: boolean;
}) {
  const formatValue = makeFormatter(format);
  const palette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 8 : 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis
              type="number"
              tickFormatter={formatValue}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={84}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
          </>
        )}
        <Tooltip
          formatter={((value: unknown) =>
            formatValue ? formatValue(Number(value)) : String(value)) as (v: unknown) => string}
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
        />
        <Bar dataKey="value" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? palette[i % palette.length]} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
