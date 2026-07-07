// Calendario del genitore loggato — eventi e iscrizioni ai centri, da Supabase
// (tabelle bookings/booking_weeks/booking_kids) quando collegato. In modalità
// demo replica esattamente il comportamento precedente basato su bookingsMock.

import { CalendarEvent } from "@/lib/types";
import {
  activities as mockActivities,
  bookingsMock,
  calendarEvents as mockEvents,
} from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function dayOf(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDate();
}

function monthShortOf(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z")
    .toLocaleDateString("it-IT", { month: "short", timeZone: "UTC" })
    .replace(".", "");
}

interface RawActivityRef {
  slug: string | null;
  name: string;
  emoji: string | null;
  img_gradient: string | null;
  centers: { name: string } | { name: string }[] | null;
}

interface RawWeekRef {
  label: string;
  start_date: string;
}

interface RawKidRef {
  name: string;
}

interface RawBookingRow {
  id: string;
  status: string;
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_weeks: { activity_weeks: RawWeekRef | RawWeekRef[] | null }[] | null;
  booking_kids: { kids: RawKidRef | RawKidRef[] | null }[] | null;
}

const BOOKINGS_SELECT = `
  id, status,
  activities ( slug, name, emoji, img_gradient, centers ( name ) ),
  booking_weeks ( activity_weeks ( label, start_date ) ),
  booking_kids ( kids ( name ) )
`;

export async function getUpcomingEventsForUser(): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured) return mockEvents;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKINGS_SELECT)
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  if (error || !data) return [];

  const drafts: { date: Date; event: CalendarEvent }[] = [];

  for (const row of data as unknown as RawBookingRow[]) {
    const activity = firstOf(row.activities);
    if (!activity) continue;

    const kidNames = (row.booking_kids ?? [])
      .map((bk) => firstOf(bk.kids)?.name)
      .filter((n): n is string => Boolean(n))
      .join(", ");

    const weeks = (row.booking_weeks ?? [])
      .map((bw) => firstOf(bw.activity_weeks))
      .filter((w): w is RawWeekRef => Boolean(w));

    for (const week of weeks) {
      drafts.push({
        date: new Date(week.start_date + "T00:00:00Z"),
        event: {
          id: `${row.id}-${week.start_date}`,
          day: dayOf(week.start_date),
          month: monthShortOf(week.start_date),
          name: `Inizio ${activity.name}`,
          meta: week.label,
          meta2: kidNames || undefined,
          pillLabel: "Camp",
          pillColor: "aqua",
          blockColor: activity.img_gradient || "#E3F9F5",
          textColor: "#3ECFB2",
        },
      });
    }
  }

  drafts.sort((a, b) => a.date.getTime() - b.date.getTime());
  return drafts.map((d) => d.event);
}

export interface CenterEnrollment {
  bookingId: string;
  activitySlug: string;
  activityName: string;
  activityEmoji: string;
  activityGradient: string;
  centerName: string;
  kidNames: string;
}

export async function getCenterEnrollmentsForUser(): Promise<CenterEnrollment[]> {
  if (!isSupabaseConfigured) {
    // Stesso comportamento di prima: prenotazioni demo di "Sofia Ferretti".
    return bookingsMock
      .filter((b) => b.parentName === "Sofia Ferretti" && b.status !== "cancelled")
      .map((b) => {
        const activity = mockActivities.find((a) => a.id === b.activityId);
        if (!activity) return null;
        return {
          bookingId: b.id,
          activitySlug: activity.id,
          activityName: activity.name,
          activityEmoji: activity.emoji,
          activityGradient: activity.imgGradient,
          centerName: activity.center,
          kidNames: b.kidName,
        };
      })
      .filter((e): e is CenterEnrollment => Boolean(e));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKINGS_SELECT)
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  if (error || !data) return [];

  return (data as unknown as RawBookingRow[])
    .map((row) => {
      const activity = firstOf(row.activities);
      if (!activity || !activity.slug) return null;
      const center = firstOf(activity.centers);
      const kidNames = (row.booking_kids ?? [])
        .map((bk) => firstOf(bk.kids)?.name)
        .filter((n): n is string => Boolean(n))
        .join(", ");
      return {
        bookingId: row.id,
        activitySlug: activity.slug,
        activityName: activity.name,
        activityEmoji: activity.emoji || "⭐",
        activityGradient: activity.img_gradient || "linear-gradient(135deg,#E8F6FD,#E3F9F5)",
        centerName: center?.name || "",
        kidNames: kidNames || "—",
      };
    })
    .filter((e): e is CenterEnrollment => Boolean(e));
}
