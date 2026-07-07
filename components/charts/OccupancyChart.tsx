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
import { WeekOccupancy } from "@/lib/analytics";

const COLORS = {
  good: "#52C87A",
  mid: "#FFD166",
  low: "#FF6B6B",
};

function colorFor(percent: number, lowThreshold: number, midThreshold: number) {
  if (percent < lowThreshold) return COLORS.low;
  if (percent < midThreshold) return COLORS.mid;
  return COLORS.good;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: WeekOccupancy }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold text-ink">{d.label}</div>
      <div className="text-ink-2">Occupazione: {d.occupancyPercent}%</div>
      <div className="text-ink-2">
        {d.capacity - d.spotsLeft} / {d.capacity} posti occupati
      </div>
    </div>
  );
}

export default function OccupancyChart({
  data,
  lowThreshold = 40,
  midThreshold = 70,
  height = 220,
}: {
  data: WeekOccupancy[];
  lowThreshold?: number;
  midThreshold?: number;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-ink-2">
        Nessun dato di disponibilità per questa attività.
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={{ stroke: "#E8EBF0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F7F9FC" }} />
          <Bar dataKey="occupancyPercent" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((d, i) => (
              <Cell key={i} fill={colorFor(d.occupancyPercent, lowThreshold, midThreshold)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-2">
        <Legend color={COLORS.low} label={`< ${lowThreshold}% — consiglia last-minute`} />
        <Legend color={COLORS.mid} label={`${lowThreshold}-${midThreshold}%`} />
        <Legend color={COLORS.good} label={`> ${midThreshold}% — ok`} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </div>
  );
}
