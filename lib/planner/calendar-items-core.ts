// TRAMA — Calendar Export V1 (11/09/2026). Logica PURA di mapping/filtro —
// estratta da lib/planner/calendar-items.ts per LO STESSO motivo già seguito
// in questo codebase per lib/checkin/action-token-core.ts rispetto ad
// action-token.ts (e per lib/feature-flags/evaluate.ts rispetto a
// resolve.ts): calendar-items.ts importa lib/supabase/server, che usa
// next/headers — un modulo che Playwright/ts-node non riesce a risolvere
// fuori dal bundler di Next.js, quindi non è importabile direttamente da un
// test unitario. Questo file non importa MAI Supabase/next: riceve righe
// grezze già lette altrove e produce PlannerCalendarItem[], testabile in
// isolamento.

export type PlannerCalendarItemSource = "TRAMA" | "EXTERNAL";

// Tipo GENERICO — non conosce bookings/activity_weeks/booking_days (§5 della
// spec di Fabrizio: "domain normalization → generic calendar items → ICS
// generator"). Un futuro source "EXTERNAL" (da external_planner_items, non
// ancora implementato) dovrà solo produrre oggetti in questa stessa forma.
export interface PlannerCalendarItem {
  // Stabile e univoco PER QUESTO export (usato per l'UID iCalendar).
  id: string;
  source: PlannerCalendarItemSource;
  title: string;
  kidNames: string[];
  // Intervallo INCLUSIVO (yyyy-mm-dd). Per un giorno singolo (Giorni Spot)
  // startDate === endDate.
  startDate: string;
  endDate: string;
  centerName: string | null;
  centerAddress: string | null;
  centerCity: string | null;
  // Nota opzionale, testo libero e breve — oggi sempre null (nessun campo
  // "hours" strutturato nel modello dati, vedi lib/ics.ts per la decisione
  // di non inventare orari, §4 della spec).
  note: string | null;
}

export function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface RawCenterRef {
  name: string | null;
  city: string | null;
  address: string | null;
}

export interface RawActivityRef {
  name: string;
  centers: RawCenterRef | RawCenterRef[] | null;
}

export interface RawWeekRef {
  id: string;
  start_date: string;
  end_date: string;
}

export interface RawDayRef {
  date: string;
}

export interface RawBookingRow {
  id: string;
  status: "pending" | "confirmed" | "cancelled";
  partner_decision: "pending" | "accepted" | "rejected" | "proposed" | null;
  activities: RawActivityRef | RawActivityRef[] | null;
  booking_weeks: { activity_weeks: RawWeekRef | RawWeekRef[] | null }[] | null;
  booking_days: { partner_decision: string | null; activity_days: RawDayRef | RawDayRef[] | null }[] | null;
  booking_kids: { kids: { name: string } | { name: string }[] | null }[] | null;
}

/**
 * Impegni TRAMA di un genitore, già filtrati a ciò che il dominio considera
 * REALMENTE confermato — mai una prenotazione/giorno ancora pending,
 * rifiutato, "proposed" (proposta del centro in attesa di risposta del
 * GENITORE, non una conferma — vedi lib/booking-response/effective-decision.ts)
 * o in lista d'attesa.
 *
 * GRANULARITÀ (§4 della spec, "non assumere a priori settimana=1 evento o
 * giorno=1 evento" — decisione documentata qui):
 * - Prenotazione a SETTIMANA INTERA (booking_weeks/activity_weeks): un
 *   evento PER SETTIMANA prenotata (non uno per l'intera prenotazione),
 *   perché una prenotazione può includere più settimane NON contigue —
 *   un solo evento "unito" rappresenterebbe come impegno anche le
 *   settimane di mezzo mai prenotate. bookings.partner_decision è l'UNICA
 *   risposta del centro per l'intera prenotazione (nessuna risposta
 *   per-settimana in questo modello dati): se non è "accepted", NESSUNA
 *   delle settimane della prenotazione è esportata.
 * - Prenotazione a GIORNI SINGOLI ("Giorni Spot", booking_days): un evento
 *   PER GIORNO, SOLO per i giorni con booking_days.partner_decision ===
 *   "accepted" — mai un evento unico che copra l'intervallo min..max dei
 *   giorni richiesti (rappresenterebbe come impegno anche i giorni non
 *   richiesti in mezzo, e quelli rifiutati/pending/in lista d'attesa).
 * - Il campo status di riga (bookings.status) NON è filtrato qui (il
 *   caller, calendar-items.ts, esclude già "cancelled" nella query) — resta
 *   comunque innocuo: una prenotazione cancellata ha in pratica sempre
 *   partner_decision non "accepted"/giorni non "accepted" nei dati reali.
 */
export function mapBookingRowsToPlannerCalendarItems(rows: RawBookingRow[]): PlannerCalendarItem[] {
  const items: PlannerCalendarItem[] = [];

  for (const row of rows) {
    const activity = firstOf(row.activities);
    const center = firstOf(activity?.centers ?? null);
    const kidNames = (row.booking_kids ?? [])
      .map((bk) => firstOf(bk.kids))
      .filter((k): k is { name: string } => Boolean(k))
      .map((k) => k.name);
    const title = activity?.name ?? "Attività TRAMA";
    const centerName = center?.name ?? null;
    const centerAddress = center?.address ?? null;
    const centerCity = center?.city ?? null;

    const weekRows = (row.booking_weeks ?? [])
      .map((bw) => firstOf(bw.activity_weeks))
      .filter((w): w is RawWeekRef => Boolean(w));
    const dayRows = (row.booking_days ?? [])
      .map((bd) => ({
        decision: bd.partner_decision,
        day: firstOf(bd.activity_days),
      }))
      .filter((d): d is { decision: string | null; day: RawDayRef } => Boolean(d.day));

    const isDayBased = weekRows.length === 0 && dayRows.length > 0;

    if (isDayBased) {
      for (const { decision, day } of dayRows) {
        if (decision !== "accepted") continue;
        items.push({
          id: `${row.id}:${day.date}`,
          source: "TRAMA",
          title,
          kidNames,
          startDate: day.date,
          endDate: day.date,
          centerName,
          centerAddress,
          centerCity,
          note: null,
        });
      }
    } else if (row.partner_decision === "accepted") {
      for (const w of weekRows) {
        items.push({
          id: `${row.id}:${w.id}`,
          source: "TRAMA",
          title,
          kidNames,
          startDate: w.start_date,
          endDate: w.end_date,
          centerName,
          centerAddress,
          centerCity,
          note: null,
        });
      }
    }
  }

  return items.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
