"use server";

// TRAMA — Calendar Export V1 · ANTEPRIMA INTERNA (11/09/2026). §8 della spec
// di Fabrizio: "Se l'export è interamente client-side, dillo esplicitamente.
// NON creare inutilmente un backend solo per poterlo 'gated'." — l'export
// vero e proprio (generazione del file .ics) resta interamente client-side
// (vedi components/nextgen/PlannerCalendarExportCard.tsx: buildPlannerCalendarIcsDataUrl
// gira nel browser, i dati arrivano già come prop dalla Server Component
// app/nextgen/planner/page.tsx). L'UNICA Server Action introdotta qui serve
// solo per l'evento di analytics opzionale (§10) — "qualunque Server
// Action/API introdotta deve riverificare il flag": lo fa sotto,
// autonomamente, anche se il chiamante dovrebbe già essere dietro al gate
// server-side della pagina Planner.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { persistProductEvent } from "@/lib/telemetry/events";
import { generateCorrelationId } from "@/lib/telemetry/correlation";

/**
 * Evento "adozione" PII-free — SOLO il conteggio degli impegni esportati,
 * mai bambino/centro/data specifici (stesso principio già seguito per
 * booking_created/group_created, vedi lib/telemetry/known-events.ts).
 * Fire-and-forget per costruzione: non lancia mai, il download del file
 * .ics lato client è già completo indipendentemente dall'esito di questa
 * chiamata (§10: "non bloccare la feature solo per aggiungere analytics").
 */
export async function logCalendarExportCreatedAction(itemCount: number): Promise<void> {
  try {
    if (!isSupabaseConfigured) return;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileRow } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = (profileRow?.role as string) ?? "parent";
    const correlationId = generateCorrelationId();

    const enabled = await resolveFeatureFlag({
      flagName: "CALENDAR_EXPORT_ENABLED",
      userId: user.id,
      role,
      tenant: "family",
      correlationId,
    });
    if (!enabled) return;

    await persistProductEvent(
      {
        event: "calendar_export_created",
        correlationId,
        tenant: "family",
        role,
        detail: `${itemCount} impegni esportati`,
      },
      { supabase, userId: user.id }
    );
  } catch {
    // Best-effort: mai propagare un errore di analytics verso l'utente.
  }
}
