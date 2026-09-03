// Promemoria di partenza — persistenza reale (segnalazione Fabrizio
// 03/09/2026: "possiamo attivare i reminder ora che ci sono le
// notifiche?"). Vedi supabase/migration_36_travel_reminders.sql (NON ANCORA
// APPLICATA) per il contesto completo e lo scope ridotto per la beta
// (nessun calcolo reale del tempo di percorrenza — l'orario è impostato
// manualmente dal genitore).
//
// Finché la migration non è applicata: le query sotto ricevono un normale
// errore PostgREST ("relation does not exist"), gestito come gli altri
// helper "in attesa di migration" del progetto (es. lib/data/family-people.ts)
// — if (error) ricade sul default, mai un crash.

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AddressKind } from "@/lib/nextgen/address-kinds";

export interface TravelReminderSettings {
  active: boolean;
  targetTime: string; // "HH:MM", impostato manualmente dal genitore
  alarmMinutes: number;
  originKind: AddressKind | null;
}

export const DEFAULT_TRAVEL_REMINDER: TravelReminderSettings = {
  active: false,
  targetTime: "16:00",
  alarmMinutes: 30,
  originKind: null,
};

interface RawTravelReminderRow {
  active: boolean;
  target_time: string; // Postgres "time" torna come "HH:MM:SS"
  alarm_minutes: number;
  origin_kind: string | null;
}

function mapRow(row: RawTravelReminderRow): TravelReminderSettings {
  return {
    active: row.active,
    targetTime: row.target_time.slice(0, 5), // "HH:MM:SS" -> "HH:MM" per l'<input type="time">
    alarmMinutes: row.alarm_minutes,
    originKind: (row.origin_kind as AddressKind | null) ?? null,
  };
}

// Usata dalla pagina Promemoria (utente loggato) per precompilare i
// controlli con l'ultimo valore salvato — default se non ha mai salvato
// nulla (mai un errore visibile, coerente con "anteprima -> reale" senza
// rotture per chi non ha ancora un'impostazione).
export async function getTravelReminderForParent(): Promise<TravelReminderSettings> {
  if (!isSupabaseConfigured) return DEFAULT_TRAVEL_REMINDER;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_TRAVEL_REMINDER;

  const { data, error } = await supabase
    .from("travel_reminders")
    .select("active, target_time, alarm_minutes, origin_kind")
    .eq("parent_id", user.id)
    .maybeSingle();
  if (error || !data) return DEFAULT_TRAVEL_REMINDER;
  return mapRow(data as RawTravelReminderRow);
}

// ─────────────────────────────────────────────
// Lato cron (app/api/cron/travel-reminders/route.ts) — service role, perché
// deve leggere/scrivere righe di MOLTI genitori diversi, non solo le
// proprie (stesso principio già stabilito per lib/push/send.ts).
// ─────────────────────────────────────────────

export interface DueTravelReminder {
  id: string;
  parentId: string;
  targetTime: string; // "HH:MM"
  alarmMinutes: number;
  originKind: AddressKind | null;
  // null = mai inviato; altrimenti "YYYY-MM-DD" dell'ultimo invio riuscito
  // — la route confronta con la data di oggi per evitare doppi invii.
  lastSentDate: string | null;
}

interface RawActiveRow {
  id: string;
  parent_id: string;
  target_time: string;
  alarm_minutes: number;
  origin_kind: string | null;
  last_sent_date: string | null;
}

// Tutti i promemoria attivi (il filtro "è l'orario giusto?" resta nella
// route, che è anche l'unico posto con la nozione di "ora" — questa
// funzione è solo I/O, testabile separatamente dalla logica di trigger).
export async function getActiveTravelReminders(): Promise<DueTravelReminder[]> {
  const service = createServiceClient();
  if (!service) return [];
  const { data, error } = await service
    .from("travel_reminders")
    .select("id, parent_id, target_time, alarm_minutes, origin_kind, last_sent_date")
    .eq("active", true);
  if (error || !data) return [];
  return (data as RawActiveRow[]).map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    targetTime: r.target_time.slice(0, 5),
    alarmMinutes: r.alarm_minutes,
    originKind: (r.origin_kind as AddressKind | null) ?? null,
    lastSentDate: r.last_sent_date,
  }));
}

// "Ha un'attività prenotata (booking non cancellato) che copre la data di
// oggi?" — stesso perimetro di lib/data/checkin.ts::getTodayCheckinsForParent
// (booking_weeks E booking_days, non solo il primo), ma qui serve solo un
// booleano per MOLTI genitori via service role, non i dettagli per un
// singolo utente autenticato: query dedicata, più leggera, invece di
// riadattare quella funzione a un contesto batch/service-role che non è il
// suo (cambierebbe il suo modello di autenticazione per un caso d'uso
// diverso).
export async function parentHasActivityToday(
  service: ReturnType<typeof createServiceClient>,
  parentId: string,
  todayIso: string
): Promise<boolean> {
  if (!service) return false;
  const { data, error } = await service
    .from("bookings")
    .select(
      "booking_weeks ( activity_weeks ( start_date, end_date ) ), booking_days ( activity_days ( date ) )"
    )
    .eq("parent_id", parentId)
    .neq("status", "cancelled");
  if (error || !data) return false;

  interface Row {
    booking_weeks: { activity_weeks: { start_date: string; end_date: string } | { start_date: string; end_date: string }[] | null }[] | null;
    booking_days: { activity_days: { date: string } | { date: string }[] | null }[] | null;
  }
  const firstOf = <T,>(v: T | T[] | null | undefined): T | null => (!v ? null : Array.isArray(v) ? (v[0] ?? null) : v);

  for (const row of data as unknown as Row[]) {
    for (const bw of row.booking_weeks ?? []) {
      const week = firstOf(bw.activity_weeks);
      if (week && todayIso >= week.start_date && todayIso <= week.end_date) return true;
    }
    for (const bd of row.booking_days ?? []) {
      const day = firstOf(bd.activity_days);
      if (day && day.date === todayIso) return true;
    }
  }
  return false;
}

// Marca l'invio riuscito di oggi (evita doppi invii nella finestra utile,
// vedi commento sulla colonna in migration_36).
export async function markTravelReminderSent(
  service: ReturnType<typeof createServiceClient>,
  id: string,
  todayIso: string
): Promise<void> {
  if (!service) return;
  await service.from("travel_reminders").update({ last_sent_date: todayIso }).eq("id", id);
}
