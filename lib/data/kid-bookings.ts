// Prenotazioni reali del genitore raggruppate per bambino — usate nella
// vista "Per bambino" della Home per mostrare "già prenotato" con
// l'attività e la settimana di riferimento, invece di mostrare solo
// suggerimenti come se il bambino non avesse mai un campo prenotato
// (bug segnalato: prenotato da "Riempi" ma la vista Per bambino non lo
// mostrava in nessun modo).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface KidBookingEntry {
  activityId: string; // slug dell'attività, per il link a /activity/[id]
  activityName: string;
  weeksLabel: string; // "Settimana 3 (8 lug–12 lug)", eventuali più settimane unite da virgola
}

interface RawRow {
  activities: { slug: string; name: string } | { slug: string; name: string }[] | null;
  booking_weeks:
    | {
        activity_weeks:
          | { label: string; start_date: string; end_date: string }
          | { label: string; start_date: string; end_date: string }[]
          | null;
      }[]
    | null;
  booking_kids: { kid_id: string }[] | null;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
}

export async function getBookingsByKid(): Promise<Map<string, KidBookingEntry[]>> {
  const empty = new Map<string, KidBookingEntry[]>();
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "activities ( slug, name ), booking_weeks ( activity_weeks ( label, start_date, end_date ) ), booking_kids ( kid_id )"
    )
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  if (error || !data) return empty;

  const result = new Map<string, KidBookingEntry[]>();

  for (const row of data as RawRow[]) {
    const activity = firstOf(row.activities);
    if (!activity) continue;

    const weekRows = (row.booking_weeks ?? [])
      .map((bw) => firstOf(bw.activity_weeks))
      .filter((w): w is { label: string; start_date: string; end_date: string } => Boolean(w))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    const weeksLabel =
      weekRows
        .map((w) => `${w.label} (${formatDateShort(w.start_date)}–${formatDateShort(w.end_date)})`)
        .join(", ") || "—";

    const entry: KidBookingEntry = {
      activityId: activity.slug,
      activityName: activity.name,
      weeksLabel,
    };

    for (const bk of row.booking_kids ?? []) {
      const list = result.get(bk.kid_id) ?? [];
      // Evita di mostrare due volte la stessa attività+settimane per lo
      // stesso bambino (es. prenotazioni doppie create durante i test, o un
      // bambino iscritto due volte alla stessa prenotazione) — per il
      // genitore l'informazione utile è "sei già iscritto qui", non quante
      // righe ci sono nel database.
      const alreadyPresent = list.some(
        (e) => e.activityId === entry.activityId && e.weeksLabel === entry.weeksLabel
      );
      if (!alreadyPresent) list.push(entry);
      result.set(bk.kid_id, list);
    }
  }

  return result;
}
