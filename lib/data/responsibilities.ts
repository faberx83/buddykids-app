// SPRINT 5.3 (NEXTGEN) — "Chi fa cosa?" (idea di Fabrizio): non un'ennesima
// lista di attività, ma la vista di CHI è responsabile del ritiro/
// accompagnamento per ciascun bambino in una settimana. Versione LEGGERA,
// esplicitamente richiesta da Fabrizio: un'etichetta libera (Io/Partner/
// Nonno/Nonna/Tata/Altro), SENZA il sistema multi-genitore vero (quello è la
// fase dedicata 5.5, più rischiosa). Chiave (kid_id, week_start_date) — la
// stessa convenzione di profiles.dismissed_weeks (SeasonWeek.startDate).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getTodayCheckinsForParent } from "./checkin";
import { getSeasonWeekRanges, isoDate } from "@/lib/season-weeks";
import { getSeasonYear } from "./season-year";
// Tipi/costanti spostati in un modulo client-safe (niente import di
// lib/supabase/server): vedi commento in lib/nextgen/responsibility-options.ts.
// Ri-esportati qui per non rompere chi già importava da questo file lato server.
import {
  ResponsibleValue,
  RESPONSIBLE_OPTIONS,
  WeekResponsibility,
  Weekday,
  Moment,
} from "@/lib/nextgen/responsibility-options";
export type { ResponsibleValue, WeekResponsibility, Weekday, Moment };
export { RESPONSIBLE_OPTIONS };

interface RawResponsibilityRow {
  kid_id: string;
  week_start_date: string;
  weekday: string;
  moment: string;
  responsible: string;
  responsible_label: string | null;
}

// Tutte le assegnazioni della stagione per il genitore loggato — dataset
// piccolo (bambini x settimane coperte x 5 giorni x 2 momenti), nessun
// filtro per periodo: la UI (PlannerCalendarView) cerca localmente per
// (kidId, weekStartDate, weekday, moment).
export async function getResponsibilitiesForParent(): Promise<WeekResponsibility[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("week_responsibilities")
    .select("kid_id, week_start_date, weekday, moment, responsible, responsible_label")
    .eq("parent_id", user.id);

  if (error || !data) return [];

  return (data as RawResponsibilityRow[]).map((r) => ({
    kidId: r.kid_id,
    weekStartDate: r.week_start_date,
    weekday: r.weekday as Weekday,
    moment: r.moment as Moment,
    responsible: r.responsible as ResponsibleValue,
    responsibleLabel: r.responsible_label,
  }));
}

// FEATURE (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026 — richiesta
// esplicita di Fabrizio dopo la live QA): "chi fa cosa" come reminder
// giornaliero in Home + segnale di coordinamento quando manca chi
// accompagna/ritira. Il gap documentato in TRAMA_PILOT_NOTIFICATIONS_
// IMPLEMENTATION.md ("Accompagnamento/ritiro non assegnato") era per
// un'INTERA settimana, senza incrocio con le prenotazioni reali — qui
// l'ambito è ristretto a OGGI e riusa la STESSA fonte di verità già
// battle-tested di getTodayCheckinsForParent() (lib/data/checkin.ts) per
// sapere quali bambini hanno davvero un'attività oggi, eliminando il
// rischio di falsi positivi descritto in quel documento (mai "manca chi
// accompagna" per un giorno senza nessuna attività prevista).
export interface TodayResponsibilityEntry {
  kidId: string;
  kidName: string;
  moment: Moment;
  responsible: ResponsibleValue | null;
  responsibleLabel: string | null;
}

const JS_DAY_TO_WEEKDAY: Record<number, Weekday | null> = {
  0: null, // domenica — "Chi fa cosa?" copre solo lun-ven (vedi WEEKDAYS)
  1: "lun",
  2: "mar",
  3: "mer",
  4: "gio",
  5: "ven",
  6: null, // sabato
};

export async function getTodayResponsibilities(): Promise<TodayResponsibilityEntry[]> {
  if (!isSupabaseConfigured) return [];

  const todayWeekday = JS_DAY_TO_WEEKDAY[new Date().getDay()];
  if (!todayWeekday) return []; // weekend: nessuna colonna "Chi fa cosa?" da controllare

  // Stessa fonte di verità già usata dal check-in ("bambini con
  // un'attività attiva oggi") — zero nuova logica di incrocio
  // planner/bookings, zero rischio dei falsi positivi già documentati.
  const checkins = await getTodayCheckinsForParent();
  if (checkins.length === 0) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const seasonYear = await getSeasonYear();
  const todayIso = isoDate(new Date());
  const currentRange = getSeasonWeekRanges(seasonYear).find(
    (r) => todayIso >= isoDate(r.start) && todayIso <= isoDate(r.end)
  );
  if (!currentRange) return [];
  const weekStartDate = isoDate(currentRange.start);

  const kidIds = Array.from(new Set(checkins.map((c) => c.kidId)));
  const { data, error } = await supabase
    .from("week_responsibilities")
    .select("kid_id, moment, responsible, responsible_label")
    .eq("parent_id", user.id)
    .eq("week_start_date", weekStartDate)
    .eq("weekday", todayWeekday)
    .in("kid_id", kidIds);

  const assignedByKidMoment = new Map<string, { responsible: ResponsibleValue; responsibleLabel: string | null }>();
  if (!error && data) {
    for (const row of data as { kid_id: string; moment: string; responsible: string; responsible_label: string | null }[]) {
      assignedByKidMoment.set(`${row.kid_id}:${row.moment}`, {
        responsible: row.responsible as ResponsibleValue,
        responsibleLabel: row.responsible_label,
      });
    }
  }

  const kidNameById = new Map(checkins.map((c) => [c.kidId, c.kidName]));
  const result: TodayResponsibilityEntry[] = [];
  for (const kidId of kidIds) {
    for (const moment of ["andata", "ritorno"] as Moment[]) {
      const assigned = assignedByKidMoment.get(`${kidId}:${moment}`);
      result.push({
        kidId,
        kidName: kidNameById.get(kidId) ?? "",
        moment,
        responsible: assigned?.responsible ?? null,
        responsibleLabel: assigned?.responsibleLabel ?? null,
      });
    }
  }
  return result;
}
