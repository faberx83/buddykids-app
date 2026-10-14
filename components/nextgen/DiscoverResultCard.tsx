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

export default function DiscoverResultCard({
  activity,
  reasons,
  distanceKm,
  correlationId,
  weekStarts,
  initialFavorite,
  raised = false,
}: {
  activity: Activity;
  reasons: string[];
  distanceKm: number | null;
  correlationId?: string;
  weekStarts?: string[];
  initialFavorite?: boolean;
  raised?: boolean;
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
      className={`relative mb-3 flex flex-col overflow-hidden rounded-[20px] bg-white ${
        raised ? "shadow-[0_1px_2px_rgba(23,42,77,0.06),0_6px_20px_rgba(23,42,77,0.06)]" : "border border-[#ECEEF2]"
      }`}
    >
      <Link href={href} data-spotlight="activity_card" className="flex flex-col text-ink">
        <span
          className="relative flex h-[120px] items-center justify-center bg-cover bg-center text-6xl"
          style={activity.coverImageUrl ? { backgroundImage: `url(${activity.coverImageUrl})` } : { background: activity.imgGradient }}
          aria-hidden="true"
        >
          {!activity.coverImageUrl && activity.emoji}
          <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#146B4F]">Partner TRAMA</span>
        </span>
        <span className="flex flex-col gap-1.5 px-4 pb-[15px] pt-[13px]">
          <span className="text-[16px] font-semibold leading-snug">{activity.name}</span>
          {meta && <span className="text-[13px] text-ink-2">{meta}</span>}
          {reasons.length > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-1.5">
              {reasons.map((r, i) => (
                <span
                  key={r}
                  className={`rounded-full px-2.5 py-[3px] text-[12px] font-semibold ${
                    i === 0 && r.startsWith("Posti liberi") ? "bg-[#E6F6F0] text-[#146B4F]" : r.startsWith("Adatto") || r.startsWith("Piace") ? "bg-[#F4F2FC] text-[#4A3F9E]" : "bg-[#F1F3F6] text-[#374151]"
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
            <span className="flex min-h-[40px] items-center rounded-full bg-trama-violet px-4 text-[13.5px] font-bold text-white">Vedi</span>
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
            });
          }
        }}
        className="absolute right-2.5 top-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-trama-navy active:scale-95"
      >
        <i className={`ti ${fav ? "ti-bookmark-filled text-trama-violet" : "ti-bookmark"} text-[19px]`} aria-hidden="true" />
      </button>
    </article>
  );
}
