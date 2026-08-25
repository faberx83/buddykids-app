// Disponibilità giorno-per-giorno di un'attività (tabella activity_days) —
// usata dal Gestore centro per aprire/chiudere giorni e impostare sconti.

import { Activity, DayAvailability } from "@/lib/types";
import { activityDaysByActivity } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface RawDayRow {
  id: string;
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
    id: row.id,
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
      "id, date, is_open, capacity, spots_left, single_day_bookable, discount_percent, last_minute, special_label, special_emoji"
    )
    .eq("activity_id", activity.dbId)
    .order("date", { ascending: true });

  if (error || !data || data.length === 0) return activityDaysByActivity[activity.id] ?? [];
  return (data as RawDayRow[]).map(mapRow);
}

// Segnalazione 25/08/2026 (Fabrizio): nella scheda "Giorni spot" i giorni
// già prenotati dal genitore per questa attività non si distinguono in
// alcun modo dai giorni ancora liberi — "sembra che non abbia prenotato".
// Stesso bisogno già coperto per le settimane intere da
// getBookedWeekIdsForActivity() (lib/data/weeks.ts) — analogo qui per i
// singoli giorni (booking_days). "Confermata" = semplicemente non
// cancellata (stessa convenzione di getBookedWeekIdsForActivity: non esiste
// ancora un vero step di pagamento/conferma separato).
export async function getBookedDayDatesForActivity(activityDbId: string): Promise<Set<string>> {
  const empty = new Set<string>();
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data, error } = await supabase
    .from("bookings")
    .select("booking_days ( activity_days ( date ) )")
    .eq("activity_id", activityDbId)
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  if (error || !data) return empty;

  const dates = new Set<string>();
  for (const row of data as { booking_days: { activity_days: { date: string } | { date: string }[] | null }[] | null }[]) {
    for (const bd of row.booking_days ?? []) {
      const ref = Array.isArray(bd.activity_days) ? bd.activity_days[0] : bd.activity_days;
      if (ref?.date) dates.add(ref.date);
    }
  }
  return dates;
}
