// TRAMA — PLANNER V2, vista Settimana (14/10/2026). Logica pura: una
// settimana qualunque (non solo l'estate), giorno per giorno, con
// prenotazioni TRAMA, Scoperte e impegni aggiunti a mano nella stessa
// lista (buildTodayAgenda, già usata dalla Home V2) e il coordinamento di
// ogni giornata (week_responsibilities: figlio + giorno + momento).
// Nessuna query: tutto è calcolato sul client a partire dai dati già letti,
// così passare da una settimana all'altra è immediato.
// Testata in tests/one/planner-v2.spec.ts.

import { occurrenceDates, occursOn, type WeeklyRecurrence } from "@/lib/planner/recurrence";
import {
  buildTodayAgenda,
  summarizeDayCoordination,
  type AgendaBookingInput,
  type AgendaEntry,
  type AgendaExternalInput,
  type DayCoordinationSlotInput,
  type DayCoordinationSummary,
} from "@/lib/nextgen/today-agenda";
import { MOMENTS, WEEKDAYS, type Weekday, type WeekResponsibility } from "@/lib/nextgen/responsibility-options";

const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const DAYS_IT = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const DAY_LETTER = ["D", "L", "M", "M", "G", "V", "S"];

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOfIso(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** "12 – 18 ottobre", "28 settembre – 4 ottobre", "29 dicembre – 4 gennaio 2027". */
export function weekRangeLabel(mondayIso: string, todayIso?: string): string {
  const a = new Date(mondayIso + "T00:00:00Z");
  const sundayIso = addDaysIso(mondayIso, 6);
  const b = new Date(sundayIso + "T00:00:00Z");
  const yearTail = todayIso && b.getUTCFullYear() !== Number(todayIso.slice(0, 4)) ? ` ${b.getUTCFullYear()}` : "";
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()} – ${b.getUTCDate()} ${MONTHS_IT[b.getUTCMonth()]}${yearTail}`;
  }
  return `${a.getUTCDate()} ${MONTHS_IT[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS_IT[b.getUTCMonth()]}${yearTail}`;
}

/** "Questa settimana", "Settimana prossima", "Settimana scorsa", altrimenti null. */
export function relativeWeekLabel(mondayIso: string, todayIso: string): string | null {
  const thisMonday = mondayOfIso(todayIso);
  if (mondayIso === thisMonday) return "Questa settimana";
  if (mondayIso === addDaysIso(thisMonday, 7)) return "Settimana prossima";
  if (mondayIso === addDaysIso(thisMonday, -7)) return "Settimana scorsa";
  return null;
}

/** Giorni feriali prenotati per figlio (stessa regola di getKidsBookedDaysForWeek:
 *  conta ogni prenotazione non annullata, settimane intere o giorni). */
export function bookedDaysForWeek(
  bookings: Pick<AgendaBookingInput, "status" | "kidIds" | "kidNames" | "weeks" | "dayDates">[],
  mondayIso: string
): { kidId: string; kidName: string; dates: string[] }[] {
  const weekdays = WEEKDAYS.map((wd) => addDaysIso(mondayIso, wd.dayOffset));
  const byKid = new Map<string, { kidName: string; dates: Set<string> }>();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const covered = weekdays.filter(
      (iso) => b.dayDates.includes(iso) || b.weeks.some((w) => w.startDate <= iso && iso <= w.endDate)
    );
    if (covered.length === 0) continue;
    b.kidIds.forEach((kidId, i) => {
      const entry = byKid.get(kidId) ?? { kidName: b.kidNames[i] ?? "", dates: new Set<string>() };
      for (const d of covered) entry.dates.add(d);
      byKid.set(kidId, entry);
    });
  }
  return Array.from(byKid.entries()).map(([kidId, v]) => ({ kidId, kidName: v.kidName, dates: Array.from(v.dates).sort() }));
}

/**
 * Giorni feriali in cui ogni figlio va accompagnato/ritirato (15/10/2026,
 * Fabrizio: "Chi accompagna" anche per gli impegni aggiunti a mano — "sì,
 * feriali"). Unisce le prenotazioni (bookedDaysForWeek) e gli impegni del
 * Planner (aggiunti a mano o Scoperte) con almeno un figlio: un impegno conta
 * in ogni giorno feriale tra startDate ed endDate, la stessa regola
 * dell'agenda (buildTodayAgenda). Sabato e domenica restano fuori:
 * week_responsibilities conosce solo lun–ven (servirebbe una migrazione).
 */
export function coordinationDaysForWeek(
  bookings: Pick<AgendaBookingInput, "status" | "kidIds" | "kidNames" | "weeks" | "dayDates">[],
  externalItems: Pick<AgendaExternalInput, "startDate" | "endDate" | "kidIds" | "recurrence" | "isSchool">[],
  mondayIso: string,
  kidNameById: Record<string, string>
): { kidId: string; kidName: string; dates: string[] }[] {
  const weekdays = WEEKDAYS.map((wd) => addDaysIso(mondayIso, wd.dayOffset));
  const byKid = new Map<string, { kidName: string; dates: Set<string> }>();
  for (const k of bookedDaysForWeek(bookings, mondayIso)) byKid.set(k.kidId, { kidName: k.kidName, dates: new Set(k.dates) });
  for (const item of externalItems) {
    // 21/10/2026: solo i giorni in cui c'è davvero (ricorrenza); la scuola
    // non genera passaggi in questa fase (sarebbero "da decidere" ogni giorno).
    if (item.isSchool) continue;
    const covered = weekdays.filter((iso) => occursOn(item, iso));
    if (covered.length === 0) continue;
    for (const kidId of item.kidIds) {
      const name = byKid.get(kidId)?.kidName || kidNameById[kidId];
      if (!name) continue; // figlio non (più) in famiglia: niente passaggio da organizzare
      const entry = byKid.get(kidId) ?? { kidName: name, dates: new Set<string>() };
      for (const d of covered) entry.dates.add(d);
      byKid.set(kidId, entry);
    }
  }
  return Array.from(byKid.entries()).map(([kidId, v]) => ({ kidId, kidName: v.kidName, dates: Array.from(v.dates).sort() }));
}

/**
 * Porta/Ritira di UN giorno (15/10/2026, Home V2 "Oggi" e "Da fare"): stessa
 * regola del Planner V2 — tutto l'anno (lunedì della settimana come
 * week_start_date), prenotazioni + impegni del Planner, solo lun–ven.
 * Sabato/domenica → nessuno slot.
 */
export function dayCoordinationSlots(input: {
  dateIso: string;
  bookings: Pick<AgendaBookingInput, "status" | "kidIds" | "kidNames" | "weeks" | "dayDates">[];
  externalItems: Pick<AgendaExternalInput, "startDate" | "endDate" | "kidIds" | "recurrence" | "isSchool">[];
  responsibilities: WeekResponsibility[];
  kidNameById: Record<string, string>;
  labelFor: (r: WeekResponsibility) => string;
}): DayCoordinationSlotInput[] {
  const monday = mondayOfIso(input.dateIso);
  const weekday = WEEKDAYS.find((wd) => addDaysIso(monday, wd.dayOffset) === input.dateIso)?.value;
  if (!weekday) return [];
  const slots: DayCoordinationSlotInput[] = [];
  for (const kid of coordinationDaysForWeek(input.bookings, input.externalItems, monday, input.kidNameById)) {
    if (!kid.dates.includes(input.dateIso)) continue;
    for (const mo of MOMENTS) {
      const r = input.responsibilities.find(
        (x) => x.kidId === kid.kidId && x.weekStartDate === monday && x.weekday === weekday && x.moment === mo.value
      );
      slots.push({ kidId: kid.kidId, kidName: kid.kidName, moment: mo.value, label: r ? input.labelFor(r) || null : null });
    }
  }
  return slots;
}

export interface WeekDayModel {
  dateIso: string;
  /** "Martedì 13" */
  label: string;
  /** "M" */
  letter: string;
  dayOfMonth: number;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  entries: AgendaEntry[];
  coordination: DayCoordinationSummary;
  /** Figli con qualcosa quel giorno (per i pallini della striscia). */
  kidIds: string[];
  /** 20/10/2026: come kidIds ma senza il filtro per figlio — "chi resta
   *  scoperto" deve vedere gli impegni di tutti anche quando si guarda un
   *  figlio solo (prima, con il filtro su Lino, Franchidea risultava
   *  scoperta pur avendo la gara). */
  allKidIds: string[];
  /** Etichette della chiusura scolastica, se la scuola è chiusa quel giorno. */
  closureLabels: string[];
}

export interface WeekModel {
  mondayIso: string;
  label: string;
  relativeLabel: string | null;
  prevMondayIso: string;
  nextMondayIso: string;
  days: WeekDayModel[];
  entryCount: number;
  missingCount: number;
}

export function buildWeekModel(input: {
  mondayIso: string;
  todayIso: string;
  bookings: AgendaBookingInput[];
  externalItems: AgendaExternalInput[];
  hoursByActivityDbId: Record<string, string | undefined>;
  kidNameById: Record<string, string>;
  responsibilities: WeekResponsibility[];
  /** Etichetta di chi accompagna (risolta col ruolo del genitore). */
  labelFor: (r: WeekResponsibility) => string;
  /** Solo questo figlio; null = tutti. */
  kidFilter: string | null;
  /** Giorni di scuola chiusa per figlio: { date: [label] }. */
  closureLabelsByDate?: Record<string, string[]>;
  /** 21/10/2026: giorni senza scuola (chiusure E vacanze estive) — lì l'orario della scuola non c'è. */
  schoolClosedDates?: string[];
}): WeekModel {
  const monday = input.mondayIso;
  const booked = coordinationDaysForWeek(input.bookings, input.externalItems, monday, input.kidNameById).filter(
    (k) => input.kidFilter === null || k.kidId === input.kidFilter
  );
  const respByKey = new Map<string, WeekResponsibility>();
  for (const r of input.responsibilities) {
    if (r.weekStartDate !== monday) continue;
    respByKey.set(`${r.kidId}__${r.weekday}__${r.moment}`, r);
  }
  const weekdayByDate = new Map<string, Weekday>(WEEKDAYS.map((wd) => [addDaysIso(monday, wd.dayOffset), wd.value]));

  const days: WeekDayModel[] = [];
  let entryCount = 0;
  let missingCount = 0;
  for (let i = 0; i < 7; i += 1) {
    const dateIso = addDaysIso(monday, i);
    const d = new Date(dateIso + "T00:00:00Z");
    const all = buildTodayAgenda({
      todayIso: dateIso,
      bookings: input.bookings,
      externalItems: input.externalItems,
      hoursByActivityDbId: input.hoursByActivityDbId,
      kidNameById: input.kidNameById,
      schoolClosedDates: input.schoolClosedDates ?? Object.keys(input.closureLabelsByDate ?? {}),
    });
    const entries =
      input.kidFilter === null ? all : all.filter((e) => e.kids.some((k) => k.id === input.kidFilter) || e.kids.length === 0);

    const weekday = weekdayByDate.get(dateIso);
    const slots: DayCoordinationSlotInput[] = [];
    if (weekday) {
      for (const kid of booked) {
        if (!kid.dates.includes(dateIso)) continue;
        for (const mo of MOMENTS) {
          const r = respByKey.get(`${kid.kidId}__${weekday}__${mo.value}`);
          slots.push({ kidId: kid.kidId, kidName: kid.kidName, moment: mo.value, label: r ? input.labelFor(r) || null : null });
        }
      }
    }
    const coordination = summarizeDayCoordination(slots);
    const kidIds = Array.from(new Set(entries.flatMap((e) => e.kids.map((k) => k.id))));
    const allKidIds = Array.from(new Set(all.flatMap((e) => e.kids.map((k) => k.id))));

    // 21/10/2026: la scuola non conta come impegno ("3 impegni", non "13").
    entryCount += entries.filter((e) => !e.school).length;
    if (dateIso >= input.todayIso) missingCount += coordination.missingCount;
    days.push({
      dateIso,
      label: `${DAYS_IT[d.getUTCDay()]} ${d.getUTCDate()}`,
      letter: DAY_LETTER[d.getUTCDay()],
      dayOfMonth: d.getUTCDate(),
      isToday: dateIso === input.todayIso,
      isPast: dateIso < input.todayIso,
      isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
      entries,
      coordination,
      kidIds,
      allKidIds,
      closureLabels: input.closureLabelsByDate?.[dateIso] ?? [],
    });
  }

  return {
    mondayIso: monday,
    label: weekRangeLabel(monday, input.todayIso),
    relativeLabel: relativeWeekLabel(monday, input.todayIso),
    prevMondayIso: addDaysIso(monday, -7),
    nextMondayIso: addDaysIso(monday, 7),
    days,
    entryCount,
    missingCount,
  };
}

/** Riga di stato sotto il navigatore: "10 impegni · 1 passaggio da assegnare". */
export function weekStatusParts(week: WeekModel): { entries: string; missing: string | null } {
  const entries = week.entryCount === 0 ? "Nessun impegno" : week.entryCount === 1 ? "1 impegno" : `${week.entryCount} impegni`;
  const missing =
    week.missingCount === 0 ? null : week.missingCount === 1 ? "1 passaggio da assegnare" : `${week.missingCount} passaggi da assegnare`;
  return { entries, missing };
}

// ─── Mese (pannello dal basso) ─────────────────────────────────────────

export interface MonthCell {
  dateIso: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  kidIds: string[];
  closure: boolean;
}

export interface MonthModel {
  /** "ottobre 2026" */
  label: string;
  firstIso: string;
  prevFirstIso: string;
  nextFirstIso: string;
  /** Righe lun→dom; ogni riga parte da un lunedì. */
  rows: { mondayIso: string; cells: MonthCell[] }[];
}

export function buildMonthModel(input: {
  anyDayIso: string;
  todayIso: string;
  kidIdsByDate: (dateIso: string) => string[];
  closureDates?: Set<string>;
}): MonthModel {
  const first = `${input.anyDayIso.slice(0, 7)}-01`;
  const d = new Date(first + "T00:00:00Z");
  const month = d.getUTCMonth();
  const prev = new Date(Date.UTC(d.getUTCFullYear(), month - 1, 1)).toISOString().slice(0, 10);
  const next = new Date(Date.UTC(d.getUTCFullYear(), month + 1, 1)).toISOString().slice(0, 10);
  const rows: MonthModel["rows"] = [];
  for (let monday = mondayOfIso(first); ; monday = addDaysIso(monday, 7)) {
    const cells: MonthCell[] = [];
    for (let i = 0; i < 7; i += 1) {
      const iso = addDaysIso(monday, i);
      const inMonth = new Date(iso + "T00:00:00Z").getUTCMonth() === month;
      cells.push({
        dateIso: iso,
        dayOfMonth: Number(iso.slice(8, 10)),
        inMonth,
        isToday: iso === input.todayIso,
        kidIds: inMonth ? input.kidIdsByDate(iso) : [],
        closure: inMonth && Boolean(input.closureDates?.has(iso)),
      });
    }
    rows.push({ mondayIso: monday, cells });
    if (addDaysIso(monday, 7) >= next) break;
  }
  return { label: `${MONTHS_IT[month]} ${d.getUTCFullYear()}`, firstIso: first, prevFirstIso: prev, nextFirstIso: next, rows };
}

/**
 * POLISH V2 (14/10/2026): gli impegni aggiunti a mano che toccano la
 * settimana di `mondayIso` (lunedì–domenica). La vista Settimana risponde
 * solo a "cosa succede in questa settimana?": gli impegni di altre date non
 * la allungano più. Nessun dato cambiato, solo presentazione.
 */
export function itemsInWeek<T extends { startDate: string; endDate: string | null; recurrence?: WeeklyRecurrence | null; isSchool?: boolean }>(
  items: T[],
  mondayIso: string
): T[] {
  const sunday = addDaysIso(mondayIso, 6);
  return items.filter((i) => {
    // 21/10/2026: l'orario della scuola si imposta in La tua famiglia, non è un "impegno aggiunto".
    if (i.isSchool) return false;
    if (!(i.startDate <= sunday && (i.endDate ?? i.startDate) >= mondayIso)) return false;
    // Un impegno ricorrente conta nella settimana solo se quella settimana c'è davvero.
    if (i.recurrence) return occurrenceDates({ startDate: i.startDate, endDate: i.endDate ?? i.startDate, recurrence: i.recurrence }, mondayIso, sunday).length > 0;
    return true;
  });
}

/**
 * 15/10/2026 (Fabrizio: "spiegami pallini e perché 'da completare'… come lo
 * vedo semplicemente?"): per ogni figlio, i giorni feriali di scuola chiusa
 * (non passati) in cui non ha ancora niente nel Planner. È il motivo per cui
 * la settimana risulta "Da completare" o "Da organizzare".
 */
export function uncoveredClosureDays(
  days: { dateIso: string; label: string; isPast: boolean; isWeekend: boolean; kidIds: string[]; allKidIds?: string[]; closureLabels: string[] }[],
  kids: { id: string; name: string }[],
  /** 20/10/2026: "kidId|giorno" già sistemati con "Non serve" (lib/nextgen/closure-not-needed.ts). */
  handled: Set<string> = new Set()
): { kidId: string; kidName: string; dayLabels: string[] }[] {
  const closureDays = days.filter((d) => d.closureLabels.length > 0 && !d.isPast && !d.isWeekend);
  return kids
    .map((k) => ({
      kidId: k.id,
      kidName: k.name,
      dayLabels: closureDays
        .filter((d) => !(d.allKidIds ?? d.kidIds).includes(k.id) && !handled.has(`${k.id}|${d.dateIso}`))
        .map((d) => d.label.toLowerCase()),
    }))
    .filter((r) => r.dayLabels.length > 0);
}

/** "lunedì 7 e martedì 8" / "lunedì 7, martedì 8 e mercoledì 9". */
export function joinItalian(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}
