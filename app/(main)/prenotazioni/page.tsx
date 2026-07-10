import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getMyBookingsForParent, type BookingStatus } from "@/lib/data/my-bookings";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "In attesa di conferma",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: "bg-yellow-light text-[#9a6b00]",
  confirmed: "bg-green-light text-green",
  cancelled: "bg-bg text-ink-3",
};

// "Le mie prenotazioni" (richiesta da Fabrizio per la v1): elenco reale,
// sola lettura — niente ancora cancellazione/modifica, solo la lista che
// prima mancava del tutto (era un MenuItem "comingSoon" nel profilo).
export default async function PrenotazioniPage() {
  const bookings = await getMyBookingsForParent();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Le mie prenotazioni" backHref="/profile" />
      <div className="px-5 py-4">
        {bookings.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
            Non hai ancora nessuna prenotazione. Trovi le attività disponibili in &quot;Cerca&quot;.
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          {bookings.map((b) => (
            <Link
              key={b.id}
              href={`/activity/${b.activityId}`}
              className="flex gap-3 rounded-lg border border-[#E8EBF0] bg-white p-3.5"
            >
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center text-2xl"
                style={b.coverImageUrl ? { backgroundImage: `url(${b.coverImageUrl})` } : { background: b.imgGradient }}
              >
                {!b.coverImageUrl && b.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">{b.activityName}</span>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_CLASS[b.status]}`}>
                    {STATUS_LABEL[b.status]}
                  </span>
                </div>
                <div className="text-xs text-ink-2">{b.weeksLabel}</div>
                {b.kidNames.length > 0 && (
                  <div className="mt-0.5 text-xs text-ink-2">{b.kidNames.join(", ")}</div>
                )}
                <div className="mt-1 text-xs font-semibold text-ink">
                  €{b.totalAmount - b.discountAmount}
                  {b.discountAmount > 0 && (
                    <span className="ml-1 font-normal text-ink-3 line-through">€{b.totalAmount}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
