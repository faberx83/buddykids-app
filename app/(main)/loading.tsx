import TramaSpinner from "@/components/TramaSpinner";

// TRAMA Sprint 3bis — "più grande e centrale" (richiesta di Fabrizio): da un
// riquadro fisso h-64 a un contenitore che occupa la maggior parte della
// viewport disponibile, cosi' lo spinner resta il fulcro visivo centrale
// della schermata di caricamento invece di un dettaglio in un box piccolo.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <TramaSpinner size={160} />
    </div>
  );
}
