"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function TrendLineChart<T extends object>({
  data,
  dataKey,
  labelKey,
  color = "#4DAFEF",
  height = 240,
  valueSuffix = "%",
}: {
  data: T[];
  dataKey: keyof T & string;
  labelKey: keyof T & string;
  color?: string;
  height?: number;
  valueSuffix?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-ink-2">
        Nessun dato disponibile.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
        <XAxis
          dataKey={labelKey as string}
          tick={{ fontSize: 11, fill: "#6B7280" }}
          axisLine={{ stroke: "#E8EBF0" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6B7280" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}${valueSuffix}`}
        />
        <Tooltip
          formatter={(value) => [`${value}${valueSuffix}`, ""]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #E8EBF0",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        />
        <Line
          type="monotone"
          dataKey={dataKey as string}
          stroke={color}
          strokeWidth={2.5}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
