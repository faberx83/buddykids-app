"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ActivityAttendanceStat } from "@/lib/data/attendance-report";

const COLORS = {
  inRitardo: "#FFA05C",
  assente: "#FF6B6B",
};

// Tasso assenza/ritardo per attività (richiesto da Fabrizio): confronto tra
// le attività del centro per capire dove ci sono più problemi, invece del
// solo numero aggregato di oggi.
export default function AttendanceRateByActivityChart({
  data,
  height = 240,
}: {
  data: ActivityAttendanceStat[];
  height?: number;
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
          dataKey="activityName"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          axisLine={{ stroke: "#E8EBF0" }}
          tickLine={false}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6B7280" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          domain={[0, 100]}
        />
        <Tooltip
          formatter={(value) => [`${value}%`, ""]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #E8EBF0",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="ritardoRate" name="% In ritardo" fill={COLORS.inRitardo} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="assenzaRate" name="% Assenza" fill={COLORS.assente} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
