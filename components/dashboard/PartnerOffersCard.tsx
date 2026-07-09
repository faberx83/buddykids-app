import { PartnerOffer } from "@/lib/partner-offers";

export default function PartnerOffersCard({ offers }: { offers: PartnerOffer[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
      <div className="flex items-center gap-1.5 bg-[#FFF3D6] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9A6B00]">
        <i className="ti ti-map-2 text-[13px]" />
        In roadmap — sezione in fase di test, contenuti in aggiornamento
      </div>
      <div className="border-b border-[#E8EBF0] px-4 py-3">
        <span className="text-sm font-bold text-ink">Servizi consigliati per il tuo centro</span>
        <p className="mt-0.5 text-xs text-ink-2">
          Contatti selezionati da BuddyKids (es. catering) per aiutarti ad ampliare i servizi del
          tuo centro — non un elenco aperto, una selezione curata.
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-ink-2">Nessun servizio consigliato ancora disponibile.</p>
          <p className="mt-1 text-xs text-ink-3">
            Presto qui troverai contatti utili per catering e altri servizi per il tuo centro.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#F0F2F5]">
          {offers.map((offer) => (
            <div key={offer.id} className="flex items-start gap-3 px-4 py-3.5">
              {offer.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, non ottimizzabile senza config extra
                <img
                  src={offer.imageUrl}
                  alt=""
                  className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-bg text-xl">
                  {offer.emoji}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{offer.name}</span>
                  <span className="rounded-full bg-sky-light px-2 py-0.5 text-[10px] font-semibold text-sky">
                    {offer.category}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-2">{offer.description}</p>
              </div>
              <a
                href={offer.contactHref}
                className="flex-shrink-0 whitespace-nowrap rounded-md bg-sky-light px-3 py-1.5 text-xs font-semibold text-sky"
              >
                {offer.contactLabel}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
