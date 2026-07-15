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
      {/* BUGFIX (segnalato da Fabrizio) — pagina condivisa tra profilo LEGACY
          e NEXTGEN: niente backHref fisso, PageHeader ricade su
          router.back() e torna sempre a dove l'utente era arrivato davvero. */}
      <PageHeader title="Le mie richieste" />
      <RichiesteGenitoreClient initialInquiries={inquiries} />
    </div>
  );
}
