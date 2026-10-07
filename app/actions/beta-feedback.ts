"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import {
  isBetaFeedbackCategory,
  isMissingColumnError,
  sanitizeBetaFeedbackClientContext,
} from "@/lib/nextgen/beta-feedback-shared";
import { getBuildInfo } from "@/lib/build-info";
import { persistProductEvent } from "@/lib/telemetry/events";
import { generateCorrelationId } from "@/lib/telemetry/correlation";

// SPRINT 5 (NEXTGEN) — "Segnala un problema": il genitore invia una
// segnalazione dalla floating CTA (BetaFeedbackButton.tsx), sempre in stato
// "nuovo" (RLS lo impone comunque). "area"/"pagePath" arrivano già calcolati
// dal client (vedi lib/nextgen/beta-feedback-areas.ts), nessuna logica di
// interpretazione lato server.
//
// ESTENSIONE PARTNER (Fabrizio: "il pulsante per le segnalazioni... non
// possiamo metterlo... nel portale partner?") — appSource ora è un
// parametro invece di un valore fisso "genitori": la colonna app_source
// (supabase/schema.sql) supportava già 'gestore' fin dalla creazione della
// tabella (Sprint 5), così come la UI Admin (SOURCE_LABEL in
// SegnalazioniBetaAdminClient.tsx) — nessuna migrazione né modifica Admin
// necessaria per questa estensione. Il default resta "genitori" per non
// dover toccare la chiamata esistente in BetaFeedbackButton.tsx lato
// genitore. Il nome colonna "parent_id" è storico/fuorviante (risale a
// quando la tabella serviva solo l'app genitori) ma tecnicamente corretto
// per qualunque ruolo: referenzia profiles(id), e la RLS controlla solo
// `auth.uid() = parent_id`, senza alcun vincolo di ruolo.
export async function submitBetaFeedbackAction(
  area: string,
  pagePath: string,
  message: string,
  appSource: "genitori" | "gestore" = "genitori",
  // TRAMA — FAMILY-FIRST BETA PASS (07/10/2026): tipo facoltativo + contesto
  // automatico (migration 40). Parametro opzionale: i call site esistenti
  // restano validi senza modifiche.
  extra?: { category?: string | null; clientContext?: unknown }
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!message.trim()) return { error: "Scrivi qualcosa prima di inviare" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const base = {
    parent_id: user.id,
    app_source: appSource,
    area,
    page_path: pagePath,
    message: message.trim(),
    status: "nuovo",
  };

  const category = isBetaFeedbackCategory(extra?.category) ? extra?.category : null;
  let clientContext: Record<string, unknown> | null = null;
  if (extra) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    clientContext = {
      ...sanitizeBetaFeedbackClientContext(extra.clientContext),
      role: (profile?.role as string | undefined) ?? undefined,
      build: getBuildInfo().shortSha ?? undefined,
    };
  }

  let { error } = await supabase
    .from("beta_feedback")
    .insert(extra ? { ...base, category, client_context: clientContext } : base);

  // Migration 40 non ancora applicata: le colonne nuove non esistono.
  // Il feedback si salva comunque con le sole colonne storiche (mai perso).
  if (error && extra && isMissingColumnError(error)) {
    ({ error } = await supabase.from("beta_feedback").insert(base));
  }

  if (error) return { error: error.message };

  await persistProductEvent(
    {
      event: "feedback_submitted",
      correlationId: generateCorrelationId(),
      tenant: appSource === "gestore" ? "partner" : "family",
      role: (clientContext?.role as string | undefined) ?? null,
      detail: category ?? "senza_categoria",
    },
    { supabase, userId: user.id }
  );

  revalidatePath("/nextgen/profile/segnalazioni");
  revalidatePath("/admin/segnalazioni-beta");
  return {};
}

export async function updateBetaFeedbackStatusAction(
  id: string,
  status: "nuovo" | "in_gestione" | "risolto",
  adminNote?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("beta_feedback")
    .update({
      status,
      admin_note: adminNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/segnalazioni-beta");
  return {};
}

// SPRINT 8 — "conferma -> lavorazione automatica" (Fabrizio: "voglio che se
// segnalo come confermata arrivi già qui e la metti in lavorazione"). Questo
// bottone imposta SOLO pipeline_status = 'confirmed' — usa la stessa RLS di
// update già esistente (solo platform_admin, vedi supabase/schema.sql), lo
// stesso meccanismo di updateBetaFeedbackStatusAction sopra: nessuna nuova
// autorizzazione qui, perché chi chiama questa action è già autenticato
// come admin nella sessione del browser. Il secret/RPC "senza login" (vedi
// migration Sprint 8) serve SOLO al task automatico esterno che legge le
// righe 'confirmed' — non a questa action, che gira lato server con la
// sessione reale dell'admin.
export async function confirmBetaFeedbackForPipelineAction(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase
    .from("beta_feedback")
    .update({ pipeline_status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/segnalazioni-beta");
  return {};
}
