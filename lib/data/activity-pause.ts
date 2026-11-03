// Migration 59 (03/11/2026): attività con le nuove richieste sospese dal
// centro (activities.requests_paused_at). Sola lettura e tollerante: prima
// della migration la colonna non c'è e il risultato è vuoto (nessuna attività
// sospesa), senza errori per le famiglie né per il centro.
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** id attività → data della sospensione (ISO), solo per le sospese. Senza ids: tutte. */
export async function getRequestsPausedAt(activityDbIds?: string[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  if (activityDbIds && activityDbIds.filter(Boolean).length === 0) return {};
  try {
    const supabase = await createClient();
    let query = supabase.from("activities").select("id, requests_paused_at").not("requests_paused_at", "is", null);
    if (activityDbIds) query = query.in("id", activityDbIds.filter(Boolean));
    const { data, error } = await query;
    if (error || !data) return {};
    const out: Record<string, string> = {};
    for (const r of data as { id: string; requests_paused_at: string | null }[]) {
      if (r.requests_paused_at) out[r.id] = r.requests_paused_at;
    }
    return out;
  } catch {
    return {};
  }
}
