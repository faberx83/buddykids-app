"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ActivityCard from "@/components/ActivityCard";
import CategoryChip from "@/components/CategoryChip";
import { Activity, Kid, Tag } from "@/lib/types";
import { computeMatchesForKid } from "@/lib/matching";
import { KidBookingEntry } from "@/lib/data/kid-bookings";

export default function PerBambinoView({
  kids,
  activities,
  categories,
  bookingsByKid,
}: {
  kids: Kid[];
  activities: Activity[];
  categories: Tag[];
  bookingsByKid: Record<string, KidBookingEntry[]>;
}) {
  const [selectedKidId, setSelectedKidId] = useState<string | null>(kids[0]?.id ?? null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const selectedKid = kids.find((k) => k.id === selectedKidId) ?? null;

  const filteredActivities = useMemo(
    () => (selectedCategory ? activities.filter((a) => a.tagIds.includes(selectedCategory)) : activities),
    [activities, selectedCategory]
  );

  const matches = useMemo(
    () => (selectedKid ? computeMatchesForKid(selectedKid, filteredActivities) : []),
    [selectedKid, filteredActivities]
  );

  if (kids.length === 0) {
    return (
      <div className="mx-5 mt-4 rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center">
        <div className="mb-1 text-sm font-semibold text-ink">Aggiungi un bambino</div>
        <p className="mb-3 text-xs text-ink-2">
          Aggiungi il profilo di tuo figlio/a per vedere le attività più adatte a lui/lei.
        </p>
        <Link
          href="/profile"
          className="inline-flex rounded-md bg-sky px-4 py-2 text-xs font-bold text-white"
        >
          Aggiungi bambino
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="px-5 pt-4">
        <div className="mb-1.5 text-[13px] font-semibold text-ink-2">Per chi cerchiamo oggi?</div>
        {/* px-1 -mx-1: l'anello di selezione (ring + ring-offset) attorno
            all'avatar sporge un po' oltre il suo bordo — senza questo
            margine interno, il contenitore con scroll orizzontale lo
            tagliava sul primo/ultimo bambino della riga. Il -mx-1 compensa
            cosi l'allineamento visivo resta lo stesso di prima.
            NOTA (bug corretto): l'anello va su un wrapper ESTERNO, non sullo
            stesso elemento che ritaglia la foto (overflow-hidden) — prima il
            ring stava sul cerchio con l'emoji/colore e la foto non veniva
            proprio mostrata; ora l'avatar reale (kid.avatarUrl) è renderizzato
            in un cerchio interno con overflow-hidden, mentre il ring vive sul
            contenitore esterno senza tagliare nulla.
            BUG CORRETTO (persisteva): "overflow-x-auto" per spec CSS forza il
            valore calcolato di overflow-y a "auto" quando non è dichiarato
            esplicitamente "visible" — quindi il contenitore, pur scrollando
            solo in orizzontale, taglia comunque in verticale qualunque cosa
            sporga oltre la sua altezza. Il ring (ring-[3px] + ring-offset-2)
            del bambino selezionato sporgeva SOPRA senza che ci fosse spazio
            (solo pb-2 in basso, zero in alto): pt-1.5 dà lo spazio mancante,
            simmetrico al trattamento già fatto in orizzontale. */}
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1.5">
          {kids.map((kid) => (
            <button
              key={kid.id}
              onClick={() => setSelectedKidId(kid.id)}
              className="flex min-w-[64px] flex-shrink-0 flex-col items-center gap-1"
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full p-0.5 transition-all ${
                  selectedKidId === kid.id ? "ring-[3px] ring-ink ring-offset-2" : "opacity-70"
                }`}
              >
                <div
                  className="flex h-full w-full items-center justify-center overflow-hidden rounded-full text-2xl"
                  style={{ background: kid.color }}
                >
                  {kid.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, non ottimizzabile senza config extra
                    <img src={kid.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    kid.emoji
                  )}
                </div>
              </div>
              <span
                className={`text-[11px] ${
                  selectedKidId === kid.id ? "font-bold text-ink" : "text-ink-2"
                }`}
              >
                {kid.name}
              </span>
            </button>
          ))}
          <Link
            href="/profile"
            className="flex min-w-[64px] flex-shrink-0 flex-col items-center gap-1"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-[#D8DEE8] text-xl text-ink-3">
              <i className="ti ti-plus" />
            </div>
            <span className="text-[11px] text-ink-2">Aggiungi</span>
          </Link>
        </div>
      </div>

      {selectedKid && (bookingsByKid[selectedKid.id]?.length ?? 0) > 0 && (
        <div className="px-5 pt-4">
          <div className="mb-2 text-[13px] font-bold text-ink">
            Già prenotato per {selectedKid.name}
          </div>
          <div className="flex flex-col gap-2">
            {bookingsByKid[selectedKid.id].map((b, i) => (
              // BUG CORRETTO (segnalato da Fabrizio): questo link portava alla
              // scheda campus (sola consultazione, niente azioni). Il genitore
              // che vede "già prenotato" vuole invece GESTIRE la prenotazione
              // (annullare, modificare) — ora porta a "Le mie prenotazioni"
              // già filtrata sul bambino selezionato.
              <Link
                key={`${b.activityId}-${i}`}
                href={`/prenotazioni?kid=${selectedKid.id}`}
                className="flex items-center gap-2.5 rounded-lg border border-green-light bg-green-light px-3.5 py-3"
              >
                <i className="ti ti-circle-check-filled text-lg text-green" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-ink">{b.activityName}</div>
                  <div className="truncate text-[11px] text-ink-2">{b.weeksLabel}</div>
                </div>
                <i className="ti ti-chevron-right text-ink-3" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">Categorie</span>
          <span
            onClick={() => setSelectedCategory(null)}
            className={`cursor-pointer text-[13px] font-medium ${
              selectedCategory === null ? "text-sky" : "text-ink-3"
            }`}
          >
            Tutte
          </span>
        </div>
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <CategoryChip
              key={cat.id}
              emoji={cat.emoji}
              label={cat.label}
              bg={cat.bg}
              selected={selectedCategory === cat.id}
              onClick={() => setSelectedCategory((prev) => (prev === cat.id ? null : cat.id))}
            />
          ))}
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="mb-3 text-[15px] font-bold text-ink">
          Perfetti per {selectedKid?.name ?? "il tuo bambino"}
        </div>
        {matches.slice(0, 4).map((a) => (
          <ActivityCard key={a.id} activity={a} matchPercent={a.matchPercent} />
        ))}
        {matches.length === 0 && (
          <p className="text-sm text-ink-2">Nessuna attività trovata in questa categoria.</p>
        )}
      </div>
    </>
  );
}
