"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PartnerPageHeader from "@/components/center/PartnerPageHeader";
import PartnerSheet from "@/components/center/PartnerSheet";
import BookingSheet from "@/components/center/BookingSheet";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { respondGroupRequestAction } from "@/app/actions/groups";
import { respondToBookingAction, respondToBookingDaysAction } from "@/app/actions/booking-response";
import type { CenterBooking } from "@/lib/data/center-bookings";
import { bookingNeedsAction } from "@/lib/booking-response/effective-decision";
import {
  INBOX_FILTERS,
  buildInboxItems,
  filterInbox,
  inboxSummary,
  relativeTime,
  toAnswerCounts,
  type InboxFilter,
  type InboxGroupInput,
  type InboxItem,
  type InboxMessageInput,
} from "@/lib/centers/partner-inbox";

// TRAMA — PORTALE CENTRI V2, RICHIESTE (29/10/2026, tavola 4,
// PARTNER_SHELL_V2_ENABLED). Fabrizio: "proseguire con la revisione di tutto
// il restyle". Prenotazioni, messaggi e richieste di gruppo in un elenco solo:
// prima "Da rispondere" (chi aspetta da più tempo in cima), poi "Già gestite".
// Una prenotazione si apre nel foglio (BookingSheet), un messaggio nella sua
// conversazione (/center/richieste/[id], di sempre), un gruppo in un foglio
// piccolo. "Seleziona" risponde a più prenotazioni insieme, come prima.

const KIND_ICON: Record<InboxItem["kind"], string> = {
  prenotazione: "ti-calendar-event",
  messaggio: "ti-message-circle",
  gruppo: "ti-users-group",
};

const TONE: Record<string, string> = {
  todo: "bg-[#FFF3DC] text-[#7A4F00]",
  done: "bg-[#E6F6F0] text-[#146B4F]",
  waiting: "bg-partner-soft text-partner-primary",
  closed: "bg-[#EEF2F1] text-ink-2",
};

const PAGE = 15;

export default function InboxV2({
  initialBookings,
  messages,
  initialGroups,
  initialFilter,
}: {
  initialBookings: CenterBooking[];
  messages: (InboxMessageInput & { activitySlug: string; parentEmail: string })[];
  initialGroups: InboxGroupInput[];
  initialFilter: InboxFilter;
}) {
  const toast = useNextgenToast();
  const [bookings, setBookings] = useState(initialBookings);
  const [groups, setGroups] = useState(initialGroups);
  const [filter, setFilter] = useState<InboxFilter>(initialFilter);
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<"accepted" | "rejected" | null>(null);
  const [groupBusy, setGroupBusy] = useState<boolean>(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const items = useMemo(() => buildInboxItems({ bookings, messages, groups }), [bookings, messages, groups]);
  const counts = useMemo(() => toAnswerCounts(items), [items]);
  const shown = filterInbox(items, filter);
  const todo = shown.filter((i) => i.needsAnswer);
  const done = shown.filter((i) => !i.needsAnswer);
  const doneShown = showAllDone ? done : done.slice(0, PAGE);
  const canSelect = (filter === "tutte" || filter === "prenotazione") && todo.some((i) => i.kind === "prenotazione");

  const openBooking = bookings.find((b) => b.id === openBookingId) ?? null;
  const openGroup = groups.find((g) => g.id === openGroupId) ?? null;

  // La conversazione con la stessa famiglia sulla stessa attività, se esiste.
  function conversationFor(b: CenterBooking): string | null {
    const m = messages.find((x) => x.activitySlug === b.activityId && x.parentEmail && x.parentEmail === b.parentEmail);
    return m ? `/center/richieste/${m.id}` : null;
  }

  function chooseFilter(f: InboxFilter) {
    setFilter(f);
    setShowAllDone(false);
    setSelecting(false);
    setSelected(new Set());
    const q = INBOX_FILTERS.find((x) => x.key === f)?.query;
    try {
      const url = new URL(window.location.href);
      if (q) url.searchParams.set("tipo", q);
      else url.searchParams.delete("tipo");
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* solo comodità: l'indirizzo resta quello di prima */
    }
  }

  async function respondSelected(decision: "accepted" | "rejected") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(decision);
    let processed = 0;
    let waitlisted = 0;
    let failed = 0;
    for (const id of ids) {
      const b = bookings.find((x) => x.id === id);
      if (!b || b.status === "cancelled" || !bookingNeedsAction(b)) continue;
      if (b.isDayBased) {
        const dayIds = b.days.filter((d) => d.partnerDecision === "pending").map((d) => d.activityDayId);
        if (dayIds.length === 0) continue;
        const r = await respondToBookingDaysAction({ bookingId: id, activityDayIds: dayIds, decision }).catch(() => null);
        if (!r || r.error) {
          failed++;
          continue;
        }
        const results = r.results as Record<string, string>;
        setBookings((prev) =>
          prev.map((x) =>
            x.id !== id
              ? x
              : {
                  ...x,
                  readByCenter: true,
                  days: x.days.map((d) => {
                    const o = results[d.activityDayId];
                    return o === "accepted" || o === "rejected" || o === "waitlisted" ? { ...d, partnerDecision: o } : d;
                  }),
                }
          )
        );
        waitlisted += r.waitlisted;
        processed++;
      } else {
        const r = await respondToBookingAction({ bookingId: id, decision }).catch(() => ({ error: "x" }));
        if (r.error) {
          failed++;
          continue;
        }
        setBookings((prev) =>
          prev.map((x) =>
            x.id !== id
              ? x
              : {
                  ...x,
                  partnerDecision: decision,
                  status: decision === "accepted" ? "confirmed" : "cancelled",
                  cancelledBy: decision === "rejected" ? "center" : null,
                  readByCenter: true,
                }
          )
        );
        processed++;
      }
    }
    setBulkBusy(null);
    setSelected(new Set());
    setSelecting(false);
    const parts = [`${processed} ${processed === 1 ? "prenotazione" : "prenotazioni"} ${decision === "accepted" ? "accettate" : "rifiutate"}`];
    if (waitlisted > 0) parts.push(`${waitlisted} ${waitlisted === 1 ? "giorno pieno" : "giorni pieni"} in lista d'attesa`);
    if (failed > 0) parts.push(`${failed} non riuscite, riprovate`);
    toast(parts.join(" · "), failed > 0 ? "info" : "success");
  }

  async function answerGroup(accept: boolean) {
    if (!openGroup) return;
    setGroupError(null);
    setGroupBusy(true);
    const r = await respondGroupRequestAction(openGroup.id, accept).catch(() => ({ error: "x" }));
    setGroupBusy(false);
    if (r.error) return setGroupError("Non siamo riusciti a salvare la risposta, riprovate.");
    setGroups((prev) => prev.map((g) => (g.id === openGroup.id ? { ...g, status: accept ? "accepted" : "rejected" } : g)));
    setOpenGroupId(null);
    toast(accept ? "Richiesta di gruppo accettata" : "Richiesta di gruppo rifiutata");
  }

  function renderRow(item: InboxItem) {
    const selectable = selecting && item.kind === "prenotazione" && item.needsAnswer;
    const inner = (
      <>
        <span
          className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
            item.needsAnswer ? "bg-partner-soft text-partner-primary" : "bg-partner-page text-ink-2"
          }`}
        >
          <i className={`ti ${KIND_ICON[item.kind]} text-[19px]`} aria-hidden="true" />
          {item.unread && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-partner-accent ring-2 ring-white" aria-label="Nuova" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-[15px] text-ink ${item.unread ? "font-bold" : "font-semibold"}`}>{item.title}</span>
            <span className="flex-shrink-0 text-[12px] text-ink-2">{relativeTime(item.at)}</span>
          </span>
          <span className="truncate text-[13px] text-ink-2">{item.detail}</span>
          <span className={`mt-0.5 self-start rounded-full px-2 py-0.5 text-[11.5px] font-bold ${TONE[item.status.tone]}`}>{item.status.label}</span>
        </span>
      </>
    );
    const cls = "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-partner-page";
    if (selectable) {
      const id = `inbox-sel-${item.id}`;
      return (
        <label htmlFor={id} className={`${cls} cursor-pointer`}>
          <input
            id={id}
            type="checkbox"
            checked={selected.has(item.id)}
            onChange={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                return next;
              })
            }
            className="h-5 w-5 flex-shrink-0 accent-[#0E5A63]"
          />
          {inner}
        </label>
      );
    }
    if (item.kind === "messaggio" && item.href) {
      return (
        <Link href={item.href} className={cls}>
          {inner}
        </Link>
      );
    }
    return (
      <button
        type="button"
        className={cls}
        onClick={() => (item.kind === "prenotazione" ? setOpenBookingId(item.id) : setOpenGroupId(item.id))}
        aria-haspopup="dialog"
      >
        {inner}
      </button>
    );
  }

  function renderList(rows: InboxItem[], empty: string) {
    if (rows.length === 0) {
      return <p className="rounded-[18px] border border-partner-line bg-white px-4 py-4 text-[14px] text-ink-2">{empty}</p>;
    }
    return (
      <ul className="overflow-hidden rounded-[18px] border border-partner-line bg-white">
        {rows.map((item, i) => (
          <li key={`${item.kind}-${item.id}`} className={i > 0 ? "border-t border-[#EEF2F1]" : ""}>
            {renderRow(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 animate-fade-in">
      <PartnerPageHeader
        title="Richieste"
        subtitle={inboxSummary(counts)}
        action={
          canSelect ? (
            <button
              type="button"
              onClick={() => {
                setSelecting((v) => !v);
                setSelected(new Set());
              }}
              aria-pressed={selecting}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-partner-line bg-white px-3 text-[13.5px] font-semibold text-partner-primary"
            >
              <i className={`ti ${selecting ? "ti-x" : "ti-checkbox"} text-[17px]`} aria-hidden="true" />
              {selecting ? "Annulla" : "Seleziona"}
            </button>
          ) : undefined
        }
      />

      <nav aria-label="Tipo di richiesta" className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
        {INBOX_FILTERS.map((f) => {
          const active = f.key === filter;
          const n = counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => chooseFilter(f.key)}
              aria-pressed={active}
              className={`flex min-h-[40px] flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors ${
                active ? "border-partner-primary bg-partner-primary text-white" : "border-partner-line bg-white text-ink-2 hover:text-ink"
              }`}
            >
              {f.label}
              {n > 0 && (
                <span
                  className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold ${
                    active ? "bg-white text-partner-primary" : "bg-partner-soft text-partner-primary"
                  }`}
                >
                  {n > 9 ? "9+" : n}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <section aria-labelledby="inbox-todo" className="flex flex-col gap-2.5">
        <h2 id="inbox-todo" className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
          Da rispondere ({todo.length})
        </h2>
        {renderList(todo, "Niente da rispondere qui. Quando una famiglia vi scrive o prenota, vi avvisiamo anche per email.")}
      </section>

      <section aria-labelledby="inbox-done" className="flex flex-col gap-2.5">
        <h2 id="inbox-done" className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
          Già gestite ({done.length})
        </h2>
        {renderList(doneShown, "Ancora nessuna richiesta gestita.")}
        {done.length > doneShown.length && (
          <button
            type="button"
            onClick={() => setShowAllDone(true)}
            className="min-h-[44px] self-center text-[14px] font-semibold text-partner-accent-ink"
          >
            Mostra le altre {done.length - doneShown.length}
          </button>
        )}
      </section>

      {selecting && (
        <div
          className="fixed inset-x-0 bottom-[68px] z-40 border-t border-partner-line bg-white px-4 py-3 md:bottom-0"
          role="region"
          aria-label="Risposta a più prenotazioni"
        >
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <span className="flex-1 text-[13.5px] text-ink-2">
              {selected.size === 0 ? "Scegliete le prenotazioni" : `${selected.size} ${selected.size === 1 ? "scelta" : "scelte"}`}
            </span>
            <button
              type="button"
              onClick={() => void respondSelected("accepted")}
              disabled={selected.size === 0 || bulkBusy !== null}
              className="min-h-[44px] rounded-xl bg-partner-primary px-4 text-[14px] font-semibold text-white disabled:bg-[#B9C6C2]"
            >
              {bulkBusy === "accepted" ? "Invio…" : "Accetta"}
            </button>
            <button
              type="button"
              onClick={() => void respondSelected("rejected")}
              disabled={selected.size === 0 || bulkBusy !== null}
              className="min-h-[44px] rounded-xl border border-partner-line px-4 text-[14px] font-semibold text-[#B4361F] disabled:opacity-50"
            >
              {bulkBusy === "rejected" ? "…" : "Rifiuta"}
            </button>
          </div>
        </div>
      )}

      <BookingSheet
        booking={openBooking}
        conversationHref={openBooking ? conversationFor(openBooking) : null}
        onClose={() => setOpenBookingId(null)}
        onChange={(next) => setBookings((prev) => prev.map((b) => (b.id === next.id ? next : b)))}
      />

      <PartnerSheet
        open={openGroup !== null}
        onClose={() => {
          setOpenGroupId(null);
          setGroupError(null);
        }}
        title={openGroup?.groupName ?? "Richiesta di gruppo"}
        subtitle={openGroup?.activityName}
        footer={
          openGroup?.status === "pending" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void answerGroup(true)}
                disabled={groupBusy}
                className="min-h-[48px] flex-1 rounded-xl bg-partner-primary px-4 text-[15px] font-semibold text-white disabled:bg-[#B9C6C2]"
              >
                {groupBusy ? "Invio…" : "Accetta"}
              </button>
              <button
                type="button"
                onClick={() => void answerGroup(false)}
                disabled={groupBusy}
                className="min-h-[48px] rounded-xl border border-partner-line px-4 text-[15px] font-semibold text-[#B4361F] disabled:opacity-50"
              >
                Rifiuta
              </button>
            </div>
          ) : undefined
        }
      >
        {openGroup && (
          <div className="flex flex-col gap-4 text-[14.5px]">
            <p className="text-ink">
              Un gruppo di famiglie ({openGroup.kidsCount} {openGroup.kidsCount === 1 ? "bambino" : "bambini"}) chiede di iscriversi insieme
              {openGroup.discountPercent > 0 ? `, con lo sconto di gruppo del ${openGroup.discountPercent}%` : ""}.
            </p>
            {openGroup.message && (
              <blockquote className="rounded-2xl bg-partner-page px-4 py-3 text-ink">“{openGroup.message}”</blockquote>
            )}
            <p className="text-[13px] text-ink-2">Lo sconto è quello di gruppo che avete indicato nel profilo del centro.</p>
            {groupError && (
              <p role="alert" className="text-[13.5px] font-medium text-[#B4361F]">
                {groupError}
              </p>
            )}
          </div>
        )}
      </PartnerSheet>
    </div>
  );
}
