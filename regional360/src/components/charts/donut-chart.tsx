"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface Slice {
  label: string;
  value: number;
  color?: string;
}

export function DonutChart({
  data,
  height = 220,
}: {
  data: Slice[];
  height?: number;
}) {
  const palette = [
    "var(--chart-1)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={((value: unknown, name: unknown) =>
            [`${Number(value)}%`, String(name)]) as (v: unknown, n: unknown) => [string, string]}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
