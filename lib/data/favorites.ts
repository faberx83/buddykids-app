// Preferiti (richiesta da Fabrizio per la v1): prima il cuore nella scheda
// attività era solo un useState locale (sempre "pieno" al reload, vedi
// FUNCTIONAL-TC-026) — ora salva davvero in una tabella dedicata
// (supabase/schema.sql#favorites).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getActivities } from "@/lib/data/activities";
import { Activity } from "@/lib/types";

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
