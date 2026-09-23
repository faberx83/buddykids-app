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
import { getAnnouncementById } from "@/lib/announcements/catalog";

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
