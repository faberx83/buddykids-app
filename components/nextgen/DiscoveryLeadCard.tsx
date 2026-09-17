"use client";

// TRAMA — REAL DISCOVERY PILOT (16/09/2026)
//
// Card DELIBERATAMENTE separata da components/ActivityCard.tsx. Non la
// riusiamo per due motivi, entrambi di dominio, non estetici:
//
// 1. ActivityCard è cablata sul modello Partner reale — voti/recensioni
//    (activity.rating/reviewsCount), posti disponibili in tempo reale
//    (spotsLeft, "Solo N posti disponibili!"), preferiti persistiti su
//    Supabase — nessuno di questi esiste per un'attività scoperta sul web.
//    Riusarla mostrerebbe "0 recensioni"/"€0/settimana" ogni volta che un
//    campo manca: un dato mancante letto come "zero" è peggio di un dato
//    assente mostrato onestamente come assente.
// 2. Cliccare una ActivityCard porta a /activity/[id] → "Prenota ora" → il
//    wizard di prenotazione reale di TRAMA (app/booking/[id]). Un'attività
//    scoperta sul web non ha nessun centro che gestisce quelle prenotazioni
//    lato TRAMA: usare lo stesso componente implicherebbe una
//    intermediazione commerciale che non esiste (vietato esplicitamente
//    dalla governance di questo lavoro).
//
// Questa card quindi: non mostra MAI rating/recensioni/posti disponibili,
// non ha MAI un CTA "Prenota" — solo "Vai al sito ufficiale"/"Contatta il
// centro" (link esterno, nuova scheda), degrada silenziosamente ogni campo
// assente (nessun placeholder "N/D" invadente, la riga semplicemente non
// compare), e porta sempre il disclaimer di provenienza.

import { useEffect } from "react";
import type { DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";
// TRAMA — REAL DISCOVERY PILOT · COMPLETION PASS (17/09/2026), §10
// "ANALYTICS MINIMUM". Stesso pattern già in uso da
// components/spotlight/SpotlightOverlay.tsx (Server Action invocata
// direttamente dal componente client, best-effort, mai bloccante) — nessuna
// nuova architettura di analytics introdotta. Vedi app/actions/discovery.ts.
import { logDiscoveryLeadEventAction } from "@/app/actions/discovery";

const CATEGORY_LABELS: Record<DiscoveryLeadRecord["category"], string> = {
  educativo: "Educativo",
  sportivo: "Sportivo",
  multisport: "Multisport",
  artistico: "Artistico",
};

function formatDateRange(startDate: string | null, endDate: string | null): string | null {
  if (!startDate || !endDate) return null;
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

function formatAge(ageMin: number | null, ageMax: number | null): string | null {
  if (ageMin != null && ageMax != null) return `${ageMin}-${ageMax} anni`;
  if (ageMax != null) return `fino a ${ageMax} anni`;
  if (ageMin != null) return `da ${ageMin} anni`;
  return null;
}

export default function DiscoveryLeadCard({ lead }: { lead: DiscoveryLeadRecord }) {
  const dateRange = formatDateRange(lead.startDate, lead.endDate);
  const age = formatAge(lead.ageMin, lead.ageMax);
  const ctaHref = lead.registrationUrl || lead.officialUrl;
  const ctaLabel = lead.registrationUrl ? "Vai al sito" : "Vai al sito ufficiale";

  // TRAMA — REAL DISCOVERY PILOT · COMPLETION PASS (17/09/2026). Un solo
  // evento "viewed" per montaggio della card (non per ogni ri-render dovuto
  // a un filtro che lascia il lead visibile) — dipendenza su lead.id, fire-
  // and-forget, mai bloccante per il rendering. detail = lead.id (nessun
  // dato utente).
  useEffect(() => {
    void logDiscoveryLeadEventAction("curated_listing_viewed", lead.id);
  }, [lead.id]);

  function handleCtaClick() {
    void logDiscoveryLeadEventAction("curated_listing_external_clicked", lead.id);
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-[#F0F2F5] bg-white">
      {/* Visual neutro TRAMA al posto di una copertina — image è sempre
          null in questo dataset V1, vedi §9 del report (nessuna immagine
          copiata da alcun sito senza verifica di liceità d'uso). */}
      <div className="flex h-[72px] items-center justify-between bg-[linear-gradient(135deg,#F3F0FF,#EDE9FE)] px-3">
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-trama-violet">
          {CATEGORY_LABELS[lead.category]}
        </span>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-ink-2">
          Scoperta TRAMA
        </span>
      </div>
      <div className="p-3">
        <div className="mb-0.5 text-sm font-bold text-ink">{lead.activityTitle}</div>
        <div className="mb-2 text-[11px] font-medium text-ink-2">{lead.organizerName}</div>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-2">
          <span className="flex items-center gap-1">
            <i className="ti ti-map-pin text-[13px] text-ink-3" />
            {lead.locationName ? `${lead.locationName}, ${lead.comune}` : lead.comune}
          </span>
          {age && (
            <span className="flex items-center gap-1">
              <i className="ti ti-users text-[13px] text-ink-3" />
              {age}
            </span>
          )}
          {dateRange && (
            <span className="flex items-center gap-1">
              <i className="ti ti-calendar text-[13px] text-ink-3" />
              {dateRange}
            </span>
          )}
        </div>

        <p className="mb-2 text-[12px] leading-snug text-ink-2">{lead.shortDescription}</p>

        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-bold text-ink">
            {lead.price != null ? (
              <>
                €{lead.price}
                {lead.priceUnit === "per_settimana" && (
                  <small className="text-[11px] font-normal text-ink-2"> / settimana</small>
                )}
              </>
            ) : (
              <span className="text-[11px] font-normal text-ink-3">Prezzo non indicato dalla fonte</span>
            )}
          </div>
        </div>

        {/* Disclaimer di provenienza — sempre presente, mai omesso. Copy
            concordata nel report (§3 Discovery Semantics): comunica che
            TRAMA ha trovato e organizzato l'informazione, non che il
            centro l'ha pubblicata su TRAMA. */}
        <p className="mb-2 border-t border-[#F0F2F5] pt-2 text-[10px] leading-snug text-ink-3">
          Informazioni raccolte da fonti pubbliche
          {lead.confidence === "medium" ? " e da riconfermare" : ""}. Verifica disponibilità e dettagli sul
          sito dell&apos;organizzatore.
        </p>

        <div className="flex items-center gap-2">
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCtaClick}
            className="flex-1 rounded-md bg-trama-violet px-3 py-2 text-center text-[12px] font-semibold text-white"
          >
            {ctaLabel}
          </a>
          {lead.contact && (
            <span className="text-[11px] text-ink-2" title="Contatto dichiarato dall'organizzatore">
              {lead.contact}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
