// Report grafico presenze per il Gestore (richiesto da Fabrizio, oltre al
// Registro presenze giorno-per-giorno già esistente): andamento nel tempo,
// tasso assenza/ritardo per attività, elenco "ritardatari abituali".
//
// Riusa gli stessi dati già letti da /center/attendance (getParticipantsForCenter
// + getAttendanceForWeek per ogni settimana) invece di nuove query dedicate:
// quei due elenchi bastano a ricostruire, giorno per giorno, sia chi era
// atteso (bambino iscritto a quella settimana/attività) sia chi è stato
// effettivamente segnato — non serve altro dal database.

import {
  getParticipantsForCenter,
  getAttendanceForWeek,
  daysInWeek,
  type AttendanceWeekGroup,
  type AttendanceDayStatus,
  type AttendanceStatusValue,
} from "@/lib/data/attendance";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface DailyAttendanceStat {
  date: string;
  dateLabel: string; // es. "8/7" per l'asse X del grafico
  presente: number;
  inRitardo: number;
  assente: number;
  totale: number;
}

export interface ActivityAttendanceStat {
  activityId: string;
  activityName: string;
  totale: number;
  presente: number;
  inRitardo: number;
  assente: number;
  assenzaRate: number; // percentuale 0-100
  ritardoRate: number; // percentuale 0-100
}

export interface FrequentIssueKid {
  kidId: string;
  kidName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  activityNames: string[];
  inRitardoCount: number;
  assenteCount: number;
  totalIssues: number;
}

export interface AttendanceReport {
  byDate: DailyAttendanceStat[];
  byActivity: ActivityAttendanceStat[];
  topIssues: FrequentIssueKid[];
  // false se non c'è ancora nessun giorno passato da poter analizzare (es.
  // stagione non ancora iniziata) — distingue "nessun dato ancora" da "dati
  // a zero perché va tutto bene".
  hasPastData: boolean;
}

function dateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

export async function getAttendanceReportForCenter(): Promise<AttendanceReport> {
  const weekGroups = await getParticipantsForCenter();
  if (weekGroups.length === 0) {
    return { byDate: [], byActivity: [], topIssues: [], hasPastData: false };
  }

  const attendanceByWeek: Record<string, AttendanceDayStatus[]> = {};
  await Promise.all(
    weekGroups.map(async (g) => {
      attendanceByWeek[g.weekId] = await getAttendanceForWeek(g.weekId);
    })
  );

  return buildAttendanceReport(weekGroups, attendanceByWeek);
}

// Pura (nessun I/O): separata da getAttendanceReportForCenter per essere
// testabile/riusabile senza rifare le query.
export function buildAttendanceReport(
  weekGroups: AttendanceWeekGroup[],
  attendanceByWeek: Record<string, AttendanceDayStatus[]>
): AttendanceReport {
  const todayIso = new Date().toISOString().slice(0, 10);

  const byDateMap = new Map<string, DailyAttendanceStat>();
  const byActivityMap = new Map<string, ActivityAttendanceStat>();
  const issueMap = new Map<string, FrequentIssueKid>();

  let hasPastData = false;

  for (const group of weekGroups) {
    // Solo i giorni già trascorsi (oggi incluso): il futuro non ha ancora
    // nessuna presenza reale da poter contare, includerlo gonfierebbe le
    // "assenze" con giorni semplicemente non ancora arrivati.
    const days = daysInWeek(group.startDate, group.endDate).filter((d) => d <= todayIso);
    if (days.length === 0 || group.kids.length === 0) continue;
    hasPastData = true;

    const recordsForWeek = attendanceByWeek[group.weekId] ?? [];
    const recordMap = new Map<string, AttendanceDayStatus>();
    for (const r of recordsForWeek) recordMap.set(`${r.kidId}:${r.date}`, r);

    if (!byActivityMap.has(group.activityId)) {
      byActivityMap.set(group.activityId, {
        activityId: group.activityId,
        activityName: group.activityName,
        totale: 0,
        presente: 0,
        inRitardo: 0,
        assente: 0,
        assenzaRate: 0,
        ritardoRate: 0,
      });
    }
    const activityStat = byActivityMap.get(group.activityId)!;

    for (const day of days) {
      if (!byDateMap.has(day)) {
        byDateMap.set(day, { date: day, dateLabel: dateLabel(day), presente: 0, inRitardo: 0, assente: 0, totale: 0 });
      }
      const dayStat = byDateMap.get(day)!;

      for (const kid of group.kids) {
        const record = recordMap.get(`${kid.kidId}:${day}`);
        // Nessun record = mai segnato dal gestore/genitore: coerente con
        // AttendanceClient.tsx, che tratta l'assenza di scrittura come
        // "assente" di default (stato iniziale dei bottoni presenza).
        const status = record?.status ?? "assente";

        dayStat.totale += 1;
        activityStat.totale += 1;
        if (status === "presente") {
          dayStat.presente += 1;
          activityStat.presente += 1;
        } else if (status === "in_ritardo") {
          dayStat.inRitardo += 1;
          activityStat.inRitardo += 1;
        } else {
          dayStat.assente += 1;
          activityStat.assente += 1;
        }

        if (status === "in_ritardo" || status === "assente") {
          if (!issueMap.has(kid.kidId)) {
            issueMap.set(kid.kidId, {
              kidId: kid.kidId,
              kidName: kid.kidName,
              parentName: kid.parentName,
              parentEmail: kid.parentEmail,
              parentPhone: kid.parentPhone,
              activityNames: [],
              inRitardoCount: 0,
              assenteCount: 0,
              totalIssues: 0,
            });
          }
          const issue = issueMap.get(kid.kidId)!;
          if (!issue.activityNames.includes(group.activityName)) issue.activityNames.push(group.activityName);
          if (status === "in_ritardo") issue.inRitardoCount += 1;
          else issue.assenteCount += 1;
          issue.totalIssues += 1;
        }
      }
    }
  }

  for (const stat of byActivityMap.values()) {
    stat.assenzaRate = stat.totale > 0 ? Math.round((stat.assente / stat.totale) * 100) : 0;
    stat.ritardoRate = stat.totale > 0 ? Math.round((stat.inRitardo / stat.totale) * 100) : 0;
  }

  const byDate = Array.from(byDateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const byActivity = Array.from(byActivityMap.values()).sort(
    (a, b) => b.assenzaRate + b.ritardoRate - (a.assenzaRate + a.ritardoRate)
  );
  // Solo bambini con almeno 2 "eventi" (ritardo/assenza) per evitare di
  // segnalare come "abituale" una singola assenza isolata (es. malattia).
  const topIssues = Array.from(issueMap.values())
    .filter((i) => i.totalIssues >= 2)
    .sort((a, b) => b.totalIssues - a.totalIssues)
    .slice(0, 10);

  return { byDate, byActivity, topIssues, hasPastData };
}

// ─────────────────────────────────────────────
// Report presenze lato GENITORE ("Le presenze" in Profilo, richiesto da
// Fabrizio insieme all'auto-hide del banner di check-in in Home) — stessa
// idea del report Gestore sopra, ma "opportunamente rivisto": qui non ha
// senso mostrare il tasso per attività di un intero centro né i "ritardatari
// abituali" (quella lista serve al gestore per contattare ALTRE famiglie —
// un genitore vede solo i propri figli, mai quelli di altri). Al suo posto,
// un riepilogo per figlio.
// ─────────────────────────────────────────────

export interface KidAttendanceStat {
  kidId: string;
  kidName: string;
  totale: number;
  presente: number;
  inRitardo: number;
  assente: number;
  presenzaRate: number; // percentuale 0-100
}

export interface ParentAttendanceReport {
  byDate: DailyAttendanceStat[];
  byKid: KidAttendanceStat[];
  hasPastData: boolean;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface ExpectedDay {
  kidId: string;
  kidName: string;
  date: string;
}

interface RawParentBookingRow {
  activities: { id: string; name: string } | { id: string; name: string }[] | null;
  booking_kids: { kid_id: string; kids: { id: string; name: string } | { id: string; name: string }[] | null }[] | null;
  booking_weeks: {
    activity_weeks: { id: string; start_date: string; end_date: string } | { id: string; start_date: string; end_date: string }[] | null;
  }[] | null;
}

export async function getAttendanceReportForParent(): Promise<ParentAttendanceReport> {
  if (!isSupabaseConfigured) return { byDate: [], byKid: [], hasPastData: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { byDate: [], byKid: [], hasPastData: false };

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "activities ( id, name ), booking_kids ( kid_id, kids ( id, name ) ), booking_weeks ( activity_weeks ( id, start_date, end_date ) )"
    )
    .eq("parent_id", user.id)
    .neq("status", "cancelled");

  if (error || !data) return { byDate: [], byKid: [], hasPastData: false };

  const todayIso = new Date().toISOString().slice(0, 10);
  const expected: ExpectedDay[] = [];
  const kidIds = new Set<string>();

  for (const booking of data as RawParentBookingRow[]) {
    const activity = firstOf(booking.activities);
    if (!activity) continue;

    for (const bw of booking.booking_weeks ?? []) {
      const week = firstOf(bw.activity_weeks);
      if (!week) continue;
      // Solo i giorni già trascorsi (oggi incluso), stesso criterio del
      // report Gestore: il futuro non ha ancora nessuna presenza reale.
      const days = daysInWeek(week.start_date, week.end_date).filter((d) => d <= todayIso);
      if (days.length === 0) continue;

      for (const bk of booking.booking_kids ?? []) {
        const kid = firstOf(bk.kids);
        if (!kid) continue;
        kidIds.add(kid.id);
        for (const day of days) expected.push({ kidId: kid.id, kidName: kid.name, date: day });
      }
    }
  }

  if (expected.length === 0) return { byDate: [], byKid: [], hasPastData: false };

  const { data: records } = await supabase
    .from("attendance_records")
    .select("kid_id, date, status")
    .in("kid_id", Array.from(kidIds))
    .lte("date", todayIso);

  // Nota: la chiave usata qui è kid_id+date (non kid_id+week_id+date come il
  // vincolo unique della tabella): nel raro caso di due attività sovrapposte
  // nello stesso giorno per lo stesso bambino (vedi avviso "prenotazioni
  // sovrapposte" nel Planner), l'ultimo record letto vince — accettabile per
  // un riepilogo aggregato, non è il Registro presenze puntuale del gestore.
  const recordMap = new Map<string, AttendanceStatusValue>();
  for (const r of records ?? []) recordMap.set(`${r.kid_id}:${r.date}`, r.status as AttendanceStatusValue);

  return buildParentAttendanceReport(expected, recordMap);
}

// Pura (nessun I/O): separata da getAttendanceReportForParent per essere
// testabile senza Supabase, stesso pattern di buildAttendanceReport sopra.
export function buildParentAttendanceReport(
  expected: ExpectedDay[],
  recordMap: Map<string, AttendanceStatusValue>
): ParentAttendanceReport {
  const byDateMap = new Map<string, DailyAttendanceStat>();
  const byKidMap = new Map<string, KidAttendanceStat>();
  const seenDayKid = new Set<string>();

  for (const item of expected) {
    const key = `${item.kidId}:${item.date}`;
    if (seenDayKid.has(key)) continue; // evita doppio conteggio, vedi nota sopra
    seenDayKid.add(key);

    const status = recordMap.get(key) ?? "assente";

    if (!byDateMap.has(item.date)) {
      byDateMap.set(item.date, {
        date: item.date,
        dateLabel: dateLabel(item.date),
        presente: 0,
        inRitardo: 0,
        assente: 0,
        totale: 0,
      });
    }
    const dayStat = byDateMap.get(item.date)!;
    dayStat.totale += 1;

    if (!byKidMap.has(item.kidId)) {
      byKidMap.set(item.kidId, {
        kidId: item.kidId,
        kidName: item.kidName,
        totale: 0,
        presente: 0,
        inRitardo: 0,
        assente: 0,
        presenzaRate: 0,
      });
    }
    const kidStat = byKidMap.get(item.kidId)!;
    kidStat.totale += 1;

    if (status === "presente") {
      dayStat.presente += 1;
      kidStat.presente += 1;
    } else if (status === "in_ritardo") {
      dayStat.inRitardo += 1;
      kidStat.inRitardo += 1;
    } else {
      dayStat.assente += 1;
      kidStat.assente += 1;
    }
  }

  for (const stat of byKidMap.values()) {
    stat.presenzaRate = stat.totale > 0 ? Math.round((stat.presente / stat.totale) * 100) : 0;
  }

  const byDate = Array.from(byDateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const byKid = Array.from(byKidMap.values()).sort((a, b) => a.kidName.localeCompare(b.kidName));

  return { byDate, byKid, hasPastData: byDate.length > 0 };
}
