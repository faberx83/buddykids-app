"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DailyAttendanceStat } from "@/lib/data/attendance-report";

const COLORS = {
  presente: "#52C87A",
  inRitardo: "#FFA05C",
  assente: "#FF6B6B",
};

// Andamento nel tempo (richiesto da Fabrizio, oltre al solo conteggio del
// giorno corrente): barre impilate presente/in ritardo/assente per giorno,
// una sopra Registro presenze, l'altra come vista storica aggregata.
export default function AttendanceTrendChart({
  data,
  height = 260,
}: {
  data: DailyAttendanceStat[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-ink-2">
        Nessun giorno di camp già trascorso da poter analizzare.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "#E8EBF0" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #E8EBF0",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="presente" name="Presente" stackId="a" fill={COLORS.presente} radius={[0, 0, 0, 0]} maxBarSize={36} />
        <Bar dataKey="inRitardo" name="In ritardo" stackId="a" fill={COLORS.inRitardo} maxBarSize={36} />
        <Bar dataKey="assente" name="Assente" stackId="a" fill={COLORS.assente} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
