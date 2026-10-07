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
// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), CURATED FAVORITES.
// Stesso pattern optimistic-UI + rollback di ActivityCard.tsx — "Preferito"
// qui significa "questa Scoperta mi interessa e voglio ritrovarla" (mai
// "è già Partner TRAMA", vedi OBIETTIVO PRODOTTO §A del task).
import { toggleCuratedFavoriteAction } from "@/app/actions/curated-favorites";
// TRAMA — EXTERNAL PLANNER ITEMS (sezioni 7/16 del task, "Aggiungi al
// Planner" da una Scoperta TRAMA + CTA HIERARCHY). Stesso pattern
// "Server Action invocata direttamente dal componente client" di
// proposeDiscoveryLeadInviteAction sopra.
import { addCuratedLeadToPlannerAction } from "@/app/actions/external-planner-items";
import type { Kid } from "@/lib/types";

const CATEGORY_LABELS: Record<DiscoveryLeadRecord["category"], string> = {
  educativo: "Educativo",
  sportivo: "Sportivo",
  multisport: "Multisport",
  artistico: "Artistico",
};

// §15 "CARD POLISH": visual neutro per categoria al posto della foto/emoji
// reale di ActivityCard (activity.emoji) — nessuna attività scoperta ha
// un'emoji propria dichiarata dalla fonte, quindi una per macro-categoria,
// mai un'immagine commerciale copiata da terzi (§9 Image/Copyright Audit).
const CATEGORY_EMOJI: Record<DiscoveryLeadRecord["category"], string> = {
  educativo: "🎨",
  sportivo: "⚽",
  multisport: "🏅",
  artistico: "🎭",
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

export default function DiscoveryLeadCard({
  lead,
  initialFavorite,
  kids = [],
  plannerEnabled = false,
  initialInPlanner = false,
}: {
  lead: DiscoveryLeadRecord;
  // FIX (§6 "FAVORITE BUTTON UX" del task) — stesso pattern di
  // ActivityCard.tsx#initialFavorite: lo stato iniziale arriva dal
  // chiamante (che legge getCuratedFavoriteLeadIds() lato server), mai un
  // useState locale sempre "vuoto" al primo render.
  initialFavorite?: boolean;
  // TRAMA — EXTERNAL PLANNER ITEMS (sezioni 7/16 del task). kids sempre
  // passato dal chiamante (SearchDiscoveryClient già li ha) — default []
  // solo per non rompere altri eventuali call site/test che non li passano
  // ancora. plannerEnabled=false per default: nessuna CTA "Aggiungi al
  // Planner" finché il flag EXTERNAL_PLANNER_ITEMS_ENABLED non risolve true
  // per questo utente (stesso principio "nessuna rotta/azione alternativa
  // per un utente normale" delle altre capability gated del repo).
  kids?: Kid[];
  plannerEnabled?: boolean;
  initialInPlanner?: boolean;
}) {
  const showToast = useNextgenToast();
  const [fav, setFav] = useState(initialFavorite ?? false);
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

  // TRAMA — EXTERNAL PLANNER ITEMS (sezione 7/16 del task) — stesso
  // ciclo di stati inline di "Proponi invito" sopra, ciclo indipendente
  // (una Scoperta invitabile può avere entrambi i dialog, mai aperti
  // insieme — vedi guardie booleane più sotto). "confirm" mostra il
  // selettore bambini (sezione 3: campo obbligatorio anche per questo
  // flow, sezione 4: multi-bambino supportato).
  type PlanState = "idle" | "confirm" | "submitting" | "done" | "error";
  const [planState, setPlanState] = useState<PlanState>(initialInPlanner ? "done" : "idle");
  // FAMILY-FIRST BETA PASS: unica condizione per "Aggiungi al Planner"
  // come azione disponibile (stessa usata già nel ramo source-only sotto).
  const canAddToPlanner = plannerEnabled && planState !== "done" && kids.length > 0;
  const [planError, setPlanError] = useState<string | null>(null);
  const [planKidIds, setPlanKidIds] = useState<string[]>([]);
  // TRAMA — DATELESS DISCOVERY (sezione 5/6 del task, 28/09/2026, live UX
  // fix). ROOT CAUSE ANALYSIS completa in
  // lib/planner/external-planner-items-core.ts: la CTA "Aggiungi al
  // Planner" NON era mai gated dalla presenza di date (verificato in questo
  // stesso file — nessuna condizione su lead.startDate ovunque sotto), il
  // problema reale era che il form non chiedeva MAI le date quando il lead
  // non le conosceva (fallback silenzioso a "oggi" lato server). Precompilate
  // con le date del lead quando note (CASE A — l'utente può correggerle),
  // vuote quando il lead non le conosce (CASE B — l'utente deve
  // compilarle): stesso principio "non inventare mai una data/durata più
  // specifica della fonte" già rispettato dal resto della card.
  const [planStartDate, setPlanStartDate] = useState(lead.startDate ?? "");
  const [planEndDate, setPlanEndDate] = useState(lead.endDate ?? lead.startDate ?? "");
  const hasKnownDates = Boolean(lead.startDate && lead.endDate);

  function togglePlanKid(kidId: string) {
    setPlanKidIds((ids) => (ids.includes(kidId) ? ids.filter((id) => id !== kidId) : [...ids, kidId]));
  }

  async function handleConfirmAddToPlanner() {
    if (planKidIds.length === 0) {
      setPlanError("Seleziona almeno un bambino.");
      return;
    }
    // CASE B "DATE RICHIESTE": senza questo controllo lato client il form
    // manderebbe comunque una richiesta valida (validateExternalPlannerItemInput
    // richiede solo che le date NON siano vuote, non che siano state
    // "confermate dall'utente") — il messaggio esplicito qui evita un
    // errore generico dal server per un campo che l'utente vede benissimo
    // sullo schermo.
    if (!planStartDate || !planEndDate) {
      setPlanError("Indica quando si svolge questo impegno.");
      return;
    }
    if (planEndDate < planStartDate) {
      setPlanError("La data di fine non può precedere quella di inizio.");
      return;
    }
    setPlanState("submitting");
    setPlanError(null);
    const result = await addCuratedLeadToPlannerAction(lead.id, planKidIds, {
      startDate: planStartDate,
      endDate: planEndDate,
    });
    if (result.error) {
      setPlanState("error");
      setPlanError(result.error);
      return;
    }
    setPlanState("done");
    showToast("Aggiunto al Planner.");
  }

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

  function handleToggleFavorite() {
    const next = !fav;
    setFav(next); // aggiornamento ottimistico
    toggleCuratedFavoriteAction(lead.id, next).then((result) => {
      if (result.error) setFav(!next); // rollback se la scrittura fallisce
    });
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
      {/* TRAMA — DISCOVERY MAP + POLISH (21/09/2026), §15 "CARD POLISH —
          LIST": hero portata a 140px (stessa altezza esatta dell'hero foto/
          gradiente di ActivityCard.tsx, non più 72px) con lo stesso schema
          di badge overlay — categoria in alto a sinistra nella stessa
          posizione/stile del badge "Match X%" di ActivityCard, "Scoperta
          TRAMA" in basso come pillola bianca semi-trasparente nella stessa
          posizione/stile della pillola rating+centro di ActivityCard — così
          l'"altezza visiva percepita" (richiesta esplicitamente dal prompt)
          e il ritmo badge-in-alto/pillola-in-basso combaciano tra le due
          card, pur restando due componenti distinti (nessun Match/rating/
          favorite qui: solo un visual neutro per categoria, mai
          un'immagine commerciale). */}
      <div className="relative flex h-[140px] items-center justify-center bg-[linear-gradient(135deg,#F3F0FF,#EDE9FE)]">
        <span className="text-6xl opacity-40" aria-hidden>
          {CATEGORY_EMOJI[lead.category]}
        </span>
        <div className="absolute left-2.5 top-2.5 z-[1] rounded-full bg-trama-violet px-2.5 py-1 text-[11px] font-bold text-white">
          {CATEGORY_LABELS[lead.category]}
        </div>
        <div className="absolute bottom-2 left-1/2 z-[1] -translate-x-1/2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-2 backdrop-blur-sm">
          Scoperta TRAMA
        </div>
        {/* §6 "FAVORITE BUTTON UX" — stessa posizione/stile del cuore in
            ActivityCard.tsx (angolo in alto a destra dell'hero), cosi il
            cuore "si legge come lo stesso prodotto" senza far sembrare la
            Scoperta un Partner (nessun badge Match/rating accanto). */}
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={fav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
          className="absolute right-2.5 top-2.5 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-base transition-transform hover:scale-110"
        >
          {fav ? "❤️" : "🤍"}
        </button>
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
          <div className="text-base font-bold text-ink">
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

        {/* TRAMA — EXTERNAL PLANNER ITEMS (sezione 16 del task "CTA
            HIERARCHY IN DISCOVERY"): con l'arrivo di "Aggiungi al Planner"
            la card avrebbe fino a 4 CTA (cuore + Proponi invito + Sito/Fonte
            + Planner) — riga compatta scelta: 1 PRIMARY grande (Proponi
            invito quando invitabile, altrimenti Aggiungi al Planner se
            abilitato) + icon-button compatti per le azioni secondarie
            (Planner quando non primaria, link esterno sempre). Nessuna
            action sheet/nuova pagina Detail introdotta — restano bottoni
            inline, stesso principio "leggero" del resto della card. */}
        {planState === "done" && (
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#2d8f52]">
            <i className="ti ti-circle-check-filled text-[13px]" />
            Nel Planner
          </div>
        )}

        {/* §7-8-11 del prompt "PROPONI INVITO"/"CTA HIERARCHY": PRIMARY
            "Proponi invito" SOLO per lead invitabili (isDiscoveryLeadInvitable),
            SECONDARY sempre presente con wording dipendente dal dominio del
            link. Nessun "Prenota ora" finto, nessun bottone disabilitato
            senza spiegazione, nessuna disponibilità finta — nessuno di
            questi ha un sistema reale dietro (§14). */}
        {/* TRAMA — FAMILY-FIRST BETA PASS (07/10/2026): gerarchia invertita
            quando il Planner è disponibile. "Aggiungi al Planner" diventa la
            PRIMARY (la Scoperta è utile alla famiglia anche se il centro non
            è su TRAMA), "Proponi invito" resta visibile come SECONDARY con
            testo (non più solo icona per il Planner). Senza Planner
            (flag spento o nessun bambino) la riga resta quella di prima. */}
        {invitable && proposeState !== "confirm" && proposeState !== "submitting" && planState !== "confirm" && planState !== "submitting" && (
          <div className="flex items-center gap-2">
            {canAddToPlanner && (
              <button
                type="button"
                onClick={() => setPlanState("confirm")}
                className="flex-1 rounded-full bg-trama-violet px-3 py-2 text-center text-[12px] font-semibold text-white active:scale-[0.98]"
              >
                Aggiungi al Planner
              </button>
            )}
            {proposeState === "done" ? (
              <span
                className={`flex items-center justify-center gap-1.5 rounded-full bg-green-light px-3 py-2 text-center text-[12px] font-semibold text-[#2d8f52] ${canAddToPlanner ? "shrink-0" : "flex-1"}`}
              >
                <i className="ti ti-circle-check-filled text-[14px]" />
                Proposta inviata
              </span>
            ) : proposeState === "already" ? (
              <span
                className={`rounded-full bg-[#F4F6FA] px-3 py-2 text-center text-[12px] font-semibold text-ink-2 ${canAddToPlanner ? "shrink-0" : "flex-1"}`}
              >
                {canAddToPlanner ? "Già proposto" : "Hai già proposto questo centro"}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setProposeState("confirm")}
                className={
                  canAddToPlanner
                    ? "shrink-0 rounded-full border border-[#E8EBF0] px-3 py-2 text-center text-[12px] font-semibold text-ink-2 active:scale-[0.98]"
                    : "flex-1 rounded-full bg-trama-violet px-3 py-2 text-center text-[12px] font-semibold text-white active:scale-[0.98]"
                }
              >
                Proponi invito
              </button>
            )}
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleExternalClick}
              aria-label={secondaryLabel}
              title={secondaryLabel}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8EBF0] text-ink-2"
            >
              <i className="ti ti-external-link text-[15px]" />
            </a>
          </div>
        )}

        {/* §14 "SOURCE-ONLY RECORDS": nessuna CTA primaria "Proponi invito"
            — quando il Planner è abilitato, "Aggiungi al Planner" diventa
            la PRIMARY per questi record (l'unica azione reale disponibile
            oltre al link esterno), altrimenti resta solo il link secondario
            come prima.
            §16 del prompt MAP+POLISH "SOURCE-ONLY MICROCOPY": una riga breve
            che spiega PERCHÉ manca "Proponi invito" — mostrata solo quando è
            effettivamente vera per questo record (!invitable, per
            definizione tutti i record source-only), mai un tono
            allarmistico. */}
        {!invitable && planState !== "confirm" && planState !== "submitting" && (
          <>
            <p className="mb-1.5 text-[10.5px] text-ink-3">Il centro non è ancora su TRAMA: puoi comunque salvarla e organizzarla.</p>
            <div className="flex items-center gap-2">
              {plannerEnabled && planState !== "done" && kids.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPlanState("confirm")}
                  className="flex-1 rounded-full bg-trama-violet px-3 py-2 text-center text-[12px] font-semibold text-white active:scale-[0.98]"
                >
                  Aggiungi al Planner
                </button>
              )}
              <a
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalClick}
                className={
                  plannerEnabled && planState !== "done" && kids.length > 0
                    ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8EBF0] text-ink-2"
                    : "flex flex-1 items-center justify-center gap-1 rounded-full border border-[#E8EBF0] px-3 py-2 text-center text-[12px] font-semibold text-ink-2"
                }
                aria-label={secondaryLabel}
                title={secondaryLabel}
              >
                {plannerEnabled && planState !== "done" && kids.length > 0 ? (
                  <i className="ti ti-external-link text-[15px]" />
                ) : (
                  <>{secondaryLabel} ↗</>
                )}
              </a>
            </div>
          </>
        )}

        {/* TRAMA — EXTERNAL PLANNER ITEMS (sezione 7 del task) — dialog
            leggero INLINE, stesso pattern di "Proponi invito" sotto: scelta
            bambini (obbligatoria, sezione 3/4) prima della conferma. */}
        {plannerEnabled && (planState === "confirm" || planState === "submitting" || planState === "error") && (
          <div className="rounded-lg border border-[#E8EBF0] bg-bg p-3">
            <p className="mb-1.5 text-[12.5px] font-semibold text-ink">Aggiungi al Planner</p>
            <p className="mb-2 text-[11.5px] text-ink-2">
              Salviamo i dati di questa Scoperta nel tuo Planner (titolo, data, luogo) — resteranno anche se
              cambia il catalogo TRAMA.
            </p>
            {/* CASE A/B/C (sezione 5 del task) — campi data SEMPRE
                modificabili: precompilati quando la fonte li conosce
                (hasKnownDates), vuoti altrimenti. Nessuna data/durata
                inventata: se il lead non le conosce, il genitore le
                inserisce lui, stesso principio del resto della card
                ("Prezzo non indicato dalla fonte" sopra). */}
            <div className="mb-2.5">
              <p className="mb-1.5 text-[11px] font-semibold text-ink-2">
                {hasKnownDates ? "Quando si svolge" : "Quando si svolge? Non indicato dalla fonte."}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10.5px] text-ink-3">Dal</span>
                  <input
                    type="date"
                    value={planStartDate}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPlanStartDate(next);
                      // Stessa convenzione già in uso nel form manuale
                      // (ExternalPlannerItemsSection.tsx#ItemForm): se "Al"
                      // precede la nuova "Dal", lo si allinea automaticamente
                      // invece di lasciare un range invertito da correggere
                      // a mano.
                      if (planEndDate && planEndDate < next) setPlanEndDate(next);
                    }}
                    className="w-full rounded-lg border border-[#E8EBF0] px-2.5 py-1.5 text-[12.5px]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10.5px] text-ink-3">Al</span>
                  <input
                    type="date"
                    value={planEndDate}
                    min={planStartDate || undefined}
                    onChange={(e) => setPlanEndDate(e.target.value)}
                    className="w-full rounded-lg border border-[#E8EBF0] px-2.5 py-1.5 text-[12.5px]"
                  />
                </label>
              </div>
            </div>
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {kids.map((kid) => (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => togglePlanKid(kid.id)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    planKidIds.includes(kid.id) ? "bg-trama-violet text-white" : "border border-[#E8EBF0] text-ink-2"
                  }`}
                >
                  {kid.emoji} {kid.name}
                </button>
              ))}
            </div>
            {planError && <p className="mb-2 text-[11.5px] font-medium text-trama-orange">{planError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={planState === "submitting"}
                onClick={() => {
                  setPlanState("idle");
                  setPlanError(null);
                  setPlanKidIds([]);
                }}
                className="flex-1 rounded-full border border-[#E8EBF0] px-3 py-2 text-[12px] font-semibold text-ink-2 disabled:opacity-60"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={planState === "submitting"}
                onClick={handleConfirmAddToPlanner}
                className="flex-1 rounded-full bg-trama-violet px-3 py-2 text-[12px] font-semibold text-white active:scale-[0.98] disabled:opacity-60"
              >
                {planState === "submitting" ? "Aggiungo…" : "Aggiungi"}
              </button>
            </div>
          </div>
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
