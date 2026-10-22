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

// ─── Ciclo 4 — K. Ricerca per disciplina, non solo per nome ───────────

/** Parole che indicano la stessa disciplina (italiano e inglese dei nomi dei centri). */
const SEARCH_SYNONYMS: string[][] = [
  ["calcio", "calcetto", "soccer", "football", "futsal"],
  ["nuoto", "piscina", "swim", "swimming", "acquatic", "acquatico", "acquatica"],
  ["danza", "dance", "ballo", "balletto", "hip hop", "hiphop"],
  ["ginnastica", "gymnastics", "ritmica", "artistica"],
  ["basket", "pallacanestro", "basketball", "minibasket"],
  ["pallavolo", "volley", "volleyball", "minivolley"],
  ["tennis", "padel"],
  ["inglese", "english", "lingue", "language"],
  ["musica", "music", "coro", "chitarra", "pianoforte", "piano"],
  ["arte", "art", "pittura", "disegno"],
  ["teatro", "theatre", "theater", "recitazione"],
  ["robotica", "coding", "stem", "programmazione", "informatica", "tecnologia", "scienza", "science"],
  ["cucina", "cooking", "chef"],
  ["scacchi", "chess"],
  ["natura", "outdoor", "avventura", "nature"],
  ["arti marziali", "judo", "karate", "taekwondo"],
];

/** Minuscole e senza accenti: "Città" e "citta" si trovano a vicenda. */
export function normalizeSearch(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

function variantsOf(token: string): string[] {
  for (const group of SEARCH_SYNONYMS) {
    if (group.some((w) => normalizeSearch(w) === token)) return group.map(normalizeSearch);
  }
  return [token];
}

/**
 * UX-PARENT-011: "calcio" deve trovare "Soccer Academy". Ogni parola della
 * ricerca (o un suo sinonimo) deve comparire in almeno uno dei campi
 * (nome, centro, descrizione, etichette). Ricerca vuota = tutto passa.
 */
export function matchesSearch(fields: (string | null | undefined)[], query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = normalizeSearch(fields.filter(Boolean).join(" • "));
  // prima la frase intera (es. "arti marziali"), poi parola per parola
  if (variantsOf(q).some((v) => haystack.includes(v))) return true;
  return q.split(" ").every((token) => variantsOf(token).some((v) => haystack.includes(v)));
}

// ─── Ciclo 4 — L. Centri di prova fuori dal catalogo famiglie ─────────

/**
 * UX-PARENT-002: toglie dal catalogo delle famiglie le attività dei centri
 * segnati come prova (centers.is_test_fixture). L'Admin piattaforma li vede
 * sempre (prove e test automatici). Nessun centro segnato = lista invariata.
 */
export function withoutTestFixtures<T extends { centerDbId?: string }>(
  activities: T[],
  testCenterIds: ReadonlySet<string>,
  role: string | null
): T[] {
  if (role === "platform_admin" || testCenterIds.size === 0) return activities;
  return activities.filter((a) => !(a.centerDbId && testCenterIds.has(a.centerDbId)));
}

// ─── Ritest 22/10 — una sola "Scuola" per figlio ──────────────────────

const REGION_ALIASES: Record<string, string> = {
  lombardy: "Lombardia",
  piedmont: "Piemonte",
  tuscany: "Toscana",
  apulia: "Puglia",
  sicily: "Sicilia",
  sardinia: "Sardegna",
  aostavalley: "Valle d'Aosta",
};

function regionKey(text: string): string {
  return normalizeSearch(text).replace(/[^a-z]/g, "");
}

/**
 * Regione di TRAMA (una delle 20 di lib/school-calendar/regions.ts) dal nome
 * che dà OpenStreetMap: "Trentino-Alto Adige/Südtirol" → "Trentino-Alto
 * Adige", "Friuli Venezia Giulia" → "Friuli-Venezia Giulia". null se non
 * corrisponde a nessuna: allora la regione la sceglie il genitore.
 */
export function regionFromPlace(osmRegion: string | null | undefined, regions: readonly string[]): string | null {
  if (!osmRegion) return null;
  const key = regionKey(osmRegion);
  if (!key) return null;
  const alias = Object.entries(REGION_ALIASES).find(([k]) => key.startsWith(k));
  if (alias) return regions.includes(alias[1]) ? alias[1] : null;
  return regions.find((r) => key.startsWith(regionKey(r))) ?? null;
}

export interface SiblingSchool {
  kidId: string;
  kidName: string;
  region: string;
  comune: string | null;
  schoolName: string | null;
}

/** Fratelli con la scuola già indicata, per "Stessa scuola di Luca" (al massimo 2 proposte). */
export function siblingSchools(
  kidId: string,
  kids: { id: string; name: string }[],
  profiles: Record<string, { region: string; comune: string | null } | undefined>,
  schoolNames: Record<string, string | null | undefined>
): SiblingSchool[] {
  return kids
    .filter((k) => k.id !== kidId && profiles[k.id])
    .map((k) => ({
      kidId: k.id,
      kidName: k.name,
      region: profiles[k.id]!.region,
      comune: profiles[k.id]!.comune,
      schoolName: schoolNames[k.id] ?? null,
    }))
    .slice(0, 2);
}

// ─── Secondo test UX (22/10/2026, ChatGPT): UX-PARENT-016…022 ─────────

/**
 * UX-PARENT-017. L'indirizzo resta solo se il nome è ancora quello a cui
 * appartiene (stessa scuola, al massimo spazi o maiuscole diversi). Con un
 * nome scritto a mano diverso l'indirizzo vecchio va tolto.
 */
export function addressBelongsTo(address: string, addressFor: string, typedName: string): boolean {
  if (!address.trim() || !addressFor.trim()) return false;
  return normalizeSearch(addressFor).replace(/\s+/g, " ").trim() === normalizeSearch(typedName).replace(/\s+/g, " ").trim();
}

/**
 * UX-PARENT-016. Messaggi della risposta a un invito di gruppo: il successo
 * nomina il gruppo; un errore tecnico non si mostra così com'è ("column
 * reference…") ma dice che l'invito resta valido e si può riprovare.
 * Gli errori "di dominio" della funzione (già gestito, altra email) restano.
 */
export const GROUP_INVITE_RETRY_MESSAGE = "Non siamo riusciti a farti entrare nel gruppo. L'invito è ancora valido.";
const GROUP_INVITE_DOMAIN_ERRORS = ["Invito non trovato o già gestito", "Questo invito è per un'altra email"];

export function groupInviteAcceptMessage(input: { groupName?: string | null; error?: string | null }): { ok: boolean; text: string; retry: boolean } {
  if (!input.error) {
    const name = input.groupName?.trim();
    return { ok: true, text: name ? `Sei nel gruppo «${name}».` : "Sei nel gruppo.", retry: false };
  }
  if (GROUP_INVITE_DOMAIN_ERRORS.includes(input.error)) return { ok: false, text: `${input.error}.`, retry: false };
  return { ok: false, text: GROUP_INVITE_RETRY_MESSAGE, retry: true };
}

/**
 * UX-PARENT-019. Categorie (tag) da proporre alle famiglie: senza quelle
 * segnate come prova (tags.is_test_fixture, migration 50). Prima della
 * migration la colonna non c'è: nessun filtro, nessun errore.
 */
export function familyVisibleTags<T extends { isTestFixture?: boolean }>(tags: T[]): T[] {
  return tags.filter((t) => t.isTestFixture !== true);
}

/**
 * UX-PARENT-020. Campanella: un invito ancora in attesa non è "da leggere"
 * ma "da rispondere". Il numero li conta tutti (restano un promemoria), il
 * testo li distingue.
 */
export function bellSummary(items: { type: string; isSeen: boolean; requiresAction?: boolean }[]): {
  count: number;
  toRead: number;
  toAnswer: number;
  ariaLabel: string;
} {
  const toAnswer = items.filter((i) => isPendingAnswer(i)).length;
  const toRead = items.filter((i) => !isPendingAnswer(i) && !i.isSeen).length;
  const parts: string[] = [];
  if (toRead > 0) parts.push(`${toRead} da leggere`);
  if (toAnswer > 0) parts.push(toAnswer === 1 ? "1 invito da gestire" : `${toAnswer} inviti da gestire`);
  return { count: toRead + toAnswer, toRead, toAnswer, ariaLabel: parts.length ? `Notifiche, ${parts.join(", ")}` : "Notifiche" };
}

export function isPendingAnswer(item: { type: string }): boolean {
  return item.type === "group_invite_pending";
}

/**
 * UX-PARENT-021. Passi dell'onboarding: se la scuola si chiederà, il totale
 * è 2 fin dall'inizio — anche quando i figli non ci sono ancora (un figlio
 * appena aggiunto non ha la scuola). Prima era "1 di 1" e poi "1 di 2".
 */
export function onboardingTotalSteps(input: { schoolCalendarEnabled: boolean; kidsCount: number; kidsWithoutSchoolCount: number }): number {
  if (!input.schoolCalendarEnabled) return 1;
  return input.kidsCount === 0 || input.kidsWithoutSchoolCount > 0 ? 2 : 1;
}
