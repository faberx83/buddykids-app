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

const MONTH_LABELS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_LABELS_IT[m - 1]} ${y}`;
}

interface BookingGroup {
  label: string;
  items: MyBooking[];
}

// Segnalazione di Fabrizio: "va bene la lista ma va fatta un pò di
// ordinamento..per settimana per bambino per campus..una serie di filtri
// per raggruappare" — e poi, con più dettaglio: "le vorrei raggruppate per
// filtro..ed ordinate sempre in ordine cronologico". Quindi non basta un
// ordinamento piatto: il criterio scelto (Settimana/Bambino/Campus) diventa
// un'intestazione di gruppo (mese/nome bambino/nome campus), e DENTRO ogni
// gruppo — così come l'ordine dei gruppi stessi — le prenotazioni restano
// sempre in ordine cronologico (per data della prima settimana prenotata),
// mai alfabetico, cosi' la lista si legge come un calendario anche quando è
// raggruppata per bambino o per campus.
//
// BUG DI UX CORRETTO (segnalato da Fabrizio: "il filtro per bambino va bene
// uno solo non due volte"): prima c'erano DUE controlli diversi legati al
// bambino sulla stessa pagina — il pulsante "Bambino" tra i criteri di
// raggruppamento E una riga separata di chip filtro "Tutti i bambini/Nome"
// che faceva la stessa cosa in un altro modo. Rimossa la riga di chip:
// scegliere "Raggruppa per: Bambino" è l'unico modo per organizzare la
// lista per bambino, niente più doppio controllo.
export default function PrenotazioniClient({ bookings }: { bookings: MyBooking[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("week");

  const groups: BookingGroup[] = useMemo(() => {
    function groupKeyFor(b: MyBooking): string {
      if (sortKey === "week") return b.firstWeekStart ? b.firstWeekStart.slice(0, 7) : "9999-99";
      if (sortKey === "kid") return b.kidNames[0] ?? "—";
      return b.activityName;
    }

    const buckets = new Map<string, MyBooking[]>();
    for (const b of bookings) {
      const key = groupKeyFor(b);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(b);
    }

    // Dentro ogni gruppo, sempre in ordine cronologico (mai alfabetico).
    for (const items of buckets.values()) {
      items.sort((a, b) => (a.firstWeekStart ?? "9999").localeCompare(b.firstWeekStart ?? "9999"));
    }

    // Anche l'ordine dei GRUPPI segue la cronologia: per "Settimana" la
    // chiave stessa (YYYY-MM) è già ordinabile; per "Bambino"/"Campus" si
    // usa la data della prenotazione più vecchia del gruppo.
    const keys = Array.from(buckets.keys());
    keys.sort((a, b) => {
      if (sortKey === "week") return a.localeCompare(b);
      const firstA = buckets.get(a)![0]?.firstWeekStart ?? "9999";
      const firstB = buckets.get(b)![0]?.firstWeekStart ?? "9999";
      return firstA.localeCompare(firstB);
    });

    return keys.map((key) => ({
      label: sortKey === "week" ? monthLabelFromKey(key) : key,
      items: buckets.get(key)!,
    }));
  }, [bookings, sortKey]);

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
        <span className="text-xs font-semibold text-ink-2">Raggruppa per:</span>
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

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 px-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
              {group.label}
            </div>
            <div className="flex flex-col gap-2.5">
              {group.items.map((b) => (
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
        ))}
      </div>
    </div>
  );
}
