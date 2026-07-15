import { getMyBetaFeedback } from "@/lib/data/beta-feedback";
import SegnalazioniClient from "./SegnalazioniClient";

// SPRINT 5 (NEXTGEN) — sezione "temporanea" richiesta da Fabrizio per la
// fase BETA ("una sezione in cui rivedere aggiornamenti delle
// segnalazioni"): sola lettura, mostra le proprie righe di beta_feedback
// con lo stato aggiornato dall'Admin. Da rimuovere a fine BETA insieme al
// link in ProfileNextgenClient.tsx (entrambi marcati "Beta" per ricordarlo).
export default async function SegnalazioniPage() {
  const items = await getMyBetaFeedback();
  return <SegnalazioniClient items={items} />;
}
