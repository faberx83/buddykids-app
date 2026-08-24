import PresenzeView from "@/components/PresenzeView";
import { getAttendanceReportForParent } from "@/lib/data/attendance-report";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Le presenze", stesso
// pattern di app/nextgen/prenotazioni (task #524): chiude uno dei rimandi
// legacy segnalati da Fabrizio. Nessuna nuova query: riusa PresenzeView + i
// dati di sempre, eredita bottom nav/layout NEXTGEN venendo da dentro
// app/nextgen/*.
export default async function NextgenPresenzePage() {
  const report = await getAttendanceReportForParent();
  return <PresenzeView report={report} showBrandIcon />;
}
