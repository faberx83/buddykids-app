// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "In
// Prenotazioni aggiungi ricerca per riferimento e filtri per centro,
// attività, data di partecipazione e stato … Ogni riga deve aprire un
// dettaglio con link interno stabile" e "Ogni contatore apre la coda già
// filtrata e il conteggio deve corrispondere alle righe risultanti, a parità
// di filtri". Iniziativa: claude/INIZIATIVA_admin_operativo.md.
//
// Logica PURA delle prenotazioni lato Admin: riferimento, stato effettivo,
// chi deve agire, anzianità, scadenza, filtri da URL. Il contatore di "Oggi"
// e l'elenco di /admin/bookings usano la STESSA funzione filterAdminBookings
// sulle STESSE righe (lib/data/admin-ops.ts): il numero sulla card è per
// costruzione il numero di righe che si vedono aprendola.
//
// Stato effettivo: stesso helper condiviso di Partner e Parent
// (lib/booking-response/effective-decision.ts). Prima l'Admin contava
// "in attesa" dal campo bookings.partner_decision, che per le prenotazioni a
// giorni resta "pending" anche dopo le risposte giorno per giorno (verificato
// il 12/11 in produzione: 11 "in attesa" sulla card, 4 davvero da decidere).

import { bookingNeedsAction, effectiveDayBasedDecision, type PartnerDecision } from "@/lib/booking-response/effective-decision";
import { isDemoRecord } from "@/lib/admin-ops/demo";
import { NO_TEST_ACCOUNTS, isTestAccount, type TestAccountIds } from "@/lib/admin-ops/test-accounts";

export type BookingStatus = "pending" | "confirmed" | "cancelled";
export type DayDecision = "pending" | "accepted" | "rejected" | "waitlisted";

export interface AdminBookingDay {
  activityDayId: string;
  date: string;
  decision: DayDecision;
  capacityDecremented: boolean;
  /** Posti presi da questa riga (migration 60); null = riga vecchia o colonna assente. */
  units: number | null;
  price: number;
}

export interface AdminBookingWeek {
  weekId: string;
  startDate: string;
  endDate: string;
  capacityDecremented: boolean;
  units: number | null;
}

export interface AdminBookingRow {
  id: string;
  status: BookingStatus;
  partnerDecisionRaw: PartnerDecision;
  createdAt: string;
  respondedAt: string | null;
  cancelledBy: "parent" | "center" | null;
  totalAmount: number;
  discountAmount: number;
  centerId: string | null;
  centerName: string;
  centerIsTestFixture: boolean;
  activityId: string | null;
  activitySlug: string;
  activityName: string;
  bookingMode: "week_only" | "day_only" | "mixed" | null;
  pricePerWeek: number | null;
  parentName: string;
  /** 17/11/2026: per riconoscere gli account di prova. */
  parentId?: string | null;
  parentEmail: string;
  kidNames: string[];
  days: AdminBookingDay[];
  weeks: AdminBookingWeek[];
}

export type Actor = "centro" | "famiglia" | "trama";

export const ACTOR_LABEL: Record<Actor, string> = {
  centro: "Tocca al centro",
  famiglia: "Tocca alla famiglia",
  trama: "Tocca a TRAMA",
};

/** Riferimento breve e stabile di una prenotazione: "#370F7E44" (primi 8 caratteri dell'id). */
export function bookingRef(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** "#370f7e44", "TR-370F7E44", "370F" → "370F7E44" o un prefisso; null se non sembra un riferimento. */
export function normalizeRefQuery(q: string): string | null {
  const t = q.trim().replace(/^#/, "").replace(/^tr-/i, "").replace(/-/g, "");
  return /^[0-9a-f]{4,32}$/i.test(t) ? t.toUpperCase() : null;
}

export function effectiveDecision(b: Pick<AdminBookingRow, "days" | "partnerDecisionRaw">): PartnerDecision {
  return b.days.length > 0 ? effectiveDayBasedDecision(b.days.map((d) => d.decision), b.partnerDecisionRaw) : b.partnerDecisionRaw;
}

export function needsCenterAction(b: Pick<AdminBookingRow, "status" | "days" | "partnerDecisionRaw">): boolean {
  return bookingNeedsAction({
    status: b.status,
    isDayBased: b.days.length > 0,
    partnerDecision: b.partnerDecisionRaw,
    days: b.days.map((d) => ({ partnerDecision: d.decision })),
  });
}

/** Date di partecipazione (giorni scelti, o ogni giorno feriale delle settimane). */
export function participationDates(b: Pick<AdminBookingRow, "days" | "weeks">): string[] {
  if (b.days.length > 0) return [...new Set(b.days.map((d) => d.date).filter(Boolean))].sort();
  const out: string[] = [];
  for (const w of b.weeks) {
    if (!w.startDate) continue;
    const end = w.endDate || w.startDate;
    const d = new Date(w.startDate + "T00:00:00Z");
    for (let i = 0; i < 14; i++) {
      const iso = d.toISOString().slice(0, 10);
      if (iso > end) break;
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(iso);
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return [...new Set(out)].sort();
}

/** Giorni interi tra due date ISO (yyyy-mm-dd). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso.slice(0, 10) + "T00:00:00Z") - Date.parse(fromIso.slice(0, 10) + "T00:00:00Z")) / 86400000);
}

export function romeTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Entro quanti giorni una data senza risposta è "imminente". */
export const IMMINENT_DAYS = 7;

export type BookingStateKey = "da_rispondere" | "confermata" | "parziale" | "proposta" | "rifiutata" | "annullata";

export const BOOKING_STATE_LABEL: Record<BookingStateKey, string> = {
  da_rispondere: "Da rispondere",
  confermata: "Confermata",
  parziale: "Confermata in parte",
  proposta: "Proposta alla famiglia",
  rifiutata: "Rifiutata",
  annullata: "Annullata",
};

export interface AdminBookingView {
  row: AdminBookingRow;
  ref: string;
  state: BookingStateKey;
  decision: PartnerDecision;
  isDemo: boolean;
  dates: string[];
  firstDate: string | null;
  /** Prima data di partecipazione da oggi in poi (null se tutte passate). */
  nextDate: string | null;
  /** Giorni dalla creazione della richiesta. */
  ageDays: number;
  /** Giorni da oggi alla prossima data (null se nessuna data futura). */
  dueInDays: number | null;
  imminent: boolean;
  actor: Actor | null;
  nextStep: string | null;
  /** Posti che questa prenotazione occupa adesso, sommati su tutti i giorni/settimane. */
  occupiedUnits: number;
  pendingDays: number;
}

export function bookingState(b: AdminBookingRow): BookingStateKey {
  if (b.status === "cancelled") return "annullata";
  if (needsCenterAction(b)) return "da_rispondere";
  const d = effectiveDecision(b);
  if (d === "proposed") return "proposta";
  if (d === "rejected") return "rifiutata";
  if (d === "partial") return "parziale";
  return "confermata";
}

export function viewAdminBooking(b: AdminBookingRow, todayIso: string, testAccounts: TestAccountIds = NO_TEST_ACCOUNTS): AdminBookingView {
  const dates = participationDates(b);
  const nextDate = dates.find((d) => d >= todayIso) ?? null;
  const state = bookingState(b);
  const pendingDays = b.days.filter((d) => d.decision === "pending" || d.decision === "waitlisted").length;
  const ageDays = Math.max(0, daysBetween(b.createdAt, todayIso));
  const dueInDays = nextDate ? daysBetween(todayIso, nextDate) : null;
  const imminent = state === "da_rispondere" && dueInDays !== null && dueInDays <= IMMINENT_DAYS;
  let actor: Actor | null = null;
  let nextStep: string | null = null;
  if (state === "da_rispondere") {
    actor = "centro";
    const what = b.days.length > 0 ? `${pendingDays} ${pendingDays === 1 ? "giorno" : "giorni"} da decidere` : "accettare o rifiutare";
    nextStep = ageDays >= 2 || imminent ? `Sollecitare il centro: ${what}` : `Il centro risponde: ${what}`;
  } else if (state === "proposta") {
    actor = "famiglia";
    nextStep = "La famiglia accetta o rifiuta la proposta del centro";
  }
  const occupiedUnits =
    b.status === "cancelled"
      ? 0
      : [...b.days, ...b.weeks].reduce((sum, r) => sum + (r.capacityDecremented ? Math.max(1, r.units ?? 1) : 0), 0);
  return {
    row: b,
    ref: bookingRef(b.id),
    state,
    decision: effectiveDecision(b),
    isDemo: isDemoRecord({
      centerName: b.centerName,
      centerIsTestFixture: b.centerIsTestFixture,
      activityName: b.activityName,
      accountIsTest: isTestAccount(b.parentId, testAccounts),
    }),
    dates,
    firstDate: dates[0] ?? null,
    nextDate,
    ageDays,
    dueInDays,
    imminent,
    actor,
    nextStep,
    occupiedUnits,
    pendingDays,
  };
}

// ── Filtri da URL ─────────────────────────────────────────────────────────

export interface BookingFilters {
  q: string;
  centro: string;
  attivita: string;
  /** Data di partecipazione yyyy-mm-dd. */
  data: string;
  stato: BookingStateKey | "tutte";
  /** true = solo le date senza risposta entro IMMINENT_DAYS. */
  imminenti: boolean;
  /** true = mostra anche i centri e le attività di prova. */
  demo: boolean;
  pagina: number;
}

export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  q: "",
  centro: "",
  attivita: "",
  data: "",
  stato: "tutte",
  imminenti: false,
  demo: false,
  pagina: 1,
};

type SearchParamsLike = Record<string, string | string[] | undefined> | URLSearchParams;

function pick(sp: SearchParamsLike, key: string): string {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? "";
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

const STATES = Object.keys(BOOKING_STATE_LABEL) as BookingStateKey[];

export function parseBookingFilters(sp: SearchParamsLike): BookingFilters {
  const stato = pick(sp, "stato");
  const data = pick(sp, "data");
  const pagina = Number.parseInt(pick(sp, "pagina"), 10);
  return {
    q: pick(sp, "q").slice(0, 80),
    centro: pick(sp, "centro"),
    attivita: pick(sp, "attivita"),
    data: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : "",
    stato: (STATES as string[]).includes(stato) ? (stato as BookingStateKey) : "tutte",
    imminenti: pick(sp, "imminenti") === "1",
    demo: pick(sp, "demo") === "1",
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Query string con i soli filtri diversi dal default ("" se nessuno). */
export function bookingFiltersQuery(f: Partial<BookingFilters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.centro) p.set("centro", f.centro);
  if (f.attivita) p.set("attivita", f.attivita);
  if (f.data) p.set("data", f.data);
  if (f.stato && f.stato !== "tutte") p.set("stato", f.stato);
  if (f.imminenti) p.set("imminenti", "1");
  if (f.demo) p.set("demo", "1");
  if (f.pagina && f.pagina > 1) p.set("pagina", String(f.pagina));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function bookingsHref(f: Partial<BookingFilters>): string {
  return `/admin/bookings${bookingFiltersQuery(f)}`;
}

function matchesQuery(v: AdminBookingView, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const ref = normalizeRefQuery(q);
  if (ref && v.row.id.replace(/-/g, "").toUpperCase().startsWith(ref)) return true;
  const hay = [v.row.parentName, v.row.parentEmail, v.row.activityName, v.row.centerName, ...v.row.kidNames].join(" ").toLowerCase();
  return hay.includes(t);
}

/** Filtro unico, usato sia dall'elenco sia dai contatori. */
export function filterAdminBookings(views: AdminBookingView[], f: BookingFilters): AdminBookingView[] {
  return views.filter(
    (v) =>
      (f.demo || !v.isDemo) &&
      (!f.centro || v.row.centerId === f.centro) &&
      (!f.attivita || v.row.activityId === f.attivita) &&
      (!f.data || v.dates.includes(f.data)) &&
      (f.stato === "tutte" || v.state === f.stato) &&
      (!f.imminenti || v.imminent) &&
      matchesQuery(v, f.q)
  );
}

/** Ordine: prima chi aspetta una risposta con la data più vicina, poi le più recenti. */
export function sortAdminBookings(views: AdminBookingView[]): AdminBookingView[] {
  return [...views].sort((a, b) => {
    const pa = a.state === "da_rispondere" ? 0 : 1;
    const pb = b.state === "da_rispondere" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (pa === 0) {
      const da = a.dueInDays ?? 9999;
      const db = b.dueInDays ?? 9999;
      if (da !== db) return da - db;
    }
    return a.row.createdAt < b.row.createdAt ? 1 : -1;
  });
}

export const BOOKINGS_PAGE_SIZE = 25;

export function paginate<T>(items: T[], page: number, size = BOOKINGS_PAGE_SIZE): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: items.slice((p - 1) * size, p * size), page: p, pages };
}
