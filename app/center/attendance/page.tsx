import AttendanceClient from "./AttendanceClient";
import { getParticipantsForCenter, getAttendanceForWeek } from "@/lib/data/attendance";

export default async function AttendancePage() {
  const weekGroups = await getParticipantsForCenter();

  const attendanceByWeek: Record<string, { kidId: string; date: string; status: "presente" | "assente" }[]> = {};
  await Promise.all(
    weekGroups.map(async (g) => {
      attendanceByWeek[g.weekId] = await getAttendanceForWeek(g.weekId);
    })
  );

  return <AttendanceClient weekGroups={weekGroups} attendanceByWeek={attendanceByWeek} />;
}
