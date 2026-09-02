// TRAMA BETA v1.1.1 — FINAL FUNCTIONAL + UI CONSISTENCY FIXES (punto 1,
// ROOT CAUSE ANALYSIS). Verificato via query Supabase read-only reale
// (parent_id 19fb4a74…, kid "Lino", attività "Prova FP", Settimana 14 =
// 31/08–04/09/2026): il booking reale è interamente a "Giorni spot"
// (booking_days, Sprint 3) — ZERO righe in booking_weeks. La vecchia
// get_shared_plan() (funzione SQL, supabase/schema.sql) leggeva ESCLUSIVAMENTE
// bookings→booking_weeks→activity_weeks: qualunque prenotazione a giorni
// (come questa) restava invisibile alla pagina condivisa pur essendo
// perfettamente visibile nel Planner (che invece legge SEMPRE entrambe le
// fonti, vedi lib/data/planner.ts) — stessa classe di bug già corretta lì il
// 06/08/2026, mai propagata a questa funzione. Causa NON date-range/
// timezone/ownership: quelle parti della query erano corrette, mancava
// l'intera fonte dati "booking_days".
//
// Trovato un SECONDO bug di correttezza nello stesso punto (Task #10 di
// questa sessione, "booking status incoerente", ora riemerso qui): la
// query condivisa usava bookings.status ("pending"|"confirmed"|"cancelled",
// che nei dati reali resta SEMPRE "confirmed" appena la richiesta è
// inviata, indipendentemente dalla decisione del centro) come stato da
// mostrare — quindi anche una prenotazione ancora "in attesa di conferma
// del centro" (bookings.partner_decision/booking_days.partner_decision
// "pending") sarebbe apparsa come "Confermata": esattamente il "fingere che
// sia già confermata" che il punto 2 vieta esplicitamente.
//
// FIX (vincolo punto 0: "NON modificare DB schema/migrations/RLS" — quindi
// NESSUNA modifica a supabase/schema.sql o nuova migration): la lettura
// dell'intero contenuto condiviso è stata spostata lato applicazione (vedi
// lib/data/plan-shares.ts), con lo stesso identico modello di sicurezza
// della funzione SQL che sostituisce (SECURITY DEFINER lì = client
// service_role in plan-shares.ts, mai esposto al browser). Questo file
// contiene SOLO la logica pura di trasformazione (nessuna chiamata
// Supabase/rete/"server-only"), estratta a parte apposta per essere
// testabile senza service_role/rete/browser (stesso principio già applicato
// a lib/booking-response/apply-day-decision.ts per lo stesso identico
// problema di testabilità — import "server-only" transitivo che rompe
// Playwright in modalità Node puro).
//
// Riusa la STESSA griglia di settimane stagionali (lib/season-weeks.ts) e lo
// stesso helper overlaps() già usati dal Planner — nessuna nuova nozione di
// "settimana", nessun cambio all'architettura del Planner/child-day/
// multi-child (questo modulo non tocca quelle tabelle, trasforma soltanto
// righe già caricate).
import { getSeasonWeekRanges, isoDate, overlaps } from "@/lib/season-weeks";

export interface SharedPlanEntry {
  kidName: string;
  activityName: string;
  weekStartDate: string;
  weekEndDate: string;
  status: string;
}

export interface RawEntryBookingRow {
  partner_decision: "pending" | "accepted" | "rejected" | "proposed" | null;
  activities: { name: string } | { name: string }[] | null;
  booking_weeks: { activity_weeks: { start_date: string; end_date: string } | { start_date: string; end_date: string }[] | null }[] | null;
  booking_days: { partner_decision: string | null; activity_days: { date: string } | { date: string }[] | null }[] | null;
  booking_kids: { kid_id: string; kids: { name: string } | { name: string }[] | null }[] | null;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// "accepted" (decisione del centro, per booking o per singolo giorno) è
// l'UNICA condizione che giustifica "Confermata" — qualunque altro valore
// (pending/proposed/null) resta "In attesa di conferma", MAI travestito da
// confermato (punto 2). "rejected" non produce nemmeno una entry (vedi sotto):
// un giorno rifiutato dal centro non fa parte del piano reale della famiglia.
export function statusFromDecision(decision: string | null | undefined): "confirmed" | "pending" {
  return decision === "accepted" ? "confirmed" : "pending";
}

// Funzione PURA (nessuna chiamata Supabase/rete): riceve le righe già
// caricate (stessa forma esatta della select in plan-shares.ts) + lo scope
// del link + l'anno di stagione, e produce le entry pubbliche.
export function buildSharedPlanEntriesFromRows(
  rows: RawEntryBookingRow[],
  scopeStart: string,
  scopeEnd: string,
  seasonYear: number
): SharedPlanEntry[] {
  const entries: SharedPlanEntry[] = [];
  const weekRanges = getSeasonWeekRanges(seasonYear);

  for (const row of rows) {
    const activityName = firstOf(row.activities)?.name;
    if (!activityName) continue;
    const kidRefs = row.booking_kids ?? [];
    const bookingDecision = row.partner_decision ?? "pending";

    // Ramo settimana intera (booking_weeks) — stessa fonte dati già letta
    // dal Planner, invariata; stato ora da partner_decision (vedi sopra),
    // non più da bookings.status.
    for (const bw of row.booking_weeks ?? []) {
      const week = firstOf(bw.activity_weeks);
      if (!week) continue;
      if (!overlaps(week.start_date, week.end_date, scopeStart, scopeEnd)) continue;
      for (const bk of kidRefs) {
        const kidName = firstOf(bk.kids)?.name;
        if (!kidName) continue;
        entries.push({
          kidName,
          activityName,
          weekStartDate: week.start_date,
          weekEndDate: week.end_date,
          status: statusFromDecision(bookingDecision),
        });
      }
    }

    // Ramo "Giorni spot" (booking_days) — il bug vero e proprio: prima
    // assente per intero da questa pagina. Raggruppato per settimana
    // stagionale reale (stessa griglia lun-ven del Planner), stato per
    // gruppo: "confirmed" solo se OGNI giorno incluso è stato accettato dal
    // centro, altrimenti "pending" — i giorni "rejected" sono esclusi (non
    // fanno parte del piano reale).
    const dayGroups = new Map<string, { weekStart: string; weekEnd: string; kidName: string; decisions: string[] }>();
    for (const bk of kidRefs) {
      const kidName = firstOf(bk.kids)?.name;
      if (!kidName) continue;
      for (const bd of row.booking_days ?? []) {
        const day = firstOf(bd.activity_days);
        if (!day) continue;
        if (day.date < scopeStart || day.date > scopeEnd) continue; // fuori range (punto 2)
        const decision = bd.partner_decision ?? "pending";
        if (decision === "rejected") continue;
        const range = weekRanges.find((r) => day.date >= isoDate(r.start) && day.date <= isoDate(r.end));
        if (!range) continue;
        const key = `${bk.kid_id}__${activityName}__${range.index}`;
        const bucket = dayGroups.get(key) ?? {
          weekStart: isoDate(range.start),
          weekEnd: isoDate(range.end),
          kidName,
          decisions: [] as string[],
        };
        bucket.decisions.push(decision);
        dayGroups.set(key, bucket);
      }
    }
    for (const bucket of dayGroups.values()) {
      const allAccepted = bucket.decisions.every((d) => d === "accepted");
      entries.push({
        kidName: bucket.kidName,
        activityName,
        weekStartDate: bucket.weekStart,
        weekEndDate: bucket.weekEnd,
        status: allAccepted ? "confirmed" : "pending",
      });
    }
  }

  entries.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate) || a.kidName.localeCompare(b.kidName));
  return entries;
}
