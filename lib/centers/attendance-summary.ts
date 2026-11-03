// UX-PARTNER-006 (report 30/10): il registro mostrava "0 presenti su 1
// prenotati · Assenti: Luca Test" per il 7 dicembre, un giorno non ancora
// arrivato e senza nessuna presenza segnata. Causa verificata: in
// app/center/attendance/AttendanceClient.tsx un bambino senza registrazione
// valeva "assente". Ora "assente" è solo quello segnato; senza registrazione
// è "da registrare"; nei giorni futuri le presenze non si segnano.

export type AttendanceMark = "presente" | "in_ritardo" | "assente";

export interface AttendanceCounts {
  booked: number;
  present: number;
  late: number;
  absent: number;
  notRecorded: number;
}

export function attendanceCounts(
  kidIds: string[],
  marks: Record<string, AttendanceMark | undefined>,
  day: string
): AttendanceCounts {
  const out: AttendanceCounts = { booked: kidIds.length, present: 0, late: 0, absent: 0, notRecorded: 0 };
  for (const id of kidIds) {
    const m = marks[`${id}:${day}`];
    if (m === "presente") out.present += 1;
    else if (m === "in_ritardo") out.late += 1;
    else if (m === "assente") out.absent += 1;
    else out.notRecorded += 1;
  }
  return out;
}

/** Data di oggi a Roma, "YYYY-MM-DD" (non UTC: a mezzanotte cambierebbe giorno un'ora prima). */
export function romeToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
}

/** Le presenze si segnano dal giorno stesso in poi, mai in anticipo. */
export function isFutureDay(day: string, today: string): boolean {
  return day > today;
}

/** Frase di riepilogo del giorno. */
export function attendanceSummaryText(c: AttendanceCounts, future: boolean): string {
  if (c.booked === 0) return "Nessun bambino prenotato";
  const booked = `${c.booked} ${c.booked === 1 ? "prenotato" : "prenotati"}`;
  if (future) return `${booked} · giorno non ancora arrivato: le presenze si segnano il giorno stesso`;
  const parts = [`${c.present} ${c.present === 1 ? "presente" : "presenti"} su ${booked}`];
  if (c.late) parts.push(`${c.late} in ritardo`);
  if (c.absent) parts.push(`${c.absent} ${c.absent === 1 ? "assente" : "assenti"}`);
  if (c.notRecorded) parts.push(`${c.notRecorded} da registrare`);
  return parts.join(" · ");
}
