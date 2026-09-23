"use client";

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), §5 "PREFERITI VIEW".
//
// Card orizzontale per una Scoperta TRAMA nei Preferiti — stessa "grammatica
// visuale" di ActivityCardHorizontal.tsx (stesso mx-5/h-[106px]/rounded-lg/
// border, stesso schema testo titolo/riga metadata/prezzo) ma componente
// DISTINTO, stesso principio già stabilito da DiscoveryLeadCard.tsx: nessun
// Match/rating/disponibilità/booking (§5 "NON mostrare"), badge "Scoperta
// TRAMA" sempre visibile, link esterno invece di /activity/[id] (nessun
// centro TRAMA gestisce questa prenotazione).
//
// §6 "FAVORITE BUTTON UX": stesso pattern optimistic-UI + rollback di
// ActivityCard.tsx — qui il tap RIMUOVE (siamo già nei Preferiti, nessuno
// stato "vuoto"/"pieno" da alternare): su successo la card sparisce dalla
// lista (fade via stato locale `removed`), su errore torna visibile.

import { useState } from "react";
import type { DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";
import { toggleCuratedFavoriteAction } from "@/app/actions/curated-favorites";

const CATEGORY_EMOJI: Record<DiscoveryLeadRecord["category"], string> = {
  educativo: "🎨",
  sportivo: "⚽",
  multisport: "🏅",
  artistico: "🎭",
};

export default function CuratedFavoriteCard({ lead }: { lead: DiscoveryLeadRecord }) {
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState(false);
  const ctaHref = lead.registrationUrl || lead.officialUrl;

  if (removed) return null;

  async function handleRemove() {
    setRemoving(true);
    setError(false);
    const result = await toggleCuratedFavoriteAction(lead.id, false);
    if (result.error) {
      setRemoving(false);
      setError(true);
      return;
    }
    setRemoved(true);
  }

  return (
    <div className="mx-5 mb-3 flex h-[106px] overflow-hidden rounded-lg border border-[#F0F2F5] bg-white">
      <div className="relative flex w-[106px] flex-shrink-0 items-center justify-center bg-[linear-gradient(135deg,#F3F0FF,#EDE9FE)] text-4xl">
        <span aria-hidden className="opacity-40">
          {CATEGORY_EMOJI[lead.category]}
        </span>
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-ink-2">
          Scoperta TRAMA
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
        <div>
          <a href={ctaHref} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-ink">
            {lead.activityTitle}
          </a>
          <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <i className="ti ti-map-pin" aria-hidden />
            {lead.locationName ? `${lead.locationName}, ${lead.comune}` : lead.comune}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-ink">
            {lead.price != null ? (
              <>
                €{lead.price}
                {lead.priceUnit === "per_settimana" && <span className="text-[10px] font-normal text-ink-2">/sett</span>}
              </>
            ) : (
              <span className="text-[10.5px] font-normal text-ink-3">Prezzo non indicato</span>
            )}
          </div>
          <button
            type="button"
            disabled={removing}
            onClick={handleRemove}
            aria-label="Rimuovi dai preferiti"
            className="flex h-7 w-7 items-center justify-center rounded-full text-base disabled:opacity-60"
          >
            ❤️
          </button>
        </div>
        {error && <p className="text-[10px] text-trama-orange">Rimozione non riuscita, riprova.</p>}
      </div>
    </div>
  );
}
