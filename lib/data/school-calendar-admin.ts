// TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026, §B11 "Admin minimo").
// Vista Admin di SOLA LETTURA sul dataset school_calendars/school_calendar_events
// — RLS "l'Admin gestisce il dataset" (is_platform_admin()) permette
// SELECT/INSERT/UPDATE/DELETE senza il filtro "status = 'published'" che si
// applica invece a un utente normale (vedi migration_26): un Admin vede
// anche le bozze (draft), coerente con "vedere calendari disponibili; anno
// scolastico; regione/comune; fonte; stato di validazione".

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface SchoolCalendarAdminEvent {
  id: string;
  startDate: string;
  endDate: string;
  eventType: string;
  label: string;
  sourceLevel: string | null;
  notes: string | null;
}

export interface SchoolCalendarAdminRow {
  id: string;
  country: string;
  region: string;
  schoolYear: string;
  validFrom: string;
  validTo: string;
  source: string | null;
  sourceUrl: string | null;
  status: "draft" | "published";
  version: number;
  events: SchoolCalendarAdminEvent[];
}

export async function getSchoolCalendarsForAdmin(): Promise<SchoolCalendarAdminRow[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data: calendarRows, error } = await supabase
    .from("school_calendars")
    .select("id, country, region, school_year, valid_from, valid_to, source, source_url, status, version")
    .order("region", { ascending: true })
    .order("school_year", { ascending: false });

  if (error || !calendarRows || calendarRows.length === 0) return [];

  const calendarIds = calendarRows.map((c) => c.id as string);
  const { data: eventRows } = await supabase
    .from("school_calendar_events")
    .select("id, calendar_id, start_date, end_date, event_type, label, source_level, notes")
    .in("calendar_id", calendarIds)
    .order("start_date", { ascending: true });

  const eventsByCalendar = new Map<string, SchoolCalendarAdminEvent[]>();
  for (const row of eventRows ?? []) {
    const list = eventsByCalendar.get(row.calendar_id as string) ?? [];
    list.push({
      id: row.id as string,
      startDate: row.start_date as string,
      endDate: row.end_date as string,
      eventType: row.event_type as string,
      label: row.label as string,
      sourceLevel: (row.source_level as string) ?? null,
      notes: (row.notes as string) ?? null,
    });
    eventsByCalendar.set(row.calendar_id as string, list);
  }

  return calendarRows.map((c) => ({
    id: c.id as string,
    country: c.country as string,
    region: c.region as string,
    schoolYear: c.school_year as string,
    validFrom: c.valid_from as string,
    validTo: c.valid_to as string,
    source: (c.source as string) ?? null,
    sourceUrl: (c.source_url as string) ?? null,
    status: c.status as "draft" | "published",
    version: c.version as number,
    events: eventsByCalendar.get(c.id as string) ?? [],
  }));
}
