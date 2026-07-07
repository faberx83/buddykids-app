// Helper per registrare le modifiche dei Gestori centro nella tabella
// activity_log (usata dai KPI Admin in /admin/analytics). Best-effort: se il
// log fallisce (es. migrazione non ancora eseguita) non blocchiamo la
// scrittura principale, la ignoriamo silenziosamente.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface LogParams {
  actorId: string;
  centerId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export async function logGestoreAction(
  supabase: SupabaseClient,
  { actorId, centerId, action, entityType, entityId, meta }: LogParams
): Promise<void> {
  try {
    await supabase.from("activity_log").insert({
      actor_id: actorId,
      center_id: centerId,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      meta: meta ?? {},
    });
  } catch {
    // Tabella non ancora creata (migrazione_05 non eseguita) o altro errore
    // non bloccante: non deve mai far fallire l'azione principale.
  }
}
