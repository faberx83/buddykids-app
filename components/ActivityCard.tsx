"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity } from "@/lib/types";
import { pillClasses } from "@/lib/colors";

export default function ActivityCard({
  activity,
  matchPercent,
  source,
  correlationId,
  weekStarts,
}: {
  activity: Activity;
  matchPercent?: number;
  // TRAMA ONE Build Sprint 3 — "context object" leggero (source/
  // correlationId), stesso trattamento già applicato a
  // ActivityCardHorizontal.tsx (card LEGACY): da dove arriva il click (es.
  // "nextgen_search") e un id univoco per correlare i log dell'intero
  // percorso ricerca→dettaglio→richiesta (vedi lib/telemetry/correlation.ts).
  // Facoltativi: se assenti, il link resta quello di prima (nessun impatto
  // sui punti che non li passano ancora).
  source?: string;
  correlationId?: string;
  // BUG CORRETTO 07/08/2026 (segnalato da Fabrizio: da "Riempi" su una
  // settimana del Planner, il filtro settimane veniva applicato nella lista
  // di Scopri ma andava perso entrando nel dettaglio del singolo centro —
  // i "giorni spot" mostrati non erano contestualizzati al filtro). Le
  // settimane selezionate in SearchDiscoveryClient vanno propagate qui nel
  // link verso /activity/[id], che ora le legge (vedi DetailClient.tsx) per
  // filtrare i giorni proposti. Array (non singolo valore) perché Scopri
  // permette la selezione di più settimane.
  weekStarts?: string[];
}) {
  const [fav, setFav] = useState(false);
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (correlationId) params.set("cid", correlationId);
  if (weekStarts && weekStarts.length > 0) params.set("weeks", weekStarts.join(","));
  const query = params.toString();

  return (
    <Link
      href={query ? `/activity/${activity.id}?${query}` : `/activity/${activity.id}`}
      // TRAMA ONE Parent Spotlight sprint (24/08/2026) — target reale dello
      // step "open_activity" (lib/walkthrough/registry.ts,
      // discover_book_parent), gated a /nextgen/search da spotlightRoute:
      // innocuo altrove (ActivityCard è riusata anche in Home/Community),
      // il motore Spotlight ignora il target quando la route corrente non
      // combacia (vedi SpotlightEngine.tsx).
      data-spotlight="activity_card"
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
        {/* FIX (TRAMA FINAL HARDENING CLOSURE §1-2, 04/09/2026) —
            activity.spotsLeft ora arriva da attachCanonicalAvailability()
            (lib/availability/canonical.ts, chiamata da getActivities()),
            mai più dal campo editoriale del gestore. A capacità esaurita
            (0) la regola esplicita è NON mostrare "Solo 0 posti
            disponibili!" (leggibile come "quasi pieno", il contrario del
            vero) — un badge neutro "Non disponibile" al suo posto. Il
            click sulla card resta invariato (porta comunque al Dettaglio,
            che mostra CTA disabilitata e il server rivalida comunque la
            capacità — vedi app/activity/[id]/page.tsx): la card di lista
            non ha una propria CTA separata da disabilitare. */}
        {activity.spotsLeft !== undefined &&
          (activity.spotsLeft <= 0 ? (
            <div className="mt-1.5 flex items-center gap-1 rounded-md bg-bg px-2 py-1 text-[10px] font-semibold text-ink-3">
              <i className="ti ti-calendar-off text-[13px]" />
              Non disponibile
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-1 rounded-md bg-yellow-light px-2 py-1 text-[10px] font-semibold text-[#9a6b00]">
              <i className="ti ti-flame text-[13px]" />
              Solo {activity.spotsLeft} posti disponibili!
            </div>
          ))}
      </div>
    </Link>
  );
}
