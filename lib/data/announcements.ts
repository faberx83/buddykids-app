import "server-only";

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), NOVITÀ TRAMA / FEATURE
// ANNOUNCEMENTS.
//
// Aggregatore: combina il catalogo EDITORIALE code-based
// (lib/announcements/catalog.ts) con (1) la risoluzione del feature flag
// richiesto per QUESTO utente (§12 "TARGETING"/"Rispetta internal-preview/
// pilot") e (2) lo stato di interazione persistito in
// public.announcement_receipts (supabase/migration_38_curated_favorites_
// and_announcements.sql — NON ANCORA APPLICATA). Stesso principio "server
// verifica sessione+ruolo PRIMA di qualunque query" già in uso da
// lib/data/notifications.ts.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { ANNOUNCEMENT_CATALOG, type AnnouncementCatalogEntry } from "@/lib/announcements/catalog";

export interface UserAnnouncement extends AnnouncementCatalogEntry {
  isSeen: boolean;
  isDismissed: boolean;
}

interface ReceiptRow {
  announcement_id: string;
  announcement_version: number;
  seen_at: string | null;
  dismissed_at: string | null;
}

async function currentParent(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string; role: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile?.role as string) ?? "parent";
  if (role !== "parent") return null;
  return { userId: user.id, role };
}

/**
 * Annunci VISIBILI per l'utente corrente (announceToUsers=true, audience
 * "parent", e — se presente requiredFeatureFlag — quel flag risolve true
 * per questo utente specifico) con lo stato seen/dismissed già calcolato
 * rispetto alla VERSIONE corrente del catalogo (§10/§11: una riga con
 * announcement_version < versione corrente NON conta come vista/dismessa —
 * ignorata, mai fatta un UPDATE in place, la storicizza semplicemente).
 */
export async function getVisibleAnnouncementsForCurrentParent(): Promise<UserAnnouncement[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const current = await currentParent(supabase);
  if (!current) return [];
  const { userId, role } = current;

  const candidates = ANNOUNCEMENT_CATALOG.filter((a) => a.announceToUsers && a.audience.includes("parent"));
  if (candidates.length === 0) return [];

  // Un solo resolve per flag distinto richiesto (mai uno per entry se più
  // entry condividono lo stesso flag) — stesso principio "nessuna query
  // duplicata" già seguito altrove in questo codice.
  const flagNames = Array.from(new Set(candidates.map((a) => a.requiredFeatureFlag).filter(Boolean))) as string[];
  const flagResults = await Promise.all(
    flagNames.map(async (flagName) => {
      const detail = await resolveFeatureFlagVisibility({
        flagName,
        userId,
        role,
        tenant: "family",
        correlationId: generateCorrelationId(),
      });
      return [flagName, detail.enabled] as const;
    })
  );
  const flagEnabled = new Map(flagResults);

  const visible = candidates.filter((a) => !a.requiredFeatureFlag || flagEnabled.get(a.requiredFeatureFlag));
  if (visible.length === 0) return [];

  const { data: receiptRows } = await supabase
    .from("announcement_receipts")
    .select("announcement_id, announcement_version, seen_at, dismissed_at")
    .eq("parent_id", userId)
    .in(
      "announcement_id",
      visible.map((a) => a.id)
    );
  const receipts = (receiptRows ?? []) as ReceiptRow[];

  return visible.map((a) => {
    const receipt = receipts.find((r) => r.announcement_id === a.id && r.announcement_version === a.version);
    return {
      ...a,
      isSeen: Boolean(receipt?.seen_at),
      isDismissed: Boolean(receipt?.dismissed_at),
    };
  });
}

/** Solo le voci con un contextualSurface che combacia — Level 2 "CONTEXTUAL NEW" (§10), non ancora dismesse. */
export async function getContextualAnnouncementForSurface(surface: string): Promise<UserAnnouncement | null> {
  const all = await getVisibleAnnouncementsForCurrentParent();
  return all.find((a) => a.contextualSurface === surface && !a.isDismissed) ?? null;
}
