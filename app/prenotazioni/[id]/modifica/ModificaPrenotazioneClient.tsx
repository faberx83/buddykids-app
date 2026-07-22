"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import WeekCard from "@/components/WeekCard";
import { Activity, Week } from "@/lib/types";
import { MyBooking } from "@/lib/data/my-bookings";
import { buildFamilyTiers, familyDiscountAmount } from "@/lib/family-discount";
import { updateBookingWeeksAction, cancelBookingAction } from "@/app/actions/bookings";
import { shortWeekLabel, formatShortRange } from "@/lib/season-weeks";

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
  // SPRINT (feedback Fabrizio: "nella 'modifica prenotazione' deve esserci
  // la possibilità di annullare") — pop-up di conferma aperto dal pulsante
  // esplicito "Annulla prenotazione" (unico modo per annullare da qui,
  // "Salva modifiche" resta a fare solo il suo mestiere, vedi sotto).
  // cancelBookingAction ri-verifica la finestra di preavviso lato server
  // (stessa funzione già usata in "Le mie prenotazioni"): se nel frattempo
  // la finestra si è chiusa, l'errore restituito è il messaggio "non puoi
  // più annullare" mostrato dentro lo stesso pop-up invece di un caso
  // separato.
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  // Le settimane davvero prenotate ORA (non quelle selezionate in questo
  // form, che potrebbero essere state cambiate senza ancora salvare): sono
  // quelle che cancelBookingAction annulla per davvero — riferimento
  // mostrato nel pop-up di conferma (feedback Fabrizio: "nel pop-up 'Vuoi
  // annullare la prenotazione' deve essere indicata la settimana di
  // riferimento").
  // BUG TROVATO (Sprint 4 gate, TC-293): prima incrociava booking.weekIds
  // con `weeks` (le settimane "offerte ORA" per il picker di nuove
  // settimane, che escludono deliberatamente quelle già concluse — vedi
  // dropPastWeeks in lib/data/weeks.ts). Per una prenotazione il cui
  // settimana prenotata è nel frattempo passata (fuori dalla finestra di
  // preavviso, quindi già non più annullabile in autonomia — vedi
  // canCancelOrModify in lib/data/my-bookings.ts), quella settimana non
  // compare più in `weeks`: l'incrocio non trovava mai nulla e il pop-up
  // mostrava "nessuna settimana" invece della settimana vera. `booking.weeks`
  // (da getMyBookingsForParent, lib/data/my-bookings.ts) ha già le settimane
  // REALMENTE prenotate con le loro date, indipendentemente da cosa sia
  // "offerto" oggi per nuove prenotazioni — è la fonte corretta qui.
  const bookedWeeksLabel = booking.weeks
    .map(
      (w) =>
        `${formatShortRange(new Date(w.startDate + "T00:00:00Z"), new Date(w.endDate + "T00:00:00Z"))} (${shortWeekLabel(w.label)})`
    )
    .join(", ");

  const expiredWindowMessage = `La finestra di ${booking.cancellationWindowDays} giorni di preavviso richiesta da questo centro è terminata${
    booking.daysUntilStart !== null ? ` (mancano ${booking.daysUntilStart} giorni)` : ""
  }. Contatta direttamente il centro per annullare questa prenotazione.`;

  async function handleSave() {
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

  // Feedback Fabrizio: "'Annulla prenotazione' deve essere cliccabile solo
  // se c'è una prenotazione e ci sono i tempi tecnici per farlo. Se è
  // 'disabilitato' al click deve esserci un pop-up che dica qualcosa
  // riguardo ai tempi scaduti" — booking.canCancelOrModify è già la stessa
  // condizione che decide se questa pagina è raggiungibile (vedi guard più
  // sotto), quindi qui è una verifica difensiva in più contro l'eventualità
  // che la finestra si chiuda proprio mentre il genitore ha la pagina
  // aperta (race condition tra il caricamento e il click): in quel caso
  // mostriamo subito il messaggio "tempi scaduti", senza nemmeno provare la
  // chiamata al server.
  function openCancelPopup() {
    setCancelError(booking.canCancelOrModify ? null : expiredWindowMessage);
    setShowCancelConfirm(true);
  }

  async function handleConfirmCancel() {
    setCancelling(true);
    setCancelError(null);
    const result = await cancelBookingAction(booking.id);
    setCancelling(false);
    if (result.error) {
      // Il centro potrebbe aver chiuso la finestra di preavviso nel
      // frattempo (o qualunque altro motivo di rifiuto lato server): questo
      // è esattamente il caso "non puoi più annullare", mostrato qui invece
      // che come stato separato.
      setCancelError(result.error);
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

        {/* "Salva modifiche" fa solo il suo mestiere: salva il cambio di
            settimane. Niente più doppio significato con l'annullamento
            (feedback Fabrizio: "è ridondante 'salva modifiche (annulla
            prenotazione)' e 'annulla prenotazione'") — deselezionare tutte le
            settimane disabilita semplicemente questo pulsante, l'unico modo
            per annullare resta il pulsante esplicito sotto. */}
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting || unchanged || selectedWeeks.length === 0}
          className="mt-4 w-full rounded-md bg-sky px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Salvataggio…" : "Salva modifiche"}
        </button>

        {/* Unico modo per annullare da questa pagina. openCancelPopup fa una
            verifica difensiva su booking.canCancelOrModify (vedi sopra) prima
            di aprire il pop-up di conferma vero e proprio. */}
        <button type="button" onClick={openCancelPopup} className="mt-2.5 w-full rounded-md border border-[#E8EBF0] px-4 py-2.5 text-[13px] font-semibold text-orange">
          Annulla prenotazione
        </button>
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <div className="mb-1 text-[15px] font-bold text-ink">
              {cancelError ? "Non puoi più annullare" : "Vuoi annullare la prenotazione?"}
            </div>
            <p className="mb-3 text-[13px] text-ink-2">
              {cancelError ??
                `Stai per annullare "${booking.activityName}"${
                  booking.kidNames.length > 0 ? ` per ${booking.kidNames.join(", ")}` : ""
                } — ${bookedWeeksLabel || "nessuna settimana"}. L'operazione non si può annullare.`}
            </p>
            <div className="flex gap-2">
              {cancelError ? (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-md bg-bg py-2.5 text-center text-[13px] font-semibold text-ink-2"
                >
                  Chiudi
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 rounded-md bg-bg py-2.5 text-center text-[13px] font-semibold text-ink-2 disabled:opacity-50"
                  >
                    No, mantieni
                  </button>
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleConfirmCancel}
                    className="flex-1 rounded-md bg-orange py-2.5 text-center text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    {cancelling ? "Annullo…" : "Sì, annulla"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
