"use client";

// TRAMA — PRENOTAZIONI V2 (14/10/2026, tavole "TRAMA Scopri e Prenotazioni
// V2", 3 e 4). Montata da app/nextgen/prenotazioni/page.tsx SOLO con
// BOOKINGS_V2_ENABLED acceso; altrimenti resta PrenotazioniClient (LEGACY
// condiviso), invariato.
//   Elenco: riga di riepilogo, In arrivo | Passate, "Da sistemare" (stesse
//   parole del "Da fare" in Home), prenotazioni per mese con data, stato,
//   figli e prezzo. La copertura delle settimane sta nel Planner (rimando).
//   Prenotazione aperta: stato spiegato, riepilogo, chi accompagna, una
//   azione principale (Scrivi al centro), Modifica, Scheda attività,
//   Annulla con il suo termine.
// Riusa: cancelBookingAction, ContactCenterButton, le pagine esistenti di
// modifica e scheda attività.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MyBooking } from "@/lib/data/my-bookings";
import {
  bookingChip,
  bookingSpan,
  bookingStatusExplainer,
  bookingsSummaryLine,
  bookingsToFix,
  bookingWhen,
  dateTile,
  futureBookings,
  groupByMonth,
  netPrice,
  splitBookings,
  type BookingTone,
} from "@/lib/nextgen/bookings-v2";
import { parseHoursRange } from "@/lib/nextgen/today-agenda";
import { mondayOfIso } from "@/lib/nextgen/planner-week";
import { cancelBookingAction } from "@/app/actions/bookings";
import ContactCenterButton from "@/components/ContactCenterButton";
import { KidAvatar, kidToneFor } from "@/components/nextgen/AgendaItemRow";
import TramaThread from "@/components/nextgen/TramaThread";

const TONE: Record<BookingTone, string> = {
  green: "bg-[#E6F6F0] text-[#146B4F]",
  amber: "bg-[#FFF4E0] text-[#7A4500]",
  red: "bg-[#FCEDEC] text-[#B3261E]",
  violet: "bg-[#F4F2FC] text-[#4A3F9E]",
  gray: "bg-[#EEF0F4] text-[#4B5563]",
};
const cardShadow = "shadow-[0_1px_2px_rgba(23,42,77,0.06),0_6px_20px_rgba(23,42,77,0.06)]";

export default function PrenotazioniV2Client({
  todayIso,
  bookings,
  kidOrder,
  hoursByActivityDbId,
  initialBookingId,
}: {
  todayIso: string;
  bookings: MyBooking[];
  kidOrder: string[];
  hoursByActivityDbId: Record<string, string | undefined>;
  initialBookingId: string | null;
}) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [openId, setOpenId] = useState<string | null>(
    initialBookingId && bookings.some((b) => b.id === initialBookingId) ? initialBookingId : null
  );

  // L'indirizzo segue la prenotazione aperta (indietro del telefono incluso).
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (openId) url.searchParams.set("id", openId);
      else {
        url.searchParams.delete("id");
        url.searchParams.delete("bookingId");
      }
      window.history.replaceState(null, "", url.toString());
    } catch {
      // mai bloccante
    }
  }, [openId]);

  const { upcoming, past } = useMemo(() => splitBookings(bookings, todayIso), [bookings, todayIso]);
  const toFix = useMemo(() => bookingsToFix(futureBookings(bookings, todayIso)), [bookings, todayIso]);
  const list = tab === "upcoming" ? upcoming : past;
  const groups = useMemo(() => groupByMonth(list, todayIso), [list, todayIso]);
  const opened = openId ? bookings.find((b) => b.id === openId) ?? null : null;

  if (opened) {
    return (
      <BookingDetail
        booking={opened}
        todayIso={todayIso}
        kidOrder={kidOrder}
        hours={opened.activityDbId ? hoursByActivityDbId[opened.activityDbId] : undefined}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="-mb-40 flex min-h-[calc(100%+10rem)] flex-col gap-4 bg-trama-page px-5 pb-24 pt-[18px]">
      <header className="flex flex-col gap-0.5">
        <div className="flex flex-col">
          <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">Prenotazioni</h1>
          <TramaThread className="mt-1.5" />
        </div>
        <span className="text-[13px] text-ink-2">{bookingsSummaryLine(bookings, todayIso)}</span>
      </header>

      <div role="tablist" aria-label="Quali prenotazioni" className="grid grid-cols-2 gap-1 rounded-full bg-[#EEF0F4] p-1">
        {(
          [
            ["upcoming", `In arrivo · ${upcoming.length}`],
            ["past", `Passate · ${past.length}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-[40px] rounded-full text-[14px] ${
              tab === key ? "bg-white font-bold text-trama-navy shadow-[0_1px_3px_rgba(23,42,77,0.12)]" : "font-semibold text-[#4B5563]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "upcoming" && toFix.length > 0 && (
        <section aria-labelledby="sist-h" className="flex flex-col gap-2.5">
          <h2 id="sist-h" className="font-poppins text-[17px] font-semibold text-ink">
            Da sistemare
          </h2>
          <ul className="flex flex-col border-t border-[#ECEEF2]">
            {toFix.map((t) => (
              <li key={t.bookingId} className="flex items-center gap-3 border-b border-[#ECEEF2] py-3">
                <span
                  className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full ${
                    t.kind === "rejected" ? "bg-[#FCEDEC] text-[#B3261E]" : "bg-[#F1F3F6] text-trama-navy"
                  }`}
                >
                  <i className={`ti ${t.kind === "rejected" ? "ti-circle-x" : t.kind === "proposed" ? "ti-message-2" : "ti-calendar-minus"} text-[18px]`} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-[14px] font-semibold text-ink">{t.title}</span>
                  <span className="text-[12.5px] leading-snug text-ink-2">{t.detail}</span>
                </span>
                {t.kind === "rejected" ? (
                  <Link
                    href={t.firstDate ? `/nextgen/search?week=${mondayOfIso(t.firstDate)}` : "/nextgen/search"}
                    className="flex min-h-[44px] flex-shrink-0 items-center px-0.5 text-[13.5px] font-bold text-[#5B4FB0]"
                  >
                    {t.ctaLabel}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenId(t.bookingId)}
                    className="flex min-h-[44px] flex-shrink-0 items-center px-0.5 text-[13.5px] font-bold text-[#5B4FB0]"
                  >
                    {t.ctaLabel}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[20px] border-[1.5px] border-dashed border-[#D6DAE3] p-5">
          <span className="text-[14px] font-semibold text-ink">
            {tab === "upcoming" ? "Nessuna prenotazione in arrivo" : "Ancora nessuna prenotazione passata"}
          </span>
          {tab === "upcoming" && (
            <Link href="/nextgen/search" className="text-[13.5px] font-semibold text-[#5B4FB0]">
              Scopri le attività
            </Link>
          )}
        </div>
      ) : (
        groups.map((g, gi) => (
          <section key={g.label} aria-label={g.label} className="flex flex-col gap-2.5">
            <h3 className="mt-1 text-[12px] font-bold uppercase tracking-wide text-ink-3">{g.label}</h3>
            {g.items.map((b, i) => (
              <BookingRow key={b.id} booking={b} kidOrder={kidOrder} raised={tab === "upcoming" && gi === 0 && i === 0} onOpen={() => setOpenId(b.id)} />
            ))}
          </section>
        ))
      )}

      <Link href="/nextgen/planner?view=stagione" className="mt-1 flex items-center gap-3 rounded-2xl bg-[#F6F4EF] px-3.5 py-3 text-ink active:scale-[0.99]">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-white text-trama-navy">
          <i className="ti ti-calendar text-[18px]" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[14px] font-semibold">Come stanno le settimane</span>
          <span className="text-[12.5px] text-[#4B5563]">Ponti, vacanze ed estate nel Planner</span>
        </span>
        <i className="ti ti-chevron-right text-[18px] text-ink-2" aria-hidden="true" />
      </Link>
    </div>
  );
}

function BookingRow({
  booking: b,
  kidOrder,
  raised,
  onOpen,
}: {
  booking: MyBooking;
  kidOrder: string[];
  raised: boolean;
  onOpen: () => void;
}) {
  const chip = bookingChip(b);
  const first = bookingSpan(b).first;
  const tile = first ? dateTile(first) : null;
  const when = bookingWhen(b);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex gap-3 rounded-[20px] bg-white px-4 py-3.5 text-left active:scale-[0.99] ${raised ? cardShadow : "border border-[#ECEEF2]"} ${
        b.status === "cancelled" ? "opacity-70" : ""
      }`}
    >
      <span className="flex w-[52px] flex-shrink-0 flex-col items-center rounded-[14px] bg-[#F6F4EF] pb-[7px] pt-1.5">
        {tile ? (
          <>
            <span className="text-[10.5px] font-bold text-trama-violet">{tile.wd}</span>
            <span className="font-poppins text-[20px] font-semibold leading-tight text-trama-navy">{tile.day}</span>
            <span className="text-[10.5px] font-semibold text-ink-2">{tile.month}</span>
          </>
        ) : (
          <i className="ti ti-calendar-question py-3 text-[18px] text-ink-2" aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[15.5px] font-semibold text-ink">
            {!b.readByParent && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-trama-orange" aria-label="Novità dal centro" />}
            {b.activityName}
          </span>
          <span className={`flex-shrink-0 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold ${TONE[chip.tone]}`}>{chip.label}</span>
        </span>
        <span className="text-[13px] text-ink-2">{[when, b.centerName].filter(Boolean).join(" · ")}</span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-[#374151]">
          <span className="flex -space-x-1.5">
            {b.kidIds.map((id, i) => (
              <KidAvatar key={id} name={b.kidNames[i] ?? ""} tone={kidToneFor(id, kidOrder)} size={22} ring />
            ))}
          </span>
          {[b.kidNames.join(", "), `€${netPrice(b)}`].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
}

function BookingDetail({
  booking: b,
  todayIso,
  kidOrder,
  hours,
  onBack,
}: {
  booking: MyBooking;
  todayIso: string;
  kidOrder: string[];
  hours: string | undefined;
  onBack: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chip = bookingChip(b);
  const explainer = bookingStatusExplainer(b);
  const range = parseHoursRange(hours);
  const { first, last } = bookingSpan(b);
  const active = b.status !== "cancelled" && b.partnerDecision !== "rejected";
  const future = last !== null && last >= todayIso;
  const nextDay = first && first >= todayIso ? first : todayIso;

  async function cancel() {
    setCancelling(true);
    setError(null);
    const res = await cancelBookingAction(b.id);
    setCancelling(false);
    setConfirming(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
    onBack();
  }

  const explainerTone =
    chip.tone === "red" ? "bg-[#FCEDEC] text-[#7F1D1D]" : chip.tone === "green" ? "bg-[#E6F6F0] text-[#0F5132]" : "bg-[#FFF4E0] text-[#5C3600]";

  return (
    <div className="-mb-40 flex min-h-[calc(100%+10rem)] flex-col gap-[18px] bg-trama-page px-5 pb-24 pt-3.5">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Torna alle prenotazioni"
          className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full text-trama-navy active:bg-black/[0.04]"
        >
          <i className="ti ti-chevron-left text-[22px]" aria-hidden="true" />
        </button>
        <span className="text-[14px] text-ink-2">Prenotazioni</span>
      </header>

      <div className="flex flex-col gap-2">
        <span className={`self-start rounded-full px-2.5 py-1 text-[12px] font-bold ${TONE[chip.tone]}`}>{chip.label}</span>
        <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">{b.activityName}</h1>
        <span className="text-[14px] text-[#4B5563]">{[b.centerName, b.centerCity].filter(Boolean).join(" · ")}</span>
      </div>

      {explainer && (
        <div className={`flex gap-3 rounded-2xl px-3.5 py-3 ${explainerTone}`}>
          <i className="ti ti-info-circle text-[20px]" aria-hidden="true" />
          <span className="text-[13.5px] leading-snug">{explainer}</span>
        </div>
      )}

      <section aria-label="Riepilogo" className={`flex flex-col rounded-[20px] bg-white ${cardShadow}`}>
        <Row label="Quando">
          {bookingWhen(b) || "—"}
          {range && <span className="block font-normal text-ink-2">{`${range.start} – ${range.end}`}</span>}
          {b.weeksLabel && b.weeksLabel !== "—" && b.partnerDecision !== "partial" && (
            <span className="block text-[12px] font-normal text-ink-2">{b.weeksLabel}</span>
          )}
        </Row>
        <Row label="Per">
          <span className="flex items-center justify-end gap-1.5">
            {b.kidIds.map((id, i) => (
              <KidAvatar key={id} name={b.kidNames[i] ?? ""} tone={kidToneFor(id, kidOrder)} size={24} />
            ))}
            {b.kidNames.join(", ")}
          </span>
        </Row>
        <Row label="Totale" last>
          <span className="text-[15px] font-bold text-trama-navy">€{netPrice(b)}</span>
          {b.discountAmount > 0 && <span className="ml-1.5 font-normal text-ink-3 line-through">€{b.totalAmount}</span>}
        </Row>
      </section>

      {active && future && (
        <Link
          href={`/nextgen/planner?mode=calendario&week=${mondayOfIso(nextDay)}`}
          className="flex items-center gap-3 rounded-2xl border border-[#ECEEF2] bg-white px-3.5 py-3 text-ink active:scale-[0.99]"
        >
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#F4F2FC] text-trama-violet">
            <i className="ti ti-car text-[18px]" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[14px] font-semibold">Chi accompagna</span>
            <span className="text-[12.5px] text-ink-2">Chi porta e chi ritira, giorno per giorno</span>
          </span>
          <span className="text-[13px] font-bold text-[#5B4FB0]">Apri</span>
        </Link>
      )}

      <div className="flex flex-col gap-2">
        {b.activityDbId && b.status !== "cancelled" && (
          <ContactCenterButton
            activityDbId={b.activityDbId}
            label="Scrivi al centro"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-trama-navy text-[14.5px] font-bold text-white active:scale-[0.99]"
          />
        )}
        <div className={`grid gap-2 ${b.canCancelOrModify ? "grid-cols-2" : "grid-cols-1"}`}>
          {b.canCancelOrModify && (
            <Link
              href={`/prenotazioni/${b.id}/modifica`}
              className="flex min-h-[46px] items-center justify-center rounded-[14px] border border-[#E3E6EC] bg-white text-[13.5px] font-semibold text-trama-navy"
            >
              Modifica
            </Link>
          )}
          <Link
            href={`/activity/${b.activityId}`}
            className="flex min-h-[46px] items-center justify-center rounded-[14px] border border-[#E3E6EC] bg-white text-[13.5px] font-semibold text-trama-navy"
          >
            Scheda attività
          </Link>
        </div>
        {b.status !== "cancelled" &&
          (b.canCancelOrModify ? (
            confirming ? (
              <div className="flex items-center justify-center gap-3 py-2 text-[13.5px]">
                <span className="font-semibold text-ink">Annullare la prenotazione?</span>
                <button type="button" disabled={cancelling} onClick={cancel} className="min-h-[40px] font-bold text-[#B3261E] disabled:opacity-50">
                  {cancelling ? "Annullo…" : "Sì, annulla"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-[40px] text-ink-2">
                  No
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="min-h-[44px] self-center text-[13.5px] font-semibold text-[#B3261E]">
                Annulla la prenotazione
              </button>
            )
          ) : null)}
        {b.status !== "cancelled" && (
          <span className="text-center text-[12px] text-ink-2">
            {b.canCancelOrModify
              ? `Annullabile fino a ${b.cancellationWindowDays} giorni prima`
              : `Mancano meno di ${b.cancellationWindowDays} giorni: per cambiare qualcosa scrivi al centro`}
          </span>
        )}
        {error && (
          <span role="alert" className="text-center text-[12.5px] font-semibold text-[#B3261E]">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 px-4 py-3.5 ${last ? "" : "border-b border-[#F0F2F5]"}`}>
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="text-right text-[14px] font-semibold text-ink">{children}</span>
    </div>
  );
}
