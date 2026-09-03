"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

// Promemoria di partenza — salvataggio reale (segnalazione Fabrizio
// 03/09/2026). Vedi supabase/migration_36_travel_reminders.sql (NON ANCORA
// APPLICATA) e lib/data/travel-reminders.ts per il contesto completo.
//
// Finché la migration non è applicata: l'upsert sotto fallisce con un
// errore Postgres esplicito ("relation does not exist"), restituito
// all'utente come { error } — mai un crash silenzioso, stesso pattern già
// stabilito per app/actions/checkin.ts (migration_35) e per le altre
// funzioni "in attesa di migration" di questa sessione.
export interface SaveTravelReminderInput {
  active: boolean;
  targetTime: string; // "HH:MM"
  alarmMinutes: 15 | 30 | 60;
  originKind: string | null;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveTravelReminderAction(input: SaveTravelReminderInput): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  if (!TIME_RE.test(input.targetTime)) return { error: "Orario non valido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  // Upsert su parent_id (unique, vedi migration_36) — un salvataggio per
  // genitore, coerente con la UI che ha sempre mostrato un solo blocco di
  // impostazioni. reset di last_sent_date NON incluso qui di proposito:
  // cambiare orario/allarme a metà giornata non deve far reinviare subito
  // un promemoria già mandato oggi per lo stesso giorno.
  const { error } = await supabase.from("travel_reminders").upsert(
    {
      parent_id: user.id,
      active: input.active,
      target_time: input.targetTime,
      alarm_minutes: input.alarmMinutes,
      origin_kind: input.originKind,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "parent_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/nextgen/planner/promemoria");
  return {};
}
