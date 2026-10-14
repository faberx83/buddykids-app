"use client";

// TRAMA — HOME V2 (Fase 1, 13/10/2026). Iniziativa "Home e Planner v2",
// baseline visuale V2.1 (canvas "TRAMA Home e Planner V2.1"). Montata da
// app/nextgen/page.tsx SOLO con HOME_V2_ENABLED acceso; altrimenti resta
// HomeDashboardClient.tsx, invariata (ripiego e rollback).
//
// Gerarchia, in quest'ordine:
//   1. intestazione (saluto, data, impegni di oggi, campanella)
//   2. alert — SOLO per un problema operativo di oggi (home-inbox.ts)
//   3. Oggi — timeline unica (TRAMA, Scoperte, aggiunti da te) + chi accompagna
//   4. Da fare — una lista, max 3 + "Vedi tutte", una CTA per voce
//   5. riepilogo del periodo (SeasonSummaryCard, condiviso col Planner V2)
//   6. prossima chiusura della scuola (solo col suo flag)
//   7. suggerimenti pertinenti (2–3, carosello)
//   8. azioni rapide

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Activity } from "@/lib/types";
import type { TodayCheckin } from "@/lib/data/checkin";
import type { AgendaEntry, DayCoordinationSummary } from "@/lib/nextgen/today-agenda";
import { joinPeople } from "@/lib/nextgen/today-agenda";
import { buildHomeInbox, type HomeInboxInput, type HomeInboxItem, type UrgentTodayAlert } from "@/lib/nextgen/home-inbox";
import type { SeasonSummaryModel } from "@/lib/nextgen/season-summary";
import { NEW_EXTERNAL_ITEM_HREF } from "@/lib/planner/new-external-item-link";
import { announceHeaderBell, requestOpenNotifications, UNSEEN_COUNT_EVENT, type UnseenCountDetail } from "@/lib/nextgen/notification-bridge";
import { isPushSupported, enablePushNotifications, hasBrowserPushSubscription } from "@/lib/push/client";
import { updatePreferencesAction } from "@/app/actions/profile";
import AgendaItemRow, { KidAvatar, kidToneFor } from "@/components/nextgen/AgendaItemRow";
import SeasonSummaryCard, { type SeasonSummaryAction, type SeasonSummaryWelcome } from "@/components/nextgen/SeasonSummaryCard";
import NextgenCheckinCard from "@/components/nextgen/NextgenCheckinCard";
import MockDataBanner from "@/components/MockDataBanner";

export interface HomeV2NextClosure {
  startDate: string;
  endDate: string;
  labels: string[];
  kidNames: string[];
  weekdayCount: number;
}

export interface HomeV2Recommendation {
  activity: Activity;
  kidName: string;
}

// Stessa chiave e stessa attesa di components/PushNotificationsPrompt.tsx:
// chi ha già detto "non ora" lì non se lo vede riproporre qui.
const PUSH_DISMISS_KEY = "trama_push_prompt_dismissed_at";
const PUSH_COOLDOWN_DAYS = 14;
const CLOSURE_LATER_KEY_PREFIX = "trama_home_closure_later_";

const WEEKDAYS_IT = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function parts(iso: string): { weekday: string; day: number; month: string } {
  const d = new Date(iso + "T00:00:00Z");
  return { weekday: WEEKDAYS_IT[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS_IT[d.getUTCMonth()] };
}

function longDate(iso: string): string {
  const p = parts(iso);
  return `${p.weekday} ${p.day} ${p.month}`;
}

function closureTitle(c: HomeV2NextClosure): string {
  if (c.startDate === c.endDate) return `${longDate(c.startDate)} · Scuola chiusa`;
  const a = parts(c.startDate);
  const b = parts(c.endDate);
  const range = a.month === b.month ? `${a.day}–${b.day} ${a.month}` : `${a.day} ${a.month} – ${b.day} ${b.month}`;
  return `${range} · Scuola chiusa`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // modalità privata/restrittiva: mai bloccante
  }
}

const sectionTitle = "font-poppins text-[17px] font-semibold text-ink";
const cardShadow = "shadow-[0_1px_2px_rgba(23,42,77,0.06),0_6px_20px_rgba(23,42,77,0.06)]";

export default function HomeDashboardV2Client({
  firstName,
  todayIso,
  weekStartIso,
  kids,
  agenda,
  coordination,
  urgentAlert,
  inboxInput,
  todayCheckins,
  summary,
  welcome,
  attentionAction,
  notStartedAction,
  nextClosure,
  recommendations,
  recommendationsTitle,
  externalPlannerItemsEnabled,
  activitiesAreMockFallback,
}: {
  firstName: string | null;
  todayIso: string;
  weekStartIso: string;
  kids: { id: string; name: string }[];
  agenda: AgendaEntry[];
  coordination: DayCoordinationSummary;
  urgentAlert: UrgentTodayAlert | null;
  inboxInput: Omit<HomeInboxInput, "pushInactive">;
  todayCheckins: TodayCheckin[];
  summary: SeasonSummaryModel | null;
  welcome: SeasonSummaryWelcome | null;
  attentionAction: SeasonSummaryAction | null;
  notStartedAction: SeasonSummaryAction | null;
  nextClosure: HomeV2NextClosure | null;
  recommendations: HomeV2Recommendation[];
  recommendationsTitle: string;
  externalPlannerItemsEnabled: boolean;
  activitiesAreMockFallback: boolean;
}) {
  const kidOrder = useMemo(() => kids.map((k) => k.id), [kids]);
  const weekHref = `/nextgen/planner?mode=calendario&week=${weekStartIso}`;

  // ── Campanella nell'intestazione → centro notifiche esistente ──
  const [unseen, setUnseen] = useState(0);
  useEffect(() => {
    function onCount(e: Event) {
      setUnseen((e as CustomEvent<UnseenCountDetail | undefined>).detail?.count ?? 0);
    }
    window.addEventListener(UNSEEN_COUNT_EVENT, onCount);
    announceHeaderBell(true);
    return () => {
      window.removeEventListener(UNSEEN_COUNT_EVENT, onCount);
      announceHeaderBell(false);
    };
  }, []);

  // ── Notifiche push non attive (solo lato client, come PushNotificationsPrompt) ──
  const [pushInactive, setPushInactive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!isPushSupported()) return;
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
      if (Notification.permission === "denied") return;
      const dismissedAt = Number(safeGet(PUSH_DISMISS_KEY) ?? "0");
      if (dismissedAt && Date.now() - dismissedAt < PUSH_COOLDOWN_DAYS * 86_400_000) return;
      const subscribed = await hasBrowserPushSubscription();
      if (!subscribed && !cancelled) setPushInactive(true);
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enablePush() {
    setPushBusy(true);
    const result = await enablePushNotifications();
    setPushBusy(false);
    if (result.error) {
      safeSet(PUSH_DISMISS_KEY, String(Date.now()));
      setPushInactive(false);
      return;
    }
    await updatePreferencesAction({ notifyPush: true });
    setPushInactive(false);
  }

  const inbox = useMemo(() => buildHomeInbox({ ...inboxInput, pushInactive }), [inboxInput, pushInactive]);
  const [showAllTodo, setShowAllTodo] = useState(false);
  const todoItems = showAllTodo ? inbox.all : inbox.visible;

  // ── Coordinamento della giornata: compatto se completo ──
  const [coordinationOpen, setCoordinationOpen] = useState(false);

  // ── Prossima chiusura: "Più tardi" la nasconde su questo dispositivo ──
  const [closureLater, setClosureLater] = useState(false);
  useEffect(() => {
    if (!nextClosure) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot al mount: localStorage esiste solo lato client (stesso pattern SSR-safe di NotificationCenter.tsx).
    if (safeGet(CLOSURE_LATER_KEY_PREFIX + nextClosure.startDate)) setClosureLater(true);
  }, [nextClosure]);

  const todayLabel = longDate(todayIso);
  const agendaCountLabel =
    agenda.length === 0 ? "nessun impegno oggi" : agenda.length === 1 ? "1 impegno oggi" : `${agenda.length} impegni oggi`;

  return (
    // Sfondo caldo del design V2.1 (#FDFCFA, card bianche con ombra) e spazio
    // in fondo calibrato: -mb-40 annulla il pb-40 generico del layout
    // NEXTGEN (pensato per campanella + chat flottanti; in Home V2 la
    // campanella sta nell'intestazione) e pb-24 lascia libero solo il
    // pulsante "Segnala un problema". Segnalazione live 14/10/2026.
    // min-h: lo sfondo arriva fino alla bottom nav anche quando la pagina è
    // corta (+10rem compensa il pb-40 del layout, escluso dal 100%).
    <div className="-mb-40 flex min-h-[calc(100%+10rem)] flex-col gap-[26px] bg-trama-page px-5 pb-24 pt-[18px]">
      {/* 1. INTESTAZIONE */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="h-[25px] w-auto flex-shrink-0" />
          <div className="flex min-w-0 flex-col">
            <h1 className="font-poppins text-[19px] font-semibold leading-tight text-ink">
              Ciao{firstName ? ` ${firstName}` : ""}
            </h1>
            <span className="text-[13px] text-ink-2">
              {todayLabel} · {agendaCountLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            requestOpenNotifications();
            setUnseen(0);
          }}
          aria-label={unseen > 0 ? `Notifiche, ${unseen} da leggere` : "Notifiche"}
          aria-haspopup="dialog"
          className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[#E8EBF0] bg-white text-trama-navy active:scale-95"
        >
          <i className="ti ti-bell text-[21px]" aria-hidden="true" />
          {unseen > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-trama-orange px-1 text-[10px] font-bold text-white ring-2 ring-white"
            >
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </button>
      </header>

      <MockDataBanner visible={activitiesAreMockFallback} />

      {/* 2. ALERT — solo un problema operativo di OGGI */}
      {urgentAlert && (
        <div role="status" className="-mb-2 flex items-center gap-3 rounded-2xl bg-[#FFF4E0] py-2.5 pl-3.5 pr-2.5">
          <i className="ti ti-car text-[20px] text-[#9A5A00]" aria-hidden="true" />
          <span className="flex-1 text-[13.5px] font-medium leading-snug text-[#5C3600]">{urgentAlert.text}</span>
          <Link
            href={urgentAlert.href}
            className="flex min-h-[38px] flex-shrink-0 items-center rounded-full bg-white px-3.5 text-[13px] font-bold text-[#7A4500]"
          >
            Assegna
          </Link>
        </div>
      )}

      {/* 3. OGGI */}
      <section aria-labelledby="oggi-h" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="oggi-h" className="font-poppins text-[22px] font-semibold text-ink">
            Oggi
          </h2>
          <Link href={weekHref} className="flex min-h-[32px] items-center text-[13.5px] font-semibold text-[#5B4FB0]">
            Apri settimana
          </Link>
        </div>

        {agenda.length === 0 ? (
          <div className="flex items-center gap-3.5 rounded-[20px] border-[1.5px] border-dashed border-[#D6DAE3] px-4 py-4">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F6F4EF] text-trama-navy">
              <i className="ti ti-calendar text-[20px]" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-ink">Niente in programma oggi</span>
              {externalPlannerItemsEnabled ? (
                <Link href={NEW_EXTERNAL_ITEM_HREF} className="text-[13px] font-semibold text-[#5B4FB0]">
                  Aggiungi un impegno
                </Link>
              ) : (
                <span className="text-[12.5px] text-ink-2">Qui vedrai chi va dove, a che ora e chi accompagna.</span>
              )}
            </div>
          </div>
        ) : (
          <div className={`flex flex-col rounded-[20px] bg-white ${cardShadow}`}>
            {agenda.map((entry, i) => (
              <AgendaItemRow
                key={entry.id}
                entry={entry}
                orderedKidIds={kidOrder}
                href={weekHref}
                divider={i < agenda.length - 1 || coordination.mode !== "none"}
              />
            ))}

            {coordination.mode === "compact" && (
              <div className="rounded-b-[20px]">
                <button
                  type="button"
                  aria-expanded={coordinationOpen}
                  onClick={() => setCoordinationOpen((v) => !v)}
                  className="flex min-h-[46px] w-full items-center gap-2 px-4 text-left text-[12.5px] text-[#4B5563]"
                >
                  <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#E6F6F0] text-[#146B4F]">
                    <i className="ti ti-check text-[11px]" aria-hidden="true" />
                  </span>
                  <span className="flex-1">Accompagnamenti decisi · {joinPeople(coordination.people)}</span>
                  <i className={`ti ${coordinationOpen ? "ti-chevron-up" : "ti-chevron-down"} text-[16px] text-ink-2`} aria-hidden="true" />
                </button>
                {coordinationOpen && <CoordinationTable coordination={coordination} kidOrder={kidOrder} padded />}
              </div>
            )}

            {coordination.mode === "detailed" && (
              <div className="flex flex-col gap-2.5 rounded-b-[20px] bg-[#FBFAF7] px-4 pb-3.5 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink-2">Chi accompagna oggi</span>
                  <Link href={weekHref} className="flex min-h-[32px] items-center text-[13px] font-bold text-[#5B4FB0]">
                    Assegna
                  </Link>
                </div>
                <CoordinationTable coordination={coordination} kidOrder={kidOrder} />
              </div>
            )}
          </div>
        )}

        {todayCheckins.length > 0 && <NextgenCheckinCard items={todayCheckins} />}
      </section>

      {/* 4. DA FARE — nascosto del tutto se non c'è niente */}
      {inbox.all.length > 0 && (
        <section aria-labelledby="dafare-h" className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 id="dafare-h" className={sectionTitle}>
              Da fare
            </h2>
            {inbox.all.length > inbox.visible.length && (
              <button
                type="button"
                onClick={() => setShowAllTodo((v) => !v)}
                className="flex min-h-[32px] items-center text-[13.5px] font-semibold text-[#5B4FB0]"
              >
                {showAllTodo ? "Mostra meno" : `Vedi tutte (${inbox.all.length})`}
              </button>
            )}
          </div>
          <ul className="flex flex-col border-t border-[#ECEEF2]">
            {todoItems.map((item) => (
              <TodoRow key={item.id} item={item} onPush={enablePush} pushBusy={pushBusy} />
            ))}
          </ul>
        </section>
      )}

      {/* 5. RIEPILOGO DEL PERIODO */}
      {summary && (
        <SeasonSummaryCard
          model={summary}
          welcome={welcome}
          attentionAction={attentionAction}
          notStartedAction={notStartedAction}
        />
      )}

      {/* 6. PROSSIMA CHIUSURA */}
      {nextClosure && !closureLater && (
        <section aria-labelledby="chiusura-h" className="flex flex-col gap-3.5 rounded-[20px] bg-[#F6F4EF] p-4">
          <div className="flex items-center gap-2 text-[#4B5563]">
            <i className="ti ti-school text-[16px]" aria-hidden="true" />
            <span className="text-[13px] font-semibold">Prossima chiusura</span>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex w-[54px] flex-shrink-0 flex-col items-center rounded-[14px] bg-white pb-2 pt-[7px]">
              <span className="text-[10.5px] font-bold tracking-wide text-trama-violet">
                {parts(nextClosure.startDate).weekday.slice(0, 3).toUpperCase()}
              </span>
              <span className="font-poppins text-[22px] font-semibold leading-tight text-trama-navy">
                {parts(nextClosure.startDate).day}
              </span>
              <span className="text-[10.5px] font-semibold text-ink-2">
                {parts(nextClosure.startDate).month.slice(0, 3).toUpperCase()}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="chiusura-h" className="text-[15.5px] font-bold leading-snug text-ink">
                {closureTitle(nextClosure)}
              </h2>
              <span className="text-[13px] leading-snug text-[#4B5563]">
                {[nextClosure.labels.join(", "), nextClosure.kidNames.length > 0 ? `${joinNames(nextClosure.kidNames)} a casa` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/nextgen/planner?mode=calendario&week=${mondayOf(nextClosure.startDate)}`}
              className="flex min-h-[42px] items-center rounded-full bg-trama-navy px-[18px] text-[13.5px] font-bold text-white"
            >
              Organizza
            </Link>
            <button
              type="button"
              onClick={() => {
                safeSet(CLOSURE_LATER_KEY_PREFIX + nextClosure.startDate, String(Date.now()));
                setClosureLater(true);
              }}
              className="flex min-h-[42px] items-center rounded-full px-3 text-[13.5px] font-semibold text-[#4A3F9E]"
            >
              Più tardi
            </button>
          </div>
        </section>
      )}

      {/* 7. SUGGERIMENTI — solo se pertinenti */}
      {recommendations.length > 0 && (
        <section aria-labelledby="sugg-h" className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 id="sugg-h" className={sectionTitle}>
              {recommendationsTitle}
            </h2>
            <Link href="/nextgen/search" className="flex min-h-[32px] items-center text-[13.5px] font-semibold text-[#5B4FB0]">
              Altre idee
            </Link>
          </div>
          <div className="-mr-5 flex gap-2.5 overflow-x-auto pb-1 pr-5 no-scrollbar">
            {recommendations.slice(0, 3).map((r) => (
              <Link
                key={r.activity.id}
                href={`/activity/${r.activity.id}`}
                className="flex w-[218px] flex-shrink-0 flex-col overflow-hidden rounded-[18px] border border-[#ECEEF2] bg-white active:scale-[0.99]"
              >
                <div
                  className="flex h-[78px] items-center justify-center bg-cover bg-center text-[30px]"
                  style={
                    r.activity.coverImageUrl
                      ? { backgroundImage: `url(${r.activity.coverImageUrl})` }
                      : { background: r.activity.imgGradient }
                  }
                  aria-hidden="true"
                >
                  {!r.activity.coverImageUrl && r.activity.emoji}
                </div>
                <div className="flex flex-col gap-[3px] px-3 pb-3 pt-[11px]">
                  <span className="text-[14px] font-semibold leading-snug text-ink">{r.activity.name}</span>
                  <span className="text-[12.5px] text-ink-2">
                    Per {r.kidName}
                    {r.activity.center ? ` · ${r.activity.center}` : ""}
                  </span>
                  <span className="mt-0.5 text-[12px] font-semibold text-[#146B4F]">Partner TRAMA</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 8. AZIONI RAPIDE */}
      <section aria-label="Azioni rapide" className={`grid gap-2 ${externalPlannerItemsEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
        {externalPlannerItemsEnabled && (
          <QuickAction href={NEW_EXTERNAL_ITEM_HREF} icon="ti-calendar-plus" label="Aggiungi impegno" />
        )}
        {/* "Scopri attività" (non "Cerca"): stessa parola della scheda Scopri e
            della pagina in cui porta — segnalazione di Fabrizio 14/10. */}
        <QuickAction href="/nextgen/search" icon="ti-search" label="Scopri attività" />
        <QuickAction href="/nextgen/planner?mode=calendario" icon="ti-share" label="Condividi piano" />
      </section>
    </div>
  );
}

function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function CoordinationTable({
  coordination,
  kidOrder,
  padded = false,
}: {
  coordination: DayCoordinationSummary;
  kidOrder: string[];
  padded?: boolean;
}) {
  const cell = (value: string | null | undefined) => {
    if (value === undefined) return <span className="text-ink-2">—</span>;
    if (value === null)
      return (
        <span className="justify-self-start rounded-full border-[1.5px] border-dashed border-[#E0A040] px-2.5 py-0.5 font-bold text-[#7A4500]">
          da decidere
        </span>
      );
    return <span className="font-semibold text-ink">{value}</span>;
  };
  return (
    <div
      className={`grid grid-cols-[30px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-2 text-[13px] ${
        padded ? "px-4 pb-3" : ""
      }`}
    >
      <span />
      <span className="text-[11.5px] text-ink-2">Porta</span>
      <span className="text-[11.5px] text-ink-2">Ritira</span>
      {coordination.kids.map((k) => (
        <KidCoordinationCells key={k.kidId} kid={k} kidOrder={kidOrder} cell={cell} />
      ))}
    </div>
  );
}

function KidCoordinationCells({
  kid,
  kidOrder,
  cell,
}: {
  kid: DayCoordinationSummary["kids"][number];
  kidOrder: string[];
  cell: (value: string | null | undefined) => ReactNode;
}) {
  return (
    <>
      <span title={kid.kidName}>
        <KidAvatar name={kid.kidName} tone={kidToneFor(kid.kidId, kidOrder)} size={24} />
        <span className="sr-only">{kid.kidName}</span>
      </span>
      {cell(kid.andata)}
      {cell(kid.ritorno)}
    </>
  );
}

function TodoRow({ item, onPush, pushBusy }: { item: HomeInboxItem; onPush: () => void; pushBusy: boolean }) {
  const icon: Record<HomeInboxItem["kind"], string> = {
    booking_rejected: "ti-circle-x",
    coordination_soon: "ti-car",
    booking_partial: "ti-calendar-minus",
    group_invite: "ti-users",
    profile_incomplete: "ti-user-circle",
    push_inactive: "ti-bell-ringing",
  };
  const tone = item.kind === "booking_rejected" ? "bg-[#FCEDEC] text-[#B3261E]" : "bg-[#F1F3F6] text-trama-navy";
  const cta = "flex min-h-[44px] flex-shrink-0 items-center px-0.5 text-[13.5px] font-bold text-[#5B4FB0]";
  return (
    <li className="flex items-center gap-3 border-b border-[#ECEEF2] py-3">
      <span className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full ${tone}`}>
        <i className={`ti ${icon[item.kind]} text-[18px]`} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[14px] font-semibold text-ink">{item.title}</span>
        <span className="text-[12.5px] leading-snug text-ink-2">{item.detail}</span>
      </span>
      {item.href ? (
        <Link href={item.href} className={cta}>
          {item.ctaLabel}
        </Link>
      ) : (
        <button type="button" onClick={onPush} disabled={pushBusy} className={`${cta} disabled:opacity-50`}>
          {item.ctaLabel}
        </button>
      )}
    </li>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[64px] flex-col items-center justify-center gap-[5px] rounded-2xl border border-[#ECEEF2] bg-white px-1 text-center text-[12.5px] font-semibold leading-tight text-trama-navy active:scale-[0.98]"
    >
      <i className={`ti ${icon} text-[20px] text-trama-violet`} aria-hidden="true" />
      {label}
    </Link>
  );
}
