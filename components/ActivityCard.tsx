"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity } from "@/lib/types";
import { pillClasses } from "@/lib/colors";

export default function ActivityCard({
  activity,
  matchPercent,
}: {
  activity: Activity;
  matchPercent?: number;
}) {
  const [fav, setFav] = useState(false);

  return (
    <Link
      href={`/activity/${activity.id}`}
      className="mb-3 block cursor-pointer overflow-hidden rounded-lg border border-[#F0F2F5] bg-white transition-transform hover:scale-[0.985] hover:shadow-md"
    >
      <div
        className="relative flex h-[140px] items-end justify-center overflow-hidden bg-cover bg-center"
        style={
          activity.coverImageUrl
            ? { backgroundImage: `url(${activity.coverImageUrl})` }
            : { background: activity.imgGradient }
        }
      >
        {/* Foto reale caricata dal gestore (se presente) invece
            dell'emoji/gradiente decorativo — BUG CORRETTO: questa card non
            mostrava MAI la copertina, nemmeno quando c'era (es. attività di
            test "Test" con foto caricata nel profilo centro). */}
        {!activity.coverImageUrl && (
          <span className="absolute inset-0 flex items-center justify-center text-7xl">
            {activity.emoji}
          </span>
        )}
        {matchPercent !== undefined && (
          // TRAMA Sprint 3 — bg-purple (generico) sostituito con trama-violet,
          // il colore CTA/primario del rebrand, per coerenza con Login/Home.
          <div className="absolute left-2.5 top-2.5 z-[1] rounded-full bg-trama-violet px-2.5 py-1 text-[11px] font-bold text-white">
            Match {matchPercent}%
          </div>
        )}
        <div className="relative z-[1] m-2 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
          <i className="ti ti-star-filled text-[11px] text-yellow" />
          {activity.rating} · {activity.center}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            setFav((f) => !f);
          }}
          className="absolute right-2.5 top-2.5 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-base transition-transform hover:scale-110"
        >
          {fav ? "❤️" : "🤍"}
        </button>
      </div>
      <div className="p-3">
        <div className="mb-1 text-sm font-bold text-ink">{activity.name}</div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-ink-2">
            <i className="ti ti-map-pin text-[13px] text-ink-3" />
            {activity.distanceKm} km
          </span>
          <span className="flex items-center gap-1 text-[11px] text-ink-2">
            <i className="ti ti-users text-[13px] text-ink-3" />
            {activity.ageRange}
          </span>
          {activity.days && (
            <span className="flex items-center gap-1 text-[11px] text-ink-2">
              <i className="ti ti-calendar text-[13px] text-ink-3" />
              {activity.days}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {activity.tags.map((tag) => (
            <span
              key={tag.label}
              style={tag.bg ? { backgroundColor: tag.bg } : undefined}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                tag.bg ? "text-ink" : pillClasses[tag.color!]
              }`}
            >
              {tag.label}
            </span>
          ))}
        </div>
        {(activity.centerAccessible ||
          (activity.dietaryOptions && activity.dietaryOptions.length > 0) ||
          (activity.certificationBadges && activity.certificationBadges.length > 0)) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {/* Segnalazione di Fabrizio: "sul badge del centro non si vede
                nulla nè sul badge disabili nè sul badge diete" — questi due
                dati arrivano già popolati in Activity (centerAccessible,
                dietaryOptions, vedi lib/data/activities.ts) e sono visibili
                da tempo nel dettaglio (DetailClient.tsx), ma non erano mai
                stati aggiunti a questa card di lista/ricerca — stesso gap
                già risolto sopra per le certificazioni.
                SPRINT 3 (feedback Fabrizio) — due correzioni: 1) questo
                badge condivideva lo stesso blu della Certificazione, poco
                distinguibile a colpo d'occhio; ora è viola (stesso token
                "purple" già in tailwind.config.ts, non ancora usato per
                badge), Certificazione resta blu. 2) "Accesso disabili"
                comunicava solo "accessibilità fisica" (rampe, ecc.);
                Fabrizio ha chiesto che comunichi "accetta senza limitazioni
                nelle attività" — testo e icona aggiornati di conseguenza
                (il campo dati/nome variabile centerAccessible resta
                invariato, cambia solo cosa il genitore legge). */}
            {activity.centerAccessible && (
              <span className="flex items-center gap-1 rounded-full bg-purple-light px-2.5 py-0.5 text-[10px] font-semibold text-purple">
                <i className="ti ti-heart-handshake text-[11px]" />
                Nessuna limitazione
              </span>
            )}
            {activity.dietaryOptions && activity.dietaryOptions.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-green-light px-2.5 py-0.5 text-[10px] font-semibold text-green">
                <i className="ti ti-salad text-[11px]" />
                Diete gestite
              </span>
            )}
            {activity.certificationBadges?.map((label) => (
              <span
                key={label}
                className="flex items-center gap-1 rounded-full bg-sky-light px-2.5 py-0.5 text-[10px] font-semibold text-sky"
              >
                <i className="ti ti-certificate text-[11px]" />
                {label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="text-base font-bold text-ink">
            €{activity.pricePerWeek}{" "}
            <small className="text-[11px] font-normal text-ink-2">/ settimana</small>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-ink">
            <i className="ti ti-star-filled text-yellow" />
            {activity.rating} ({activity.reviewsCount})
          </div>
        </div>
        {activity.spotsLeft !== undefined && (
          <div className="mt-1.5 flex items-center gap-1 rounded-md bg-yellow-light px-2 py-1 text-[10px] font-semibold text-[#9a6b00]">
            <i className="ti ti-flame text-[13px]" />
            Solo {activity.spotsLeft} posti disponibili!
          </div>
        )}
      </div>
    </Link>
  );
}
