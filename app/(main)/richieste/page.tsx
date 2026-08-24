import RichiesteView from "@/components/RichiesteView";
import { getInquiriesForParent } from "@/lib/data/inquiries";

// "Le mie richieste" — ticketing semplice verso i centri (vedi
// ContactCenterButton nella scheda attività e lib/data/inquiries.ts). Un
// messaggio, una risposta per richiesta: qui il genitore vede lo storico e
// le eventuali risposte ricevute. Interattività (checkbox, segna come
// letta/da leggere) spostata in RichiesteGenitoreClient.tsx.
//
// TRAMA ONE (24/08/2026) — JSX estratto in components/RichiesteView.tsx per
// essere riusato anche dal guscio NEXTGEN-native (app/nextgen/richieste),
// stesso pattern di "Le mie prenotazioni" (task #524): nessun comportamento
// cambiato qui, solo spostato in un componente condiviso.
export default async function RichiestePage() {
  const inquiries = await getInquiriesForParent();
  return <RichiesteView inquiries={inquiries} />;
}
