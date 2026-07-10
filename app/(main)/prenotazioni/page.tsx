import PageHeader from "@/components/PageHeader";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import PrenotazioniClient from "./PrenotazioniClient";

// "Le mie prenotazioni" (richiesta da Fabrizio per la v1): elenco reale,
// sola lettura — niente ancora cancellazione/modifica. Ordinamento e filtri
// (per settimana/bambino/campus) sono gestiti da PrenotazioniClient.
export default async function PrenotazioniPage() {
  const bookings = await getMyBookingsForParent();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Le mie prenotazioni" backHref="/profile" />
      <div className="px-5 py-4">
        <PrenotazioniClient bookings={bookings} />
      </div>
    </div>
  );
}
