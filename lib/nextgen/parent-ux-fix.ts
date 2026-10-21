// TRAMA — CORREZIONI DAL TEST UX PARENT (21/10/2026), release
// "correzioni-test-ux" (PARENT_UX_FIX_ENABLED). Logica pura, nessuna query:
// usata da Scopri, scheda attività, Home e Planner; testata in
// tests/one/parent-ux-fix.spec.ts. Iniziativa:
// claude/INIZIATIVA_parent_ux_fix_2110.md.
//
// Ciclo 1 (report UX-PARENT-001/003/004/006/007/012):
//  A. un risultato per un periodo deve essere davvero di quel periodo. Le
//     attività senza date note non spariscono, ma escono dal conteggio e
//     vanno in "Date da verificare"; quelle dichiaratamente estive non
//     compaiono per un ponte di dicembre. Le attività Partner mostrano la
//     prossima data vera (o "Edizione conclusa") calcolata dalle settimane e
//     dai giorni, non il testo libero "7 di 8" (activities.weeks_available).
//  B. la copertura scolastica dice per quanti figli c'è il calendario.

export const PARENT_UX_FIX_FLAG = "PARENT_UX_FIX_ENABLED";

export interface IsoRange {
  start: string;
  end: string;
}

const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MONTHS_LONG = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function parts(iso: string): { d: number; m: number; y: number } {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) };
}

/** "7 dic", "7–11 dic", "29 giu–3 lug". */
export function shortRangeIt(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (start === end) return `${a.d} ${MONTHS_SHORT[a.m]}`;
  if (a.m === b.m && a.y === b.y) return `${a.d}–${b.d} ${MONTHS_SHORT[b.m]}`;
  return `${a.d} ${MONTHS_SHORT[a.m]}–${b.d} ${MONTHS_SHORT[b.m]}`;
}

/** "28 agosto". */
export function longDateIt(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${MONTHS_LONG[p.m]}`;
}

// ─── A. Scoperte e periodi ────────────────────────────────────────────

/** Nessuna data nota: la fonte non dice quando si svolge. */
export function isUndated(item: { startDate: string | null; endDate: string | null }): boolean {
  return !item.startDate && !item.endDate;
}

/** Il periodo tocca giugno–settembre (l'estate dei centri estivi). */
export function isSummerRange(range: IsoRange): boolean {
  const months = new Set<number>();
  let y = parts(range.start).y;
  let m = parts(range.start).m;
  const end = parts(range.end);
  // al massimo 13 passi: basta per qualunque periodo di Scopri
  for (let i = 0; i < 13 && (y < end.y || (y === end.y && m <= end.m)); i += 1) {
    months.add(m);
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return [5, 6, 7, 8].some((x) => months.has(x));
}

const SUMMER_WORDS = /\b(estiv[aoie]|estate|summer|campus estivo|cre\b|grest)/i;

/** Il nome dice che è un'attività estiva ("Centri Ricreativi Diurni Estivi"). */
export function looksLikeSummerOnly(text: string): boolean {
  return SUMMER_WORDS.test(text);
}

export type PeriodFit = "match" | "to_verify" | "excluded";

/**
 * Come si colloca una Scoperta (TRAMA o community) rispetto al periodo scelto:
 *  - date note che toccano il periodo → "match" (entra nel conteggio);
 *  - date note fuori dal periodo → "excluded";
 *  - nessuna data: "to_verify" (sezione a parte, fuori dal conteggio), salvo
 *    quando il nome la dichiara estiva e il periodo non è estivo → "excluded".
 */
export function periodFit(
  item: { startDate: string | null; endDate: string | null; title: string },
  period: IsoRange
): PeriodFit {
  if (isUndated(item)) {
    if (!isSummerRange(period) && looksLikeSummerOnly(item.title)) return "excluded";
    return "to_verify";
  }
  const start = item.startDate ?? item.endDate!;
  const end = item.endDate ?? item.startDate!;
  return start <= period.end && period.start <= end ? "match" : "excluded";
}

// ─── A. Date vere delle attività Partner ──────────────────────────────

export interface ActivityDateRows {
  weeks: { start: string; end: string; spotsLeft: number }[];
  days: { date: string; isOpen: boolean; singleDayBookable: boolean; spotsLeft: number }[];
}

export type ActivityDateState = "open" | "full" | "ended" | "no_dates";

export interface ActivityDateSummary {
  state: ActivityDateState;
  /** Prima data futura con posti (solo "open"). */
  next: IsoRange | null;
  /** Le prossime date future, con i posti (max 4), per la scheda. */
  upcoming: { start: string; end: string; full: boolean }[];
  /** Ultimo giorno dell'edizione passata (solo "ended"). */
  lastEnd: string | null;
}

/**
 * Stato vero dell'attività dalle sue settimane e dai suoi giorni (passati
 * compresi), rispettando la modalità di prenotazione:
 *  - "open": c'è almeno una data futura con posti;
 *  - "full": ci sono date future ma senza posti;
 *  - "ended": tutte le date sono passate ("Edizione conclusa");
 *  - "no_dates": nessuna data pubblicata.
 */
export function summarizeActivityDates(
  rows: ActivityDateRows | undefined,
  todayIso: string,
  bookingMode?: "week_only" | "day_only" | "mixed"
): ActivityDateSummary {
  const weeks = bookingMode === "day_only" ? [] : (rows?.weeks ?? []);
  const days = bookingMode === "week_only" ? [] : (rows?.days ?? []).filter((d) => d.isOpen);
  const all: { start: string; end: string; full: boolean }[] = [
    ...weeks.map((w) => ({ start: w.start, end: w.end, full: w.spotsLeft <= 0 })),
    ...days.map((d) => ({ start: d.date, end: d.date, full: d.spotsLeft <= 0 || !d.singleDayBookable })),
  ].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  if (all.length === 0) return { state: "no_dates", next: null, upcoming: [], lastEnd: null };
  const future = all.filter((r) => r.end >= todayIso);
  if (future.length === 0) {
    const lastEnd = all.reduce((m, r) => (r.end > m ? r.end : m), all[0].end);
    return { state: "ended", next: null, upcoming: [], lastEnd };
  }
  const firstFree = future.find((r) => !r.full) ?? null;
  return {
    state: firstFree ? "open" : "full",
    next: firstFree ? { start: firstFree.start, end: firstFree.end } : null,
    upcoming: future.slice(0, 4),
    lastEnd: null,
  };
}

/** Riga breve per la card di Scopri. */
export function activityDateLine(s: ActivityDateSummary): { text: string; tone: "ok" | "warn" | "muted" } {
  if (s.state === "open" && s.next) return { text: `Prossima data: ${shortRangeIt(s.next.start, s.next.end)}`, tone: "ok" };
  if (s.state === "full") return { text: "Posti esauriti", tone: "warn" };
  if (s.state === "ended") return { text: s.lastEnd ? `Edizione conclusa il ${longDateIt(s.lastEnd)}` : "Edizione conclusa", tone: "muted" };
  return { text: "Date non ancora pubblicate", tone: "muted" };
}

/** Testo del pulsante quando non si può prenotare, con la causa vera. */
export function unavailableCtaLabel(s: ActivityDateSummary | null | undefined): string {
  if (!s) return "Non disponibile ora";
  if (s.state === "ended") return "Edizione conclusa";
  if (s.state === "full") return "Posti esauriti";
  if (s.state === "no_dates") return "Date non ancora aperte";
  return "Non disponibile ora";
}

/** In Scopri, senza un periodo scelto, le attività senza date future vanno in fondo (ordine stabile). */
export function dateStateRank(s: ActivityDateSummary | undefined): number {
  if (!s) return 1;
  return s.state === "open" ? 0 : s.state === "full" ? 1 : 2;
}

// ─── B. Calendario della scuola per figlio ────────────────────────────

export interface SchoolCoverage {
  total: number;
  configured: number;
  missing: { id: string; name: string }[];
}

export function schoolCoverage(kids: { id: string; name: string }[], configuredKidIds: Iterable<string>): SchoolCoverage {
  const set = new Set(configuredKidIds);
  const missing = kids.filter((k) => !set.has(k.id));
  return { total: kids.length, configured: kids.length - missing.length, missing };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/**
 * Nota sotto i riepiloghi delle chiusure. null quando non serve: nessun
 * figlio, oppure tutti hanno la scuola. Con 0 figli configurati il
 * riepilogo non c'è proprio, quindi la nota parla di "nessun figlio".
 */
export function schoolCoverageNote(c: SchoolCoverage): { text: string; ctaLabel: string; kidId: string } | null {
  if (c.total === 0 || c.missing.length === 0) return null;
  const names = joinNames(c.missing.map((k) => k.name));
  const text =
    c.configured === 0
      ? "Calendario della scuola non ancora impostato: le chiusure non sono contate."
      : `Calendario della scuola impostato per ${c.configured} ${c.configured === 1 ? "figlio" : "figli"} su ${c.total}. Le chiusure di ${names} non sono contate.`;
  const ctaLabel = c.missing.length === 1 ? `Imposta per ${c.missing[0].name}` : "Imposta la scuola";
  return { text, ctaLabel, kidId: c.missing[0].id };
}

/** Link alla scheda del figlio in "La tua famiglia", con la scuola già aperta. */
export function schoolSetupHref(kidId: string): string {
  return `/nextgen/profile/famiglia?scuola=${encodeURIComponent(kidId)}`;
}

// ─── Ciclo 2 — E. Form del figlio: tutti gli errori insieme ───────────

export type NewKidField = "name" | "birthDate" | "declaration";

/**
 * UX-PARENT-015: gli errori del form "Aggiungi figlio" si vedono tutti
 * insieme e accanto al campo, prima di qualunque chiamata al server.
 * Restituisce i campi da correggere nell'ordine del form (il primo riceve
 * il fuoco).
 */
export function validateNewKid(input: {
  name: string;
  birthDate: string;
  declarationRequired: boolean;
  declarationAccepted: boolean;
  todayIso: string;
}): { field: NewKidField; message: string }[] {
  const out: { field: NewKidField; message: string }[] = [];
  if (!input.name.trim()) out.push({ field: "name", message: "Scrivi il nome" });
  if (!input.birthDate) out.push({ field: "birthDate", message: "Indica la data di nascita" });
  else if (input.birthDate > input.todayIso) out.push({ field: "birthDate", message: "La data di nascita è nel futuro" });
  if (input.declarationRequired && !input.declarationAccepted) {
    out.push({ field: "declaration", message: "Conferma la dichiarazione per salvare" });
  }
  return out;
}

/** Riepilogo in una riga: "Mancano: nome e data di nascita." */
export function newKidErrorSummary(errors: { field: NewKidField }[]): string | null {
  if (errors.length === 0) return null;
  const label: Record<NewKidField, string> = { name: "nome", birthDate: "data di nascita", declaration: "conferma della dichiarazione" };
  const parts = errors.map((e) => label[e.field]);
  return `Da completare: ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`}.`;
}
