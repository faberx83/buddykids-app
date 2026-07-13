"use client";

import { useMemo, useState } from "react";
import { SeasonWeek } from "@/lib/data/planner";
import { KidOverlap } from "@/lib/nextgen/planner-insights";
import { buildCalendarMonths, defaultMonthKey, CalendarDay } from "@/lib/nextgen/calendar-weeks";
import { Kid } from "@/lib/types";

// SPRINT 5.2 (NEXTGEN) — Planner, modalità Calendario: "Giorno, settimana e
// mese, con colori per figlio e conflitti evidenziati" (PRD Family Planner).
// Vedi lib/nextgen/calendar-weeks.ts per il limite di dati dichiarato: niente
// vista Giorno con presenza reale (il modello dati copre solo intere
// settimane, non singoli giorni di frequenza) — qui offriamo Mese e
// Settimana, entrambe derivate dalle stesse SeasonWeek già usate in
// Organizzazione, senza nuove query.

type ViewMode = "mese" | "settimana";

const WEEKDAY_SHORT_IT = ["L", "M", "M", "G", "V", "S", "D"];

const DOT_BG: Record<string, string> = {
  sky: "bg-sky",
  aqua: "bg-aqua",
  orange: "bg-orange",
  purple: "bg-purple",
  green: "bg-green",
};

export default function PlannerCalendarView({
  weeks,
  kids,
  overlaps,
}: {
  weeks: SeasonWeek[];
  kids: Kid[];
  overlaps: KidOverlap[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("mese");
  const months = useMemo(() => buildCalendarMonths(weeks, kids, overlaps), [weeks, kids, overlaps]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [monthKey, setMonthKey] = useState<string>(() => defaultMonthKey(months, todayIso));
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const monthIndex = months.findIndex((m) => m.key === monthKey);
  const activeMonth = months[monthIndex] ?? months[0] ?? null;

  const conflictWeekIndexes = useMemo(() => {
    function weekIndexFromLabel(label: string): number | null {
      const m = label.match(/\d+/);
      return m ? Number(m[0]) : null;
    }
    return new Set(overlaps.map((o) => weekIndexFromLabel(o.weekLabel)).filter((i): i is number => i !== null));
  }, [overlaps]);

  if (weeks.length === 0 || !activeMonth) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
        <i className="ti ti-calendar mb-2 text-2xl text-ink-3" />
        <p className="text-xs text-ink-2">Nessuna settimana stagionale disponibile.</p>
      </div>
    );
  }

  // Legenda colori per bambino — stessa tecnica del chip selettore bambino
  // già usato altrove nel Planner (kid.accentColor), qui mostrata come
  // legenda fissa (non richiede alcuna selezione).
  const kidLegend = kids.map((k) => {
    const dot = months
      .flatMap((m) => m.cells)
      .find((c) => c?.kids.some((ck) => ck.kidId === k.id))
      ?.kids.find((ck) => ck.kidId === k.id);
    return { kidId: k.id, kidName: k.name, accentColor: dot?.accentColor };
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Selettore Mese/Settimana */}
      <div className="flex gap-2">
        {(
          [
            { key: "mese", label: "Mese" },
            { key: "settimana", label: "Settimana" },
          ] as { key: ViewMode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => {
              setViewMode(opt.key);
              setSelectedDay(null);
            }}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${
              viewMode === opt.key ? "bg-ink text-white" : "bg-bg text-ink-2"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Legenda per bambino */}
      {kids.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5">
          {kidLegend.map((k) => (
            <div key={k.kidId} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${DOT_BG[k.accentColor ?? "sky"]}`} />
              <span className="text-[11.5px] font-semibold text-ink-2">{k.kidName}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <i className="ti ti-alert-triangle text-[13px] text-[#9a6b00]" />
            <span className="text-[11px] text-ink-3">Sovrapposizione</span>
          </div>
        </div>
      )}

      {viewMode === "mese" ? (
        <div className="rounded-2xl bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              disabled={monthIndex <= 0}
              onClick={() => setMonthKey(months[Math.max(0, monthIndex - 1)].key)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2 disabled:opacity-30"
              aria-label="Mese precedente"
            >
              <i className="ti ti-chevron-left text-[15px]" />
            </button>
            <div className="text-sm font-bold text-ink">{activeMonth.label}</div>
            <button
              type="button"
              disabled={monthIndex >= months.length - 1}
              onClick={() => setMonthKey(months[Math.min(months.length - 1, monthIndex + 1)].key)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2 disabled:opacity-30"
              aria-label="Mese successivo"
            >
              <i className="ti ti-chevron-right text-[15px]" />
            </button>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT_IT.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-ink-3">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {activeMonth.cells.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-square" />;
              const isToday = cell.dateIso === todayIso;
              const isSelected = selectedDay?.dateIso === cell.dateIso;
              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  disabled={!cell.inSeason}
                  onClick={() => setSelectedDay(isSelected ? null : cell)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] ${
                    isSelected
                      ? "bg-[#EFECFD] font-bold text-ink"
                      : isToday
                        ? "border border-[#5B4FE9] font-semibold text-ink"
                        : cell.inSeason
                          ? "text-ink"
                          : "text-ink-3/50"
                  }`}
                >
                  <span>{cell.dayOfMonth}</span>
                  {cell.kids.length > 0 && (
                    <span className="mt-0.5 flex gap-0.5">
                      {cell.kids.slice(0, 3).map((k) => (
                        <span key={k.kidId} className={`h-1.5 w-1.5 rounded-full ${DOT_BG[k.accentColor]}`} />
                      ))}
                    </span>
                  )}
                  {cell.hasConflict && (
                    <i className="ti ti-alert-triangle absolute -right-0.5 -top-0.5 text-[10px] text-[#9a6b00]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {weeks.map((w) => {
            const hasConflict = conflictWeekIndexes.has(w.index);
            const isSelected = selectedDay?.weekIndex === w.index;
            return (
              <button
                key={w.index}
                type="button"
                onClick={() =>
                  setSelectedDay(
                    isSelected
                      ? null
                      : {
                          dateIso: w.startDate,
                          dayOfMonth: 0,
                          weekIndex: w.index,
                          weekLabel: w.label,
                          inSeason: true,
                          covered: w.covered,
                          dismissed: w.dismissed,
                          activityName: w.activityName,
                          kids: w.coveredKids
                            .map((ck) => kids.find((k) => k.id === ck.kidId))
                            .filter((k): k is Kid => Boolean(k))
                            .map((k) => ({
                              kidId: k.id,
                              kidName: k.name,
                              accentColor: k.accentColor ?? "sky",
                            })),
                          hasConflict,
                        }
                  )
                }
                className={`flex items-center gap-3 rounded-xl p-3 text-left ${
                  isSelected ? "bg-[#EFECFD]" : w.dismissed ? "bg-bg" : "bg-white"
                }`}
              >
                <div className="w-16 flex-shrink-0 whitespace-nowrap text-[11.5px] font-bold text-ink">
                  Sett. {w.index}
                </div>
                <div className="flex flex-1 items-center gap-1">
                  {w.dismissed ? (
                    <span className="text-[11.5px] text-ink-3">Non ti serve</span>
                  ) : w.coveredKids.length > 0 ? (
                    w.coveredKids.map((ck) => {
                      const kid = kids.find((k) => k.id === ck.kidId);
                      if (!kid) return null;
                      return (
                        <span
                          key={ck.kidId}
                          className={`h-2.5 w-2.5 rounded-full ${DOT_BG[kid.accentColor ?? "sky"]}`}
                          title={kid.name}
                        />
                      );
                    })
                  ) : (
                    <span className="text-[11.5px] text-ink-3">Scoperta</span>
                  )}
                </div>
                {hasConflict && <i className="ti ti-alert-triangle flex-shrink-0 text-[15px] text-[#9a6b00]" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Riepilogo del giorno/settimana selezionata */}
      {selectedDay && (
        <div className="rounded-2xl border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-bold text-ink">
              {selectedDay.weekLabel ?? "Settimana"}
            </div>
            {selectedDay.hasConflict && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#9a6b00]">
                <i className="ti ti-alert-triangle text-[13px]" />
                Sovrapposizione
              </span>
            )}
          </div>
          {selectedDay.dismissed ? (
            <p className="text-[12.5px] text-ink-2">Segnata come &quot;non ti serve&quot;.</p>
          ) : selectedDay.kids.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {selectedDay.kids.map((k) => (
                <div key={k.kidId} className="flex items-center gap-2 text-[12.5px]">
                  <span className={`h-2.5 w-2.5 rounded-full ${DOT_BG[k.accentColor]}`} />
                  <span className="font-semibold text-ink">{k.kidName}</span>
                  <span className="text-ink-2">{selectedDay.activityName ?? "attività prenotata"}</span>
                </div>
              ))}
              {selectedDay.hasConflict && (
                <p className="mt-1 text-[11.5px] text-[#7a5400]">
                  Controlla il dettaglio in Organizzazione: uno o più bambini risultano prenotati due volte questa
                  settimana.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-2">Nessuna prenotazione per questa settimana.</p>
          )}
        </div>
      )}
    </div>
  );
}
