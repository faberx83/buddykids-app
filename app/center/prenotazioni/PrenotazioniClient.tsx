"use client";

import { useMemo, useState } from "react";
import { CenterBooking, BookingStatus, PartnerDecision } from "@/lib/data/center-bookings";
import {
  respondToBookingAction,
  respondToBookingDayAction,
  cancelBookingDayAction,
  markBookingsReadAction,
} from "@/app/actions/booking-response";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Stesso principio di STATUS_LABEL in RichiesteClient.tsx, qui su
// partner_decision invece di status (l'asse rilevante per il centro: cosa
// deve ancora fare/ha fatto rispetto alla RISPOSTA, non lo stato finale
// della prenotazione).
const DECISION_LABEL: Record<PartnerDecision, { label: string; cls: string }> = {
  pending: { label: "Da rispondere", cls: "bg-orange-light text-trama-orange" },
  accepted: { label: "Accettata", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Rifiutata", cls: "bg-bg text-ink-3" },
  proposed: { label: "Proposta inviata", cls: "bg-sky-light text-sky" },
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "In attesa",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

const MONTH_LABELS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_LABELS_IT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Raggruppamento per mese — stessa logica di RichiesteClient.tsx /
// AttendanceClient.tsx (segnalazione ricorrente di Fabrizio su ogni lista
// cronologica di questa sezione).
function useMonthBuckets(items: CenterBooking[]) {
  return useMemo(() => {
    const buckets = new Map<string, { label: string; items: CenterBooking[] }>();
    for (const b of items) {
      const key = b.createdAt.slice(0, 7);
      if (!buckets.has(key)) buckets.set(key, { label: monthLabel(b.createdAt), items: [] });
      buckets.get(key)!.items.push(b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => v);
  }, [items]);
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export default function PrenotazioniClient({
  initialBookings,
}: {
  initialBookings: CenterBooking[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [proposalDrafts, setProposalDrafts] = useState<Record<string, string>>({});
  const [proposalOpenFor, setProposalOpenFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function patchBooking(id: string, patch: Partial<CenterBooking>) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function patchDay(bookingId: string, activityDayId: string, patch: Partial<CenterBooking["days"][number]>) {
    setBookings((prev) =>
      prev.map((b) =>
        b.id !== bookingId
          ? b
          : { ...b, days: b.days.map((d) => (d.activityDayId === activityDayId ? { ...d, ...patch } : d)) }
      )
    );
  }

  async function respond(bookingId: string, decision: "accepted" | "rejected") {
    setErrorId(null);
    setBusyId(bookingId);
    const result = await respondToBookingAction({ bookingId, decision });
    setBusyId(null);
    if (result.error) {
      setErrorId(bookingId);
      return;
    }
    patchBooking(bookingId, {
      partnerDecision: decision,
      status: decision === "accepted" ? "confirmed" : "cancelled",
      readByCenter: true,
      cancelledBy: decision === "rejected" ? "center" : null,
    });
  }

  async function sendProposal(bookingId: string) {
    const note = (proposalDrafts[bookingId] ?? "").trim();
    if (!note) {
      setErrorId(bookingId);
      return;
    }
    setErrorId(null);
    setBusyId(bookingId);
    const result = await respondToBookingAction({ bookingId, decision: "proposed", proposalNote: note });
    setBusyId(null);
    if (result.error) {
      setErrorId(bookingId);
      return;
    }
    patchBooking(bookingId, { partnerDecision: "proposed", partnerProposalNote: note, readByCenter: true });
    setProposalOpenFor(null);
  }

  async function respondDay(bookingId: string, activityDayId: string, decision: "accepted" | "rejected") {
    const busyKey = `${bookingId}:${activityDayId}`;
    setErrorId(null);
    setBusyId(busyKey);
    const result = await respondToBookingDayAction({ bookingId, activityDayId, decision });
    setBusyId(null);
    if (result.error) {
      setErrorId(busyKey);
      return;
    }
    patchDay(bookingId, activityDayId, { partnerDecision: decision });
    patchBooking(bookingId, { readByCenter: true });
  }

  async function cancelDay(bookingId: string, activityDayId: string) {
    const busyKey = `cancel:${bookingId}:${activityDayId}`;
    setBusyId(busyKey);
    const result = await cancelBookingDayAction({ bookingId, activityDayId, cancelledBy: "center" });
    setBusyId(null);
    if (result.error) {
      setErrorId(busyKey);
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id !== bookingId ? b : { ...b, days: b.days.filter((d) => d.activityDayId !== activityDayId) }
      )
    );
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === bookings.length ? new Set() : new Set(bookings.map((b) => b.id))));
  }

  async function markSelected(read: boolean) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const result = await markBookingsReadAction({ ids, side: "center", read });
    setBulkBusy(false);
    if (result.error) return;
    setBookings((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, readByCenter: read } : b)));
    setSelected(new Set());
  }

  const pending = bookings.filter((b) => b.status !== "cancelled" && b.partnerDecision === "pending");
  const decided = bookings.filter((b) => !(b.status !== "cancelled" && b.partnerDecision === "pending"));
  const allSelected = bookings.length > 0 && selected.size === bookings.length;
  const pendingBuckets = useMonthBuckets(pending);
  const decidedBuckets = useMonthBuckets(decided);

  function renderBooking(b: CenterBooking) {
    const busyKey = busyId === b.id;
    return (
      <div key={b.id} data-testid="booking-row" className="flex gap-2.5 px-4 py-3.5">
        <input
          type="checkbox"
          checked={selected.has(b.id)}
          onChange={() => toggleOne(b.id)}
          className="mt-0.5 h-4 w-4 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {!b.readByCenter && (
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#FF6B6B]" aria-label="Non letta" />
              )}
              {b.activityName}
            </div>
            <div className="flex gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${DECISION_LABEL[b.partnerDecision].cls}`}>
                {DECISION_LABEL[b.partnerDecision].label}
              </span>
            </div>
          </div>
          <div className="mb-2 text-xs text-ink-2">
            {b.parentName}
            {b.parentEmail ? ` · ${b.parentEmail}` : ""}
            {b.kidNames.length > 0 ? ` · ${b.kidNames.join(", ")}` : ""}
          </div>

          {b.isDayBased ? (
            <div className="mb-2.5 space-y-1.5">
              {b.days.map((d) => {
                const dayBusyKey = `${b.id}:${d.activityDayId}`;
                return (
                  <div
                    key={d.activityDayId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-bg p-2.5 text-xs"
                  >
                    <span className="font-medium text-ink">
                      {formatDate(d.date)} · €{d.price}
                    </span>
                    {d.partnerDecision === "pending" ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => respondDay(b.id, d.activityDayId, "accepted")}
                          disabled={busyId === dayBusyKey}
                          className="rounded-md bg-partner px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                        >
                          Accetta
                        </button>
                        <button
                          onClick={() => respondDay(b.id, d.activityDayId, "rejected")}
                          disabled={busyId === dayBusyKey}
                          className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
                        >
                          Rifiuta
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                            d.partnerDecision === "accepted"
                              ? "bg-green-light text-[#2d8f52]"
                              : "bg-white text-ink-3"
                          }`}
                        >
                          {d.partnerDecision === "accepted" ? "Accettato" : "Rifiutato"}
                        </span>
                        <button
                          onClick={() => cancelDay(b.id, d.activityDayId)}
                          disabled={busyId === `cancel:${b.id}:${d.activityDayId}`}
                          className="text-[11px] font-semibold text-ink-3 underline disabled:opacity-60"
                        >
                          Rimuovi giorno
                        </button>
                      </div>
                    )}
                    {errorId === dayBusyKey && (
                      <p className="w-full text-[11px] font-medium text-orange">Errore, riprova.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mb-2.5 rounded-md bg-bg p-2.5 text-xs text-ink">
              {b.weeks.length} settiman{b.weeks.length === 1 ? "a" : "e"} · Totale €{b.totalAmount}
              {b.shuttleIncluded ? " · con navetta" : ""}
            </div>
          )}

          <div className="mb-1 text-[11px] text-ink-3">
            Stato prenotazione: {STATUS_LABEL[b.status]}
          </div>

          {b.partnerDecision === "proposed" && b.partnerProposalNote && (
            <div className="mb-2 rounded-md bg-sky-light p-2.5 text-xs text-ink">
              <div className="mb-0.5 font-semibold text-sky">La tua proposta</div>
              {b.partnerProposalNote}
            </div>
          )}

          {!b.isDayBased && b.partnerDecision === "pending" && b.status !== "cancelled" && (
            <div>
              {proposalOpenFor === b.id ? (
                <div className="mb-2">
                  <textarea
                    value={proposalDrafts[b.id] ?? ""}
                    onChange={(e) => setProposalDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                    rows={2}
                    placeholder="Es. proponi altre settimane disponibili…"
                    className="mb-2 w-full resize-none rounded-md border border-[#E8EBF0] px-3 py-2 text-sm outline-none focus:border-sky"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendProposal(b.id)}
                      disabled={busyKey}
                      className="rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {busyKey ? "Invio…" : "Invia proposta"}
                    </button>
                    <button
                      onClick={() => setProposalOpenFor(null)}
                      className="rounded-md bg-white px-3.5 py-2 text-xs font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => respond(b.id, "accepted")}
                    disabled={busyKey}
                    className="rounded-md bg-partner px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {busyKey ? "…" : "Accetta"}
                  </button>
                  <button
                    onClick={() => respond(b.id, "rejected")}
                    disabled={busyKey}
                    className="rounded-md bg-white px-3.5 py-2 text-xs font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
                  >
                    Rifiuta
                  </button>
                  <button
                    onClick={() => setProposalOpenFor(b.id)}
                    className="rounded-md bg-white px-3.5 py-2 text-xs font-bold text-sky shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  >
                    Proponi alternativa
                  </button>
                </div>
              )}
              {errorId === b.id && (
                <p className="mt-2 text-xs font-medium text-orange">Errore — riprova.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Prenotazioni</h1>
        <p className="text-sm text-ink-2">
          Rispondi alle prenotazioni ricevute: accetta, rifiuta o proponi un&apos;alternativa. Per le
          prenotazioni a Giorni spot puoi rispondere singolo giorno per giorno.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai le prenotazioni reali una volta
          collegato.
        </div>
      )}

      {bookings.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
            Seleziona tutte
          </label>
          {selected.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => markSelected(true)}
                disabled={bulkBusy}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
              >
                Segna come lette
              </button>
              <button
                onClick={() => markSelected(false)}
                disabled={bulkBusy}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
              >
                Segna come da leggere
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Da rispondere ({pending.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {pendingBuckets.map((bucket) => (
            <div key={bucket.label}>
              <div className="bg-bg px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
                {bucket.label}
              </div>
              {bucket.items.map(renderBooking)}
            </div>
          ))}
          {pending.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">
              Nessuna prenotazione in attesa di risposta.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Storico ({decided.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {decidedBuckets.map((bucket) => (
            <div key={bucket.label}>
              <div className="bg-bg px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
                {bucket.label}
              </div>
              {bucket.items.map(renderBooking)}
            </div>
          ))}
          {decided.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">
              Ancora nessuna prenotazione gestita.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
