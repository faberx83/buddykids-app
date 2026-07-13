import PartnerOffersCard from "@/components/dashboard/PartnerOffersCard";
import { getPartnerOffers } from "@/lib/data/partner-offers";

export default async function ServiziConsigliatiPage() {
  const partnerOffers = await getPartnerOffers();

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink">Servizi consigliati</h1>
        <p className="mt-1 text-sm text-ink-2">
          Contatti selezionati da TRAMA per aiutarti ad ampliare i servizi del tuo centro
          estivo (es. catering, trasporti, materiali).
        </p>
      </div>
      <PartnerOffersCard offers={partnerOffers} />
    </div>
  );
}
