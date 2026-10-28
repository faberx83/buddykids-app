// TRAMA — CHI ACCOMPAGNA NELLE GIORNATE PIENE (28/10/2026, release
// "chi-accompagna-giornate-piene"). Fabrizio: "rivedere ux accompagnamenti…
// in una giornata con più impegni è un casino, troppi click non si capisce";
// mock approvato il 28/10 (canvas "TRAMA — Chi accompagna nelle giornate
// piene"): prima si sceglie CHI, poi si toccano i suoi passaggi; "Come
// mercoledì scorso" in un tocco; i passaggi da decidere in alto, quelli
// decisi raccolti per persona; una domanda sola "Anche gli altri mercoledì?"
// alla fine, non una dopo ogni scelta.
//
// Logica pura sopra lib/nextgen/passages.ts (REUSE: dayLegs, resolveLegs,
// groupTrips, dayMirrorFor, applyAllTargets), senza rete. Il foglio è
// components/nextgen/PassageBusyDayBody.tsx. Test: tests/one/chi-accompagna-giornate-piene.spec.ts.

import type { AgendaEntry } from "@/lib/nextgen/today-agenda";
import { WEEKDAYS, type Moment, type ResponsibleOption, type WeekResponsibility } from "@/lib/nextgen/responsibility-options";
import {
  dayLegs,
  dayMirrorFor,
  groupTrips,
  legLabel,
  resolveLegs,
  tripTitle,
  type PassageResponsibility,
  type PassageTarget,
  type ResolvedLeg,
} from "@/lib/nextgen/passages";

export const PASSAGE_PERSON_FIRST_FLAG = "PASSAGE_PERSON_FIRST_ENABLED";
/** "Come mercoledì scorso": si guarda fino a 4 settimane indietro. */
export const SAME_WEEKDAY_LOOKBACK_WEEKS = 4;
/** Col flag acceso il Planner legge le scelte di 5 settimane fa (prima 2). */
export const PERSON_FIRST_HISTORY_DAYS = 35;

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_IT = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MONTH_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MONTH_SHORT_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

const dow = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();

/** "mercoledì" */
export function weekdayIt(iso: string): string {
  return WEEKDAY_IT[dow(iso)];
}

/** "gli altri mercoledì", "gli altri sabati", "le altre domeniche" */
export function otherWeekdaysIt(iso: string): string {
  const d = dow(iso);
  if (d === 0) return "le altre domeniche";
  if (d === 6) return "gli altri sabati";
  return `gli altri ${WEEKDAY_IT[d]}`;
}

/** "17 dic" */
export function shortDateIt(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTH_SHORT_IT[d.getUTCMonth()]}`;
}

/** "Come mercoledì scorso" / "Come domenica scorsa" / "Come mercoledì 8 ottobre" */
export function sameWeekdayTitle(dateIso: string, weeksBack: number): string {
  if (weeksBack === 1) return `Come ${weekdayIt(dateIso)} ${dow(dateIso) === 0 ? "scorsa" : "scorso"}`;
  const from = new Date(addDaysIso(dateIso, -7 * weeksBack) + "T00:00:00Z");
  return `Come ${weekdayIt(dateIso)} ${from.getUTCDate()} ${MONTH_IT[from.getUTCMonth()]}`;
}

/** "Lino", "Lino e Sara", "Lino, Sara e Bea" */
export function namesIt(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

// ─── Le righe del foglio ────────────────────────────────────────────────

export interface BusyPart {
  kidId: string;
  kidName: string;
  /** 1 passaggio, o 2 per un viaggio intero (uscita → attività). */
  legs: ResolvedLeg[];
  /** Tutti i passaggi del figlio quel giorno (per la scelta del giorno, dayMirrorFor). */
  allLegs: ResolvedLeg[];
  /** Chiave del viaggio (per "Persone diverse?"), se la parte è un viaggio intero. */
  tripKey: string | null;
  /** Stesso posto, stessa ora, stesso verso: i fratelli si possono unire in una riga. */
  signature: string;
}

export interface BusyItem {
  key: string;
  time: string | null;
  title: string;
  sub: string | null;
  kidIds: string[];
  kidsLabel: string;
  parts: BusyPart[];
  /** Chi se ne occupa (uguale per tutte le parti), null = da decidere. */
  label: string | null;
  trip: boolean;
  signature: string;
}

const sigOf = (legs: ResolvedLeg[]) => legs.map((l) => `${l.key}@${l.time ?? ""}`).join(">");

function titleOf(legs: ResolvedLeg[], kidCount: number): string {
  if (legs.length === 2) return tripTitle(legs[0], legs[1]);
  const l = legs[0];
  if (l.school && kidCount > 1) return l.moment === "andata" ? "Entrano a scuola" : "Escono da scuola";
  return legLabel(l);
}

function subOf(legs: ResolvedLeg[]): string | null {
  if (legs.length === 2) {
    const [from, to] = legs;
    return `esce alle ${from.time}, ${to.school ? "a scuola" : `a ${to.title}`} alle ${to.time} · un viaggio`;
  }
  const l = legs[0];
  if (l.school) return l.schoolName;
  return l.place;
}

/**
 * Le righe di "Chi accompagna" per una giornata, in ordine di orario. Ogni
 * figlio ha i suoi passaggi (un viaggio intero è una riga sola); due fratelli
 * con lo STESSO passaggio (stesso impegno, stesso verso, stessa ora — es.
 * entrata a scuola) e la stessa persona (o entrambi da decidere) stanno in
 * una riga sola, a meno di averli separati (`separated`).
 */
export function buildBusyItems(input: {
  kids: { id: string; name: string }[];
  entries: AgendaEntry[];
  date: string;
  rows: PassageResponsibility[];
  labelFor: (row: PassageResponsibility) => string;
  dayChoiceFor?: (kidId: string) => { andata?: string | null; ritorno?: string | null } | undefined;
  splitTrips?: Set<string>;
  separated?: Set<string>;
}): BusyItem[] {
  const parts: { part: BusyPart; label: string | null; order: number }[] = [];
  let order = 0;
  for (const kid of input.kids) {
    const legs = dayLegs(input.entries, kid.id);
    if (legs.length === 0) continue;
    const resolved = resolveLegs({ legs, kidId: kid.id, date: input.date, rows: input.rows, labelFor: input.labelFor, dayChoice: input.dayChoiceFor?.(kid.id) });
    for (const s of groupTrips(resolved)) {
      const base = { kidId: kid.id, kidName: kid.name, allLegs: resolved };
      if (s.kind === "leg") {
        parts.push({ part: { ...base, legs: [s.leg], tripKey: null, signature: sigOf([s.leg]) }, label: s.leg.label, order: order++ });
        continue;
      }
      const tripKey = `${kid.id}|${s.from.key}>${s.to.key}`;
      if (s.split || input.splitTrips?.has(tripKey)) {
        parts.push({ part: { ...base, legs: [s.from], tripKey: null, signature: sigOf([s.from]) }, label: s.from.label, order: order++ });
        parts.push({ part: { ...base, legs: [s.to], tripKey: null, signature: sigOf([s.to]) }, label: s.to.label, order: order++ });
      } else {
        const legsTrip = [s.from, s.to];
        parts.push({ part: { ...base, legs: legsTrip, tripKey, signature: sigOf(legsTrip) }, label: s.from.label, order: order++ });
      }
    }
  }

  const groups = new Map<string, { parts: BusyPart[]; label: string | null; order: number }>();
  for (const p of parts) {
    const apart = input.separated?.has(p.part.signature);
    const gk = apart ? `${p.part.signature}#${p.part.kidId}` : `${p.part.signature}#${p.label ?? ""}`;
    const g = groups.get(gk);
    if (g) g.parts.push(p.part);
    else groups.set(gk, { parts: [p.part], label: p.label, order: p.order });
  }

  return Array.from(groups.values())
    .map((g) => {
      const legs = g.parts[0].legs;
      const kidIds = g.parts.map((p) => p.kidId);
      return {
        g,
        item: {
          key: `${g.parts[0].signature}#${kidIds.join(",")}`,
          time: legs[0].time,
          title: titleOf(legs, g.parts.length),
          sub: subOf(legs),
          kidIds,
          kidsLabel: namesIt(g.parts.map((p) => p.kidName)),
          parts: g.parts,
          label: g.label,
          trip: legs.length === 2,
          signature: g.parts[0].signature,
        } satisfies BusyItem,
      };
    })
    .sort((a, b) => {
      const ta = a.item.time;
      const tb = b.item.time;
      if (ta !== tb) {
        if (ta === null) return -1;
        if (tb === null) return 1;
        return ta < tb ? -1 : 1;
      }
      return a.g.order - b.g.order;
    })
    .map((x) => x.item);
}

/** I passaggi decisi, raccolti per persona, nell'ordine della prima uscita. */
export function groupByPerson(items: BusyItem[]): { label: string; items: BusyItem[] }[] {
  const out: { label: string; items: BusyItem[] }[] = [];
  for (const it of items) {
    if (it.label === null) continue;
    const g = out.find((x) => x.label === it.label);
    if (g) g.items.push(it);
    else out.push({ label: it.label, items: [it] });
  }
  return out;
}

/** Tutti i passaggi (con figlio e data) di una riga, e le scelte del giorno da tenere allineate. */
export function targetsOf(parts: BusyPart[], date: string): { targets: PassageTarget[]; mirror: { kidId: string; date: string; moment: Moment }[] } {
  const targets: PassageTarget[] = [];
  const mirror: { kidId: string; date: string; moment: Moment }[] = [];
  for (const p of parts) {
    for (const l of p.legs) {
      targets.push({ kidId: p.kidId, date, passageKey: l.passageKey, moment: l.moment });
      const m = dayMirrorFor(p.allLegs, l.key);
      if (m) mirror.push({ kidId: p.kidId, date, moment: m });
    }
  }
  return { targets, mirror };
}

// ─── La persona scelta ──────────────────────────────────────────────────

export interface ChosenPerson {
  opt: ResponsibleOption;
  /** Testo libero per "Altro…" (persona non salvata in famiglia). */
  label?: string;
}

export const personLabel = (p: ChosenPerson) => p.label ?? p.opt.label;

/** Il passaggio è già affidato a questa persona? */
export function legIsPerson(leg: ResolvedLeg, p: ChosenPerson): boolean {
  if (leg.row) {
    if (leg.row.responsible !== p.opt.value) return false;
    if ((leg.row.familyPersonId ?? null) !== (p.opt.familyPersonId ?? null)) return false;
    if (p.opt.value === "altro" && !p.opt.familyPersonId) return (leg.row.responsibleLabel ?? "") === personLabel(p);
    return true;
  }
  return leg.source === "day" && leg.label === personLabel(p);
}

export const itemIsPerson = (item: BusyItem, p: ChosenPerson) => item.parts.every((part) => part.legs.every((l) => legIsPerson(l, p)));

// ─── "Come mercoledì scorso" ────────────────────────────────────────────

export interface SameWeekdayPick {
  itemKey: string;
  kidId: string;
  passageKey: string;
  moment: Moment;
  allLegs: ResolvedLeg[];
  legKey: string;
  row: PassageResponsibility;
}

export interface SameWeekdaySuggestion {
  fromDate: string;
  weeksBack: number;
  title: string;
  picks: SameWeekdayPick[];
  /** Quante righe del foglio si riempiono. */
  count: number;
  /** "Nonna Rita 2 passaggi, Papà 2" */
  summary: string;
}

/**
 * Le scelte dello stesso giorno della settimana più recente (fino a 4
 * settimane indietro) che coprono passaggi ANCORA DA DECIDERE oggi: stesso
 * figlio, stesso impegno, stesso verso. Null se non c'è niente da copiare.
 */
export function sameWeekdaySuggestion(input: {
  date: string;
  items: BusyItem[];
  rows: PassageResponsibility[];
  labelFor: (row: PassageResponsibility) => string;
  maxWeeks?: number;
}): SameWeekdaySuggestion | null {
  const open = input.items.filter((i) => i.label === null);
  if (open.length === 0) return null;
  for (let k = 1; k <= (input.maxWeeks ?? SAME_WEEKDAY_LOOKBACK_WEEKS); k += 1) {
    const past = addDaysIso(input.date, -7 * k);
    const picks: SameWeekdayPick[] = [];
    for (const item of open) {
      for (const part of item.parts) {
        for (const l of part.legs) {
          const row = input.rows.find((r) => r.kidId === part.kidId && r.date === past && r.passageKey === l.passageKey && r.moment === l.moment);
          if (row) picks.push({ itemKey: item.key, kidId: part.kidId, passageKey: l.passageKey, moment: l.moment, allLegs: part.allLegs, legKey: l.key, row });
        }
      }
    }
    if (picks.length === 0) continue;
    const covered = new Set(picks.map((p) => p.itemKey));
    const byPerson = new Map<string, Set<string>>();
    for (const p of picks) {
      const who = input.labelFor(p.row) || "Altro";
      if (!byPerson.has(who)) byPerson.set(who, new Set());
      byPerson.get(who)!.add(p.itemKey);
    }
    const summary = Array.from(byPerson.entries())
      .map(([who, set], i) => (i === 0 ? `${who} ${set.size} ${set.size === 1 ? "passaggio" : "passaggi"}` : `${who} ${set.size}`))
      .join(", ");
    return { fromDate: past, weeksBack: k, title: sameWeekdayTitle(input.date, k), picks, count: covered.size, summary };
  }
  return null;
}

/** Le scelte da scrivere per "Usa questi passaggi", raggruppate per persona (una chiamata ciascuna). */
export function suggestionWrites(s: SameWeekdaySuggestion, date: string) {
  const groups = new Map<
    string,
    { row: PassageResponsibility; targets: PassageTarget[]; mirror: { kidId: string; date: string; moment: Moment }[] }
  >();
  for (const p of s.picks) {
    const gk = `${p.row.responsible}|${p.row.familyPersonId ?? ""}|${p.row.responsibleLabel ?? ""}`;
    if (!groups.has(gk)) groups.set(gk, { row: p.row, targets: [], mirror: [] });
    const g = groups.get(gk)!;
    g.targets.push({ kidId: p.kidId, date, passageKey: p.passageKey, moment: p.moment });
    const m = dayMirrorFor(p.allLegs, p.legKey);
    if (m) g.mirror.push({ kidId: p.kidId, date, moment: m });
  }
  return Array.from(groups.values());
}

// ─── "Anche gli altri mercoledì?" ───────────────────────────────────────

/** Solo lo stesso giorno della settimana (Fabrizio, mock del 28/10: "Anche gli altri mercoledì?"). */
export function sameWeekdayDates(dates: string[], dateIso: string): string[] {
  const d = dow(dateIso);
  return dates.filter((x) => x !== dateIso && dow(x) === d);
}

/** Toglie i passaggi che in quei giorni sono già affidati alla stessa persona. */
export function pendingTargets(
  targets: PassageTarget[],
  rows: PassageResponsibility[],
  choice: { responsible: string; familyPersonId: string | null; responsibleLabel: string | null }
): PassageTarget[] {
  return targets.filter((t) => {
    const r = rows.find((x) => x.kidId === t.kidId && x.date === t.date && x.passageKey === t.passageKey && x.moment === t.moment);
    if (!r) return true;
    if (r.responsible !== choice.responsible || (r.familyPersonId ?? null) !== choice.familyPersonId) return true;
    return choice.responsible === "altro" && !choice.familyPersonId && (r.responsibleLabel ?? "") !== (choice.responsibleLabel ?? "");
  });
}

/** Settimana e giorno della "scelta del giorno" (solo lun–ven). Stessa regola di PassageAssignBody. */
export function dayRowFor(date: string): { weekStartDate: string; weekday: WeekResponsibility["weekday"] } | null {
  const d = new Date(date + "T00:00:00Z");
  const offset = (d.getUTCDay() + 6) % 7;
  const monday = addDaysIso(date, -offset);
  const wd = WEEKDAYS.find((w) => w.dayOffset === offset);
  return wd ? { weekStartDate: monday, weekday: wd.value } : null;
}

// ─── v2 (28/10/2026 pomeriggio): il bambino al centro ───────────────────
// Fabrizio, sul foglio "prima chi": "il focus è sull'accompagnatore o sul
// bambino? … rimane difficile capire 'mamma' di chi deve occuparsi.
// Proverei a sintetizzare e semplificare ancora". Mock v2 approvato ("si ok
// tutto"): una scheda per figlio con la sua giornata; "Chi?" apre la domanda
// scritta per intero con la persona di solito in alto; vista "Per persona"
// a frasi ("Tu: 08:30 porti Lino a scuola"); "Io" diventa "Tu".

/** Le righe di un figlio solo (niente righe in comune fra fratelli). */
export function buildKidDays(input: Omit<Parameters<typeof buildBusyItems>[0], "separated">): { kid: { id: string; name: string }; items: BusyItem[] }[] {
  return input.kids
    .map((kid) => ({ kid, items: buildBusyItems({ ...input, kids: [kid] }) }))
    .filter((k) => k.items.length > 0);
}

const placeOf = (l: ResolvedLeg) => (l.school ? "scuola" : l.title);

/** Dal punto di vista del bambino: "Entra a scuola", "Esce da scuola", "Va a Ritmica", "Esce da Ritmica", "Da scuola a Ritmica". */
export function kidItemTitle(item: BusyItem): string {
  const legs = item.parts[0].legs;
  if (legs.length === 2) return tripTitle(legs[0], legs[1]);
  const l = legs[0];
  if (l.school) return l.moment === "andata" ? "Entra a scuola" : "Esce da scuola";
  return l.moment === "andata" ? `Va a ${l.title}` : `Esce da ${l.title}`;
}

/** La domanda del foglietto: "Chi prende Lino all'uscita da scuola?" */
export function whoQuestion(item: BusyItem): string {
  const legs = item.parts[0].legs;
  const kid = item.kidsLabel;
  if (legs.length === 2) return `Chi accompagna ${kid} da ${placeOf(legs[0])} a ${placeOf(legs[1])}?`;
  const l = legs[0];
  if (l.school) return l.moment === "andata" ? `Chi porta ${kid} a scuola?` : `Chi prende ${kid} all'uscita da scuola?`;
  return l.moment === "andata" ? `Chi porta ${kid} a ${l.title}?` : `Chi riprende ${kid} da ${l.title}?`;
}

/** La frase della vista "Per persona": "porti Lino a scuola" (tu) / "prende Lino a scuola" (gli altri). */
export function personSentence(item: BusyItem, you: boolean): string {
  const legs = item.parts[0].legs;
  const kid = item.kidsLabel;
  const v = (tu: string, lui: string) => (you ? tu : lui);
  if (legs.length === 2) return `${v("porti", "porta")} ${kid} da ${placeOf(legs[0])} a ${placeOf(legs[1])}`;
  const l = legs[0];
  if (l.school) return l.moment === "andata" ? `${v("porti", "porta")} ${kid} a scuola` : `${v("prendi", "prende")} ${kid} a scuola`;
  return l.moment === "andata" ? `${v("porti", "porta")} ${kid} a ${l.title}` : `${v("riprendi", "riprende")} ${kid} da ${l.title}`;
}

/** Identità di una persona (opzione + testo libero per "Altro…"). */
export function personKey(p: { responsible: string; familyPersonId?: string | null; responsibleLabel?: string | null }): string {
  const free = p.responsible === "altro" && !p.familyPersonId ? (p.responsibleLabel ?? "").trim() : "";
  return `${p.responsible}|${p.familyPersonId ?? ""}|${free}`;
}

export const chosenKey = (p: ChosenPerson) =>
  personKey({ responsible: p.opt.value, familyPersonId: p.opt.familyPersonId ?? null, responsibleLabel: p.opt.value === "altro" ? personLabel(p) : null });

/** Da una scelta salvata alla persona fra le opzioni (null se non si ritrova). */
export function personFromRow(row: PassageResponsibility, options: ResponsibleOption[]): ChosenPerson | null {
  if (row.responsible === "altro" && !row.familyPersonId) {
    const generic = options.find((o) => o.value === "altro" && !o.familyPersonId);
    const label = row.responsibleLabel?.trim();
    return generic && label ? { opt: generic, label } : null;
  }
  const opt = options.find((o) => o.value === row.responsible && (o.familyPersonId ?? null) === (row.familyPersonId ?? null));
  return opt ? { opt } : null;
}

/**
 * Chi lo fa "di solito": per lo stesso figlio e lo stesso passaggio, prima lo
 * stesso giorno della settimana nelle 4 settimane prima (il più recente),
 * poi chi l'ha fatto più spesso nei giorni prima.
 */
export function usualPersonFor(input: {
  item: BusyItem;
  date: string;
  rows: PassageResponsibility[];
  options: ResponsibleOption[];
}): ChosenPerson | null {
  const part = input.item.parts[0];
  const leg = part.legs[0];
  const past = input.rows.filter((r) => r.kidId === part.kidId && r.passageKey === leg.passageKey && r.moment === leg.moment && r.date < input.date);
  for (let k = 1; k <= SAME_WEEKDAY_LOOKBACK_WEEKS; k += 1) {
    const d = addDaysIso(input.date, -7 * k);
    const r = past.find((x) => x.date === d);
    if (r) {
      const p = personFromRow(r, input.options);
      if (p) return p;
    }
  }
  const counts = new Map<string, { n: number; row: PassageResponsibility }>();
  for (const r of past) {
    const k = personKey(r);
    const c = counts.get(k);
    counts.set(k, { n: (c?.n ?? 0) + 1, row: r });
  }
  const best = Array.from(counts.values()).sort((a, b) => b.n - a.n)[0];
  return best ? personFromRow(best.row, input.options) : null;
}

/** Le persone più usate (scelte salvate), escluse quelle già in alto; si completa con l'ordine delle opzioni. */
export function topPeople(input: { rows: PassageResponsibility[]; options: ResponsibleOption[]; exclude: string[]; n?: number }): ChosenPerson[] {
  const n = input.n ?? 3;
  const counts = new Map<string, { n: number; p: ChosenPerson }>();
  for (const r of input.rows) {
    const p = personFromRow(r, input.options);
    if (!p) continue;
    const k = chosenKey(p);
    counts.set(k, { n: (counts.get(k)?.n ?? 0) + 1, p });
  }
  const out: ChosenPerson[] = [];
  const taken = new Set(input.exclude);
  for (const { p } of Array.from(counts.values()).sort((a, b) => b.n - a.n)) {
    if (out.length >= n) break;
    const k = chosenKey(p);
    if (taken.has(k)) continue;
    out.push(p);
    taken.add(k);
  }
  for (const o of input.options) {
    if (out.length >= n) break;
    if (o.value === "altro" && !o.familyPersonId) continue;
    const p = { opt: o };
    const k = chosenKey(p);
    if (taken.has(k)) continue;
    out.push(p);
    taken.add(k);
  }
  return out;
}

/** Il fratello con lo stesso passaggio alla stessa ora ("Anche Franchidea"). */
export function siblingTwins(item: BusyItem, kidDays: { kid: { id: string; name: string }; items: BusyItem[] }[]): BusyItem[] {
  return kidDays.flatMap((k) => (k.kid.id === item.kidIds[0] ? [] : k.items.filter((i) => i.signature === item.signature)));
}

/** La vista "Per persona": Tu per primo, poi in ordine di prima uscita; i da decidere a parte. */
export function personView(
  kidDays: { kid: { id: string; name: string }; items: BusyItem[] }[],
  youLabel: string
): { groups: { label: string; you: boolean; items: BusyItem[] }[]; open: BusyItem[] } {
  const all = kidDays
    .flatMap((k) => k.items)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const groups = groupByPerson(all).map((g) => ({ ...g, you: g.label === youLabel }));
  groups.sort((a, b) => Number(b.you) - Number(a.you));
  return { groups, open: all.filter((i) => i.label === null) };
}

// ─── "Chi fa cosa" della settimana (28/10/2026 sera) ────────────────────
// Fabrizio, sul foglio settimanale rimasto quello di prima (Porta / Ritira
// per giorno e "Uguale per tutta la settimana" con tutte le persone): stesso
// linguaggio del foglio del giorno. Ogni giorno: i figli, ognuno con i suoi
// passaggi in fila ("08:00 Tu · 13:40 Zia Carla · 19:00 Chi?"); in cima
// "Come la settimana scorsa" per tutti i giorni insieme.

/** Le scelte della settimana prima, giorno per giorno (solo passaggi uguali e ancora da decidere, da oggi in poi). */
export function weekSameAsLast(input: {
  days: { date: string; items: BusyItem[] }[];
  todayIso: string;
  rows: PassageResponsibility[];
  labelFor: (row: PassageResponsibility) => string;
}): { perDay: { date: string; suggestion: SameWeekdaySuggestion }[]; count: number } {
  const perDay = input.days
    .filter((d) => d.date >= input.todayIso)
    .flatMap((d) => {
      const s = sameWeekdaySuggestion({ date: d.date, items: d.items, rows: input.rows, labelFor: input.labelFor, maxWeeks: 1 });
      return s ? [{ date: d.date, suggestion: s }] : [];
    });
  return { perDay, count: perDay.reduce((n, d) => n + d.suggestion.count, 0) };
}
