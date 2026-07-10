import AttendanceClient from "./AttendanceClient";
import { getParticipantsForCenter, getAttendanceForWeek, type AttendanceDayStatus } from "@/lib/data/attendance";

export default async function AttendancePage() {
  const weekGroups = await getParticipantsForCenter();

  const attendanceByWeek: Record<string, AttendanceDayStatus[]> = {};
  await Promise.all(
    weekGroups.map(async (g) => {
      attendanceByWeek[g.weekId] = await getAttendanceForWeek(g.weekId);
    })
  );

  return <AttendanceClient weekGroups={weekGroups} attendanceByWeek={attendanceByWeek} />;
}
