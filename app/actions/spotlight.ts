"use server";

// CONTROLLED BETA EXPERIENCE GATE (§7-14) — Server Action minima per
// persistere gli eventi del motore visivo Spotlight (spotlight_shown/
// spotlight_target_not_found/spotlight_dismissed, lib/telemetry/
// known-events.ts). Distinta da app/actions/walkthrough.ts: quella traccia
// l'avanzamento dello STEP nel registry (tutorial_progress), questa traccia
// il comportamento del motore VISIVO in sé — nessuna scrittura su
// tutorial_progress qui, solo telemetria best-effort (mai bloccante, stessa
// filosofia di persistProductEvent).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { persistProductEvent } from "@/lib/telemetry/events";
import { isKnownProductEvent, KnownProductEvent } from "@/lib/telemetry/known-events";

const SPOTLIGHT_EVENTS: readonly KnownProductEvent[] = [
  "spotlight_shown",
  "spotlight_target_not_found",
  "spotlight_dismissed",
];

export async function logSpotlightEventAction(event: string, detail: string): Promise<void> {
  // Fail-safe silenzioso per costruzione: un evento di telemetria non deve
  // MAI produrre un errore visibile all'utente che sta seguendo il
  // percorso guidato — se qualcosa non va, semplicemente non si registra.
  if (!isSupabaseConfigured) return;
  if (!isKnownProductEvent(event) || !SPOTLIGHT_EVENTS.includes(event)) return;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await persistProductEvent(
      { event, correlationId: generateCorrelationId(), detail },
      { supabase, userId: user.id }
    );
  } catch (err) {
    console.error(`[spotlight] Impossibile registrare l'evento "${event}":`, err);
  }
}
