// Disponibilità giorno-per-giorno di un'attività (tabella activity_days) —
// usata dal Gestore centro per aprire/chiudere giorni e impostare sconti.

import { Activity, DayAvailability } from "@/lib/types";
import { activityDaysByActivity } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface RawDayRow {
  date: string;
  is_open: boolean;
  capacity: number;
  spots_left: number;
  single_day_bookable: boolean;
  discount_percent: number | null;
  last_minute: boolean;
  special_label: string | null;
  special_emoji: string | null;
}

function weekdayOf(dateStr: string): number {
  const jsDay = new Date(dateStr + "T00:00:00Z").getUTCDay(); // 0=dom … 6=sab
  return jsDay === 0 ? 6 : jsDay - 1; // 0=lun … 6=dom
}

function mapRow(row: RawDayRow): DayAvailability {
  return {
    date: row.date,
    weekday: weekdayOf(row.date),
    isOpen: row.is_open,
    capacity: row.capacity,
    spotsLeft: row.spots_left,
    singleDayBookable: row.single_day_bookable,
    discountPercent: row.discount_percent ?? undefined,
    lastMinute: row.last_minute,
    specialLabel: row.special_label ?? undefined,
    specialEmoji: row.special_emoji ?? undefined,
  };
}

export async function getActivityDays(activity: Activity): Promise<DayAvailability[]> {
  if (!isSupabaseConfigured || !activity.dbId) {
    return activityDaysByActivity[activity.id] ?? [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_days")
    .select(
      "date, is_open, capacity, spots_left, single_day_bookable, discount_percent, last_minute, special_label, special_emoji"
    )
    .eq("activity_id", activity.dbId)
    .order("date", { ascending: true });

  if (error || !data || data.length === 0) return activityDaysByActivity[activity.id] ?? [];
  return (data as RawDayRow[]).map(mapRow);
}
