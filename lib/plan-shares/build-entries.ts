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
// TRAMA BETA v1.1.1 — PIANO CONDIVISO: "chi fa cosa" (02/09/2026, richiesta
// di Fabrizio: centro/indirizzo/orari + chi accompagna/ritira per giorno,
// utili per chi riceve il link — nonni, tata). WEEKDAYS/Weekday/Moment/
// ResponsibleValue/WeekResponsibility sono lo stesso modulo client-safe già
// usato da PlannerCalendarView/week-roles (nessuna nuova nozione di
// "settimana"/"giorno feriale"); resolvePublicResponsibleLabel è la
// variante IN TERZA PERSONA di resolveResponsibleDisplay, pensata apposta
// per un lettore esterno senza login (vedi commento lì per il motivo).
import { WEEKDAYS, Weekday, WeekResponsibility, resolvePublicResponsibleLabel } from "@/lib/nextgen/responsibility-options";
// "import type": ParentRole è solo un tipo (da lib/data/profile.ts, che
// importa lib/supabase/server) — eliminato a compile-time, questo modulo
// resta senza alcun import server-only/rete, testabile in Node puro.
import type { ParentRole } from "@/lib/data/profile";

export interface SharedPlanResponsibilityCell {
  weekday: Weekday;
  andata: { label: string; emoji: string } | null;
  ritorno: { label: string; emoji: string } | null;
}

export interface SharedPlanEntry {
  kidName: string;
  activityName: string;
  weekStartDate: string;
  weekEndDate: string;
  status: string;
  // Campi aggiunti (02/09/2026) — tutti già presenti sulla riga activities
  // (vedi lib/data/activities.ts, stesse colonne "address"/"hours"/"days"),
  // nessuna nuova tabella. null quando l'attività non ha il dato compilato
  // (attività legacy) o quando l'entry arriva dal fallback RPC (vedi
  // plan-shares.ts, funzione SQL non estendibile senza migration).
  centerName: string | null;
  address: string | null;
  hours: string | null;
  days: string | null;
  // Solo i giorni feriali REALMENTE prenotati da questo bambino in questa
  // settimana per questa attività (mai i 5 giorni "a prescindere" — stessa
  // regola già vincolante per computeRolesToCover, vedi lib/nextgen/
  // week-roles.ts). andata/ritorno null = non ancora assegnato in "Chi fa
  // cosa?", mostrato come "da assegnare" lato UI, mai nascosto.
  responsibilities: SharedPlanResponsibilityCell[];
}

export interface RawEntryActivityRef {
  name: string;
  address: string | null;
  hours: string | null;
  days: string | null;
  // "address" qui sotto per il fallback (vedi buildSharedPlanEntriesFromRows,
  // fix "Naviga" mancante 03/09/2026).
  centers: { name: string; address: string | null } | { name: string; address: string | null }[] | null;
}

export interface RawEntryBookingRow {
  partner_decision: "pending" | "accepted" | "rejected" | "proposed" | null;
  activities: RawEntryActivityRef | RawEntryActivityRef[] | null;
  booking_weeks: { activity_weeks: { start_date: string; end_date: string } | { start_date: string; end_date: string }[] | null }[] | null;
  booking_days: { partner_decision: string | null; activity_days: { date: string } | { date: string }[] | null }[] | null;
  booking_kids: { kid_id: string; kids: { name: string } | { name: string }[] | null }[] | null;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// Stessa tecnica di addDaysIso duplicata altrove nel repo (piccola funzione
// pura) — converte l'offset in giorni di WEEKDAYS in una data ISO reale a
// partire dal lunedì della settimana stagionale.
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const JS_DAY_TO_WEEKDAY: Record<number, Weekday | null> = {
  0: null,
  1: "lun",
  2: "mar",
  3: "mer",
  4: "gio",
  5: "ven",
  6: null,
};

// Data ISO reale -> giorno feriale ("lun".."ven"), null per sabato/domenica
// (stessa mappa già usata privatamente in lib/data/responsibilities.ts —
// duplicata qui per restare un modulo puro senza import server-only).
function weekdayFromIso(dateIso: string): Weekday | null {
  const jsDay = new Date(dateIso + "T00:00:00Z").getUTCDay();
  return JS_DAY_TO_WEEKDAY[jsDay];
}

// Costruisce le celle "chi fa cosa" per un bambino in una settimana, SOLO
// per i giorni feriali passati in `bookedWeekdays` (mai tutti e 5 "a
// prescindere" — vedi commento su SharedPlanEntry.responsibilities).
function buildResponsibilityCells(
  kidId: string,
  weekStartDate: string,
  bookedWeekdays: Weekday[],
  responsibilities: WeekResponsibility[],
  ownerParentRole: ParentRole | null
): SharedPlanResponsibilityCell[] {
  const order = WEEKDAYS.map((w) => w.value);
  const uniqueWeekdays = Array.from(new Set(bookedWeekdays)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return uniqueWeekdays.map((weekday) => {
    const andataRow = responsibilities.find(
      (r) => r.kidId === kidId && r.weekStartDate === weekStartDate && r.weekday === weekday && r.moment === "andata"
    );
    const ritornoRow = responsibilities.find(
      (r) => r.kidId === kidId && r.weekStartDate === weekStartDate && r.weekday === weekday && r.moment === "ritorno"
    );
    return {
      weekday,
      andata: andataRow ? resolvePublicResponsibleLabel(andataRow, ownerParentRole) : null,
      ritorno: ritornoRow ? resolvePublicResponsibleLabel(ritornoRow, ownerParentRole) : null,
    };
  });
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
//
// TRAMA BETA v1.1.1 — PIANO CONDIVISO (02/09/2026): `responsibilities` e
// `ownerParentRole` sono parametri OPZIONALI, di proposito — il fallback via
// RPC (get_shared_plan, funzione SQL non estendibile senza migration, vedi
// plan-shares.ts) continua a chiamare questa funzione senza quei dati:
// centerName/address/hours/days restano null e responsibilities resta [],
// mai un errore o un comportamento diverso da prima per quel percorso.
export function buildSharedPlanEntriesFromRows(
  rows: RawEntryBookingRow[],
  scopeStart: string,
  scopeEnd: string,
  seasonYear: number,
  responsibilities: WeekResponsibility[] = [],
  ownerParentRole: ParentRole | null = null
): SharedPlanEntry[] {
  const entries: SharedPlanEntry[] = [];
  const weekRanges = getSeasonWeekRanges(seasonYear);

  for (const row of rows) {
    const activityRef = firstOf(row.activities);
    const activityName = activityRef?.name;
    if (!activityName) continue;
    const centerRef = firstOf(activityRef.centers);
    const centerName = centerRef?.name ?? null;
    // Fix "Naviga" mancante (segnalazione Fabrizio 03/09/2026, verificato su
    // dati reali: 2 attività su 9 hanno activities.address vuoto/non
    // compilato dal gestore, ma il centro a cui appartengono ha un
    // indirizzo reale — es. "Prova FP"/"Centro estivo prova candidatura").
    // Il gestore spesso compila l'indirizzo solo a livello di centro
    // (profilo), non per ogni singola attività: se activities.address è
    // vuoto usiamo centers.address come fallback, invece di nascondere
    // "Naviga" per un dato che in realtà esiste.
    const address = (activityRef.address || centerRef?.address) ?? null;
    const hours = activityRef.hours ?? null;
    const days = activityRef.days ?? null;
    const kidRefs = row.booking_kids ?? [];
    const bookingDecision = row.partner_decision ?? "pending";

    // Ramo settimana intera (booking_weeks) — stessa fonte dati già letta
    // dal Planner, invariata; stato ora da partner_decision (vedi sopra),
    // non più da bookings.status. "Chi fa cosa?" copre tutti i 5 giorni
    // feriali della settimana (prenotazione a settimana intera = il
    // bambino è coperto lun-ven per definizione).
    for (const bw of row.booking_weeks ?? []) {
      const week = firstOf(bw.activity_weeks);
      if (!week) continue;
      if (!overlaps(week.start_date, week.end_date, scopeStart, scopeEnd)) continue;
      for (const bk of kidRefs) {
        const kidName = firstOf(bk.kids)?.name;
        if (!kidName) continue;
        const bookedWeekdays = WEEKDAYS.map((wd) => addDaysIso(week.start_date, wd.dayOffset))
          .map(weekdayFromIso)
          .filter((w): w is Weekday => w !== null);
        entries.push({
          kidName,
          activityName,
          weekStartDate: week.start_date,
          weekEndDate: week.end_date,
          status: statusFromDecision(bookingDecision),
          centerName,
          address,
          hours,
          days,
          responsibilities: buildResponsibilityCells(
            bk.kid_id,
            week.start_date,
            bookedWeekdays,
            responsibilities,
            ownerParentRole
          ),
        });
      }
    }

    // Ramo "Giorni spot" (booking_days) — il bug vero e proprio: prima
    // assente per intero da questa pagina. Raggruppato per settimana
    // stagionale reale (stessa griglia lun-ven del Planner), stato per
    // gruppo: "confirmed" solo se OGNI giorno incluso è stato accettato dal
    // centro, altrimenti "pending" — i giorni "rejected" sono esclusi (non
    // fanno parte del piano reale, quindi nemmeno di "Chi fa cosa?").
    const dayGroups = new Map<
      string,
      { weekStart: string; weekEnd: string; kidId: string; kidName: string; decisions: string[]; weekdays: Weekday[] }
    >();
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
          kidId: bk.kid_id,
          kidName,
          decisions: [] as string[],
          weekdays: [] as Weekday[],
        };
        bucket.decisions.push(decision);
        const weekday = weekdayFromIso(day.date);
        if (weekday) bucket.weekdays.push(weekday);
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
        centerName,
        address,
        hours,
        days,
        responsibilities: buildResponsibilityCells(
          bucket.kidId,
          bucket.weekStart,
          bucket.weekdays,
          responsibilities,
          ownerParentRole
        ),
      });
    }
  }

  entries.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate) || a.kidName.localeCompare(b.kidName));
  return entries;
}
