// Dati per la Home "Planner": calendario delle settimane dell'estate e quali
// sono già coperte da una prenotazione reale del genitore. La griglia delle 13
// settimane (metà giugno - metà settembre) è convenzionale, uguale per tutti:
// non esiste ancora un "calendario stagione" configurabile lato Admin, quindi
// oggi è calcolata qui. Lo stato "coperta/scoperta" invece è reale quando
// Supabase è collegato: viene dedotto dalle prenotazioni confermate/pending del
// genitore loggato (bookings -> booking_weeks -> activity_weeks). Senza
// Supabase, o per un utente senza prenotazioni, tutte le settimane risultano
// scoperte: non è un dato finto, è lo stato vero di un account nuovo.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSeasonWeekRanges, isoDate, formatShortRange, overlaps } from "@/lib/season-weeks";
import { getSeasonYear } from "@/lib/data/season-year";
import { PillColor } from "@/lib/types";

// Copertura di UN bambino per una settimana — una famiglia con più bambini
// può avere iscrizioni diverse (campi diversi, o solo alcuni bambini
// iscritti) per la stessa settimana: senza questo dettaglio il Planner
// aggregato mostrava "coperta" anche quando in realtà lo era solo per uno
// dei figli, nascondendo silenziosamente l'altro campo/bambino.
export interface KidCoverage {
  kidId: string;
  activityName: string;
  activityTagColor?: PillColor;
}

export interface SeasonWeek {
  index: number; // 1-based
  label: string; // "SETT 1"
  dateRange: string; // "9–13/6"
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  covered: boolean; // almeno un bambino ha una prenotazione questa settimana
  activityName?: string; // vista aggregata: nome della PRIMA attività trovata per questa settimana
  activityTagColor?: PillColor; // colore della prima categoria dell'attività, per la tinta della card in Home
  coveredKids: KidCoverage[]; // dettaglio per bambino — per capire se la copertura è parziale o per chi
  dismissed: boolean; // il genitore l'ha segnata "non mi serve" (ferie, nonni, ecc.)
}

export interface PlannerData {
  weeks: SeasonWeek[];
  coveredCount: number;
  totalCount: number;
  firstUncoveredIndex: number | null; // index (1-based) della prima settimana scoperta
}

interface RawBookingRow {
  status: string | null;
  activities: { name: string; pills: { color: PillColor }[] | null } | { name: string; pills: { color: PillColor }[] | null }[] | null;
  booking_weeks: { activity_weeks: { start_date: string; end_date: string } | { start_date: string; end_date: string }[] | null }[] | null;
  booking_kids: { kid_id: string }[] | null;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function buildBaseWeeks(year: number): SeasonWeek[] {
  const ranges = getSeasonWeekRanges(year);
  return ranges.map((r) => ({
    index: r.index,
    label: `SETT ${r.index}`,
    dateRange: formatShortRange(r.start, r.end),
    startDate: isoDate(r.start),
    endDate: isoDate(r.end),
    covered: false,
    coveredKids: [],
    dismissed: false,
  }));
}

// Nota: niente più parametro "kidId" per filtrare a un solo bambino — si
// calcola sempre la copertura per TUTTI i bambini in un colpo solo
// (SeasonWeek.coveredKids), cosi chi consuma questo dato (es. PlannerView)
// può passare dalla vista aggregata a quella di un singolo bambino senza
// un'altra richiesta al server.
export async function getPlannerData(): Promise<PlannerData> {
  // Stesso anno "di stagione" condiviso da tutta l'app (lib/data/season-year.ts):
  // dedotto dalle settimane reali configurate dai centri, non dalle
  // prenotazioni di QUESTO genitore (per chi non ha ancora prenotato nulla
  // sarebbero vuote) né dall'orologio di sistema. Prima il Planner derivava
  // l'anno solo dalle prenotazioni del genitore: per chi prenotava per la
  // prima volta da "Riempi", quella settimana veniva cercata nel selettore
  // con un anno diverso da quello dei dati reali dell'attività, non trovava
  // corrispondenza, e finiva per prenotare tutt'altra settimana.
  const seasonYear = await getSeasonYear();
  const baseWeeks = buildBaseWeeks(seasonYear);

  if (!isSupabaseConfigured) {
    return finalize(baseWeeks);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return finalize(baseWeeks);

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "status, activities ( name, pills ), booking_weeks ( activity_weeks ( start_date, end_date ) ), booking_kids ( kid_id )"
    )
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  const rows = !error && data ? (data as RawBookingRow[]) : [];

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("dismissed_weeks")
    .eq("id", user.id)
    .single();
  const dismissedDates: string[] = Array.isArray(profileRow?.dismissed_weeks)
    ? profileRow.dismissed_weeks
    : [];
  for (const w of baseWeeks) {
    if (dismissedDates.includes(w.startDate)) w.dismissed = true;
  }

  for (const row of rows) {
    const activity = firstOf(row.activities);
    const activityName = activity?.name;
    const activityTagColor = activity?.pills?.[0]?.color;
    const kidIds = (row.booking_kids ?? []).map((bk) => bk.kid_id);
    if (kidIds.length === 0 || !activityName) continue;

    for (const bw of row.booking_weeks ?? []) {
      const week = firstOf(bw.activity_weeks);
      if (!week) continue;
      for (const seasonWeek of baseWeeks) {
        if (overlaps(seasonWeek.startDate, seasonWeek.endDate, week.start_date, week.end_date)) {
          seasonWeek.covered = true;
          // Vista aggregata: mostra la PRIMA attività trovata per questa
          // settimana (comportamento storico, invariato per le famiglie con
          // un solo bambino). Il dettaglio completo per bambino resta
          // comunque in coveredKids, cosi chi ha più figli con campi diversi
          // la stessa settimana non perde l'informazione.
          if (!seasonWeek.activityName) {
            seasonWeek.activityName = activityName;
            seasonWeek.activityTagColor = activityTagColor;
          }
          for (const kidId of kidIds) {
            if (!seasonWeek.coveredKids.some((c) => c.kidId === kidId)) {
              seasonWeek.coveredKids.push({ kidId, activityName, activityTagColor });
            }
          }
        }
      }
    }
  }

  return finalize(baseWeeks);
}

function finalize(weeks: SeasonWeek[]): PlannerData {
  const coveredCount = weeks.filter((w) => w.covered).length;
  // Le settimane "non mi serve" non contano come da riempire: non suggeriamo
  // attività per una settimana che il genitore ha volutamente escluso.
  const firstUncovered = weeks.find((w) => !w.covered && !w.dismissed);
  return {
    weeks,
    coveredCount,
    totalCount: weeks.length,
    firstUncoveredIndex: firstUncovered?.index ?? null,
  };
}
