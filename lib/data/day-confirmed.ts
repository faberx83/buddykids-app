// Test browser 03/11/2026: posti già confermati per data (booking_days che
// hanno occupato un posto, capacity_decremented), per "Date e posti" del
// centro. Sola lettura, con le regole di accesso di sempre. Errore → {}.
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function getConfirmedSpotsByDate(activityDbId: string | null | undefined): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || !activityDbId) return {};
  try {
    const supabase = await createClient();
    const { data: dayRows } = await supabase.from("activity_days").select("id, date").eq("activity_id", activityDbId);
    const byId = new Map(((dayRows ?? []) as { id: string; date: string }[]).map((r) => [r.id, r.date]));
    if (byId.size === 0) return {};
    const { data: booked } = await supabase
      .from("booking_days")
      .select("activity_day_id")
      .in("activity_day_id", [...byId.keys()])
      .eq("capacity_decremented", true);
    const out: Record<string, number> = {};
    for (const r of (booked ?? []) as { activity_day_id: string }[]) {
      const date = byId.get(r.activity_day_id);
      if (date) out[date] = (out[date] ?? 0) + 1;
    }
    return out;
  } catch {
    return {};
  }
}
