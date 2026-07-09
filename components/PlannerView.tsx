"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Kid, PillColor } from "@/lib/types";
import { PlannerData, SeasonWeek } from "@/lib/data/planner";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { toggleWeekDismissedAction } from "@/app/actions/profile";
import { lightBgClasses } from "@/lib/colors";

// Colore testo/icona pieno per categoria (thumbnail settimana coperta) —
// stessi colori di lib/colors.ts pillClasses, qui separati dallo sfondo.
const TINT_TEXT_CLASSES: Record<PillColor, string> = {
  sky: "text-sky",
  aqua: "text-[#1fa88e]",
  orange: "text-[#d4622a]",
  purple: "text-[#6b58d4]",
  green: "text-[#2d8f52]",
};

// Vista "risolta" di una settimana per la modalità corrente (aggregata o per
// un bambino specifico) — calcolata da SeasonWeek + il filtro attivo.
interface ResolvedWeek extends SeasonWeek {
  viewCovered: boolean;
  viewActivityName?: string;
  viewActivityTagColor?: PillColor;
  // Solo in vista aggregata con più bambini: la settimana è coperta ma non
  // per TUTTI — utile a non far credere al genitore che sia a posto quando
  // in realtà manca ancora un figlio.
  partialForKids: Kid[]; // bambini NON ancora coperti questa settimana (vuoto se non parziale)
}

export default function PlannerView({
  planner,
  suggestions,
  kids,
}: {
  planner: PlannerData;
  suggestions: Activity[];
  kids: Kid[];
}) {
  const [weeks, setWeeks] = useState<SeasonWeek[]>(planner.weeks);
  const [saving, setSaving] = useState<string | null>(null);
  // null = "Tutti i bambini" (vista aggregata, comportamento storico) —
  // mostriamo il selettore solo se ci sono davvero più bambini tra cui
  // scegliere, per non aggiungere un controllo inutile alle famiglie con un
  // figlio solo.
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const showKidFilter = kids.length > 1;

  const resolvedWeeks: ResolvedWeek[] = useMemo(() => {
    return weeks.map((w) => {
      if (selectedKidId === null) {
        const partialForKids =
          showKidFilter && w.covered
            ? kids.filter((k) => !w.coveredKids.some((c) => c.kidId === k.id))
            : [];
        return {
          ...w,
          viewCovered: w.covered,
          viewActivityName: w.activityName,
          viewActivityTagColor: w.activityTagColor,
          partialForKids,
        };
      }
      const entry = w.coveredKids.find((c) => c.kidId === selectedKidId);
      return {
        ...w,
        viewCovered: Boolean(entry),
        viewActivityName: entry?.activityName,
        viewActivityTagColor: entry?.activityTagColor,
        partialForKids: [],
      };
    });
  }, [weeks, selectedKidId, kids, showKidFilter]);

  const { coveredCount, neededCount, totalCount, firstUncoveredIndex } = useMemo(() => {
    const covered = resolvedWeeks.filter((w) => w.viewCovered).length;
    const needed = resolvedWeeks.filter((w) => !w.dismissed).length;
    const firstUncovered = resolvedWeeks.find((w) => !w.viewCovered && !w.dismissed);
    return {
      coveredCount: covered,
      neededCount: needed,
      totalCount: resolvedWeeks.length,
      firstUncoveredIndex: firstUncovered?.index ?? null,
    };
  }, [resolvedWeeks]);

  const progressPercent = neededCount > 0 ? Math.round((coveredCount / neededCount) * 100) : 0;

  async function toggleDismissed(week: SeasonWeek) {
    const nextDismissed = !week.dismissed;
    setWeeks((prev) =>
      prev.map((w) => (w.index === week.index ? { ...w, dismissed: nextDismissed } : w))
    );
    if (isSupabaseConfigured) {
      setSaving(week.startDate);
      await toggleWeekDismissedAction(week.startDate, nextDismissed);
      setSaving(null);
    }
  }

  return (
    <div className="px-5 pt-4">
      {showKidFilter && (
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedKidId(null)}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              selectedKidId === null ? "bg-ink text-white" : "bg-white text-ink-2"
            }`}
          >
            Tutti
          </button>
          {kids.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setSelectedKidId(k.id)}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                selectedKidId === k.id ? "bg-ink text-white" : "bg-white text-ink-2"
              }`}
            >
              {k.emoji} {k.name}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 rounded-2xl bg-white p-3.5">
        <div className="flex items-center justify-between text-[12.5px] font-semibold text-ink-2">
          <span>
            {coveredCount} di {neededCount} settimane coperte
            {selectedKidId && ` per ${kids.find((k) => k.id === selectedKidId)?.name ?? ""}`}
          </span>
          {neededCount < totalCount && <span>{totalCount - neededCount} non ti servono</span>}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sky-light">
          <div
            className="h-full rounded-full bg-sky transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mb-4 space-y-2.5">
        {resolvedWeeks.map((w) => {
          const color = w.viewActivityTagColor ?? "sky";
          const rowBg = w.viewCovered ? lightBgClasses[color] : "bg-white";
          const riempiHref = selectedKidId
            ? `/search?week=${w.startDate}&kid=${selectedKidId}`
            : `/search?week=${w.startDate}`;

          return (
            <div key={w.index} className={`flex items-center gap-2.5 rounded-2xl p-3.5 ${rowBg}`}>
              {w.viewCovered ? (
                <>
                  <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl bg-white/60">
                    <i className={`ti ti-calendar-check text-lg ${TINT_TEXT_CLASSES[color]}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold text-ink">
                      {w.viewActivityName ?? "Prenotata"}
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-ink-2">
                      Settimana {w.index} · {w.dateRange}
                      {w.partialForKids.length > 0 &&
                        ` · manca per ${w.partialForKids.map((k) => k.name).join(", ")}`}
                    </div>
                  </div>
                  {w.partialForKids.length > 0 ? (
                    <i className="ti ti-alert-circle-filled flex-shrink-0 text-[19px] text-yellow" />
                  ) : (
                    <i className="ti ti-circle-check-filled flex-shrink-0 text-[19px] text-green" />
                  )}
                </>
              ) : w.dismissed ? (
                <>
                  <div className="flex-1 text-[13px] font-medium text-ink-2">
                    Settimana {w.index} · non ti serve
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDismissed(w)}
                    disabled={saving === w.startDate}
                    className="flex-shrink-0 text-xs font-semibold text-sky disabled:opacity-60"
                  >
                    Ripristina
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 text-[13px] font-bold text-ink-3">
                    Settimana {w.index} · scoperta
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDismissed(w)}
                    disabled={saving === w.startDate}
                    className="flex-shrink-0 text-[11px] font-medium text-ink-3 underline disabled:opacity-60"
                  >
                    Non mi serve
                  </button>
                  <Link
                    href={riempiHref}
                    className="flex-shrink-0 rounded-full bg-orange px-3.5 py-[7px] text-[11.5px] font-bold text-white"
                  >
                    Riempi
                  </Link>
                </>
              )}
            </div>
          );
        })}
      </div>

      {firstUncoveredIndex !== null && suggestions.length > 0 && (
        <div className="mb-2">
          <div className="mb-2.5 text-sm font-bold text-ink">
            Per riempire la settimana {firstUncoveredIndex}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((a) => {
              const color = a.tags[0]?.color ?? "sky";
              return (
                <Link
                  key={a.id}
                  href={`/activity/${a.id}`}
                  className={`overflow-hidden rounded-2xl p-2.5 transition-transform hover:scale-[0.985] ${lightBgClasses[color]}`}
                >
                  <div
                    className="flex h-11 items-center justify-center rounded-xl text-2xl"
                    style={{ background: a.imgGradient }}
                  >
                    {a.emoji}
                  </div>
                  <div className="mt-2 truncate text-xs font-bold text-ink">{a.name}</div>
                  <div className="text-[11px] text-ink-2">€{a.pricePerWeek}</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
