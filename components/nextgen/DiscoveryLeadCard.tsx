"use client";

// TRAMA — REAL DISCOVERY PILOT (16/09/2026), esteso da DISCOVERY UNIFICATION
// + PROPONI INVITO (21/09/2026).
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
// non ha MAI un CTA "Prenota" — solo "Proponi invito" (per i lead
// invitabili) + un link secondario esterno, degrada silenziosamente ogni
// campo assente (nessun placeholder "N/D" invadente, la riga semplicemente
// non compare), e porta sempre il disclaimer di provenienza.
//
// DISCOVERY UNIFICATION (21/09/2026), §6 "CARD VISUAL GRAMMAR": padding,
// radius, gerarchia titolo/metadata e spacing allineati a ActivityCard.tsx
// (stesso rounded-lg/border/p-3, stessa dimensione titolo text-sm font-bold,
// stessa riga metadata con icone Tabler text-[13px] text-ink-3) — la card
// resta un componente React distinto (capability differenti: nessun Match/
// rating/favorite/disponibilità), ma deve leggersi come lo stesso prodotto.

import { useEffect, useState } from "react";
import type { DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";
import { isDiscoveryLeadInvitable, secondaryLinkLabelForLead } from "@/lib/discovery/real-dataset";
// TRAMA — REAL DISCOVERY PILOT · COMPLETION PASS (17/09/2026), §10
// "ANALYTICS MINIMUM". Stesso pattern già in uso da
// components/spotlight/SpotlightOverlay.tsx (Server Action invocata
// direttamente dal componente client, best-effort, mai bloccante) — nessuna
// nuova architettura di analytics introdotta. Vedi app/actions/discovery.ts.
import { logDiscoveryLeadEventAction, proposeDiscoveryLeadInviteAction } from "@/app/actions/discovery";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";

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
  const showToast = useNextgenToast();
  const dateRange = formatDateRange(lead.startDate, lead.endDate);
  const age = formatAge(lead.ageMin, lead.ageMax);
  const ctaHref = lead.registrationUrl || lead.officialUrl;
  const invitable = isDiscoveryLeadInvitable(lead);
  // §11 del prompt "CTA SECONDARIA": wording derivato dal dominio del link
  // (officialUrlIsOrganizerSite), MAI genericamente "sito ufficiale".
  const secondaryLabel = secondaryLinkLabelForLead(lead);

  // §10 "UX FLOW" — Flow B: tap su "Proponi invito" apre un dialog leggero
  // INLINE (stesso pattern già in uso da SuggestCenterCard.tsx per lo stato
  // "aperto", non un portale/modale separato — meno rischio, stessa UX
  // "leggera" richiesta). "proposeState" copre l'intero ciclo: idle → confirm
  // (dialog aperto) → submitting → done/already/error.
  type ProposeState = "idle" | "confirm" | "submitting" | "done" | "already" | "error";
  const [proposeState, setProposeState] = useState<ProposeState>("idle");
  const [proposeError, setProposeError] = useState<string | null>(null);

  // TRAMA — REAL DISCOVERY PILOT · COMPLETION PASS (17/09/2026). Un solo
  // evento "viewed" per montaggio della card (non per ogni ri-render dovuto
  // a un filtro che lascia il lead visibile) — dipendenza su lead.id, fire-
  // and-forget, mai bloccante per il rendering. detail = lead.id (nessun
  // dato utente).
  useEffect(() => {
    void logDiscoveryLeadEventAction("curated_listing_viewed", lead.id);
  }, [lead.id]);

  function handleExternalClick() {
    void logDiscoveryLeadEventAction("curated_listing_external_clicked", lead.id);
  }

  async function handleConfirmPropose() {
    setProposeState("submitting");
    setProposeError(null);
    const result = await proposeDiscoveryLeadInviteAction(lead.id, lead.organizerName, lead.comune);
    if (result.error) {
      setProposeState("error");
      setProposeError(result.error);
      return;
    }
    if (result.alreadyProposed) {
      setProposeState("already");
      return;
    }
    setProposeState("done");
    // §10: "toast equivalente a: Proposta inviata. Abbiamo registrato il tuo
    // interesse." — mai una promessa che TRAMA contatterà sicuramente il
    // centro.
    showToast("Proposta inviata — abbiamo registrato il tuo interesse.");
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
        <div className="mb-1 text-sm font-bold text-ink">{lead.activityTitle}</div>
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
          {lead.contact && (
            <span className="flex items-center gap-1" title="Contatto dichiarato dall'organizzatore">
              <i className="ti ti-phone text-[13px] text-ink-3" />
              {lead.contact}
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

        {/* §7-8-11 del prompt "PROPONI INVITO"/"CTA HIERARCHY": PRIMARY
            "Proponi invito" SOLO per lead invitabili (isDiscoveryLeadInvitable),
            SECONDARY sempre presente con wording dipendente dal dominio del
            link. Nessun "Prenota ora" finto, nessun bottone disabilitato
            senza spiegazione, nessuna disponibilità finta — nessuno di
            questi ha un sistema reale dietro (§14). */}
        {invitable && proposeState !== "confirm" && proposeState !== "submitting" && (
          <div className="flex items-center gap-2">
            {proposeState === "done" ? (
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-green-light px-3 py-2 text-center text-[12px] font-semibold text-[#2d8f52]">
                <i className="ti ti-circle-check-filled text-[14px]" />
                Proposta inviata
              </span>
            ) : proposeState === "already" ? (
              <span className="flex-1 rounded-full bg-[#F4F6FA] px-3 py-2 text-center text-[12px] font-semibold text-ink-2">
                Hai già proposto questo centro
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setProposeState("confirm")}
                className="flex-1 rounded-full bg-trama-violet px-3 py-2 text-center text-[12px] font-semibold text-white active:scale-[0.98]"
              >
                Proponi invito
              </button>
            )}
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleExternalClick}
              className="whitespace-nowrap text-[11.5px] font-semibold text-trama-violet underline underline-offset-2"
            >
              {secondaryLabel} ↗
            </a>
          </div>
        )}

        {/* §14 "SOURCE-ONLY RECORDS": nessuna CTA primaria — solo il link
            alla fonte, con wording onesto ("Vedi la fonte" per un servizio
            comunale, mai "sito dell'organizzatore" quando non esiste un
            organizzatore nominato). */}
        {!invitable && (
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleExternalClick}
            className="flex items-center justify-center gap-1 rounded-full border border-[#E8EBF0] px-3 py-2 text-center text-[12px] font-semibold text-ink-2"
          >
            {secondaryLabel} ↗
          </a>
        )}

        {/* Flow B — dialog leggero INLINE (§10): "Vuoi trovare questo centro
            su TRAMA? Segnalaci il tuo interesse..." + Annulla/Sì proponilo.
            Nessun form, nessuna domanda aggiuntiva. */}
        {invitable && (proposeState === "confirm" || proposeState === "submitting" || proposeState === "error") && (
          <div className="rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <p className="mb-1 text-[12.5px] font-semibold text-ink">Vuoi trovare questo centro su TRAMA?</p>
            <p className="mb-3 text-[11.5px] text-ink-2">
              Segnalaci il tuo interesse: ci aiuterà a capire quali centri invitare sulla piattaforma.
            </p>
            {proposeError && <p className="mb-2 text-[11.5px] font-medium text-trama-orange">{proposeError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={proposeState === "submitting"}
                onClick={() => {
                  setProposeState("idle");
                  setProposeError(null);
                }}
                className="flex-1 rounded-full border border-[#E8EBF0] px-3 py-2 text-[12px] font-semibold text-ink-2 disabled:opacity-60"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={proposeState === "submitting"}
                onClick={handleConfirmPropose}
                className="flex-1 rounded-full bg-trama-violet px-3 py-2 text-[12px] font-semibold text-white active:scale-[0.98] disabled:opacity-60"
              >
                {proposeState === "submitting" ? "Invio…" : "Sì, proponilo"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
