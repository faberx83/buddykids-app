"use server";

// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Segnali beta che nascono lato
// client (apertura del pannello feedback, apertura della pagina Novità) e
// finiscono nella stessa product_events già usata dal resto del prodotto
// (lib/telemetry/events.ts#persistProductEvent). Whitelist esplicita: questa
// action non accetta nomi evento arbitrari dal client.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { persistProductEvent } from "@/lib/telemetry/events";
import { generateCorrelationId } from "@/lib/telemetry/correlation";

const CLIENT_SIGNALS = ["feedback_opened", "novita_opened"] as const;
export type ClientBetaSignal = (typeof CLIENT_SIGNALS)[number];

export async function recordBetaSignalAction(event: ClientBetaSignal, detail?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!(CLIENT_SIGNALS as readonly string[]).includes(event)) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await persistProductEvent(
      {
        event,
        correlationId: generateCorrelationId(),
        tenant: "family",
        detail: detail ? detail.slice(0, 60) : null,
      },
      { supabase, userId: user.id }
    );
  } catch {
    // Telemetria best-effort: mai bloccare l'interfaccia per un evento perso.
  }
}
