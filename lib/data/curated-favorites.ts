import "server-only";

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), CURATED FAVORITES.
//
// Data layer per i Preferiti su Scoperta TRAMA — stesso principio di
// lib/data/favorites.ts (getFavoriteActivityIds/getFavoriteActivitiesForParent),
// ma sulla tabella nuova public.curated_favorites (supabase/
// migration_38_curated_favorites_and_announcements.sql — NON ANCORA
// APPLICATA: le query qui falliranno con 42P01 finché la migration non è
// applicata in produzione, stesso comportamento "atteso, non un bug" già
// documentato nella migration stessa).
//
// ASSUME che la migration sia già applicata quando questo modulo viene
// invocato — nessun controllo difensivo "colonna assente" come in
// migration_37 (quella tecnica serve per colonne AGGIUNTE a tabelle già
// lette ovunque in produzione; qui la tabella è interamente nuova e i call
// site sono tutti nuovi in questo stesso ciclo, vedi commento
// BACKWARD COMPATIBILITY nella migration).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { REAL_DISCOVERY_LEADS, type DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";

export interface CuratedFavoriteRecord {
  curatedLeadId: string;
  /** Risolto da REAL_DISCOVERY_LEADS — null se il lead non esiste più nel dataset code-based (dato mancante, gestito onestamente in UI, mai un crash). */
  lead: DiscoveryLeadRecord | null;
  /** Valorizzato solo dopo la promozione Curated → Partner (sezione 4 del task) — vedi lib/data/favorites.ts#getUnifiedFavoritesForParent per la logica di merge a resolution-time. */
  promotedToActivityId: string | null;
  createdAt: string;
}

function findLead(leadId: string): DiscoveryLeadRecord | null {
  return REAL_DISCOVERY_LEADS.find((l) => l.id === leadId) ?? null;
}

// Usata dalla card/popup Scoperta TRAMA per sapere se mostrare il cuore
// pieno o vuoto all'apertura — stesso pattern di getFavoriteActivityIds().
export async function getCuratedFavoriteLeadIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("curated_favorites")
    .select("curated_lead_id")
    .eq("parent_id", user.id);
  if (error || !data) return new Set();

  return new Set(data.map((r) => r.curated_lead_id as string));
}

// Lista completa per "I tuoi preferiti" — righe grezze + lead risolto dal
// dataset code-based. Il merge con i Preferiti Partner (unificazione lista,
// promotion resolution) avviene in lib/data/favorites.ts#getUnifiedFavoritesForParent,
// non qui: questa funzione resta un semplice accessor del dominio Curated,
// stesso principio "domini separati" già stabilito in
// lib/discovery/result-model.ts.
export async function getCuratedFavoritesForParent(): Promise<CuratedFavoriteRecord[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("curated_favorites")
    .select("curated_lead_id, promoted_to_activity_id, created_at")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => ({
    curatedLeadId: row.curated_lead_id as string,
    lead: findLead(row.curated_lead_id as string),
    promotedToActivityId: (row.promoted_to_activity_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}
