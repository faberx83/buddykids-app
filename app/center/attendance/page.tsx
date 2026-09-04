import AttendanceClient from "./AttendanceClient";
import {
  getParticipantsForCenter,
  getAttendanceForWeek,
  getAttendanceForDay,
  type AttendanceDayStatus,
} from "@/lib/data/attendance";

export default async function AttendancePage() {
  const weekGroups = await getParticipantsForCenter();

  // FIX (TRAMA FINAL HARDENING CLOSURE §16, 04/09/2026) — segnalazione live
  // Fabrizio: "il pallino del registro presenze c'è ma se clicco è vuoto",
  // per un camp "a giorno" già in corso con un vero check-in del genitore
  // già persistito. Root cause: un gruppo "a giorno" (g.weekId === null,
  // g.activityDayId valorizzato — vedi getParticipantsForCenter) restava
  // SEMPRE a [] qui, perché al momento del commit precedente
  // supabase/migration_35_attendance_day_based.sql non era ancora applicata
  // (attendance_records.week_id era NOT NULL, quindi nessuna riga "a
  // giorno" poteva esistere). Ora la migrazione risulta APPLICATA
  // (verificato via MCP Supabase read-only: week_id/activity_day_id
  // nullable, vincolo unique(kid_id,occurrence_id,date) presente) — usiamo
  // quindi il ramo corretto per ciascun tipo di gruppo, mai più [] di
  // default per un gruppo a giorno.
  const attendanceByWeek: Record<string, AttendanceDayStatus[]> = {};
  await Promise.all(
    weekGroups.map(async (g) => {
      attendanceByWeek[g.groupKey] = g.weekId
        ? await getAttendanceForWeek(g.weekId)
        : g.activityDayId
        ? await getAttendanceForDay(g.activityDayId)
        : [];
    })
  );

  return <AttendanceClient weekGroups={weekGroups} attendanceByWeek={attendanceByWeek} />;
}
