import RichiesteClient from "./RichiesteClient";
import { getInquiriesForCenter } from "@/lib/data/inquiries";

// "Le richieste" del centro — ticketing semplice dai genitori (vedi
// ContactCenterButton nella scheda attività, lib/data/inquiries.ts). Il
// gestore legge il messaggio e scrive una risposta unica; la risposta torna
// visibile al genitore in /richieste ("Le mie richieste").
export default async function CenterRichiestePage() {
  const inquiries = await getInquiriesForCenter();
  return <RichiesteClient initialInquiries={inquiries} />;
}
