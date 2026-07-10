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
          weekLabel: week.label,
          kidId: kid.id,
          kidName: kid.name,
          date: today,
          status: null,
          checkedInByParent: false,
        });
      }
    }
  }

  const results = Array.from(map.values());
  if (results.length === 0) return [];

  const { data: existing } = await supabase
    .from("attendance_records")
    .select("kid_id, week_id, status, checked_in_by")
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
    }
  }

  return results;
}
