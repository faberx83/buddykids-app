import PresenzeView from "@/components/PresenzeView";
import { getAttendanceReportForParent } from "@/lib/data/attendance-report";

// "Le presenze" (richiesto da Fabrizio insieme all'auto-hide del banner di
// check-in in Home): versione per il GENITORE del Report presenze già
// esistente lato Gestore (vedi app/center/report-presenze/page.tsx), ma
// "opportunamente rivisto" — niente tasso per attività dell'intero centro né
// "ritardatari abituali" (quella lista serve al gestore per contattare ALTRE
// famiglie: qui il genitore vede solo l'andamento dei propri figli). Sezione
// a sé in Profilo, separata da "Le mie prenotazioni" — le prenotazioni sono
// il PIANO futuro, le presenze sono lo STORICO di cosa è successo davvero.
//
// TRAMA ONE (24/08/2026) — JSX estratto in components/PresenzeView.tsx per
// essere riusato anche dal guscio NEXTGEN-native (app/nextgen/presenze),
// stesso pattern di "Le mie prenotazioni" (task #524): nessun comportamento
// cambiato qui, solo spostato in un componente condiviso.
export default async function PresenzePage() {
  const report = await getAttendanceReportForParent();
  return <PresenzeView report={report} />;
}
