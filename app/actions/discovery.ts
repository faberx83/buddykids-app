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

const DISCOVERY_LEAD_EVENTS: readonly KnownProductEvent[] = [
  "curated_listing_viewed",
  "curated_listing_external_clicked",
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
