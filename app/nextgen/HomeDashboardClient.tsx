"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlannerData } from "@/lib/data/planner";
import { MyBooking, BookingStatus } from "@/lib/data/my-bookings";
import { Activity } from "@/lib/types";
import ActivityCard from "@/components/ActivityCard";
import NextgenBadge from "@/components/nextgen/NextgenBadge";

// SPRINT 1 (NEXTGEN) — Dashboard Genitore come "Family Operating System":
// la schermata risponde a "la mia famiglia è organizzata per le prossime
// settimane?", non più "quali prenotazioni ho?". Ordine dei contenuti
// deciso con Fabrizio: 1) copertura, 2) prossimi impegni, 3) attività in
// evidenza, 4) stato/riepilogo sintetico. L'elenco completo (con Vista/
// Raggruppamento/Ordinamento) resta in fondo, volutamente secondario — non
// deve competere visivamente con la sintesi (vedi nota nel brief: "le
// prenotazioni non sono più il contenuto principale ma una conseguenza
// della pianificazione").

type Recommendation = { activity: Activity; kidName: string; matchPercent: number };

type GroupKey = "kid" | "week" | "month" | "activity" | "status";
type SortKey = "date" | "price" | "name";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "In attesa",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

const MONTH_LABELS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return "Senza data";
  return `${MONTH_LABELS_IT[m - 1]} ${y}`;
}

function netPrice(b: MyBooking): number {
  return b.totalAmount - b.discountAmount;
}

export default function HomeDashboardClient({
  firstName,
  planner,
  bookings,
  recommendations,
}: {
  firstName: string | null;
  planner: PlannerData;
  bookings: MyBooking[];
  recommendations: Recommendation[];
}) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const active = useMemo(() => bookings.filter((b) => b.status !== "cancelled"), [bookings]);

  const upcoming = useMemo(
    () =>
      active
        .filter((b) => b.firstWeekStart && b.firstWeekStart >= todayIso)
        .sort((a, b) => (a.firstWeekStart ?? "").localeCompare(b.firstWeekStart ?? ""))
        .slice(0, 3),
    [active, todayIso]
  );

  const totalSpent = useMemo(() => active.reduce((sum, b) => sum + netPrice(b), 0), [active]);
  const statusCounts = useMemo(() => {
    const counts: Record<BookingStatus, number> = { pending: 0, confirmed: 0, cancelled: 0 };
    for (const b of bookings) counts[b.status]++;
    return counts;
  }, [bookings]);

  const gaps = planner.weeks.filter((w) => !w.covered && !w.dismissed).length;
  const headline = gaps === 0
    ? "La tua famiglia è organizzata per tutta l'estate"
    : `Organizzati per ${planner.coveredCount} settimane su ${planner.totalCount} — ${gaps} ancora da coprire`;

  // Sezione secondaria "Tutte le prenotazioni": Vista/Raggruppamento/
  // Ordinamento tenuti separati come richiesto, ma volutamente in fondo e
  // con peso visivo ridotto rispetto alla sintesi sopra.
  const [showAll, setShowAll] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupKey>("week");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const groups = useMemo(() => {
    function keyFor(b: MyBooking): { key: string; label: string } {
      if (groupBy === "kid") return { key: b.kidNames[0] ?? "—", label: b.kidNames[0] ?? "Nessun bambino" };
      if (groupBy === "month") {
        const mk = b.firstWeekStart ? b.firstWeekStart.slice(0, 7) : "9999-99";
        return { key: mk, label: monthLabel(mk) };
      }
      if (groupBy === "activity") return { key: b.activityName, label: b.activityName };
      if (groupBy === "status") return { key: b.status, label: STATUS_LABEL[b.status] };
      return { key: b.firstWeekLabel ?? "—", label: b.firstWeekLabel ?? "Senza settimana" };
    }
    const buckets = new Map<string, { label: string; items: MyBooking[] }>();
    for (const b of bookings) {
      const { key, label } = keyFor(b);
      if (!buckets.has(key)) buckets.set(key, { label, items: [] });
      buckets.get(key)!.items.push(b);
    }
    function cmp(a: MyBooking, b: MyBooking): number {
      if (sortKey === "price") return netPrice(a) - netPrice(b);
      if (sortKey === "name") return a.activityName.localeCompare(b.activityName);
      return (a.firstWeekStart ?? "9999").localeCompare(b.firstWeekStart ?? "9999");
    }
    for (const g of buckets.values()) g.items.sort(cmp);
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [bookings, groupBy, sortKey]);

  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">
          Ciao{firstName ? ` ${firstName}` : ""} 👋
        </h1>
        <NextgenBadge />
      </div>

      {/* 1) Copertura — la prima domanda a cui rispondere */}
      <div className="rounded-2xl border border-[#E8EBF0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[15px] font-bold text-ink">{headline}</div>
          <Link
            href="/nextgen/search"
            className="flex-shrink-0 rounded-full bg-bg px-3 py-1.5 text-[11px] font-semibold text-ink-2"
          >
            Scopri attività
          </Link>
        </div>
        <div className="flex gap-1">
          {planner.weeks.map((w) => (
            <div
              key={w.index}
              title={`${w.label} · ${w.dateRange}`}
              className={`h-2.5 flex-1 rounded-full ${
                w.covered ? "bg-green" : w.dismissed ? "bg-[#E8EBF0]" : "bg-orange-mid/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 2) Prossimi impegni */}
      {upcoming.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-3">
            Prossimi impegni
          </div>
          <div className="flex flex-col gap-2.5">
            {upcoming.map((b) => (
              <Link
                key={b.id}
                href={`/activity/${b.activityId}`}
                className="flex items-center gap-3 rounded-xl border border-[#E8EBF0] bg-white p-3.5"
              >
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center text-xl"
                  style={b.coverImageUrl ? { backgroundImage: `url(${b.coverImageUrl})` } : { background: b.imgGradient }}
                >
                  {!b.coverImageUrl && b.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-ink">{b.activityName}</div>
                  <div className="truncate text-[12px] text-ink-2">
                    {b.weeksLabel} {b.kidNames.length > 0 ? `· ${b.kidNames.join(", ")}` : ""}
                  </div>
                </div>
                <i className="ti ti-chevron-right text-ink-3" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 3) Attività in evidenza — solo se ci sono buchi da riempire */}
      {recommendations.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-3">
            Consigliati per voi
          </div>
          <div className="flex flex-col gap-1">
            {recommendations.map((r) => (
              <div key={r.activity.id}>
                <div className="mb-1 px-1 text-[11px] font-semibold text-ink-2">Per {r.kidName}</div>
                <ActivityCard activity={r.activity} matchPercent={r.matchPercent} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4) Stato prenotazioni + riepilogo pianificazione, sintetico */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-[#E8EBF0] bg-white p-3">
          <div className="text-[17px] font-bold text-ink">{statusCounts.confirmed}</div>
          <div className="text-[10.5px] leading-tight text-ink-2">Confermate</div>
        </div>
        <div className="rounded-xl border border-[#E8EBF0] bg-white p-3">
          <div className="text-[17px] font-bold text-ink">{statusCounts.pending}</div>
          <div className="text-[10.5px] leading-tight text-ink-2">In attesa</div>
        </div>
        <div className="rounded-xl border border-[#E8EBF0] bg-white p-3">
          <div className="text-[17px] font-bold text-ink">€{totalSpent}</div>
          <div className="text-[10.5px] leading-tight text-ink-2">Speso finora</div>
        </div>
      </div>

      {/* Sezione secondaria, volutamente in fondo e a basso peso visivo:
          l'elenco completo con Vista/Raggruppamento/Ordinamento separati —
          esiste perché richiesto esplicitamente, ma non compete con la
          sintesi sopra. Le azioni di modifica/annullo restano per ora in
          "Le mie prenotazioni" (LEGACY): questo sprint è sulla sintesi, non
          sulla gestione transazionale. */}
      {bookings.length > 0 && (
        <div className="mt-2 border-t border-[#F0F2F5] pt-4">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex w-full items-center justify-between text-[12.5px] font-semibold text-ink-2"
          >
            Tutte le prenotazioni ({bookings.length})
            <i className={`ti ti-chevron-${showAll ? "up" : "down"}`} />
          </button>

          {showAll && (
            <div className="mt-3">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-ink-3">Raggruppa:</span>
                {(
                  [
                    { key: "week", label: "Settimana" },
                    { key: "month", label: "Mese" },
                    { key: "kid", label: "Figlio" },
                    { key: "activity", label: "Attività" },
                    { key: "status", label: "Stato" },
                  ] as { key: GroupKey; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setGroupBy(opt.key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      groupBy === opt.key ? "bg-ink text-white" : "bg-bg text-ink-2"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-ink-3">Ordina:</span>
                {(
                  [
                    { key: "date", label: "Data" },
                    { key: "price", label: "Prezzo" },
                    { key: "name", label: "Nome" },
                  ] as { key: SortKey; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSortKey(opt.key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      sortKey === opt.key ? "bg-ink text-white" : "bg-bg text-ink-2"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {groups.map((g) => (
                  <div key={g.label}>
                    <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                      {g.label}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {g.items.map((b) => (
                        <Link
                          key={b.id}
                          href={`/activity/${b.activityId}`}
                          className="flex items-center justify-between rounded-lg border border-[#F0F2F5] bg-white px-3 py-2 text-[12px]"
                        >
                          <span className="truncate text-ink">{b.activityName}</span>
                          <span className="flex-shrink-0 text-ink-3">€{netPrice(b)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/prenotazioni" className="mt-3 inline-block text-[12px] font-semibold text-sky">
                Gestisci (modifica/annulla) →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
