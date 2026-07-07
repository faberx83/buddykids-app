// Settimane prenotabili di un'attività — da Supabase (activity_weeks) se
// collegato e disponibili, altrimenti dai dati mock.

import { Activity, Week } from "@/lib/types";
import { weeksByActivity, defaultWeeks } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface RawWeekRow {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  spots_left: number | null;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(s)} – ${fmt(e)}`;
}

function mapRow(row: RawWeekRow): Week {
  const spots = row.spots_left ?? 0;
  return {
    id: row.id,
    label: row.label,
    dates: formatDateRange(row.start_date, row.end_date),
    spots,
    soldOut: spots <= 0,
  };
}

export async function getWeeksForActivity(activity: Activity): Promise<Week[]> {
  if (!isSupabaseConfigured || !activity.dbId) {
    return weeksByActivity[activity.id] ?? defaultWeeks;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_weeks")
    .select("id, label, start_date, end_date, spots_left")
    .eq("activity_id", activity.dbId)
    .order("start_date", { ascending: true });

  if (error || !data || data.length === 0) {
    return weeksByActivity[activity.id] ?? defaultWeeks;
  }

  return (data as RawWeekRow[]).map(mapRow);
}
