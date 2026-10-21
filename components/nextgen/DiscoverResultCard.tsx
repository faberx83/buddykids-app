"use client";

// TRAMA — SCOPRI V2 (14/10/2026, tavola "Scopri, elenco"). Card di
// un'attività Partner nello stile V2.1: fascia immagine con "Partner TRAMA"
// e Salva, nome, centro · distanza · età, al massimo 3 motivi chiari
// ("Posti liberi · Ponte 7–8 dic", "Adatto a Lino", "Pranzo incluso"),
// prezzo e "Vedi". Niente "Match 80%": il motivo dice perché, il numero no.
// Stessi link (con source/cid/weeks per la telemetria) e stesso preferito
// (toggleFavoriteAction) di components/ActivityCard.tsx.

import { useState } from "react";
import Link from "next/link";
import type { Activity } from "@/lib/types";
import { toggleFavoriteAction } from "@/app/actions/favorites";
import { markFirstUsefulAction } from "@/lib/nextgen/first-action";
import ActivityVisual from "@/components/nextgen/ActivityVisual";

export default function DiscoverResultCard({
  activity,
  reasons,
  distanceKm,
  correlationId,
  weekStarts,
  initialFavorite,
  raised = false,
  dateLine = null,
}: {
  activity: Activity;
  reasons: string[];
  distanceKm: number | null;
  correlationId?: string;
  weekStarts?: string[];
  initialFavorite?: boolean;
  raised?: boolean;
  /** Correzioni dal test UX (21/10/2026): prossima data vera o "Edizione conclusa". null = come prima. */
  dateLine?: { text: string; tone: "ok" | "warn" | "muted" } | null;
}) {
  const [fav, setFav] = useState(initialFavorite ?? false);
  const params = new URLSearchParams();
  params.set("source", "nextgen_search");
  if (correlationId) params.set("cid", correlationId);
  if (weekStarts && weekStarts.length > 0) params.set("weeks", weekStarts.join(","));
  const href = `/activity/${activity.id}?${params.toString()}`;
  const meta = [
    activity.center,
    distanceKm !== null ? `${distanceKm.toLocaleString("it-IT", { maximumFractionDigits: 1 })} km` : null,
    activity.ageRange ? (/anni/.test(activity.ageRange) ? activity.ageRange : `${activity.ageRange} anni`) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`relative mb-3 flex flex-col overflow-hidden rounded-2xl border bg-white ${raised ? "border-[#DCD8CF]" : "border-trama-line"}`}
    >
      <Link href={href} data-spotlight="activity_card" className="flex flex-col text-ink">
        {/* POLISH V2: foto vera se c'è, altrimenti monogramma + filo TRAMA (niente emoji gigante). */}
        <ActivityVisual title={activity.name} imageUrl={activity.coverImageUrl} className="h-[120px]">
          <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#146B4F]">Partner TRAMA</span>
        </ActivityVisual>
        <span className="flex flex-col gap-1.5 px-4 pb-[15px] pt-[13px]">
          <span className="text-[16px] font-semibold leading-snug">{activity.name}</span>
          {meta && <span className="text-[13px] text-ink-2">{meta}</span>}
          {dateLine && (
            <span
              data-testid="discover-card-date"
              className={`flex items-center gap-1.5 text-[13px] font-semibold ${
                dateLine.tone === "ok" ? "text-[#146B4F]" : dateLine.tone === "warn" ? "text-[#B54708]" : "text-ink-2"
              }`}
            >
              <i className="ti ti-calendar text-[14px]" aria-hidden="true" />
              {dateLine.text}
            </span>
          )}
          {reasons.length > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-1.5">
              {reasons.map((r, i) => (
                <span
                  key={r}
                  className={`rounded-full px-2.5 py-[3px] text-[12px] font-semibold ${
                    i === 0 && r.startsWith("Posti liberi") ? "bg-[#E6F6F0] text-[#146B4F]" : r.startsWith("Adatto") || r.startsWith("Piace") ? "bg-trama-accent-soft text-trama-accent-ink" : "bg-[#F1F3F6] text-[#374151]"
                  }`}
                >
                  {r}
                </span>
              ))}
            </span>
          )}
          <span className="mt-1.5 flex items-center justify-between">
            <span className="text-[15px] font-bold text-trama-navy">
              €{activity.pricePerWeek} <span className="text-[12.5px] font-medium text-ink-2">a settimana</span>
            </span>
            <span className="flex min-h-[44px] items-center rounded-[12px] bg-trama-primary px-4 text-[14px] font-bold text-white">Vedi</span>
          </span>
        </span>
      </Link>
      <button
        type="button"
        aria-label={fav ? "Togli dai salvati" : "Salva"}
        aria-pressed={fav}
        onClick={() => {
          const next = !fav;
          setFav(next);
          if (activity.dbId) {
            toggleFavoriteAction(activity.dbId, next).then((result) => {
              if (result.error) setFav(!next);
              else if (next) markFirstUsefulAction("salvata");
            });
          }
        }}
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-trama-navy active:scale-95"
      >
        <i className={`ti ${fav ? "ti-bookmark-filled text-trama-primary" : "ti-bookmark"} text-[19px]`} aria-hidden="true" />
      </button>
    </article>
  );
}
