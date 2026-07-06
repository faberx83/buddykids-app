"use client";

import { useMemo, useState } from "react";
import { DayAvailability } from "@/lib/types";

const weekdayLabels = ["Lun", "Mar", "Mer", "Gio", "Ven"];

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function cellTone(day: DayAvailability) {
  if (!day.isOpen) return "bg-[#F4F6FA] text-ink-3 border-[#E8EBF0]";
  if (day.spotsLeft === 0) return "bg-orange-light text-[#d4622a] border-orange-mid";
  if (day.spotsLeft <= 3) return "bg-yellow-light text-[#9a6b00] border-yellow";
  return "bg-green-light text-[#2d8f52] border-green";
}

export default function AvailabilityCalendar({
  days,
  mode,
  highlightDates,
  onChange,
}: {
  days: DayAvailability[];
  mode: "edit" | "view";
  highlightDates?: string[];
  onChange?: (updated: DayAvailability[]) => void;
}) {
  const [localDays, setLocalDays] = useState(days);
  const [selected, setSelected] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const chunks: DayAvailability[][] = [];
    for (let i = 0; i < localDays.length; i += 5) chunks.push(localDays.slice(i, i + 5));
    return chunks;
  }, [localDays]);

  const selectedDay = localDays.find((d) => d.date === selected) ?? null;

  function updateSelectedDay(patch: Partial<DayAvailability>) {
    if (!selected) return;
    const updated = localDays.map((d) => (d.date === selected ? { ...d, ...patch } : d));
    setLocalDays(updated);
    onChange?.(updated);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-2">
        <Legend swatch="bg-green-light border-green" label="Disponibile" />
        <Legend swatch="bg-yellow-light border-yellow" label="Ultimi posti" />
        <Legend swatch="bg-orange-light border-orange-mid" label="Pieno" />
        <Legend swatch="bg-[#F4F6FA] border-[#E8EBF0]" label="Chiuso" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th className="w-24 text-left text-[11px] font-semibold text-ink-3">Settimana</th>
              {weekdayLabels.map((w) => (
                <th key={w} className="text-center text-[11px] font-semibold text-ink-3">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => (
              <tr key={i}>
                <td className="pr-2 text-xs font-medium text-ink-2">
                  {formatDate(week[0].date)} – {formatDate(week[week.length - 1].date)}
                </td>
                {week.map((day) => {
                  const isHighlighted = highlightDates?.includes(day.date);
                  const isSelected = selected === day.date;
                  return (
                    <td key={day.date}>
                      <button
                        type="button"
                        onClick={() => mode === "edit" && setSelected(day.date)}
                        className={`relative flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-md border text-[11px] font-semibold transition-all ${cellTone(
                          day
                        )} ${mode === "edit" ? "cursor-pointer hover:brightness-95" : "cursor-default"} ${
                          isSelected ? "ring-2 ring-sky" : ""
                        } ${isHighlighted ? "outline outline-2 outline-offset-1 outline-sky" : ""}`}
                      >
                        <span>{formatDate(day.date)}</span>
                        <span className="text-[10px] font-normal">
                          {!day.isOpen
                            ? "Chiuso"
                            : day.spotsLeft === 0
                            ? "Pieno"
                            : `${day.spotsLeft} posti`}
                        </span>
                        {(day.discountPercent || day.lastMinute) && (
                          <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 rounded-full bg-purple px-1.5 py-0.5 text-[9px] font-bold text-white">
                            {day.lastMinute ? "⚡" : `-${day.discountPercent}%`}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mode === "edit" && selectedDay && (
        <div className="mt-4 rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-ink">
              Modifica {formatDate(selectedDay.date)}
            </div>
            <button onClick={() => setSelected(null)} className="text-ink-3">
              <i className="ti ti-x text-lg" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-md bg-bg px-3 py-2.5 text-sm">
              Giorno aperto
              <input
                type="checkbox"
                checked={selectedDay.isOpen}
                onChange={(e) => updateSelectedDay({ isOpen: e.target.checked })}
                className="h-4 w-4 accent-sky"
              />
            </label>
            <label className="flex items-center justify-between rounded-md bg-bg px-3 py-2.5 text-sm">
              Promo last-minute
              <input
                type="checkbox"
                checked={Boolean(selectedDay.lastMinute)}
                onChange={(e) => updateSelectedDay({ lastMinute: e.target.checked })}
                className="h-4 w-4 accent-purple"
              />
            </label>
            <label className="rounded-md bg-bg px-3 py-2.5 text-sm">
              <div className="mb-1 text-xs text-ink-2">Posti totali</div>
              <input
                type="number"
                min={0}
                value={selectedDay.capacity}
                onChange={(e) => {
                  const capacity = Number(e.target.value);
                  updateSelectedDay({
                    capacity,
                    spotsLeft: Math.min(selectedDay.spotsLeft, capacity),
                  });
                }}
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded-md bg-bg px-3 py-2.5 text-sm">
              <div className="mb-1 text-xs text-ink-2">Posti liberi</div>
              <input
                type="number"
                min={0}
                max={selectedDay.capacity}
                value={selectedDay.spotsLeft}
                onChange={(e) => updateSelectedDay({ spotsLeft: Number(e.target.value) })}
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              />
            </label>
            <label className="col-span-2 rounded-md bg-bg px-3 py-2.5 text-sm">
              <div className="mb-1 text-xs text-ink-2">Sconto sul giorno (%)</div>
              <input
                type="number"
                min={0}
                max={90}
                value={selectedDay.discountPercent ?? 0}
                onChange={(e) =>
                  updateSelectedDay({
                    discountPercent: Number(e.target.value) || undefined,
                  })
                }
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              />
            </label>
          </div>

          <p className="mt-3 text-[11px] text-ink-3">
            Modifiche demo salvate solo in questa sessione — quando colleghi Supabase
            aggiorneranno la tabella <code className="rounded bg-bg px-1">activity_days</code>.
          </p>
        </div>
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm border ${swatch}`} />
      {label}
    </div>
  );
}
