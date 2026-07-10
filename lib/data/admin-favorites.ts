// KPI Admin: Preferiti come segnale di domanda (proposta a Fabrizio insieme
// al pannello SLA Richieste e all'analisi Presenze cross-centro). Le
// attività molto salvate ma poco/mai prenotate segnalano interesse alto e
// conversione bassa — utile per contattare il centro (prezzo? disponibilità?
// descrizione poco chiara?) o per pianificare promozioni mirate.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface ActivityDemandSignal {
  activityId: string;
  activitySlug: string;
  activityName: string;
  activityEmoji: string;
  centerName: string;
  favoritesCount: number;
  bookingsCount: number;
}

export async function getFavoritesDemandSignal(): Promise<ActivityDemandSignal[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();

  const { data: favs, error: favError } = await supabase.from("favorites").select("activity_id").limit(5000);
  // Tabella non ancora creata (migrazione non eseguita) o nessun preferito salvato.
  if (favError || !favs || favs.length === 0) return [];

  const favCountByActivity = new Map<string, number>();
  for (const row of favs as { activity_id: string }[]) {
    favCountByActivity.set(row.activity_id, (favCountByActivity.get(row.activity_id) ?? 0) + 1);
  }

  const activityIds = Array.from(favCountByActivity.keys());

  const { data: bookings } = await supabase
    .from("bookings")
    .select("activity_id")
    .neq("status", "cancelled")
    .in("activity_id", activityIds);

  const bookingCountByActivity = new Map<string, number>();
  for (const row of (bookings ?? []) as { activity_id: string }[]) {
    bookingCountByActivity.set(row.activity_id, (bookingCountByActivity.get(row.activity_id) ?? 0) + 1);
  }

  const { data: activityRows } = await supabase
    .from("activities")
    .select("id, slug, name, emoji, centers ( name )")
    .in("id", activityIds);

  interface RawActivityRow {
    id: string;
    slug: string | null;
    name: string;
    emoji: string | null;
    centers: { name: string } | { name: string }[] | null;
  }

  return ((activityRows ?? []) as RawActivityRow[])
    .map((a) => ({
      activityId: a.id,
      activitySlug: a.slug ?? a.id,
      activityName: a.name,
      activityEmoji: a.emoji || "🏫",
      centerName: firstOf(a.centers)?.name || "Centro",
      favoritesCount: favCountByActivity.get(a.id) ?? 0,
      bookingsCount: bookingCountByActivity.get(a.id) ?? 0,
    }))
    // Prima chi ha più preferiti rispetto alle prenotazioni (interesse alto,
    // conversione bassa) — a parità, semplicemente più preferiti.
    .sort((a, b) => {
      const gapA = a.favoritesCount - a.bookingsCount;
      const gapB = b.favoritesCount - b.bookingsCount;
      return gapB - gapA || b.favoritesCount - a.favoritesCount;
    })
    .slice(0, 20);
}
