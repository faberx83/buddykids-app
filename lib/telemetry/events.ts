import "server-only";

// TRAMA ONE Build Sprint 6 — E11, persistenza eventi prodotto
// (public.product_events, migration_20_product_events.sql, NON applicata).
//
// lib/telemetry/correlation.ts (Sprint 0) resta INVARIATO: logTelemetryEvent
// continua a scrivere solo su console, esattamente come prima. Questo modulo
// aggiunge un secondo passo, opzionale e sempre "best effort", che in più
// tenta di persistere l'evento su product_events — mai il contrario: non
// sostituisce mai logTelemetryEvent, lo precede sempre.
//
// "Best effort" qui significa, in ordine: (1) se Supabase non è configurato,
// no-op; (2) se non esiste una sessione autenticata nella richiesta corrente,
// no-op (coerente con la insert policy "auth.uid() is not null" di
// migration_20); (3) se la tabella non esiste ancora (migrazione non
// applicata) o l'insert fallisce per qualunque altro motivo, viene loggato
// un console.error e la funzione ritorna comunque senza lanciare — stessa
// filosofia già stabilita in questo sprint per l'invio email
// (lib/email.ts) e per recordEmailDeliveryStatus
// (app/actions/booking-response.ts): l'osservabilità non deve MAI diventare
// un nuovo modo di rompere il flusso utente.
//
// Il registro KNOWN_PRODUCT_EVENTS (whitelist) vive in ./known-events.ts,
// un file separato SENZA "import server-only": stesso principio già in uso
// in questo sprint per lib/command-center/priority.ts (pura) vs
// lib/data/command-center.ts (I/O) — permette a
// tests/one/product-events.spec.ts di importare la whitelist direttamente,
// senza passare dal bundler Next (che è l'unico contesto in cui "server-only"
// si risolve).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logTelemetryEvent, TelemetryLogEntry } from "./correlation";
import { isKnownProductEvent } from "./known-events";

export { KNOWN_PRODUCT_EVENTS, isKnownProductEvent } from "./known-events";
export type { KnownProductEvent } from "./known-events";

/**
 * Contesto opzionale per evitare una seconda chiamata a createClient()/
 * auth.getUser() quando il chiamante ne ha già uno a disposizione (Sprint 6,
 * hardening walkthrough, task #418 — persistProductEvent() era l'unica
 * chiamata di rete duplicata su ogni click Walkthrough: app/actions/
 * walkthrough.ts chiama già requireUser() che restituisce esattamente
 * supabase+user, prima di questo cambiamento persistProductEvent() ne
 * creava un secondo identico un attimo dopo). Se omesso, il comportamento è
 * invariato: la funzione crea da sé client e sessione.
 */
export interface PersistProductEventContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}

/**
 * Sostituto drop-in di logTelemetryEvent() per i soli eventi elencati in
 * KNOWN_PRODUCT_EVENTS: chiama SEMPRE logTelemetryEvent() per primo
 * (comportamento Sprint 0 invariato), poi tenta in più — mai in sua vece —
 * di persistere l'evento su product_events. Non ritorna nulla e non lancia
 * mai: i call site restano fire-and-forget esattamente come lo erano con
 * logTelemetryEvent().
 */
export async function persistProductEvent(
  entry: TelemetryLogEntry,
  context?: PersistProductEventContext
): Promise<void> {
  logTelemetryEvent(entry);

  if (!isSupabaseConfigured) return;
  if (!isKnownProductEvent(entry.event)) return;

  try {
    let supabase: Awaited<ReturnType<typeof createClient>>;
    if (context) {
      supabase = context.supabase;
    } else {
      supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return; // coerente con la RLS insert policy di migration_20
    }

    const { error } = await supabase.from("product_events").insert({
      event_name: entry.event,
      correlation_id: entry.correlationId ?? null,
      tenant: entry.tenant ?? null,
      role: entry.role ?? null,
      detail: entry.detail ?? null,
    });

    if (error) {
      // Atteso finché migration_20_product_events.sql non è stata applicata
      // manualmente da Fabrizio (tabella inesistente) — non è un errore
      // dell'utente, solo un promemoria per chi legge i log server.
      console.error(`[product-events] Insert fallito per evento "${entry.event}": ${error.message}`);
    }
  } catch (err) {
    console.error(`[product-events] Eccezione imprevista persistendo evento "${entry.event}":`, err);
  }
}
