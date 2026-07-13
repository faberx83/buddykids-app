// SPRINT 5.4 (NEXTGEN) — Planner, modalità Mappa: "tutte le attività su una
// mappa, con distanze e tempi di percorrenza dai tuoi indirizzi salvati"
// (PRD Family Planner). Le coordinate dei centri (activities.latitude/
// longitude) sono dati REALI, già usati da LEGACY Cerca/ActivityMap — non
// stubbati. Ciò che RESTA stubbato (per scelta esplicita di Fabrizio: "la
// configuriamo dopo, inserisci un dato stubbato - visibile") è la distanza/
// tempo di percorrenza dagli indirizzi di famiglia (lib/data/addresses.ts),
// perché quegli indirizzi sono testo libero SENZA coordinate (Sprint 5.3,
// nessuna geocodifica) — calcolarla per davvero richiede un'API di mappe a
// pagamento non ancora configurata. Vedi lib/nextgen/planner-map-estimate.ts
// per il valore stubbato e la sua etichetta "stimato" ben visibile in UI.
//
// Interrogazione ISOLATA e ADDITIVA (stesso approccio di lib/data/plan-
// shares.ts/addresses.ts): non riusa lib/data/my-bookings.ts perché qui
// servono campi diversi (indirizzo/coordinate del centro) che quel modulo,
// condiviso con LEGACY "Le mie prenotazioni", non espone — evitiamo di
// allargarne la query per non rischiare regressioni su codice già in uso.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface PlannerMapPin {
  activityDbId: string;
  activitySlug: string;
  activityName: string;
  emoji: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  kidNames: string[];
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawActivityRef {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface RawKidRef {
  name: string;
}

interface RawRow {
  status: string;
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_kids: { kids: RawKidRef | RawKidRef[] | null }[] | null;
}

// Un pin per attività prenotata (dedup — una famiglia può avere più
// prenotazioni/bambini sulla stessa attività, un solo pin sulla mappa con
// tutti i nomi dei bambini coinvolti).
export async function getPlannerMapPins(): Promise<PlannerMapPin[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "status, activities ( id, slug, name, emoji, address, latitude, longitude ), booking_kids ( kids ( name ) )"
    )
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  if (error || !data) return [];

  const byActivity = new Map<string, PlannerMapPin>();
  for (const row of data as RawRow[]) {
    const activity = firstOf(row.activities);
    if (!activity) continue;
    const kidNames = (row.booking_kids ?? [])
      .map((bk) => firstOf(bk.kids))
      .filter((k): k is RawKidRef => Boolean(k))
      .map((k) => k.name);

    const existing = byActivity.get(activity.id);
    if (existing) {
      for (const name of kidNames) {
        if (!existing.kidNames.includes(name)) existing.kidNames.push(name);
      }
      continue;
    }

    byActivity.set(activity.id, {
      activityDbId: activity.id,
      activitySlug: activity.slug,
      activityName: activity.name,
      emoji: activity.emoji || "🏫",
      address: activity.address,
      lat: activity.latitude,
      lng: activity.longitude,
      kidNames,
    });
  }

  return Array.from(byActivity.values());
}
