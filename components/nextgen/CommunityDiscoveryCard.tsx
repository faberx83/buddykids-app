"use client";

// TRAMA — RADAR / COMMUNITY DISCOVERY (13/10/2026), patch 2.
//
// Card di una scoperta segnalata da un genitore. Stessa grammatica visiva
// di DiscoveryLeadCard (hero 140px, badge categoria in alto, pillola in
// basso, cuore in alto a destra), ma con il badge "Segnalato dalla
// community" al posto di "Scoperta TRAMA": l'utente deve sempre capire
// che il dato viene da un genitore, non da TRAMA né da un Partner.
// Nessun "Prenota", nessun prezzo o data inventati: ogni campo assente
// semplicemente non compare. Tap sulla card → scheda completa.

import Link from "next/link";
import { useState } from "react";
import { toggleCuratedFavoriteAction } from "@/app/actions/curated-favorites";
import {
  COMMUNITY_BADGE_LABEL,
  communityCategoryEmoji,
  communityCategoryLabel,
  communityDetailHref,
  communityFavoriteId,
  formatCommunityAge,
  formatCommunityDates,
  formatCommunityPlace,
  formatCommunityPrice,
  type CommunityDiscoveryRecord,
} from "@/lib/radar/community";

export default function CommunityDiscoveryCard({
  discovery,
  initialFavorite = false,
  inPlanner = false,
}: {
  discovery: CommunityDiscoveryRecord;
  initialFavorite?: boolean;
  inPlanner?: boolean;
}) {
  const [fav, setFav] = useState(initialFavorite);
  const href = communityDetailHref(discovery.id);
  const place = formatCommunityPlace(discovery);
  const age = formatCommunityAge(discovery.ageMin, discovery.ageMax);
  const dates = formatCommunityDates(discovery);
  const price = formatCommunityPrice(discovery.price, discovery.priceUnit);

  function handleToggleFavorite() {
    const next = !fav;
    setFav(next); // aggiornamento ottimistico
    toggleCuratedFavoriteAction(communityFavoriteId(discovery.id), next).then((result) => {
      if (result.error) setFav(!next);
    });
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-[#F0F2F5] bg-white" data-testid="community-discovery-card">
      <div className="relative flex h-[140px] items-center justify-center bg-[linear-gradient(135deg,#FFF4E8,#FFE9D6)]">
        <Link href={href} className="absolute inset-0" aria-label={`Apri ${discovery.title}`} />
        <span className="pointer-events-none text-6xl opacity-40" aria-hidden>
          {communityCategoryEmoji(discovery.category)}
        </span>
        <div className="pointer-events-none absolute left-2.5 top-2.5 z-[1] rounded-full bg-trama-orange px-2.5 py-1 text-[11px] font-bold text-white">
          {communityCategoryLabel(discovery.category)}
        </div>
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-[1] flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-2 backdrop-blur-sm">
          <i className="ti ti-users-group text-[12px] text-trama-orange" aria-hidden />
          {COMMUNITY_BADGE_LABEL}
        </div>
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={fav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
          className="absolute right-2.5 top-2.5 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-base transition-transform hover:scale-110"
        >
          {fav ? "❤️" : "🤍"}
        </button>
      </div>
      <Link href={href} className="block p-3">
        <div className="mb-1 text-sm font-bold text-ink">{discovery.title}</div>
        {discovery.organizerName && <div className="mb-2 text-[11px] font-medium text-ink-2">{discovery.organizerName}</div>}

        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-2">
          {place && (
            <span className="flex items-center gap-1">
              <i className="ti ti-map-pin text-[13px] text-ink-3" />
              {place}
            </span>
          )}
          {age && (
            <span className="flex items-center gap-1">
              <i className="ti ti-users text-[13px] text-ink-3" />
              {age}
            </span>
          )}
          {dates && (
            <span className="flex items-center gap-1">
              <i className="ti ti-calendar text-[13px] text-ink-3" />
              {dates}
            </span>
          )}
        </div>

        {discovery.shortDescription && (
          <p className="mb-2 line-clamp-3 text-[12px] leading-snug text-ink-2">{discovery.shortDescription}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="text-base font-bold text-ink">
            {price ?? <span className="text-[11px] font-normal text-ink-3">Prezzo non indicato</span>}
          </div>
          {inPlanner ? (
            <span className="rounded-full bg-green-light px-2.5 py-1 text-[11px] font-semibold text-[#2d8f52]">✓ Nel Planner</span>
          ) : (
            <span className="text-[12px] font-semibold text-trama-violet">Vedi scheda →</span>
          )}
        </div>
        <p className="mt-2 border-t border-[#F0F2F5] pt-2 text-[10px] leading-snug text-ink-3">
          Informazioni segnalate da un genitore e non verificate da TRAMA: controlla sempre con l&apos;organizzatore.
        </p>
      </Link>
    </div>
  );
}
