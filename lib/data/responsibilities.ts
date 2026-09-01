// SPRINT 5.3 (NEXTGEN) — "Chi fa cosa?" (idea di Fabrizio): non un'ennesima
// lista di attività, ma la vista di CHI è responsabile del ritiro/
// accompagnamento per ciascun bambino in una settimana. Versione LEGGERA,
// esplicitamente richiesta da Fabrizio: un'etichetta libera (Io/Partner/
// Nonno/Nonna/Tata/Altro), SENZA il sistema multi-genitore vero (quello è la
// fase dedicata 5.5, più rischiosa). Chiave (kid_id, week_start_date) — la
// stessa convenzione di profiles.dismissed_weeks (SeasonWeek.startDate).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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
// l'ambito è ristretto a OGGI e incrocia con le prenotazioni reali di oggi
// (sia a settimana intera che "Giorni spot" a giorno singolo — vedi
// getKidsWithActivityToday sotto), eliminando il rischio di falsi positivi
// descritto in quel documento (mai "manca chi accompagna" per un giorno
// senza nessuna attività prevista).
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

interface RawTodayBookingRow {
  booking_kids: { kid_id: string; kids: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
  booking_weeks: { activity_weeks: { start_date: string; end_date: string } | { start_date: string; end_date: string }[] | null }[] | null;
  booking_days: { activity_days: { date: string } | { date: string }[] | null }[] | null;
}

function firstOfRaw<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// BUG TROVATO+CORRETTO (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026 —
// segnalazione di Fabrizio: "in home non vedo nulla nel coordination
// signal del chi fa cosa"): questa funzione riusava
// getTodayCheckinsForParent() (lib/data/checkin.ts), che guarda SOLO
// booking_weeks/activity_weeks — un'attività "Giorni spot" (Sprint 3,
// single_day_bookable, es. "Prova FP") prenotata a GIORNO SINGOLO non ha
// mai una riga in booking_weeks, quindi getTodayCheckinsForParent() non la
// vedeva mai, a nessuna data — stessa classe di bug già corretta oggi in
// getActivityAvailabilityByWeek (lib/data/activities.ts). Qui si evita la
// dipendenza da getTodayCheckinsForParent (che ha anche il vincolo NOT
// NULL di attendance_records.week_id, non applicabile a un'attività senza
// alcuna riga activity_weeks) e si interroga direttamente sia
// booking_weeks CHE booking_days.
async function getKidsWithActivityToday(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  todayIso: string
): Promise<{ kidId: string; kidName: string }[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "booking_kids ( kid_id, kids ( id, name ) ), booking_weeks ( activity_weeks ( start_date, end_date ) ), booking_days ( activity_days ( date ) )"
    )
    .eq("parent_id", userId)
    .neq("status", "cancelled");

  if (error || !data) return [];

  const byKid = new Map<string, string>();
  for (const booking of data as RawTodayBookingRow[]) {
    const hasWeekToday = (booking.booking_weeks ?? []).some((bw) => {
      const week = firstOfRaw(bw.activity_weeks);
      return week && todayIso >= week.start_date && todayIso <= week.end_date;
    });
    const hasDayToday = (booking.booking_days ?? []).some((bd) => {
      const day = firstOfRaw(bd.activity_days);
      return day && day.date === todayIso;
    });
    if (!hasWeekToday && !hasDayToday) continue;

    for (const bk of booking.booking_kids ?? []) {
      const kid = firstOfRaw(bk.kids);
      if (kid) byKid.set(kid.id, kid.name);
    }
  }

  return Array.from(byKid.entries()).map(([kidId, kidName]) => ({ kidId, kidName }));
}

// PLANNER BETA v1.1 (Wave 2, Dettaglio Settimana) — generalizzazione di
// getKidsWithActivityToday sopra da UNA data a un INSIEME di date (i 5
// giorni feriali lun-ven di una settimana stagionale): STESSA identica
// fonte di verità (booking_weeks/activity_weeks per le prenotazioni a
// settimana intera, booking_days/activity_days per "Giorni spot"), nessuna
// nuova interpretazione del calendario — richiesto esplicitamente dalla
// revisione ("verifica come il progetto determina oggi che uno specifico
// bambino sia coperto in uno specifico giorno, riusa quella stessa fonte,
// non creare una seconda interpretazione del calendario").
//
// Deduplica automatica per (kid, giorno): l'accumulo avviene in un Set per
// bambino, quindi due prenotazioni/attività diverse dello stesso bambino
// che ricadono sullo stesso giorno producono comunque UNA sola data in
// output — coerente con "CURRENT DOMAIN LIMITATION — ACTIVITY-LEVEL
// TRANSPORT NOT MODELED" (week_responsibilities è chiave per kid+weekday+
// moment, non per singola occorrenza di attività: non possiamo comunque
// distinguere due Andate diverse per lo stesso bambino nello stesso giorno,
// quindi non ha senso generarle).
export interface KidBookedDays {
  kidId: string;
  kidName: string;
  dates: string[]; // ISO, sottoinsieme ordinato di weekdayDates
}

export async function getKidsBookedDaysForWeek(weekdayDates: string[]): Promise<KidBookedDays[]> {
  if (!isSupabaseConfigured || weekdayDates.length === 0) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "booking_kids ( kid_id, kids ( id, name ) ), booking_weeks ( activity_weeks ( start_date, end_date ) ), booking_days ( activity_days ( date ) )"
    )
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  if (error || !data) return [];

  const byKid = new Map<string, { kidName: string; dates: Set<string> }>();
  for (const booking of data as RawTodayBookingRow[]) {
    const weekRanges = (booking.booking_weeks ?? [])
      .map((bw) => firstOfRaw(bw.activity_weeks))
      .filter((w): w is { start_date: string; end_date: string } => Boolean(w));
    const dayDates = new Set(
      (booking.booking_days ?? [])
        .map((bd) => firstOfRaw(bd.activity_days))
        .filter((d): d is { date: string } => Boolean(d))
        .map((d) => d.date)
    );
    const coveredDates = weekdayDates.filter(
      (iso) => dayDates.has(iso) || weekRanges.some((w) => iso >= w.start_date && iso <= w.end_date)
    );
    if (coveredDates.length === 0) continue;

    for (const bk of booking.booking_kids ?? []) {
      const kid = firstOfRaw(bk.kids);
      if (!kid) continue;
      const entry = byKid.get(kid.id) ?? { kidName: kid.name, dates: new Set<string>() };
      for (const d of coveredDates) entry.dates.add(d);
      byKid.set(kid.id, entry);
    }
  }

  return Array.from(byKid.entries()).map(([kidId, v]) => ({
    kidId,
    kidName: v.kidName,
    dates: Array.from(v.dates).sort(),
  }));
}

export async function getTodayResponsibilities(): Promise<TodayResponsibilityEntry[]> {
  if (!isSupabaseConfigured) return [];

  const todayWeekday = JS_DAY_TO_WEEKDAY[new Date().getDay()];
  if (!todayWeekday) return []; // weekend: nessuna colonna "Chi fa cosa?" da controllare

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const todayIso = isoDate(new Date());
  const kidsToday = await getKidsWithActivityToday(supabase, user.id, todayIso);
  if (kidsToday.length === 0) return [];

  const seasonYear = await getSeasonYear();
  const currentRange = getSeasonWeekRanges(seasonYear).find(
    (r) => todayIso >= isoDate(r.start) && todayIso <= isoDate(r.end)
  );
  if (!currentRange) return [];
  const weekStartDate = isoDate(currentRange.start);

  const kidIds = kidsToday.map((k) => k.kidId);
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

  const kidNameById = new Map(kidsToday.map((k) => [k.kidId, k.kidName]));
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
