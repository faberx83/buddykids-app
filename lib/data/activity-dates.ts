// TRAMA — PORTALE CENTRI V2, ATTIVITÀ (28/10/2026). Per ogni attività del
// centro: quanti giorni aperti o settimane ha da oggi in poi e qual è il
// prossimo, per dire nell'elenco "prossimo giorno: …" oppure "mancano le
// date" (la stessa regola del controllo "Prima attività con le date"
// dell'attivazione, lib/data/center-activation.ts). Sola lettura.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface ActivityDateSummary {
  openDays: number;
  weeks: number;
  /** Prima data utile (giorno aperto o inizio settimana), "YYYY-MM-DD". */
  next: string | null;
  /** Ultima data utile. */
  last: string | null;
}

export const EMPTY_DATE_SUMMARY: ActivityDateSummary = { openDays: 0, weeks: 0, next: null, last: null };

export async function getActivityDateSummaries(activityDbIds: string[]): Promise<Record<string, ActivityDateSummary>> {
  const out: Record<string, ActivityDateSummary> = {};
  const ids = activityDbIds.filter(Boolean);
  if (!isSupabaseConfigured || ids.length === 0) return out;
  try {
    const supabase = await createClient();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    const [daysRes, weeksRes] = await Promise.all([
      supabase.from("activity_days").select("activity_id, date").in("activity_id", ids).eq("is_open", true).gte("date", today),
      supabase.from("activity_weeks").select("activity_id, start_date, end_date").in("activity_id", ids).gte("end_date", today),
    ]);
    const bump = (id: string, date: string, kind: "day" | "week") => {
      if (!out[id]) out[id] = { ...EMPTY_DATE_SUMMARY };
      const s = out[id];
      if (kind === "day") s.openDays += 1;
      else s.weeks += 1;
      if (!s.next || date < s.next) s.next = date;
      if (!s.last || date > s.last) s.last = date;
    };
    for (const r of (daysRes.data ?? []) as { activity_id: string; date: string }[]) bump(r.activity_id, r.date, "day");
    for (const r of (weeksRes.data ?? []) as { activity_id: string; start_date: string; end_date: string }[]) {
      bump(r.activity_id, r.start_date < today ? today : r.start_date, "week");
    }
  } catch {
    /* sola lettura, best-effort: senza dati l'elenco dice "mancano le date" */
  }
  return out;
}
