import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getPlannerData } from "@/lib/data/planner";
import { getKidsForUser } from "@/lib/data/kids";
import PrenotazioniClient from "./PrenotazioniClient";

// "Le mie prenotazioni" — trasformata da Fabrizio in una dashboard di
// pianificazione familiare (non più un semplice elenco): copertura del
// periodo, prossime attività e statistiche sintetiche, con Vista/
// Raggruppamento/Ordinamento separati e azioni rapide (Modifica, Annulla,
// Dettagli, Contatta) su ogni prenotazione. "?kid=" (arrivato da "Già
// prenotato per [bambino]" in Home) preseleziona il filtro bambino.
export default async function PrenotazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ kid?: string }>;
}) {
  const { kid } = await searchParams;
  const [bookings, planner, kids] = await Promise.all([
    getMyBookingsForParent(),
    getPlannerData(),
    getKidsForUser(),
  ]);

  return (
    <div className="animate-fade-in">
      <PrenotazioniClient bookings={bookings} planner={planner} kids={kids} initialKidFilter={kid ?? null} />
    </div>
  );
}
