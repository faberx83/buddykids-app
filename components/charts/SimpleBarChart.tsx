"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function SimpleBarChart<T extends object>({
  data,
  dataKey,
  labelKey,
  color = "#4DAFEF",
  height = 220,
  valueSuffix = "",
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
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
        <XAxis
          dataKey={labelKey as string}
          tick={{ fontSize: 11, fill: "#6B7280" }}
          axisLine={{ stroke: "#E8EBF0" }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [`${value}${valueSuffix}`, ""]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #E8EBF0",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        />
        <Bar dataKey={dataKey as string} fill={color} radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
