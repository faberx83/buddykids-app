// Test browser 03/11/2026: posti già confermati per data (booking_days che
// hanno occupato un posto, capacity_decremented), per "Date e posti" del
// centro. Sola lettura, con le regole di accesso di sempre. Errore → {}.
// QA 04/11/2026 (EXTRA-02): conta i POSTI presi (capacity_units, uno per
// bambino; 1 per le righe vecchie o senza migration 60), non le righe.
import { createClient } from "@/lib/supabase/server";
import { confirmedByDate } from "@/lib/capacity/units";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function getConfirmedSpotsByDate(activityDbId: string | null | undefined): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || !activityDbId) return {};
  try {
    const supabase = await createClient();
    const { data: dayRows } = await supabase.from("activity_days").select("id, date").eq("activity_id", activityDbId);
    const byId = new Map(((dayRows ?? []) as { id: string; date: string }[]).map((r) => [r.id, r.date]));
    if (byId.size === 0) return {};
    type Row = { activity_day_id: string; capacity_decremented: boolean; capacity_units?: number | null };
    const ids = [...byId.keys()];
    const withUnits = await supabase
      .from("booking_days")
      .select("activity_day_id, capacity_decremented, capacity_units")
      .in("activity_day_id", ids)
      .eq("capacity_decremented", true);
    const booked: Row[] = withUnits.error
      ? (((
          await supabase
            .from("booking_days")
            .select("activity_day_id, capacity_decremented")
            .in("activity_day_id", ids)
            .eq("capacity_decremented", true)
        ).data ?? []) as Row[])
      : ((withUnits.data ?? []) as Row[]);
    return confirmedByDate(booked, byId);
  } catch {
    return {};
  }
}

