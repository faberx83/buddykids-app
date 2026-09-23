// Preferiti (richiesta da Fabrizio per la v1): prima il cuore nella scheda
// attività era solo un useState locale (sempre "pieno" al reload, vedi
// FUNCTIONAL-TC-026) — ora salva davvero in una tabella dedicata
// (supabase/schema.sql#favorites).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getActivities } from "@/lib/data/activities";
import { Activity } from "@/lib/types";
import { getCuratedFavoritesForParent } from "@/lib/data/curated-favorites";
import { buildUnifiedFavorites, type UnifiedFavoriteItem } from "@/lib/discovery/unified-favorites";

// Usata dalla scheda attività per sapere se mostrare il cuore pieno o vuoto
// all'apertura — un Set di activity_id (dbId) per lookup rapido.
export async function getFavoriteActivityIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase.from("favorites").select("activity_id").eq("parent_id", user.id);
  if (error || !data) return new Set();

  return new Set(data.map((r) => r.activity_id as string));
}

// Lista completa per la pagina "Preferiti" — riusa getActivities() (stessa
// fonte di Cerca/Home) invece di una nuova query dedicata, poi filtra sui
// dbId salvati: evita di duplicare la logica di mappatura Activity.
export async function getFavoriteActivitiesForParent(): Promise<Activity[]> {
  const favoriteIds = await getFavoriteActivityIds();
  if (favoriteIds.size === 0) return [];

  const activities = await getActivities();
  return activities.filter((a) => a.dbId && favoriteIds.has(a.dbId));
}

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), §5 "PREFERITI VIEW".
// Preferiti UNIFICATI Partner + Curated in un'unica lista — vedi
// lib/discovery/unified-favorites.ts per il ragionamento completo
// (dedup/promotion resolution). Un'unica chiamata a getActivities() (già
// usata sopra) copre sia i preferiti Partner "normali" sia l'eventuale
// risoluzione di un curated_favorites promosso (§4): entrambi i casi
// filtrano/cercano nello stesso array, nessuna query duplicata.
export async function getUnifiedFavoritesForParent(): Promise<UnifiedFavoriteItem[]> {
  const [favoriteIds, curatedFavorites] = await Promise.all([
    getFavoriteActivityIds(),
    getCuratedFavoritesForParent(),
  ]);

  const needsActivities = favoriteIds.size > 0 || curatedFavorites.some((cf) => cf.promotedToActivityId);
  if (!needsActivities) return [];

  const activities = await getActivities();
  const partnerActivities = activities.filter((a) => a.dbId && favoriteIds.has(a.dbId));
  const promotedActivitiesById = new Map(
    activities.filter((a) => a.dbId).map((a) => [a.dbId as string, a])
  );

  return buildUnifiedFavorites(partnerActivities, curatedFavorites, promotedActivitiesById);
}
