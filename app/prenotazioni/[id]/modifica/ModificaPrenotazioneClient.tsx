"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import WeekCard from "@/components/WeekCard";
import { Activity, Week } from "@/lib/types";
import { MyBooking } from "@/lib/data/my-bookings";
import { buildFamilyTiers, familyDiscountAmount } from "@/lib/family-discount";
import { updateBookingWeeksAction } from "@/app/actions/bookings";

// NOTA (limite noto, accettabile per questa funzionalità "di test"): WeekCard
// non permette di deselezionare una settimana risultata "piena" nel
// frattempo — nel raro caso in cui una settimana già prenotata da questo
// genitore risulti soldOut per esaurimento posti altrove, non sarà
// deselezionabile da qui. Va bene per verificare il flusso lato gestore.
function bookable(w: Week, selected: Set<string>): boolean {
  return w.offered !== false && (!w.soldOut || selected.has(w.id));
}

export default function ModificaPrenotazioneClient({
  booking,
  activity,
  weeks,
}: {
  booking: MyBooking;
  activity: Activity;
  weeks: Week[];
}) {
  const router = useRouter();
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(booking.weekIds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedWeeks), [selectedWeeks]);

  function toggleWeek(w: Week) {
    if (!bookable(w, selectedSet)) return;
    setSelectedWeeks((prev) =>
      prev.includes(w.id) ? prev.filter((id) => id !== w.id) : [...prev, w.id]
    );
  }

  // Stessa formula di app/booking/[id]/BookingClient.tsx (creazione), per
  // mostrare un'anteprima del nuovo totale coerente con quanto poi calcolato
  // davvero da updateBookingWeeksAction lato server.
  const nWeeks = selectedWeeks.length || 0;
  const kidsCount = Math.max(1, booking.kidNames.length);
  const perChildSubtotal = nWeeks * activity.pricePerWeek;
  const subtotal = perChildSubtotal * kidsCount;
  const multiweekPercent = activity.centerMultiweekDiscountPercent ?? 5;
  const weekDiscount = nWeeks >= 2 ? Math.round(subtotal * (multiweekPercent / 100)) : 0;
  const familyTiers = buildFamilyTiers(activity.centerFamilyDiscountTiers);
  const familyDiscount = familyDiscountAmount(perChildSubtotal, kidsCount, familyTiers);
  const groupDiscount = weekDiscount + familyDiscount;
  const shuttleCost = 0; // preview conservativa: la navetta reale dipende da booking.shuttle_included, non esposto qui
  const total = subtotal - groupDiscount + shuttleCost;

  const unchanged =
    selectedWeeks.length === booking.weekIds.length &&
    selectedWeeks.every((id) => booking.weekIds.includes(id));

  async function handleSave() {
    if (selectedWeeks.length === 0) {
      setError("Seleziona almeno una settimana");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await updateBookingWeeksAction({ bookingId: booking.id, weekIds: selectedWeeks });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/prenotazioni");
  }

  if (!booking.canCancelOrModify) {
    return (
      <div className="flex h-full min-h-screen flex-col sm:min-h-0 sm:flex-1">
        <PageHeader title="Modifica prenotazione" onBack={() => router.back()} />
        <div className="px-5 py-6">
          <div className="rounded-lg border border-orange-mid bg-orange-light p-4 text-[13px] text-ink">
            <div className="mb-1 font-bold">Non modificabile da qui</div>
            <p>
              La finestra di {booking.cancellationWindowDays} giorni di preavviso richiesta da questo
              centro è terminata{booking.daysUntilStart !== null ? ` (mancano ${booking.daysUntilStart} giorni)` : ""}.
              Contatta direttamente il centro per modificare questa prenotazione.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen flex-col sm:min-h-0 sm:flex-1">
      <PageHeader title="Modifica prenotazione" onBack={() => router.back()} />
      <div className="flex-1 overflow-y-auto px-5 py-[18px]">
        <div className="mb-1 text-base font-bold text-ink">{booking.activityName}</div>
        <p className="mb-3 text-[13px] text-ink-2">
          Cambia le settimane selezionate — funzionalità di test per verificare l&apos;effetto lato
          gestore. Puoi modificare fino a {booking.cancellationWindowDays} giorni prima dell&apos;inizio.
        </p>
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          {weeks.map((w) => (
            <WeekCard
              key={w.id}
              week={w}
              selected={selectedSet.has(w.id)}
              onToggle={() => toggleWeek(w)}
            />
          ))}
        </div>

        <div className="mt-4 rounded-md bg-bg p-3.5">
          <div className="mb-2 text-[13px] font-semibold text-ink">Nuovo totale stimato</div>
          <div className="flex items-center justify-between text-[13px] text-ink-2">
            <span>
              {nWeeks} settiman{nWeeks === 1 ? "a" : "e"} × €{activity.pricePerWeek} × {kidsCount} bambin
              {kidsCount === 1 ? "o" : "i"}
            </span>
            <span>€{subtotal}</span>
          </div>
          {groupDiscount > 0 && (
            <div className="flex items-center justify-between text-[13px] text-green">
              <span>Sconti</span>
              <span>-€{groupDiscount}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-[#E8EBF0] pt-2 text-sm font-bold text-ink">
            <span>Totale</span>
            <span>€{total}</span>
          </div>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-orange">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={submitting || unchanged || selectedWeeks.length === 0}
          className="mt-4 w-full rounded-md bg-sky px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Salvataggio…" : "Salva modifiche"}
        </button>
      </div>
    </div>
  );
}
