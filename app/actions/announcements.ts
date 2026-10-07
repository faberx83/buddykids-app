"use server";

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), NOVITÀ TRAMA / FEATURE
// ANNOUNCEMENTS.
//
// Due azioni distinte per i due livelli persistiti (§11: "NON sovraccaricare
// una tabella con significati incompatibili" — stessa tabella, due colonne,
// due momenti applicativi diversi):
// - markAnnouncementSeenAction: LEVEL 1 (Notification Center) — chiamata
//   quando l'utente apre/clicca l'annuncio dal bell.
// - dismissAnnouncementCalloutAction: LEVEL 2 (callout contestuale) —
//   chiamata su "Ho capito"/tap CTA del callout in superficie.
//
// Entrambe prendono SOLO announcementId (mai la versione dal client): la
// versione corrente vive nel catalogo code-based
// (lib/announcements/catalog.ts), letta qui server-side — un client
// desincronizzato (bundle vecchio in cache) non può mai scrivere una
// versione stale per errore.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { getAnnouncementById, isComingSoon } from "@/lib/announcements/catalog";
import { isMissingTableError, voteTelemetryDetail } from "@/lib/announcements/votes";
import { persistProductEvent } from "@/lib/telemetry/events";
import { generateCorrelationId } from "@/lib/telemetry/correlation";

async function upsertReceipt(
  announcementId: string,
  field: "seen_at" | "dismissed_at"
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };

  const entry = getAnnouncementById(announcementId);
  if (!entry) return { error: "Annuncio non trovato" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } = await supabase.from("announcement_receipts").upsert(
    {
      parent_id: user.id,
      announcement_id: announcementId,
      announcement_version: entry.version,
      [field]: new Date().toISOString(),
    },
    { onConflict: "parent_id,announcement_id,announcement_version" }
  );
  if (error) return { error: error.message };

  // Il bell (NotificationCenter) e l'eventuale callout contestuale vivono
  // in più route NEXTGEN (montato una sola volta nel layout, ma i Server
  // Component che leggono getVisibleAnnouncementsForCurrentParent() sono
  // per-pagina) — stesso principio "revalidate ogni rotta che legge questo
  // dato" già seguito in app/actions/favorites.ts.
  revalidatePath("/nextgen", "layout");

  return {};
}

export async function markAnnouncementSeenAction(announcementId: string): Promise<{ error?: string }> {
  return upsertReceipt(announcementId, "seen_at");
}

export async function dismissAnnouncementCalloutAction(announcementId: string): Promise<{ error?: string }> {
  return upsertReceipt(announcementId, "dismissed_at");
}

// ════════════════════════════════════════════════════════════════
// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026)
// ════════════════════════════════════════════════════════════════

/**
 * Apertura della pagina Novità: le voci visibili ancora non lette diventano
 * lette (stesso seen_at della campanella), così il badge si spegne anche
 * leggendole dalla pagina e non solo cliccandole nella campanella. Le
 * dismissioni dei callout contestuali (dismissed_at) non vengono toccate:
 * l'upsert scrive solo seen_at.
 */
export async function markAnnouncementsSeenFromNovitaAction(announcementIds: string[]): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const entries = announcementIds
    .map((id) => getAnnouncementById(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  if (entries.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const now = new Date().toISOString();
  const { error } = await supabase.from("announcement_receipts").upsert(
    entries.map((e) => ({
      parent_id: user.id,
      announcement_id: e.id,
      announcement_version: e.version,
      seen_at: now,
    })),
    { onConflict: "parent_id,announcement_id,announcement_version" }
  );
  if (error) return { error: error.message };

  for (const e of entries) {
    await persistProductEvent(
      { event: "announcement_read", correlationId: generateCorrelationId(), tenant: "family", detail: e.id },
      { supabase, userId: user.id }
    );
  }

  revalidatePath("/nextgen", "layout");
  return {};
}

/**
 * 👍/👎 su una voce "In arrivo" (announcement_votes, migration 40). vote = 0
 * ritira il voto. Accettato SOLO per voci coming_soon del catalogo.
 */
export async function setAnnouncementVoteAction(
  announcementId: string,
  vote: -1 | 0 | 1
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const entry = getAnnouncementById(announcementId);
  if (!entry || !isComingSoon(entry)) return { error: "Voce non votabile" };
  if (vote !== -1 && vote !== 0 && vote !== 1) return { error: "Voto non valido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { error } =
    vote === 0
      ? await supabase.from("announcement_votes").delete().eq("parent_id", user.id).eq("announcement_id", announcementId)
      : await supabase
          .from("announcement_votes")
          .upsert(
            { parent_id: user.id, announcement_id: announcementId, vote, updated_at: new Date().toISOString() },
            { onConflict: "parent_id,announcement_id" }
          );
  if (error) {
    if (isMissingTableError(error)) return { error: "Il voto non è ancora disponibile." };
    return { error: error.message };
  }

  await persistProductEvent(
    {
      event: "announcement_voted",
      correlationId: generateCorrelationId(),
      tenant: "family",
      detail: voteTelemetryDetail(announcementId, vote),
    },
    { supabase, userId: user.id }
  );

  revalidatePath("/nextgen/novita");
  return {};
}
