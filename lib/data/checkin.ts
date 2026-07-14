// Check-in MVP lato genitore — trova, per l'utente loggato, i bambini che
// hanno una prenotazione attiva OGGI (data odierna dentro l'intervallo
// start_date/end_date della settimana di camp) così la Home può mostrare
// "[Bambino] è arrivato/a a [Attività]?" (vedi components/CheckinPrompt.tsx).
//
// Nessuna geolocalizzazione/notifica push automatica: il genitore conferma
// manualmente aprendo l'app (scelta di scope concordata con Fabrizio — la
// geolocalizzazione in background e le push affidabili richiederebbero
// un'infrastruttura non ancora presente in questo stack, specialmente su
// iOS/Safari).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSeasonWeekRanges, overlaps } from "@/lib/season-weeks";
import { getSeasonYear } from "@/lib/data/season-year";

export type CheckinStatus = "presente" | "assente" | "in_ritardo";

export interface TodayCheckin {
  activityId: string;
  activityName: string;
  activitySlug: string;
  activityEmoji: string;
  activityImgGradient: string;
  coverImageUrl: string | null;
  weekId: string;
  weekLabel: string;
  kidId: string;
  kidName: string;
  date: string;
  status: CheckinStatus | null;
  checkedInByParent: boolean;
  // Timestamp della risposta del genitore (colonna attendance_records.checkin_at,
  // scritta solo da parentCheckinAction — vedi app/actions/checkin.ts). Resta
  // null finché il genitore non risponde, o se lo stato è stato scritto solo
  // dal gestore (checked_in_by "center") senza mai passare dal check-in.
  checkinAt: string | null;
}

// Segnalazione di Fabrizio ("dopo un tot va tolto il banner"): dopo la
// risposta il banner in Home non deve restare visibile per sempre (prima si
// riduceva solo a un chip compatto, ma restava lì tutto il giorno) — oltre
// questa soglia la card non viene più mostrata affatto. Chi non ha ancora
// risposto (checkinAt null) resta sempre visibile, indipendentemente dalla
// soglia.
export const CHECKIN_HIDE_AFTER_HOURS = 3;

// Pura (nessun I/O) per essere testabile senza Supabase: decide se una card
// di check-in va ancora mostrata in Home.
export function isCheckinStillVisible(
  item: Pick<TodayCheckin, "status" | "checkinAt">,
  now: Date = new Date()
): boolean {
  if (!item.status || !item.checkinAt) return true;
  const hoursSinceAnswer = (now.getTime() - new Date(item.checkinAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceAnswer < CHECKIN_HIDE_AFTER_HOURS;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface RawActivityRef {
  id: string;
  name: string;
  slug: string | null;
  emoji: string | null;
  img_gradient: string | null;
  cover_image_url: string | null;
}

interface RawWeekRef {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
}

interface RawBookingRow {
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_kids: { kid_id: string; kids: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
  booking_weeks: {
    activity_weeks: RawWeekRef | RawWeekRef[] | null;
  }[] | null;
}

export async function getTodayCheckinsForParent(): Promise<TodayCheckin[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date().toISOString().slice(0, 10);

  // BUG TROVATO+CORRETTO (segnalato da Fabrizio: la card di check-in
  // mostrava "Settimana 3" mentre il Registro presenze/Planner per la
  // STESSA settimana mostravano "Settimana 6"): qui si usava il testo
  // "label" salvato sulla riga activity_weeks, che il gestore può aver
  // scritto a mano quando ha creato le settimane della sua attività — non è
  // detto corrisponda al numero "canonico" calcolato da getSeasonWeekRanges
  // (la stessa griglia lun-ven usata da Planner/Prenotazione/Registro). Ora
  // ricalcoliamo l'indice dalla data reale, come fa lib/data/planner.ts, così
  // il numero di settimana è sempre coerente in tutta l'app.
  const seasonYear = await getSeasonYear();
  const seasonWeeks = getSeasonWeekRanges(seasonYear);

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "activities ( id, name, slug, emoji, img_gradient, cover_image_url ), booking_kids ( kid_id, kids ( id, name ) ), booking_weeks ( activity_weeks ( id, label, start_date, end_date ) )"
    )
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  if (error || !data) return [];

  const map = new Map<string, TodayCheckin>();
  for (const booking of data as RawBookingRow[]) {
    const activity = firstOf(booking.activities);
    if (!activity) continue;

    for (const bw of booking.booking_weeks ?? []) {
      const week = firstOf(bw.activity_weeks);
      if (!week) continue;
      if (today < week.start_date || today > week.end_date) continue; // non è oggi la settimana di camp

      const canonicalWeek = seasonWeeks.find((sw) =>
        overlaps(week.start_date, week.end_date, sw.start.toISOString().slice(0, 10), sw.end.toISOString().slice(0, 10))
      );
      // Solo "Settimana N" (senza intervallo date): il chiamante (Home)
      // premette già "Questa settimana · ", ripetere anche le date qui
      // sarebbe ridondante ("Questa settimana · Settimana 6 · LUG 6-10").
      const weekLabel = canonicalWeek ? `Settimana ${canonicalWeek.index}` : week.label;

      for (const bk of booking.booking_kids ?? []) {
        const kid = firstOf(bk.kids);
        if (!kid) continue;
        const key = `${kid.id}:${week.id}`;
        if (map.has(key)) continue;
        map.set(key, {
          activityId: activity.id,
          activityName: activity.name,
          activitySlug: activity.slug ?? activity.id,
          activityEmoji: activity.emoji || "🏫",
          activityImgGradient: activity.img_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
          coverImageUrl: activity.cover_image_url,
          weekId: week.id,
          weekLabel,
          kidId: kid.id,
          kidName: kid.name,
          date: today,
          status: null,
          checkedInByParent: false,
          checkinAt: null,
        });
      }
    }
  }

  const results = Array.from(map.values());
  if (results.length === 0) return [];

  const { data: existing } = await supabase
    .from("attendance_records")
    .select("kid_id, week_id, status, checked_in_by, checkin_at")
    .eq("date", today)
    .in(
      "kid_id",
      results.map((r) => r.kidId)
    );

  for (const rec of existing ?? []) {
    const match = results.find((r) => r.kidId === rec.kid_id && r.weekId === rec.week_id);
    if (match) {
      match.status = rec.status as CheckinStatus;
      match.checkedInByParent = rec.checked_in_by === "parent";
      match.checkinAt = (rec.checkin_at as string | null) ?? null;
    }
  }

  return results.filter((r) => isCheckinStillVisible(r));
}
