"use client";

import Link from "next/link";
import { MyBooking, BookingStatus } from "@/lib/data/my-bookings";

// SPRINT CORRETTIVO (NEXTGEN) — "Le prenotazioni devono diventare più
// visuali. Ridurre il testo. Badge, icone, informazioni sintetiche"
// (richiesta di Fabrizio). Sostituisce le righe di solo testo usate finora
// in Home (link semplice con nome attività + prezzo) con una card che mostra
// SOLO: attività, figlio, periodo, stato, un'azione principale — il resto
// (prezzo, sconto, data creazione) resta nella pagina di dettaglio, non qui.
const STATUS_BADGE: Record<BookingStatus, { label: string; cls: string }> = {
  confirmed: { label: "Confermata", cls: "bg-green/15 text-[#1f7a3d]" },
  pending: { label: "In attesa", cls: "bg-orange/15 text-[#a8501f]" },
  cancelled: { label: "Annullata", cls: "bg-ink/10 text-ink-3" },
};

export default function BookingVisualCard({
  booking,
  compact = false,
}: {
  booking: MyBooking;
  compact?: boolean;
}) {
  const badge = STATUS_BADGE[booking.status];

  return (
    <Link
      href={`/activity/${booking.activityId}`}
      className="nextgen-hero-shadow flex items-center gap-3 rounded-2xl border border-[#F0F2F5] bg-white p-3.5 transition-transform hover:scale-[0.99]"
    >
      <div
        className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cover bg-center text-xl ${
          compact ? "h-11 w-11" : "h-14 w-14"
        }`}
        style={booking.coverImageUrl ? { backgroundImage: `url(${booking.coverImageUrl})` } : { background: booking.imgGradient }}
      >
        {!booking.coverImageUrl && booking.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-bold text-ink">{booking.activityName}</div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-ink-2">
          <i className="ti ti-users text-[13px] text-ink-3" />
          {booking.kidNames.join(", ") || "—"}
          <span className="text-ink-3">·</span>
          <i className="ti ti-calendar text-[13px] text-ink-3" />
          {booking.firstWeekLabel ?? "—"}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
        <i className="ti ti-chevron-right text-base text-ink-3" />
      </div>
    </Link>
  );
}
