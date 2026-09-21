"use server";

// TRAMA — REAL DISCOVERY PILOT · COMPLETION PASS (17/09/2026), §10 del
// prompt "ANALYTICS MINIMUM". Server Action minima per persistere i 2 eventi
// richiesti (curated_listing_viewed/curated_listing_external_clicked,
// lib/telemetry/known-events.ts) — copia deliberata dello stesso identico
// pattern già usato da app/actions/spotlight.ts per gli eventi del motore
// Spotlight: nessuna nuova architettura di analytics introdotta, solo un
// secondo call site sulla stessa infrastruttura esistente (persistProductEvent
// best-effort, mai bloccante). `detail` accetta SOLO l'id del lead curato
// (stringa statica del dataset code-based in lib/discovery/real-dataset.ts)
// — mai il testo digitato dall'utente nella ricerca, mai dati su bambini o
// famiglia, coerente con TELEMETRY_FORBIDDEN_FIELDS.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { persistProductEvent } from "@/lib/telemetry/events";
import { isKnownProductEvent, KnownProductEvent } from "@/lib/telemetry/known-events";
// TRAMA — DISCOVERY UNIFICATION + PROPONI INVITO (21/09/2026, §9: "Usa
// l'infrastruttura esistente: public.center_leads e il flow già esistente
// di suggestCenterLeadAction. NON creare una nuova tabella."). Riuso diretto
// — nessuna nuova Server Action di scrittura, solo un wrapper che chiama
// quella esistente con i dati già noti del lead curato e poi registra
// l'evento analytics SOLO in caso di successo (§13).
import { suggestCenterLeadAction } from "@/app/actions/center-leads";
import { normalizeDedupeKey, hasParentAlreadySuggestedLead } from "@/lib/data/center-leads";
import { CenterLeadDemandContext } from "@/lib/types";

const DISCOVERY_LEAD_EVENTS: readonly KnownProductEvent[] = [
  "curated_listing_viewed",
  "curated_listing_external_clicked",
  "curated_listing_invite_proposed",
];

export async function logDiscoveryLeadEventAction(event: string, leadId: string): Promise<void> {
  // Fail-safe silenzioso per costruzione, stesso principio di
  // logSpotlightEventAction: un evento di telemetria non deve MAI produrre
  // un errore visibile né rallentare la navigazione dell'utente in Scopri.
  if (!isSupabaseConfigured) return;
  if (!isKnownProductEvent(event) || !DISCOVERY_LEAD_EVENTS.includes(event)) return;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await persistProductEvent(
      { event, correlationId: generateCorrelationId(), detail: leadId },
      { supabase, userId: user.id }
    );
  } catch (err) {
    console.error(`[discovery] Impossibile registrare l'evento "${event}":`, err);
  }
}

// TRAMA — DISCOVERY UNIFICATION + PROPONI INVITO (21/09/2026), §9-10 del
// prompt. "Proponi invito" NON invia automaticamente un'email al centro:
// registra una manifestazione d'interesse della famiglia, esattamente come
// "Suggerisci un centro" (SuggestCenterCard.tsx) — qui pre-compilata con i
// dati già noti del lead curato invece che digitati dall'utente. Mostrato
// SOLO per lead con `invitable: true` (vedi lib/discovery/real-dataset.ts,
// isDiscoveryLeadInvitable) — mai per i 6 record SOURCE-ONLY.
export interface ProposeDiscoveryLeadInviteResult {
  error?: string;
  alreadyProposed?: boolean;
}

export async function proposeDiscoveryLeadInviteAction(
  leadId: string,
  organizerName: string,
  comune: string
): Promise<ProposeDiscoveryLeadInviteResult> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  // §12 "CENTER_LEADS": stesso utente non deve accumulare righe duplicate a
  // proprio nome per lo stesso lead — dedupe_key identico a quello che
  // suggestCenterLeadAction calcolerebbe comunque (stessa funzione pura),
  // verificato PRIMA dell'insert invece che dopo.
  const dedupeKey = normalizeDedupeKey(organizerName, comune);
  const already = await hasParentAlreadySuggestedLead(dedupeKey);
  if (already) return { alreadyProposed: true };

  const demandContext: CenterLeadDemandContext = {
    sourceRoute: "/nextgen/search",
    locality: comune,
    discoveryLeadId: leadId,
  };

  // Riuso diretto dell'azione esistente (stessa validazione, stessa RLS,
  // stesso stato iniziale "suggested") — nessun contatto raccolto qui
  // (undefined), coerente con "Nessun form, nessuna domanda aggiuntiva" (§10).
  const result = await suggestCenterLeadAction(organizerName, comune, undefined, demandContext);
  if (result.error) return result;

  // Evento SOLO alla conferma riuscita (§13) — mai per apertura dialog, mai
  // per annulla, mai se l'insert fallisce.
  await logDiscoveryLeadEventAction("curated_listing_invite_proposed", leadId);
  return {};
}
