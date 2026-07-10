"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MyBooking, BookingStatus } from "@/lib/data/my-bookings";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "In attesa di conferma",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: "bg-yellow-light text-[#9a6b00]",
  confirmed: "bg-green-light text-green",
  cancelled: "bg-bg text-ink-3",
};

type SortKey = "week" | "kid" | "campus";

// Segnalazione di Fabrizio: "nel tab 'le mie prenotazioni' va bene la lista
// ma va fatta un pò di ordinamento..per settimana per bambino per
// campus..una serie di filtri per raggruappare altrimenti è difficile
// leggerls". Aggiunto: un ordinamento a scelta (settimana/bambino/campus) +
// filtro per bambino (chip, singola selezione) — la lista resta piatta (non
// a gruppi) ma ordinata secondo il criterio scelto, che è il modo più
// semplice per "raggruppare visivamente" senza introdurre intestazioni
// multiple che con pochi elementi risulterebbero eccessive.
export default function PrenotazioniClient({ bookings }: { bookings: MyBooking[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("week");
  const [kidFilter, setKidFilter] = useState<string | null>(null);

  const allKidNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of bookings) for (const n of b.kidNames) names.add(n);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [bookings]);

  const filtered = useMemo(() => {
    let list = bookings;
    if (kidFilter) list = list.filter((b) => b.kidNames.includes(kidFilter));

    const sorted = [...list];
    if (sortKey === "week") {
      sorted.sort((a, b) => (a.firstWeekStart ?? "9999").localeCompare(b.firstWeekStart ?? "9999"));
    } else if (sortKey === "kid") {
      sorted.sort((a, b) => (a.kidNames[0] ?? "").localeCompare(b.kidNames[0] ?? ""));
    } else if (sortKey === "campus") {
      sorted.sort((a, b) => a.activityName.localeCompare(b.activityName));
    }
    return sorted;
  }, [bookings, sortKey, kidFilter]);

  if (bookings.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
        Non hai ancora nessuna prenotazione. Trovi le attività disponibili in &quot;Cerca&quot;.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-2">Ordina per:</span>
        {(
          [
            { key: "week", label: "Settimana" },
            { key: "kid", label: "Bambino" },
            { key: "campus", label: "Campus" },
          ] as { key: SortKey; label: string }[]
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortKey(opt.key)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              sortKey === opt.key ? "bg-ink text-white" : "bg-white text-ink-2"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {allKidNames.length > 1 && (
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setKidFilter(null)}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              kidFilter === null ? "bg-sky text-white" : "bg-white text-ink-2"
            }`}
          >
            Tutti i bambini
          </button>
          {allKidNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setKidFilter(name)}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                kidFilter === name ? "bg-sky text-white" : "bg-white text-ink-2"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
          Nessuna prenotazione per questo filtro.
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {filtered.map((b) => (
          <Link
            key={b.id}
            href={`/activity/${b.activityId}`}
            className="flex gap-3 rounded-lg border border-[#E8EBF0] bg-white p-3.5"
          >
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center text-2xl"
              style={b.coverImageUrl ? { backgroundImage: `url(${b.coverImageUrl})` } : { background: b.imgGradient }}
            >
              {!b.coverImageUrl && b.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink">{b.activityName}</span>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_CLASS[b.status]}`}>
                  {STATUS_LABEL[b.status]}
                </span>
              </div>
              <div className="text-xs text-ink-2">{b.weeksLabel}</div>
              {b.kidNames.length > 0 && (
                <div className="mt-0.5 text-xs text-ink-2">{b.kidNames.join(", ")}</div>
              )}
              <div className="mt-1 text-xs font-semibold text-ink">
                €{b.totalAmount - b.discountAmount}
                {b.discountAmount > 0 && (
                  <span className="ml-1 font-normal text-ink-3 line-through">€{b.totalAmount}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
