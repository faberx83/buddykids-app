import { getFamilyForUser } from "@/lib/data/family";
import FamigliaClient from "./FamigliaClient";

// SPRINT 5.5 (NEXTGEN) — Profilo Famiglia multi-genitore: pagina per creare
// una famiglia, invitare un secondo genitore (codice), vedere i membri, o
// entrare/uscire. Raggiungibile dal Planner (Organizzazione) — vedi
// PlannerClient.tsx, stesso trattamento del link "Indirizzi di famiglia".
export default async function FamigliaPage() {
  const family = await getFamilyForUser();
  return <FamigliaClient initialFamily={family} />;
}
