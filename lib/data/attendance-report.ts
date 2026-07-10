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
} from "@/lib/data/attendance";

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
