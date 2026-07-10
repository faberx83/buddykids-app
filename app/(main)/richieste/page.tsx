import PageHeader from "@/components/PageHeader";
import { getInquiriesForParent } from "@/lib/data/inquiries";
import RichiesteGenitoreClient from "./RichiesteGenitoreClient";

// "Le mie richieste" — ticketing semplice verso i centri (vedi
// ContactCenterButton nella scheda attività e lib/data/inquiries.ts). Un
// messaggio, una risposta per richiesta: qui il genitore vede lo storico e
// le eventuali risposte ricevute. Interattività (checkbox, segna come
// letta/da leggere) spostata in RichiesteGenitoreClient.tsx.
export default async function RichiestePage() {
  const inquiries = await getInquiriesForParent();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Le mie richieste" backHref="/profile" />
      <RichiesteGenitoreClient initialInquiries={inquiries} />
    </div>
  );
}
