import AttendanceClient from "./AttendanceClient";
import { getParticipantsForCenter, getAttendanceForWeek, type AttendanceDayStatus } from "@/lib/data/attendance";

export default async function AttendancePage() {
  const weekGroups = await getParticipantsForCenter();

  // FIX (TRAMA FINAL HARDENING §10-12) — chiave SEMPRE groupKey (mai
  // g.weekId, che per un gruppo "a giorno" è null): un gruppo a giorno non
  // ha ancora presenze persistibili (attendance_records richiede week_id
  // NOT NULL finché migration_35 non è applicata), quindi resta a [] invece
  // di interrogare getAttendanceForWeek con un id incompatibile.
  const attendanceByWeek: Record<string, AttendanceDayStatus[]> = {};
  await Promise.all(
    weekGroups.map(async (g) => {
      attendanceByWeek[g.groupKey] = g.weekId ? await getAttendanceForWeek(g.weekId) : [];
    })
  );

  return <AttendanceClient weekGroups={weekGroups} attendanceByWeek={attendanceByWeek} />;
}
