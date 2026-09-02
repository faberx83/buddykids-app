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
// BUG CORRETTO 02/09/2026 (segnalazione Fabrizio) — vedi il commento sopra
// RawBookingRow.booking_days e lib/booking-response/effective-decision.ts
// per la ROOT CAUSE ANALYSIS completa.
import { effectiveDayBasedDecision } from "@/lib/booking-response/effective-decision";

// Copertura di UN bambino per una settimana — una famiglia con più bambini
// può avere iscrizioni diverse (campi diversi, o solo alcuni bambini
// iscritti) per la stessa settimana: senza questo dettaglio il Planner
// aggregato mostrava "coperta" anche quando in realtà lo era solo per uno
// dei figli, nascondendo silenziosamente l'altro campo/bambino.
export interface KidCoverage {
  kidId: string;
  activityName: string;
  activityTagColor?: PillColor;
  // Slug dell'attività (Activity.id) — serve alla CTA "Aggiungi [bambino]"
  // del Planner per costruire un link diretto a /booking/{slug}, senza
  // passare da Cerca (si conosce già l'attività: è quella prenotata per il
  // fratello/sorella che ha coperto questa settimana).
  activitySlug?: string;
  // TRAMA ONE Build Sprint 4 (DEC-42, Task #345) — risposta del Partner alla
  // prenotazione che copre questa settimana per questo bambino. "pending"
  // per ogni prenotazione mai gestita dal centro (comportamento AS-IS
  // invariato: prima di questo sprint "confirmed" non era mai raggiungibile,
  // quindi ogni settimana "coperta" era in realtà solo "richiesta").
  // "partial" (02/09/2026) — SOLO per Giorni spot: tutti i giorni decisi dal
  // centro ma esito misto. Trattato come "non accettata" ai fini di
  // awaitingPartnerConfirmation più sotto (coerente col principio "mai
  // dichiarare più di quanto i dati confermino": una copertura mista resta
  // da verificare per il genitore). Vedi lib/booking-response/effective-decision.ts.
  partnerDecision: "pending" | "accepted" | "rejected" | "proposed" | "partial";
  // Task #357 (Fabrizio: il click su una settimana coperta deve mostrare LA
  // MIA prenotazione, non la scheda marketing dell'attività) — id della
  // prenotazione reale che copre questa settimana per questo bambino, per
  // poter linkare a "Le mie prenotazioni" (?bookingId=) invece che a
  // /activity/{slug}. Deciso REUSE di quella pagina già esistente (vedi
  // FEATURE_PARITY_MATRIX.md/DECISION_LOG.md, DEC-06/DEC-42: il Planner resta
  // una proiezione in sola lettura, nessuno stato mutabile proprio).
  bookingId: string;
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
  activitySlug?: string; // vista aggregata: slug della PRIMA attività trovata (per "Aggiungi [bambino]")
  // Task #357: id della PRIMA prenotazione trovata per questa settimana —
  // usato dal Planner per linkare a "Le mie prenotazioni" (?bookingId=)
  // quando covered è true, invece della scheda marketing dell'attività.
  bookingId?: string;
  coveredKids: KidCoverage[]; // dettaglio per bambino — per capire se la copertura è parziale o per chi
  dismissed: boolean; // il genitore l'ha segnata "non mi serve" (ferie, nonni, ecc.)
  // TRAMA ONE Build Sprint 4 (DEC-42, Task #345): true se questa settimana è
  // "covered" ma NESSUNA delle prenotazioni che la coprono è stata ancora
  // accettata dal centro (tutte pending/proposed) — il Planner può così
  // distinguere una settimana davvero confermata da una solo richiesta.
  awaitingPartnerConfirmation: boolean;
  // BUG CORRETTO 06/08/2026 (segnalato da Fabrizio: prenotazione a giorni
  // singoli invisibile nel Planner) — true se questa settimana risulta
  // "covered" SOLO grazie a una o più prenotazioni a giorni (booking_days,
  // "Giorni spot") e non da nessuna prenotazione a settimana intera
  // (booking_weeks). Decisione di Fabrizio: una settimana coperta solo a
  // giorni conta come "parziale" in planner-insights.ts#computeWeekStatus
  // (stesso trattamento visivo di una copertura parziale tra fratelli), MAI
  // come "covered" piena — 2 giorni su 5 non sono la settimana organizzata.
  dayBookingOnly: boolean;
}

export interface PlannerData {
  weeks: SeasonWeek[];
  coveredCount: number;
  // BUGFIX (segnalato da Fabrizio: "5 di 4 settimane coperte" — un rapporto
  // superiore al 100%): coveredCount conta TUTTE le settimane coperte, anche
  // quelle marcate "non mi serve" (dismissed) — una settimana può avere una
  // prenotazione attiva E essere stata esclusa dal bisogno dichiarato (es.
  // prenotata, poi esclusa). Il rapporto "X di Y settimane coperte" deve
  // invece confrontare solo le settimane NECESSARIE (non dismissed): usa
  // coveredNeededCount (mai > neededCount, per costruzione) per quel testo,
  // non coveredCount.
  coveredNeededCount: number;
  totalCount: number;
  // index (1-based) della prima settimana scoperta E NON ANCORA TRASCORSA
  // (24/08/2026: prima non escludeva le settimane passate, vedi finalize()).
  firstUncoveredIndex: number | null;
}

interface RawActivityRef {
  slug: string;
  name: string;
  pills: { color: PillColor }[] | null;
}

interface RawBookingRow {
  id: string;
  status: string | null;
  partner_decision: "pending" | "accepted" | "rejected" | "proposed" | null;
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_weeks: { activity_weeks: { start_date: string; end_date: string } | { start_date: string; end_date: string }[] | null }[] | null;
  // BUG CORRETTO 06/08/2026: prenotazioni "Giorni spot" (booking_days, Sprint
  // 3) non venivano lette affatto da questa query — la settimana risultava
  // sempre scoperta anche con giorni realmente prenotati.
  //
  // BUG CORRETTO 02/09/2026 (segnalazione Fabrizio, Sett.14 "Prova FP"): il
  // campo partner_decision non era selezionato QUI (solo a livello di
  // bookings sopra) — vedi lib/booking-response/effective-decision.ts per il
  // motivo per cui serve leggerlo per-giorno invece del solo campo booking-level.
  booking_days: { partner_decision: string | null; activity_days: { date: string } | { date: string }[] | null }[] | null;
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
    awaitingPartnerConfirmation: false,
    dayBookingOnly: false,
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
  // Segnalazione 24/08/2026 (Fabrizio) — vedi finalize() sotto: serve per
  // escludere le settimane già trascorse da firstUncoveredIndex.
  const todayIso = new Date().toISOString().slice(0, 10);

  if (!isSupabaseConfigured) {
    return finalize(baseWeeks, todayIso);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return finalize(baseWeeks, todayIso);

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, partner_decision, activities ( slug, name, pills ), booking_weeks ( activity_weeks ( start_date, end_date ) ), booking_days ( partner_decision, activity_days ( date ) ), booking_kids ( kid_id )"
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
    const activitySlug = activity?.slug;
    const partnerDecision = row.partner_decision ?? "pending";
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
            seasonWeek.activitySlug = activitySlug;
            seasonWeek.bookingId = row.id;
          }
          for (const kidId of kidIds) {
            if (!seasonWeek.coveredKids.some((c) => c.kidId === kidId)) {
              seasonWeek.coveredKids.push({ kidId, activityName, activityTagColor, activitySlug, partnerDecision, bookingId: row.id });
            }
          }
        }
      }
    }
  }

  // Secondo giro, SOLO per booking_days ("Giorni spot"): fatto dopo (non
  // dentro) il giro sopra cosi possiamo controllare, per ogni settimana, se
  // è già "covered" da una vera booking_weeks prima di decidere se marcarla
  // dayBookingOnly — una prenotazione a settimana intera prevale sempre su
  // una a giorni per la stessa settimana/bambino.
  for (const row of rows) {
    const activity = firstOf(row.activities);
    const activityName = activity?.name;
    const activityTagColor = activity?.pills?.[0]?.color;
    const activitySlug = activity?.slug;
    // BUG CORRETTO 02/09/2026 (segnalazione Fabrizio, Sett.14 "Prova FP"):
    // qui, a differenza del giro sopra (booking_weeks, dove
    // row.partner_decision è la risposta autoritativa scritta da
    // respondToBookingAction), una prenotazione a giorni riceve le sue
    // decisioni giorno per giorno (applyDayDecision scrive SOLO su
    // booking_days.partner_decision, mai su bookings.partner_decision) — usare
    // row.partner_decision qui la mostrava "in attesa" per sempre anche a
    // conferma completata. Vedi lib/booking-response/effective-decision.ts.
    const partnerDecision = effectiveDayBasedDecision(
      (row.booking_days ?? []).map((bd) => bd.partner_decision),
      row.partner_decision ?? "pending"
    );
    const kidIds = (row.booking_kids ?? []).map((bk) => bk.kid_id);
    if (kidIds.length === 0 || !activityName) continue;

    for (const bd of row.booking_days ?? []) {
      const day = firstOf(bd.activity_days);
      if (!day) continue;
      for (const seasonWeek of baseWeeks) {
        if (day.date < seasonWeek.startDate || day.date > seasonWeek.endDate) continue;
        const alreadyFullWeek = seasonWeek.covered && !seasonWeek.dayBookingOnly;
        if (!alreadyFullWeek) {
          seasonWeek.covered = true;
          seasonWeek.dayBookingOnly = true;
          if (!seasonWeek.activityName) {
            seasonWeek.activityName = activityName;
            seasonWeek.activityTagColor = activityTagColor;
            seasonWeek.activitySlug = activitySlug;
            seasonWeek.bookingId = row.id;
          }
        }
        for (const kidId of kidIds) {
          if (!seasonWeek.coveredKids.some((c) => c.kidId === kidId)) {
            seasonWeek.coveredKids.push({ kidId, activityName, activityTagColor, activitySlug, partnerDecision, bookingId: row.id });
          }
        }
      }
    }
  }

  return finalize(baseWeeks, todayIso);
}

// Segnalazione 24/08/2026 (Fabrizio): Scopri (/nextgen/search) mostrava
// "priorità a chi è libero in GIU 1-5" con oggi già al 24/08 — settimane di
// giugno/luglio, ormai passate. Causa: il calcolo di firstUncoveredIndex NON
// escludeva le settimane già trascorse (a differenza di
// computePriorityWeekIndex in lib/nextgen/planner-insights.ts, già
// todayIso-aware e usato dal Planner stesso per il proprio badge "priorità"
// — ma app/nextgen/search/page.tsx legge invece questo campo
// firstUncoveredIndex, rimasto ingenuo). Estratta in funzione pura esportata
// (stessa logica isPast di planner-insights.ts, replicata qui invece che
// importata per evitare un import circolare: quel file importa già i tipi
// PlannerData/SeasonWeek da qui) cosi' è testabile senza mock di Supabase
// (vedi tests/one/planner-first-uncovered.spec.ts).
export function firstUncoveredWeekIndex(
  weeks: { index: number; covered: boolean; dismissed: boolean; endDate: string }[],
  todayIso: string
): number | null {
  // Le settimane "non mi serve" non contano come da riempire: non suggeriamo
  // attività per una settimana che il genitore ha volutamente escluso.
  const firstUncovered = weeks.find((w) => !w.covered && !w.dismissed && w.endDate >= todayIso);
  return firstUncovered?.index ?? null;
}

function finalize(weeks: SeasonWeek[], todayIso: string): PlannerData {
  // TRAMA ONE Build Sprint 4 (DEC-42, Task #345): una settimana "covered" ma
  // dove NESSUNA copertura è stata ancora "accepted" dal centro resta in
  // attesa di conferma — il Planner può segnalarlo senza doverla trattare
  // come scoperta (il genitore ha comunque fatto la richiesta).
  for (const w of weeks) {
    w.awaitingPartnerConfirmation =
      w.covered && w.coveredKids.length > 0 && w.coveredKids.every((k) => k.partnerDecision !== "accepted");
  }

  const coveredCount = weeks.filter((w) => w.covered).length;
  const coveredNeededCount = weeks.filter((w) => w.covered && !w.dismissed).length;
  return {
    weeks,
    coveredCount,
    coveredNeededCount,
    totalCount: weeks.length,
    firstUncoveredIndex: firstUncoveredWeekIndex(weeks, todayIso),
  };
}
