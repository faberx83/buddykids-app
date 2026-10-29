"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PartnerSheet from "@/components/center/PartnerSheet";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import {
  cancelBookingDayAction,
  markBookingsReadAction,
  promoteWaitlistedDayAction,
  respondToBookingAction,
  respondToBookingDaysAction,
} from "@/app/actions/booking-response";
import type { CenterBooking } from "@/lib/data/center-bookings";
import { bookingNeedsAction } from "@/lib/booking-response/effective-decision";
import { DAY_DECISION, bookingStatus, chosenServices, dayBulkSummary, relativeTime, spotsLabel } from "@/lib/centers/partner-inbox";

// TRAMA — PORTALE CENTRI V2, RICHIESTA APERTA (29/10/2026, tavola 5).
// Il foglio di una prenotazione: giorni con i posti, Accetta / Rifiuta sui
// giorni scelti, lista d'attesa ("Dai il posto"), annullare un giorno già
// accettato, proposta alternativa per le prenotazioni a settimane; servizi
// scelti e importo; la conversazione con la famiglia, se c'è. Le azioni sono
// quelle di sempre (app/actions/booking-response.ts), come in
// app/center/prenotazioni/PrenotazioniClient.tsx.

const TONE: Record<string, string> = {
  todo: "bg-[#FFF3DC] text-[#7A4F00]",
  done: "bg-[#E6F6F0] text-[#146B4F]",
  waiting: "bg-partner-soft text-partner-primary",
  closed: "bg-[#EEF2F1] text-ink-2",
};

const SPOTS_TONE: Record<string, string> = {
  ok: "text-ink-2",
  few: "text-[#7A4F00] font-semibold",
  full: "text-[#B4361F] font-semibold",
  unknown: "text-ink-2",
};

const longDay = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
    .replace(/\./g, "");

const euro = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2)}`;

export default function BookingSheet({
  booking,
  conversationHref,
  onClose,
  onChange,
}: {
  booking: CenterBooking | null;
  /** La conversazione con la stessa famiglia sulla stessa attività, se esiste. */
  conversationHref: string | null;
  onClose: () => void;
  onChange: (next: CenterBooking) => void;
}) {
  const toast = useNextgenToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposal, setProposal] = useState("");
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const pendingDayIds = useMemo(
    () => (booking?.days ?? []).filter((d) => d.partnerDecision === "pending").map((d) => d.activityDayId),
    [booking]
  );

  // Aprendo un'altra richiesta: tutti i giorni da rispondere già scelti; segna come letta.
  useEffect(() => {
    if (!booking) return;
    setSelected(new Set(pendingDayIds));
    setError(null);
    setProposalOpen(false);
    setProposal("");
    setConfirmCancel(null);
    if (!booking.readByCenter) {
      void markBookingsReadAction({ ids: [booking.id], side: "center", read: true }).catch(() => undefined);
      onChange({ ...booking, readByCenter: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo quando si apre un'altra richiesta
  }, [booking?.id]);

  if (!booking) return null;
  const b = booking;
  const status = bookingStatus(b);
  const open = b.status !== "cancelled";
  const needs = open && bookingNeedsAction(b);
  const services = chosenServices(b);

  function patchDays(results: Record<string, string>) {
    onChange({
      ...b,
      readByCenter: true,
      days: b.days.map((d) => {
        const outcome = results[d.activityDayId];
        return outcome === "accepted" || outcome === "rejected" || outcome === "waitlisted" ? { ...d, partnerDecision: outcome } : d;
      }),
    });
  }

  async function respondDays(decision: "accepted" | "rejected") {
    const ids = Array.from(selected).filter((id) => pendingDayIds.includes(id));
    if (ids.length === 0) return setError("Scegliete almeno un giorno.");
    setError(null);
    setBusy(decision);
    const r = await respondToBookingDaysAction({ bookingId: b.id, activityDayIds: ids, decision }).catch(() => null);
    setBusy(null);
    if (!r || r.error) return setError("Non siamo riusciti a salvare la risposta, riprovate.");
    patchDays(r.results as Record<string, string>);
    toast(dayBulkSummary(r) || "Risposta inviata");
  }

  async function respondWhole(decision: "accepted" | "rejected") {
    setError(null);
    setBusy(decision);
    const r = await respondToBookingAction({ bookingId: b.id, decision }).catch(() => ({ error: "x" }));
    setBusy(null);
    if (r.error) return setError("Non siamo riusciti a salvare la risposta, riprovate.");
    onChange({
      ...b,
      partnerDecision: decision,
      status: decision === "accepted" ? "confirmed" : "cancelled",
      cancelledBy: decision === "rejected" ? "center" : null,
      readByCenter: true,
    });
    toast(decision === "accepted" ? "Prenotazione accettata: la famiglia riceve una notifica" : "Prenotazione rifiutata");
  }

  async function sendProposal() {
    const note = proposal.trim();
    if (!note) return setError("Scrivete cosa proponete alla famiglia.");
    setError(null);
    setBusy("proposal");
    const r = await respondToBookingAction({ bookingId: b.id, decision: "proposed", proposalNote: note }).catch(() => ({ error: "x" }));
    setBusy(null);
    if (r.error) return setError("Non siamo riusciti a inviare la proposta, riprovate.");
    onChange({ ...b, partnerDecision: "proposed", partnerProposalNote: note, readByCenter: true });
    setProposalOpen(false);
    toast("Proposta inviata alla famiglia");
  }

  async function promote(dayId: string) {
    setError(null);
    setBusy(`promote:${dayId}`);
    const r = await promoteWaitlistedDayAction({ bookingId: b.id, activityDayId: dayId }).catch(() => ({ error: "x" }));
    setBusy(null);
    if (r.error) return setError("Non c'è ancora un posto libero per quel giorno.");
    patchDays({ [dayId]: "accepted" });
    toast("Posto dato: la famiglia riceve una notifica");
  }

  async function cancelDay(dayId: string) {
    setError(null);
    setBusy(`cancel:${dayId}`);
    const r = await cancelBookingDayAction({ bookingId: b.id, activityDayId: dayId, cancelledBy: "center" }).catch(() => ({ error: "x" }));
    setBusy(null);
    setConfirmCancel(null);
    if (r.error) return setError("Non siamo riusciti ad annullare il giorno, riprovate.");
    const days = b.days.filter((d) => d.activityDayId !== dayId);
    const removed = b.days.find((d) => d.activityDayId === dayId);
    onChange({
      ...b,
      days,
      totalAmount: Math.max(0, b.totalAmount - (removed?.price ?? 0)),
      ...(days.length === 0 ? { status: "cancelled" as const, cancelledBy: "center" as const } : {}),
    });
    toast("Giorno annullato");
  }

  const pendingSelected = Array.from(selected).filter((id) => pendingDayIds.includes(id)).length;
  const allPendingSelected = pendingDayIds.length > 0 && pendingSelected === pendingDayIds.length;

  const footer = !needs ? null : b.isDayBased ? (
    pendingDayIds.length > 0 ? (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void respondDays("accepted")}
            disabled={busy !== null || pendingSelected === 0}
            className="min-h-[48px] flex-1 rounded-xl bg-partner-primary px-4 text-[15px] font-semibold text-white hover:bg-partner-primary-press disabled:bg-[#B9C6C2]"
          >
            {busy === "accepted" ? "Invio…" : `Accetta ${pendingSelected === 1 ? "1 giorno" : `${pendingSelected} giorni`}`}
          </button>
          <button
            type="button"
            onClick={() => void respondDays("rejected")}
            disabled={busy !== null || pendingSelected === 0}
            className="min-h-[48px] rounded-xl border border-partner-line bg-white px-4 text-[15px] font-semibold text-[#B4361F] hover:bg-[#FFF4F1] disabled:opacity-50"
          >
            {busy === "rejected" ? "…" : "Rifiuta"}
          </button>
        </div>
        <span className="text-center text-[12.5px] text-ink-2">Se un giorno è pieno, la richiesta passa in lista d&apos;attesa.</span>
      </div>
    ) : null
  ) : (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void respondWhole("accepted")}
          disabled={busy !== null}
          className="min-h-[48px] flex-1 rounded-xl bg-partner-primary px-4 text-[15px] font-semibold text-white hover:bg-partner-primary-press disabled:bg-[#B9C6C2]"
        >
          {busy === "accepted" ? "Invio…" : "Accetta"}
        </button>
        <button
          type="button"
          onClick={() => void respondWhole("rejected")}
          disabled={busy !== null}
          className="min-h-[48px] rounded-xl border border-partner-line bg-white px-4 text-[15px] font-semibold text-[#B4361F] hover:bg-[#FFF4F1] disabled:opacity-50"
        >
          {busy === "rejected" ? "…" : "Rifiuta"}
        </button>
      </div>
      {!proposalOpen && (
        <button
          type="button"
          onClick={() => setProposalOpen(true)}
          className="min-h-[40px] text-[14px] font-semibold text-partner-accent-ink"
        >
          Proponi un&apos;alternativa
        </button>
      )}
    </div>
  );

  return (
    <PartnerSheet
      open
      onClose={onClose}
      title={b.kidNames.length > 0 ? b.kidNames.join(", ") : "Prenotazione"}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{b.activityName}</span>
          <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${TONE[status.tone]}`}>{status.label}</span>
        </span>
      }
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        {/* Famiglia */}
        <section aria-label="Famiglia" className="flex items-center gap-3 rounded-2xl bg-partner-page px-3.5 py-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-partner-primary">
            <i className="ti ti-users text-[19px]" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14.5px] font-semibold text-ink">{b.parentName || "Famiglia"}</span>
            <span className="text-[12.5px] text-ink-2">Richiesta {relativeTime(b.createdAt)}</span>
          </span>
          {conversationHref ? (
            <Link href={conversationHref} className="flex min-h-[40px] items-center gap-1 rounded-xl border border-partner-line bg-white px-3 text-[13px] font-semibold text-partner-primary">
              <i className="ti ti-message-circle text-[16px]" aria-hidden="true" />
              Messaggi
            </Link>
          ) : b.parentEmail ? (
            <a href={`mailto:${b.parentEmail}`} className="flex min-h-[40px] items-center gap-1 rounded-xl border border-partner-line bg-white px-3 text-[13px] font-semibold text-partner-primary">
              <i className="ti ti-mail text-[16px]" aria-hidden="true" />
              Scrivi
            </a>
          ) : null}
        </section>

        {b.partnerDecision === "proposed" && b.partnerProposalNote && (
          <section className="flex flex-col gap-1 rounded-2xl border border-partner-line px-4 py-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-2">La vostra proposta</span>
            <p className="text-[14px] text-ink">“{b.partnerProposalNote}”</p>
            <span className="text-[12.5px] text-ink-2">Aspettiamo la risposta della famiglia.</span>
          </section>
        )}

        {/* Giorni o settimane */}
        {b.isDayBased ? (
          <section aria-labelledby="bs-days" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="bs-days" className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
                Giorni richiesti
              </h3>
              {needs && pendingDayIds.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelected(allPendingSelected ? new Set() : new Set(pendingDayIds))}
                  className="min-h-[36px] text-[13px] font-semibold text-partner-accent-ink"
                >
                  {allPendingSelected ? "Togli tutti" : "Scegli tutti"}
                </button>
              )}
            </div>
            <ul className="overflow-hidden rounded-2xl border border-partner-line">
              {[...b.days]
                .sort((x, y) => x.date.localeCompare(y.date))
                .map((d, i) => {
                  const dec = DAY_DECISION[d.partnerDecision];
                  const spots = spotsLabel(d.spotsLeft, d.capacity);
                  const pending = d.partnerDecision === "pending";
                  const checkboxId = `bs-day-${d.activityDayId}`;
                  return (
                    <li key={d.activityDayId} className={`flex flex-col gap-2 px-3.5 py-3 ${i > 0 ? "border-t border-[#EEF2F1]" : ""}`}>
                      <div className="flex items-center gap-3">
                        {pending && open ? (
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={selected.has(d.activityDayId)}
                            onChange={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(d.activityDayId)) next.delete(d.activityDayId);
                                else next.add(d.activityDayId);
                                return next;
                              })
                            }
                            className="h-5 w-5 flex-shrink-0 accent-[#0E5A63]"
                          />
                        ) : (
                          <span className="w-5 flex-shrink-0" aria-hidden="true" />
                        )}
                        <label htmlFor={pending && open ? checkboxId : undefined} className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[15px] font-semibold capitalize text-ink">{longDay(d.date)}</span>
                          <span className="text-[12.5px] text-ink-2">
                            {euro(d.price)} · <span className={SPOTS_TONE[spots.tone]}>{spots.text}</span>
                          </span>
                        </label>
                        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${TONE[dec.tone]}`}>{dec.label}</span>
                      </div>
                      {open && d.partnerDecision === "waitlisted" && (
                        <button
                          type="button"
                          onClick={() => void promote(d.activityDayId)}
                          disabled={busy !== null}
                          className="ml-8 self-start rounded-xl border border-partner-line px-3 py-1.5 text-[13px] font-semibold text-partner-primary disabled:opacity-50"
                        >
                          {busy === `promote:${d.activityDayId}` ? "…" : "Si è liberato un posto: dallo a loro"}
                        </button>
                      )}
                      {open && d.partnerDecision === "accepted" && (
                        confirmCancel === d.activityDayId ? (
                          <div className="ml-8 flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="text-ink">Annullare questo giorno? La famiglia viene avvisata.</span>
                            <button
                              type="button"
                              onClick={() => void cancelDay(d.activityDayId)}
                              disabled={busy !== null}
                              className="rounded-lg bg-[#B4361F] px-2.5 py-1 font-semibold text-white disabled:opacity-50"
                            >
                              {busy === `cancel:${d.activityDayId}` ? "…" : "Sì, annulla"}
                            </button>
                            <button type="button" onClick={() => setConfirmCancel(null)} className="px-1.5 py-1 font-semibold text-ink-2">
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmCancel(d.activityDayId)}
                            className="ml-8 self-start text-[12.5px] font-semibold text-ink-2 underline-offset-2 hover:underline"
                          >
                            Annulla questo giorno
                          </button>
                        )
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ) : (
          b.weeks.length > 0 && (
            <section aria-labelledby="bs-weeks" className="flex flex-col gap-2">
              <h3 id="bs-weeks" className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
                Settimane richieste
              </h3>
              <ul className="overflow-hidden rounded-2xl border border-partner-line">
                {b.weeks.map((w, i) => {
                  const spots = spotsLabel(w.spotsLeft, w.capacity);
                  return (
                    <li key={w.weekId} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-[#EEF2F1]" : ""}`}>
                      <span className="text-[15px] font-semibold text-ink">Settimana dal {longDay(w.startDate)}</span>
                      <span className={`text-[12.5px] ${SPOTS_TONE[spots.tone]}`}>{spots.text}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )
        )}

        {proposalOpen && (
          <section className="flex flex-col gap-2">
            <label htmlFor="bs-proposal" className="text-[13px] font-semibold text-ink">
              Cosa proponete alla famiglia?
            </label>
            <textarea
              id="bs-proposal"
              rows={3}
              value={proposal}
              onChange={(e) => setProposal(e.target.value)}
              placeholder="Es. Quella settimana è piena: possiamo offrirvi quella dopo, alle stesse condizioni."
              className="w-full rounded-xl border border-partner-line px-3.5 py-2.5 text-[15px] outline-none focus:border-partner-primary"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void sendProposal()}
                disabled={busy !== null}
                className="min-h-[44px] rounded-xl bg-partner-primary px-4 text-[14px] font-semibold text-white disabled:bg-[#B9C6C2]"
              >
                {busy === "proposal" ? "Invio…" : "Invia la proposta"}
              </button>
              <button type="button" onClick={() => setProposalOpen(false)} className="min-h-[44px] px-3 text-[14px] font-semibold text-ink-2">
                Annulla
              </button>
            </div>
          </section>
        )}

        {/* Servizi e importo */}
        <section aria-labelledby="bs-total" className="flex flex-col gap-2">
          <h3 id="bs-total" className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
            Servizi e importo
          </h3>
          <div className="flex flex-col gap-1.5 rounded-2xl border border-partner-line px-4 py-3 text-[14px]">
            <span className="text-ink">{services.length > 0 ? services.join(" · ") : "Nessun servizio extra"}</span>
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-ink-2">Totale{b.discountAmount > 0 ? ` (sconto ${euro(b.discountAmount)})` : ""}</span>
              <span className="font-poppins text-[17px] font-semibold text-ink">{euro(b.totalAmount)}</span>
            </span>
            <span className="text-[12.5px] text-ink-2">Nel pilota la famiglia paga direttamente al centro.</span>
          </div>
        </section>

        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[#B9C6C2] px-4 py-3">
          <span className="flex-1 text-[13px] text-ink-2">Note della famiglia per il centro (allergie, esigenze)</span>
          <span className="rounded-full border border-dashed border-[#B9C6C2] px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">In programma</span>
        </div>

        {error && (
          <p role="alert" className="text-[13.5px] font-medium text-[#B4361F]">
            {error}
          </p>
        )}
      </div>
    </PartnerSheet>
  );
}
