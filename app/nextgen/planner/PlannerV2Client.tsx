"use client";

// TRAMA — PLANNER V2 (14/10/2026). Baseline visuale V2.1 (canvas "TRAMA
// Home e Planner V2.1", tavole Planner Settimana e Planner Stagione).
// Montato da app/nextgen/planner/page.tsx SOLO con PLANNER_V2_ENABLED
// acceso; altrimenti resta PlannerClient.tsx, invariato (ripiego).
//
//   Settimana — qualunque settimana, sette giorni in lista: prenotazioni
//               TRAMA, Scoperte e impegni aggiunti a mano insieme; in fondo
//               a ogni giornata chi accompagna (compatto se deciso, tabella
//               se manca qualcuno, assegnazione sul posto). Striscia dei
//               giorni, frecce, Mese in un pannello dal basso.
//   Stagione  — riepilogo (stesso componente della Home), copertura per
//               figlio, tutte le settimane per mese (raggruppamento solo
//               visivo), filtro Da sistemare, Trova attività / Non serve,
//               budget compatto.
//   Mappa e Gruppi — pulsanti secondari nell'intestazione, aprono i
//               componenti esistenti in un pannello.
//
// Riusa: AgendaItemRow, SeasonSummaryCard, DayCoordinationBlock,
// PlannerMapView, PlannerGroupsView, PlannerBudgetView,
// PlannerCalendarExportCard, ExternalPlannerItemsSection e le azioni
// esistenti (setResponsibilityAction, clearResponsibilityAction,
// toggleWeekDismissedAction, createPlanShareAction).

import { Component, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { goBackInApp } from "@/lib/nextgen/in-app-history";
import type { Kid, CommunityItem, GroupItem } from "@/lib/types";
import type { SeasonWeek } from "@/lib/data/planner";
import type { ExternalPlannerItem } from "@/lib/data/external-planner-items";
import type { PlannerMapPin } from "@/lib/data/planner-map";
import type { ParentAddress } from "@/lib/nextgen/address-kinds";
import type { ParentRole } from "@/lib/data/profile";
import type { BudgetSummary } from "@/lib/nextgen/planner-insights";
import type { PlannerCalendarItemForIcs } from "@/lib/ics";
import type { AgendaBookingInput, AgendaExternalInput } from "@/lib/nextgen/today-agenda";
import { buildTodayAgenda } from "@/lib/nextgen/today-agenda";
import {
  MOMENTS,
  WEEKDAYS,
  resolveResponsibleDisplay,
  resolveResponsibleOptions,
  type FamilyPerson,
  type Moment,
  type ResponsibleOption,
  type Weekday,
  type WeekResponsibility,
} from "@/lib/nextgen/responsibility-options";
import {
  addDaysIso,
  coordinationDaysForWeek,
  buildMonthModel,
  buildWeekModel,
  mondayOfIso,
  weekStatusParts,
  itemsInWeek,
  monthOfWeek,
  uncoveredClosureDays,
  joinItalian,
  type WeekDayModel,
} from "@/lib/nextgen/planner-week";
import { buildSeasonRows, coverageByKid, savedForWeek, type SeasonFilter, type SeasonRow } from "@/lib/nextgen/planner-season";
import { buildSeasonSummary, periodTitleForSeason, type PeriodWeekState, type SeasonSummaryModel } from "@/lib/nextgen/season-summary";
import { computeRolesToCover } from "@/lib/nextgen/week-roles";
import { closureRangeLabel } from "@/lib/nextgen/holiday-summary";
import { defaultDateForWeek, newExternalItemHref } from "@/lib/planner/new-external-item-link";
import { useCloseOnBack } from "@/lib/nextgen/use-close-on-back";
import {
  setResponsibilityAction,
  clearResponsibilityAction,
  setWeekBulkResponsibilityAction,
  setResponsibilityForDatesAction,
} from "@/app/actions/responsibilities";
import { notifyPartnerAssignmentsAction } from "@/app/actions/assign-notify";
import { otherDaysOfCommitments, shortDayIt, isPartnerChoice, type AssignChange, type CommitmentDays } from "@/lib/nextgen/assign-plus";
import { toggleWeekDismissedAction } from "@/app/actions/profile";
import { setSchoolCalendarOverrideAction, clearSchoolCalendarOverrideAction } from "@/app/actions/school-calendar";
import { notNeededKey, weekdaysOfWeek, type ClosureNotNeeded } from "@/lib/nextgen/closure-not-needed";
import { createPlanShareAction } from "@/app/actions/plan-shares";
import AgendaItemRow, { KidAvatar, kidToneFor } from "@/components/nextgen/AgendaItemRow";
import TramaThread from "@/components/nextgen/TramaThread";
import DayCoordinationBlock, { CoordinationTable } from "@/components/nextgen/DayCoordination";
import SeasonSummaryCard from "@/components/nextgen/SeasonSummaryCard";
import SchoolCoverageNote from "@/components/nextgen/SchoolCoverageNote";
import { schoolSetupHref, type SchoolCoverage } from "@/lib/nextgen/parent-ux-fix";
import PlannerMapView from "@/components/nextgen/PlannerMapView";
import PlannerGroupsView from "@/components/nextgen/PlannerGroupsView";
import PlannerBudgetView from "@/components/nextgen/PlannerBudgetView";
import PlannerCalendarExportCard from "@/components/nextgen/PlannerCalendarExportCard";
import ExternalPlannerItemsSection from "@/components/nextgen/ExternalPlannerItemsSection";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
// NODI THREAD (28/10/2026): Planner vuoto, piccolo nodo in "Chi fa cosa", avviso dopo un'assegnazione.
import Nodi, { useNodiEnabled } from "@/components/nextgen/Nodi";
import { isPlannerWeekEmpty, nodiAfterAssign, NODI_COPY, NODI_SIZE, type AssignSnapshot } from "@/lib/nextgen/nodi";
import { useGlobalActionProgress } from "@/components/GlobalActionProgress";
import { recordBetaSignalAction } from "@/app/actions/beta-signals";
import { markFirstUsefulAction } from "@/lib/nextgen/first-action";
import ProfileChip from "@/components/nextgen/ProfileChip";
import PlannerDayFocus from "@/components/nextgen/PlannerDayFocus";
import { buildKidPassageChains, defaultDayIso } from "@/lib/nextgen/planner-day";
import PassageAssignBody from "@/components/nextgen/PassageAssignBody";
import PassageBusyDayBody from "@/components/nextgen/PassageBusyDayBody";
import type { PassageResponsibility } from "@/lib/nextgen/passages";

type View = "settimana" | "stagione";
export interface HolidayPeriodRow {
  startDate: string;
  endDate: string;
  labels: string[];
  kidIds: string[];
  weekdayCount: number;
  state: "organized" | "to_complete" | "to_organize";
}
type Panel = "mappa" | "gruppi" | "mese" | "budget" | "esporta" | "chi" | "condividi" | { assign: string } | null;

// Colori pieni dei figli per i pallini (le tinte chiare restano negli avatar).
const KID_DOTS = ["#6F63C5", "#F6A623", "#2DBA8C", "#4DAFEF"];
const WEEKDAY_NAME: Record<Weekday, string> = { lun: "lunedì", mar: "martedì", mer: "mercoledì", gio: "giovedì", ven: "venerdì" };

// POLISH V2 (14/10/2026): bordo navy leggero per evidenziare oggi, niente ombra morbida.
const cardShadow = "border border-trama-primary/25";

const STATE_CHIP: Record<PeriodWeekState, { label: string; className: string } | null> = {
  organized: { label: "Organizzata", className: "bg-[#E6F6F0] text-[#146B4F]" },
  to_complete: { label: "Da completare", className: "bg-[#FFF4E0] text-[#7A4500]" },
  to_organize: { label: "Da organizzare", className: "border-[1.5px] border-dashed border-[#8B93A1] text-[#374151]" },
  not_needed: { label: "Non serve", className: "bg-[#EEF0F4] text-[#4B5563]" },
  past: { label: "Passata", className: "bg-[#EEF0F4] text-[#6B7280]" },
  school: null,
};

export default function PlannerV2Client({
  todayIso,
  initialView,
  initialWeek,
  initialPanel,
  kids,
  bookings,
  hoursByActivityDbId,
  externalItems,
  externalEnabled,
  responsibilities: initialResponsibilities,
  parentRole,
  familyPeople,
  closureLabelsByDate,
  closureNotNeeded = [],
  schoolClosedDates,
  holidaySummary,
  holidayPeriods = [],
  parentUxFix = null,
  summerWeeks,
  budget,
  seasonBudgetTarget,
  mapPins,
  addresses,
  communities,
  groups,
  savedCount,
  savedPending = [],
  navV2Enabled,
  assignPlusEnabled = false,
  partnerOnTrama = false,
  weeklyRoutineEnabled = false,
  placeSearchEnabled = false,
  dayViewEnabled = false,
  passagesEnabled = false,
  passagePersonFirst = false,
  passageResponsibilities = [],
  showDiagnostics = false,
  calendarExportEnabled,
  calendarExportItems,
}: {
  todayIso: string;
  initialView: View;
  initialWeek: string | null;
  initialPanel: "mappa" | "gruppi" | "chi" | { assign: string } | null;
  kids: Kid[];
  bookings: AgendaBookingInput[];
  hoursByActivityDbId: Record<string, string | undefined>;
  externalItems: ExternalPlannerItem[];
  externalEnabled: boolean;
  responsibilities: WeekResponsibility[];
  parentRole: ParentRole | null;
  familyPeople: FamilyPerson[];
  closureLabelsByDate: Record<string, string[]>;
  /** 20/10/2026: "Non serve" sulle chiusure (school_calendar_overrides, per figlio e settimana). */
  closureNotNeeded?: ClosureNotNeeded[];
  /** 21/10/2026: giorni senza scuola (chiusure e vacanze estive), per l'orario della scuola. */
  schoolClosedDates?: string[];
  holidaySummary: SeasonSummaryModel | null;
  /** Ponti e vacanze dei prossimi mesi, uno per riga (Stagione a estate finita). */
  holidayPeriods?: HolidayPeriodRow[];
  /** Correzioni dal test UX (21/10/2026, PARENT_UX_FIX_ENABLED): figli con e senza scuola. null = come prima. */
  parentUxFix?: { schoolCoverage: SchoolCoverage | null } | null;
  summerWeeks: SeasonWeek[];
  budget: BudgetSummary;
  seasonBudgetTarget: number | null;
  mapPins: PlannerMapPin[];
  addresses: ParentAddress[];
  communities: CommunityItem[];
  groups: GroupItem[];
  savedCount: number;
  /** 20/10/2026: salvati non ancora nel Planner, con le date in cui sono disponibili. */
  savedPending?: { title: string; ranges: { startDate: string; endDate: string }[] }[];
  navV2Enabled: boolean;
  /** 20/10/2026 — release "chi-accompagna-veloce" (CHI_ACCOMPAGNA_PLUS_ENABLED). */
  assignPlusEnabled?: boolean;
  /** L'altro genitore è nella stessa famiglia su TRAMA (riceve la notifica). */
  partnerOnTrama?: boolean;
  /** 21/10/2026 — release "settimana-tipo" (WEEKLY_ROUTINE_ENABLED). */
  weeklyRoutineEnabled?: boolean;
  /** 21/10/2026 — release "ricerca-luoghi" (PLACE_SEARCH_ENABLED). */
  placeSearchEnabled?: boolean;
  /** 21/10/2026 — release "planner-giorno" (PLANNER_DAY_VIEW_ENABLED): la Settimana un giorno alla volta. */
  dayViewEnabled?: boolean;
  /** 22/10/2026 — release "chi-accompagna-per-passaggio" (con planner-giorno): chi porta e chi ritira per passaggio. */
  passagesEnabled?: boolean;
  /** 28/10/2026 — Chi accompagna nelle giornate piene (PASSAGE_PERSON_FIRST_ENABLED). */
  passagePersonFirst?: boolean;
  passageResponsibilities?: PassageResponsibility[];
  showDiagnostics?: boolean;
  calendarExportEnabled: boolean;
  calendarExportItems: PlannerCalendarItemForIcs[];
}) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const { start: startProgress, complete: completeProgress } = useGlobalActionProgress();

  const [view, setView] = useState<View>(initialView);
  const [monday, setMonday] = useState<string>(mondayOfIso(initialWeek ?? todayIso));
  // 15/10/2026: la settimana aperta resta nell'indirizzo (?week=), senza
  // ricaricare: così il + della barra ("Un impegno") la conosce e un
  // ricaricamento riapre la stessa settimana.
  useEffect(() => {
    // Leggermente in ritardo: se nello stesso tocco si chiude un foglio
    // (es. Mese → scelta settimana), prima si toglie la sua voce dalla
    // cronologia, poi si aggiorna l'indirizzo della voce giusta.
    const sync = () => {
      try {
        const url = new URL(window.location.href);
        if (!url.pathname.startsWith("/nextgen/planner")) return; // si è già usciti dal Planner
        if (url.searchParams.get("week") === monday) return;
        url.searchParams.set("week", monday);
        window.history.replaceState(window.history.state, "", url.toString());
      } catch {
        // ambienti senza history: nessun effetto
      }
    };
    const t = window.setTimeout(sync, 150);
    const onPop = () => window.setTimeout(sync, 150);
    window.addEventListener("popstate", onPop);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("popstate", onPop);
    };
  }, [monday]);
  const [kidFilter, setKidFilter] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(initialPanel);
  // 20/10/2026: "Assegna" dalla Home apre qui direttamente la scelta del giorno
  // (?assegna=…): quel foglio fa da pagina — Fatto, X e Indietro riportano alla Home.
  const assignFromLink = useRef(initialPanel !== null && typeof initialPanel === "object");
  // 15/10/2026: "Indietro" da Mappa o Gruppi torna al Planner (non esce dalla pagina).
  useCloseOnBack((panel === "mappa" || panel === "gruppi") && initialPanel !== "mappa" && initialPanel !== "gruppi", () => setPanel(null));
  const [responsibilities, setResponsibilities] = useState<WeekResponsibility[]>(initialResponsibilities);
  const [dismissedOverrides, setDismissedOverrides] = useState<Record<string, boolean>>({});
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("all");

  // L'indirizzo segue vista e settimana: ricaricando si torna dove si era.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("view", view);
      if (view === "settimana") params.set("week", monday);
      else params.delete("week");
      params.delete("mode");
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    } catch {
      // mai bloccante
    }
  }, [view, monday]);

  const kidOrder = useMemo(() => kids.map((k) => k.id), [kids]);
  const kidNameById = useMemo(() => Object.fromEntries(kids.map((k) => [k.id, k.name])), [kids]);
  const agendaExternal = useMemo(
    () =>
      externalItems.map((i) => ({
        id: i.id,
        title: i.title,
        startDate: i.startDate,
        endDate: i.endDate,
        allDay: i.allDay,
        startTime: i.startTime,
        endTime: i.endTime,
        location: i.location,
        sourceType: i.sourceType,
        kidIds: i.kidIds,
        // 21/10/2026 — settimana tipo.
        recurrence: i.recurrence ?? null,
        isSchool: i.isSchool ?? false,
      })),
    [externalItems]
  );
  const labelFor = useCallback((r: WeekResponsibility) => resolveResponsibleDisplay(r, parentRole).label, [parentRole]);
  // 22/10/2026 — chi accompagna per passaggio (Fase B, migration 51).
  const [passageRows, setPassageRows] = useState<PassageResponsibility[]>(passageResponsibilities);
  const passageLabelFor = useCallback((r: PassageResponsibility) => resolveResponsibleDisplay(r, parentRole).label, [parentRole]);
  const passages = useMemo(
    () => (passagesEnabled ? { rows: passageRows, labelFor: passageLabelFor } : null),
    [passagesEnabled, passageRows, passageLabelFor]
  );
  const visibleKids = useMemo(
    () => kids.filter((k) => kidFilter === null || k.id === kidFilter).map((k) => ({ id: k.id, name: k.name })),
    [kids, kidFilter]
  );
  const agendaFor = useCallback(
    (dateIso: string) =>
      buildTodayAgenda({ todayIso: dateIso, bookings, externalItems: agendaExternal, hoursByActivityDbId, kidNameById, schoolClosedDates }),
    [bookings, agendaExternal, hoursByActivityDbId, kidNameById, schoolClosedDates]
  );
  const rangeFor = useCallback(
    (passageKey: string) => {
      // 26/10/2026: la scuola dura tutto l'anno scolastico (l'orario salvato in La tua famiglia).
      if (passageKey === "school") {
        const school = agendaExternal.filter((i) => i.isSchool);
        if (school.length === 0) return null;
        return {
          startDate: school.map((i) => i.startDate).sort()[0],
          endDate: school.map((i) => i.endDate).sort()[school.length - 1],
        };
      }
      if (passageKey.startsWith("external:")) {
        const item = agendaExternal.find((i) => `external:${i.id}` === passageKey);
        return item ? { startDate: item.startDate, endDate: item.endDate } : null;
      }
      const b = bookings.find((x) => `booking:${x.id}` === passageKey);
      if (!b) return null;
      const dates = [...b.dayDates, ...b.weeks.flatMap((w) => [w.startDate, w.endDate])].sort();
      return dates.length > 0 ? { startDate: dates[0], endDate: dates[dates.length - 1] } : null;
    },
    [agendaExternal, bookings]
  );

  const week = useMemo(
    () =>
      buildWeekModel({
        mondayIso: monday,
        todayIso,
        bookings,
        externalItems: agendaExternal,
        hoursByActivityDbId,
        kidNameById,
        responsibilities,
        labelFor,
        kidFilter,
        closureLabelsByDate,
        schoolClosedDates,
      }),
    [monday, todayIso, bookings, agendaExternal, hoursByActivityDbId, kidNameById, responsibilities, labelFor, kidFilter, closureLabelsByDate, schoolClosedDates]
  );
  // 22/10/2026 — con i passaggi, "da decidere" (striscia dei giorni e riga di
  // stato) conta i passaggi della giornata, sabato e domenica compresi.
  const weekShown = useMemo(() => {
    if (!passages) return week;
    let missingCount = 0;
    const days = week.days.map((d) => {
      const missing = buildKidPassageChains(d, visibleKids, passages).reduce((n, c) => n + c.missing, 0);
      if (d.dateIso >= todayIso) missingCount += missing;
      return { ...d, coordination: { ...d.coordination, missingCount: missing } };
    });
    return { ...week, days, missingCount };
  }, [week, passages, visibleKids, todayIso]);

  // NODI THREAD (28/10/2026): "prima" e "dopo" il foglio Chi accompagna / Chi
  // fa cosa. All'apertura si fotografano i passaggi da decidere; alla
  // chiusura (il pannello torna null), se il giorno o la settimana sono
  // diventati completi, un avviso di conferma (nodiAfterAssign). Mai a ogni
  // scelta. Gli onClose dei fogli restano com'erano.
  const nodiEnabled = useNodiEnabled();
  const assignBefore = useRef<(AssignSnapshot & { dayIso: string | null }) | null>(null);
  const panelKey = panel === "chi" ? "chi" : panel !== null && typeof panel === "object" && "assign" in panel ? `assign:${panel.assign}` : null;
  useEffect(() => {
    if (!panelKey) {
      const before = assignBefore.current;
      assignBefore.current = null;
      if (!nodiEnabled || !before) return;
      const day = before.dayIso ? weekShown.days.find((d) => d.dateIso === before.dayIso) : null;
      const moment = nodiAfterAssign(before, {
        dayMissing: before.dayIso ? (day ? day.coordination.missingCount : null) : null,
        weekMissing: weekShown.missingCount,
      });
      // Il pacchetto v2 non ha una versione per fondo scuro: l'avviso (scuro) resta senza Nodi.
      if (moment) showToast(moment.text, "success");
      return;
    }
    const dayIso = panelKey.startsWith("assign:") ? panelKey.slice("assign:".length) : null;
    const day = dayIso ? weekShown.days.find((d) => d.dateIso === dayIso) : null;
    assignBefore.current = { dayIso, dayMissing: day ? day.coordination.missingCount : null, weekMissing: weekShown.missingCount };
    // Solo quando si apre o si chiude un foglio, non a ogni scelta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelKey]);

  // 20/10/2026 — "Non serve" sulle chiusure: stato locale (si vede subito),
  // salvato con l'azione già esistente degli override del calendario scuola.
  const [notNeeded, setNotNeeded] = useState<Set<string>>(
    () => new Set(closureNotNeeded.map((r) => notNeededKey(r.kidId, r.weekStartDate)))
  );
  const handledClosureDays = useMemo(() => {
    const out = new Set<string>();
    for (const key of notNeeded) {
      const [kidId, weekStart] = key.split("|");
      for (const d of weekdaysOfWeek(weekStart)) out.add(`${kidId}|${d}`);
    }
    return out;
  }, [notNeeded]);
  async function setClosureNotNeeded(kidId: string, on: boolean) {
    const key = notNeededKey(kidId, monday);
    const apply = (value: boolean) =>
      setNotNeeded((cur) => {
        const next = new Set(cur);
        if (value) next.add(key);
        else next.delete(key);
        return next;
      });
    apply(on);
    const res = on
      ? await setSchoolCalendarOverrideAction(monday, "not_needed", kidId).catch(() => ({ error: "Non siamo riusciti a salvare, riprova." }))
      : await clearSchoolCalendarOverrideAction(monday, kidId).catch(() => ({ error: "Non siamo riusciti a salvare, riprova." }));
    if (res.error) {
      apply(!on);
      showToast(res.error);
      return;
    }
    const name = kidNameById[kidId] ?? "";
    showToast(on ? `Ok: per ${name} questa settimana non serve` : `Di nuovo da organizzare per ${name}`);
  }

  const weeks = useMemo(
    () => summerWeeks.map((w) => (w.startDate in dismissedOverrides ? { ...w, dismissed: dismissedOverrides[w.startDate] } : w)),
    [summerWeeks, dismissedOverrides]
  );
  const missingSlotsByStart = useMemo(() => {
    const out: Record<string, number> = {};
    for (const w of weeks) {
      const booked = coordinationDaysForWeek(bookings, agendaExternal, w.startDate, kidNameById).filter(
        (k) => kidFilter === null || k.kidId === kidFilter
      );
      out[w.startDate] = computeRolesToCover(w.startDate, booked, responsibilities).missingSlots;
    }
    return out;
  }, [weeks, bookings, agendaExternal, kidNameById, responsibilities, kidFilter]);

  // ── Azioni ──
  async function toggleDismissed(row: SeasonRow, next: boolean) {
    setDismissedOverrides((cur) => ({ ...cur, [row.startDate]: next }));
    startProgress();
    try {
      const res = await toggleWeekDismissedAction(row.startDate, next);
      if (res && "error" in res && res.error) showToast(res.error);
    } finally {
      completeProgress();
    }
    router.refresh();
  }

  async function shareWeek() {
    await sharePeriod(monday, addDaysIso(monday, 6), `Settimana ${week.label}`, `TRAMA · ${week.label}`);
  }

  // 27/10/2026 (Fabrizio: "una possibilità di esportare e condividere tutto il
  // mese non ce l'abbiamo?"): stesso link pubblico, periodo a scelta. Il mese è
  // quello del giovedì della settimana aperta (la settimana "sta" in quel mese).
  const shareMonth = useMemo(() => monthOfWeek(monday), [monday]);

  async function sharePeriod(start: string, end: string, label: string, title: string) {
    startProgress();
    try {
      const res = await createPlanShareAction(start, end, label);
      if (res.error || !res.url) {
        showToast(res.error ?? "Non è stato possibile creare il link");
        return;
      }
      try {
        if (navigator.share) {
          await navigator.share({ title, url: res.url });
          return;
        }
      } catch {
        // condivisione annullata: si prova a copiare
      }
      try {
        await navigator.clipboard.writeText(res.url);
        showToast("Link copiato: vale 30 giorni");
      } catch {
        showToast(res.url);
      }
    } finally {
      completeProgress();
    }
  }

  function openWeek(startIso: string) {
    setMonday(mondayOfIso(startIso));
    setView("settimana");
    window.scrollTo?.(0, 0);
  }

  // Mappa e Gruppi: pagina interna (non pannello), stesso contesto in cui i
  // componenti esistenti girano nel Planner attuale. Segnalazione live
  // 14/10: la mappa dentro il pannello dava "This page couldn't load".
  if (panel === "mappa" || panel === "gruppi") {
    return (
      <div className="-mb-40 flex min-h-[calc(100%+10rem)] flex-col gap-4 bg-trama-page px-5 pb-24 pt-3.5">
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanel(null)}
            aria-label="Torna al Planner"
            className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full text-trama-navy active:bg-black/[0.04]"
          >
            <i className="ti ti-chevron-left text-[22px]" aria-hidden="true" />
          </button>
          <h1 className="flex-1 font-poppins text-[22px] font-semibold text-ink">{panel === "mappa" ? "Mappa" : "Gruppi"}</h1>
        </header>
        <SafeBoundary
          name={panel}
          fallback={(error, retry) => (
            <SubviewError error={error} what={panel === "mappa" ? "la mappa" : "i gruppi"} showDiagnostics={showDiagnostics} onRetry={retry} onBack={() => setPanel(null)} />
          )}
        >
          {panel === "mappa" ? (
            <PlannerMapView pins={mapPins} addresses={addresses} />
          ) : (
            <PlannerGroupsView communities={communities} groups={groups} v2 />
          )}
        </SafeBoundary>
      </div>
    );
  }

  return (
    <div className="-mb-40 flex min-h-[calc(100%+10rem)] flex-col gap-4 bg-trama-page px-5 pb-24 pt-[18px]">
      {/* INTESTAZIONE: titolo, strumenti secondari, (Aggiungi se la barra non ha il +) */}
      <header className="flex items-center gap-2">
        {/* Freccia indietro come nelle altre pagine (segnalazione live 14/10). */}
        <button
          type="button"
          onClick={() => {
            goBackInApp(router, "/nextgen");
          }}
          aria-label="Indietro"
          className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full text-[22px] text-ink active:bg-black/[0.04]"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <div className="flex flex-1 flex-col">
          <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">Planner</h1>
          <TramaThread className="mt-1.5" />
        </div>
        <HeaderTool icon="ti-map-2" label="Mappa" onClick={() => setPanel("mappa")} />
        <HeaderTool icon="ti-users-group" label="Gruppi" onClick={() => setPanel("gruppi")} />
        <ProfileChip />
        {!navV2Enabled && externalEnabled && (
          <Link
            href={newExternalItemHref(monday)}
            className="flex h-[44px] items-center gap-1.5 rounded-[12px] bg-trama-primary pl-3 pr-4 text-[14px] font-bold text-white active:bg-trama-primary-press"
          >
            <i className="ti ti-plus text-[18px]" aria-hidden="true" />
            Aggiungi
          </Link>
        )}
      </header>

      {/* SETTIMANA | STAGIONE */}
      <div role="tablist" aria-label="Vista del Planner" className="grid grid-cols-2 gap-1 rounded-full bg-[#EEF0F4] p-1">
        {(["settimana", "stagione"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`min-h-[40px] rounded-full text-[14px] ${
              view === v ? "bg-white font-bold text-trama-navy shadow-[0_1px_3px_rgba(23,42,77,0.12)]" : "font-semibold text-[#4B5563]"
            }`}
          >
            {v === "settimana" ? "Settimana" : "Stagione"}
          </button>
        ))}
      </div>

      {/* FILTRO FIGLI */}
      {kids.length > 1 && (
        <div className="-mr-5 flex gap-2 overflow-x-auto pr-5 no-scrollbar" role="group" aria-label="Filtra per figlio">
          <button
            type="button"
            aria-pressed={kidFilter === null}
            onClick={() => setKidFilter(null)}
            className={`min-h-[36px] flex-shrink-0 rounded-full px-3.5 text-[13px] font-semibold ${
              kidFilter === null ? "bg-trama-navy text-white" : "border border-[#E3E6EC] bg-white text-ink"
            }`}
          >
            Tutti
          </button>
          {kids.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kidFilter === k.id}
              onClick={() => setKidFilter(kidFilter === k.id ? null : k.id)}
              className={`flex min-h-[36px] flex-shrink-0 items-center gap-[7px] rounded-full pl-1.5 pr-3.5 text-[13px] font-semibold ${
                kidFilter === k.id ? "bg-trama-navy text-white" : "border border-[#E3E6EC] bg-white text-ink"
              }`}
            >
              <KidAvatar name={k.name} tone={kidToneFor(k.id, kidOrder)} size={24} />
              {k.name}
            </button>
          ))}
        </div>
      )}

      {/* SALVATI (20/10/2026, Fabrizio: "serve? dipende dalla disponibilità o
          dalla necessità della famiglia, altrimenti no"). Nella Settimana
          compare solo se un salvato è disponibile in quei giorni, e dice se
          copre una giornata ancora scoperta. Nella Stagione resta il
          conteggio di prima. */}
      {(() => {
        if (savedCount === 0) return null;
        if (view === "settimana") {
          const uncoveredDates = week.days
            .filter((d) => d.closureLabels.length > 0 && !d.isPast && !d.isWeekend)
            .filter((d) => kids.some((k) => !(d.allKidIds ?? d.kidIds).includes(k.id) && !handledClosureDays.has(`${k.id}|${d.dateIso}`)))
            .map((d) => d.dateIso);
          const { items, coversNeed } = savedForWeek(savedPending, monday, uncoveredDates);
          if (items.length === 0) return null;
          const names = items.map((i) => i.title).filter(Boolean);
          return (
            <SavedCard
              count={items.length}
              title={coversNeed ? "Salvati che coprono la scuola chiusa" : "Salvati liberi questa settimana"}
              detail={names.length === 1 ? names[0] : `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` e altri ${names.length - 2}` : ""}`}
              highlight={coversNeed}
            />
          );
        }
        return (
          <SavedCard
            count={savedCount}
            title="Salvati"
            detail={savedCount === 1 ? "1 attività non ancora nel Planner" : `${savedCount} attività non ancora nel Planner`}
          />
        );
      })()}

      {view === "settimana" ? (
        <WeekView
          week={weekShown}
          passages={passages}
          kidOrder={kidOrder}
          kidList={kids.map((k) => ({ id: k.id, name: k.name }))}
          alertKids={kids.filter((k) => kidFilter === null || k.id === kidFilter).map((k) => ({ id: k.id, name: k.name }))}
          handledClosureDays={handledClosureDays}
          notNeededThisWeek={kids.filter((k) => notNeeded.has(notNeededKey(k.id, monday))).map((k) => ({ id: k.id, name: k.name }))}
          onClosureNotNeeded={setClosureNotNeeded}
          findHref={`/nextgen/search?week=${monday}`}
          addHref={externalEnabled ? newExternalItemHref(monday) : null}
          onPrev={() => setMonday(week.prevMondayIso)}
          onNext={() => setMonday(week.nextMondayIso)}
          onToday={() => setMonday(mondayOfIso(todayIso))}
          onMonth={() => setPanel("mese")}
          onAssign={(dateIso) => setPanel({ assign: dateIso })}
          onWho={() => setPanel("chi")}
          onShare={parentUxFix ? () => setPanel("condividi") : shareWeek}
          shareLabel={parentUxFix ? "Condividi" : "Condividi settimana"}
          onExport={calendarExportEnabled ? () => setPanel("esporta") : null}
          showToday={monday !== mondayOfIso(todayIso)}
          dayView={dayViewEnabled}
          todayIso={todayIso}
          // 21/10/2026 — un giorno alla volta: gli impegni aggiunti a mano escono
          // dalla giornata e stanno qui, tutti (non solo questa settimana), in
          // una scheda che si apre con "Gestisci". Il + della barra continua ad
          // aprire il foglio "Nuovo impegno" (il componente resta montato).
          beforeActions={
            externalEnabled && dayViewEnabled ? (
              <section aria-label="I tuoi impegni" className="mt-1">
                <ExternalPlannerItemsSection
                  items={externalItems.filter((i) => !i.isSchool && i.endDate >= todayIso)}
                  kids={kids}
                  title="I tuoi impegni"
                  emptyText="Ancora nessuno: sport, musica, una festa, una visita. Quelli che si ripetono li inserisci una volta sola."
                  v2
                  collapsible
                  defaultDate={defaultDateForWeek(monday, todayIso)}
                  routineEnabled={weeklyRoutineEnabled}
                  placeSearchEnabled={placeSearchEnabled}
                  uxFix={Boolean(parentUxFix)}
                />
              </section>
            ) : null
          }
        />
      ) : (
        <SeasonView
          weeks={weeks}
          kids={kids}
          kidFilter={kidFilter}
          todayIso={todayIso}
          missingSlotsByStart={missingSlotsByStart}
          holidaySummary={holidaySummary}
          holidayPeriods={holidayPeriods}
          schoolCoverage={parentUxFix?.schoolCoverage ?? null}
          filter={seasonFilter}
          onFilter={setSeasonFilter}
          onOpenWeek={openWeek}
          onToggleDismissed={toggleDismissed}
          budget={budget}
          onBudget={() => setPanel("budget")}
        />
      )}

      {/* Impegni aggiunti a mano: elenco, modifica, nuovo (componente esistente). */}
      {externalEnabled && view === "settimana" && !dayViewEnabled && (
        <section aria-label="I tuoi impegni" className="mt-2">
          {/* POLISH V2: solo gli impegni di questa settimana (gli altri restano nelle loro settimane). */}
          <ExternalPlannerItemsSection
            items={itemsInWeek(externalItems, monday)}
            kids={kids}
            title="Aggiunti da te, questa settimana"
            emptyText="Nessun impegno aggiunto per questa settimana. Usa + per aggiungerne uno."
            v2
            defaultDate={defaultDateForWeek(monday, todayIso)}
            routineEnabled={weeklyRoutineEnabled}
            placeSearchEnabled={placeSearchEnabled}
            uxFix={Boolean(parentUxFix)}
          />
        </section>
      )}

      {/* PANNELLI */}
      {panel === "budget" && (
        <Sheet title="Budget della stagione" onClose={() => setPanel(null)} tall>
          <PlannerBudgetView budget={budget} seasonBudgetTarget={seasonBudgetTarget} />
        </Sheet>
      )}
      {panel === "condividi" && (
        <Sheet title="Condividi il piano" onClose={() => setPanel(null)}>
          <div className="flex flex-col gap-2.5" data-testid="share-period">
            <p className="text-[13.5px] leading-snug text-ink-2">
              Un link da mandare a nonni, tata o altri genitori: si apre senza app e senza accesso, vale 30 giorni.
            </p>
            {[
              { key: "settimana", title: "Questa settimana", sub: week.label, run: shareWeek },
              {
                key: "mese",
                title: `Tutto il mese di ${shareMonth.name}`,
                sub: `Dal 1° al ${Number(shareMonth.end.slice(8, 10))} ${shareMonth.name}`,
                run: () => sharePeriod(shareMonth.start, shareMonth.end, `Mese di ${shareMonth.name}`, `TRAMA · ${shareMonth.name}`),
              },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={async () => {
                  setPanel(null);
                  await o.run();
                }}
                className="flex min-h-[56px] items-center gap-3 rounded-[14px] border border-trama-line bg-white px-4 text-left active:bg-black/[0.03]"
              >
                <i className={`ti ${o.key === "mese" ? "ti-calendar-month" : "ti-calendar-week"} text-[20px] text-trama-navy`} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14.5px] font-semibold text-ink">{o.title}</span>
                  <span className="text-[12.5px] text-ink-2">{o.sub}</span>
                </span>
                <i className="ti ti-share text-[17px] text-ink-3" aria-hidden="true" />
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {panel === "esporta" && (
        <Sheet title="Esporta calendario" onClose={() => setPanel(null)}>
          <PlannerCalendarExportCard enabled={calendarExportEnabled} items={calendarExportItems} />
        </Sheet>
      )}
      {panel === "mese" && (
        <MonthSheet
          anchorIso={monday}
          todayIso={todayIso}
          bookings={bookings}
          externalItems={agendaExternal}
          hoursByActivityDbId={hoursByActivityDbId}
          kidNameById={kidNameById}
          kidOrder={kidOrder}
          kidFilter={kidFilter}
          closureDates={new Set(Object.keys(closureLabelsByDate))}
          onPick={(iso) => {
            setMonday(mondayOfIso(iso));
            setPanel(null);
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "chi" && (
        <WeekWhoSheet
          week={week}
          mondayIso={monday}
          kidOrder={kidOrder}
          options={resolveResponsibleOptions(parentRole, familyPeople)}
          bookings={bookings}
          externalItems={agendaExternal}
          kidNameById={kidNameById}
          kidFilter={kidFilter}
          responsibilities={responsibilities}
          onChange={setResponsibilities}
          onOpenDay={(dateIso) => setPanel({ assign: dateIso })}
          onClose={() => {
            setPanel(null);
            router.refresh();
          }}
        />
      )}
      {panel !== null && typeof panel === "object" && "assign" in panel && passages && (
        <PassageAssignSheet
          day={weekShown.days.find((d) => d.dateIso === panel.assign) ?? null}
          kids={visibleKids}
          kidOrder={kidOrder}
          options={resolveResponsibleOptions(parentRole, familyPeople)}
          rows={passageRows}
          onRowsChange={setPassageRows}
          responsibilities={responsibilities}
          onDayChange={setResponsibilities}
          labelFor={passageLabelFor}
          todayIso={todayIso}
          agendaFor={agendaFor}
          rangeFor={rangeFor}
          plusEnabled={assignPlusEnabled}
          partnerOnTrama={partnerOnTrama}
          onShareWeek={shareWeek}
          personFirst={passagePersonFirst}
          ownHistoryEntry={!assignFromLink.current}
          onClose={() => {
            setPanel(null);
            if (assignFromLink.current) {
              assignFromLink.current = false;
              goBackInApp(router, "/nextgen");
              return;
            }
            router.refresh();
          }}
        />
      )}
      {panel !== null && typeof panel === "object" && "assign" in panel && !passages && (
        <AssignSheet
          day={week.days.find((d) => d.dateIso === panel.assign) ?? null}
          mondayIso={monday}
          kidOrder={kidOrder}
          options={resolveResponsibleOptions(parentRole, familyPeople)}
          responsibilities={responsibilities}
          bookings={bookings}
          externalItems={agendaExternal}
          kidNameById={kidNameById}
          kidFilter={kidFilter}
          onChange={setResponsibilities}
          todayIso={todayIso}
          plusEnabled={assignPlusEnabled}
          partnerOnTrama={partnerOnTrama}
          onShareWeek={shareWeek}
          ownHistoryEntry={!assignFromLink.current}
          onClose={() => {
            setPanel(null);
            if (assignFromLink.current) {
              assignFromLink.current = false;
              goBackInApp(router, "/nextgen");
              return;
            }
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function HeaderTool({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[46px] min-w-[50px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold text-trama-navy active:bg-black/[0.04]"
    >
      <i className={`ti ${icon} text-[20px]`} aria-hidden="true" />
      {label}
    </button>
  );
}

function SavedCard({ count, title, detail, highlight = false }: { count: number; title: string; detail: string; highlight?: boolean }) {
  return (
    <Link
      href="/nextgen/preferiti"
      className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-ink active:scale-[0.99] ${highlight ? "bg-[#FFF8EB]" : "bg-[#F6F4EF]"}`}
      data-testid="planner-saved-card"
    >
      <span className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-white text-trama-navy">
        <i className="ti ti-bookmark text-[18px]" aria-hidden="true" />
        <span className="absolute -right-[5px] -top-[5px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-trama-navy px-1 text-[10.5px] font-bold text-white ring-2 ring-[#F6F4EF]">
          {count}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="truncate text-[12.5px] text-[#4B5563]">{detail}</span>
      </span>
      <i className="ti ti-chevron-right text-[18px] text-ink-2" aria-hidden="true" />
    </Link>
  );
}

// ─── Settimana ──────────────────────────────────────────────────────────

function WeekView({
  week,
  kidOrder,
  kidList,
  alertKids,
  handledClosureDays,
  notNeededThisWeek,
  onClosureNotNeeded,
  findHref,
  addHref,
  onPrev,
  onNext,
  onToday,
  onMonth,
  onAssign,
  onWho,
  onShare,
  shareLabel = "Condividi settimana",
  onExport,
  showToday,
  dayView = false,
  todayIso,
  beforeActions = null,
  passages = null,
}: {
  week: ReturnType<typeof buildWeekModel>;
  /** 22/10/2026 — release "chi-accompagna-per-passaggio". */
  passages?: { rows: PassageResponsibility[]; labelFor: (row: PassageResponsibility) => string } | null;
  kidOrder: string[];
  /** 15/10/2026: per la legenda dei pallini e "chi resta scoperto". */
  kidList: { id: string; name: string }[];
  /** 20/10/2026: figli dell'avviso "scuola chiusa" (rispetta il filtro per figlio). */
  alertKids: { id: string; name: string }[];
  handledClosureDays: Set<string>;
  notNeededThisWeek: { id: string; name: string }[];
  onClosureNotNeeded: (kidId: string, on: boolean) => void;
  findHref: string;
  addHref: string | null;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onMonth: () => void;
  onAssign: (dateIso: string) => void;
  onWho: () => void;
  onShare: () => void;
  /** 27/10/2026: "Condividi" (sceglie settimana o mese) con le correzioni UX, altrimenti "Condividi settimana". */
  shareLabel?: string;
  onExport: (() => void) | null;
  showToday: boolean;
  /** 21/10/2026 — release "planner-giorno": un giorno alla volta. */
  dayView?: boolean;
  todayIso: string;
  /** 21/10/2026: "I tuoi impegni" fra la giornata e le azioni della settimana. */
  beforeActions?: ReactNode;
}) {
  const status = weekStatusParts(week);
  const nodiEnabled = useNodiEnabled(); // NODI THREAD (28/10/2026)
  const nodiProblem = nodiEnabled && Boolean(status.missing);
  const dayRefs = useRef<Record<string, HTMLElement | null>>({});
  // Giorno aperto: quello toccato nella striscia, se è in questa settimana;
  // altrimenti oggi / il primo giorno con qualcosa (cambiando settimana si riparte da lì).
  const [picked, setPicked] = useState<string | null>(null);
  const selectedIso = picked && week.days.some((d) => d.dateIso === picked) ? picked : defaultDayIso(week, todayIso);
  const selectedIdx = week.days.findIndex((d) => d.dateIso === selectedIso);
  return (
    <>
      {/* NAVIGATORE */}
      <div className="mt-0.5 flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="font-poppins text-[18px] font-semibold text-ink">{week.label}</span>
          {week.relativeLabel ? (
            <span className="text-[12.5px] text-ink-2">{week.relativeLabel}</span>
          ) : showToday ? (
            <button type="button" onClick={onToday} className="self-start text-[12.5px] font-semibold text-trama-accent-ink">
              Torna a questa settimana
            </button>
          ) : null}
        </div>
        <RoundButton label="Settimana precedente" icon="ti-chevron-left" onClick={onPrev} />
        <RoundButton label="Settimana successiva" icon="ti-chevron-right" onClick={onNext} />
        <button
          type="button"
          onClick={onMonth}
          className="flex h-10 items-center gap-1.5 rounded-full border border-[#E8EBF0] bg-white pl-2.5 pr-3 text-[13px] font-semibold text-trama-navy active:scale-[0.98]"
        >
          <i className="ti ti-calendar-month text-[17px]" aria-hidden="true" />
          Mese
        </button>
      </div>

      {/* STATO DELLA SETTIMANA */}
      <div className="flex items-center gap-2.5 text-[13px] text-[#374151]">
        <span>{status.entries}</span>
        {status.missing && (
          <>
            <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-ink-3" />
            <span className="flex items-center gap-1.5 font-semibold text-[#8A4B00]">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#F6B84B]" />
              {status.missing}
            </span>
          </>
        )}
      </div>

      {/* CHI FA COSA (nome del Planner attuale, segnalazione live 14/10):
          tutta la settimana in un colpo d'occhio + "uguale tutta la settimana". */}
      {week.days.some((d) => d.coordination.mode !== "none") && (
        <button
          type="button"
          onClick={onWho}
          className="flex items-center gap-3 rounded-2xl border border-trama-line bg-white px-3.5 py-3 text-left active:scale-[0.99]"
        >
          {/* NODI THREAD: con passaggi da decidere Nodi "problem" prende il posto
              dell'icona, alla stessa misura (34 px): stessa riga, stessi testi
              tranne il titolo. Senza Nodi resta l'icona. */}
          {(() => {
            const icon = (
              <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-trama-primary-soft text-trama-primary">
                <i className="ti ti-car text-[18px]" aria-hidden="true" />
              </span>
            );
            return nodiProblem ? <Nodi state="problem" size={NODI_SIZE.problem} fallback={icon} /> : icon;
          })()}
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[14px] font-semibold text-ink">{nodiProblem ? NODI_COPY.problemTitle : "Chi fa cosa"}</span>
            <span className={`text-[12.5px] ${status.missing ? "font-semibold text-[#8A4B00]" : "text-ink-2"}`}>
              {status.missing ?? "Accompagnamenti della settimana decisi"}
            </span>
          </span>
          <span className="text-[13px] font-bold text-trama-accent-ink">{status.missing ? "Assegna" : "Vedi"}</span>
        </button>
      )}

      {/* STRISCIA 7 GIORNI — 21/10/2026, un giorno alla volta: il tocco apre
          quel giorno (non scorre), la striscia resta in alto mentre scorri e
          un pallino ambra segna i passaggi da decidere. */}
      <div className={dayView ? "sticky top-0 z-10 -mx-5 bg-trama-page/95 px-5 py-1.5 backdrop-blur" : ""}>
      <div className="grid grid-cols-7 gap-1" role={dayView ? "tablist" : undefined} aria-label={dayView ? "Giorni della settimana" : undefined}>
        {week.days.map((d) => {
          const on = dayView ? d.dateIso === selectedIso : d.isToday;
          // Un giorno alla volta: i pallini dei figli contano gli impegni, non la
          // scuola (altrimenti ogni giorno feriale ha tutti i pallini); il
          // "da decidere" è un segno a parte nell'angolo, non un altro pallino.
          const dotKidIds = dayView ? Array.from(new Set(d.entries.filter((e) => !e.school).flatMap((e) => e.kids.map((k) => k.id)))) : d.kidIds;
          const missing = dayView && !d.isPast && d.coordination.missingCount > 0;
          return (
          <button
            key={d.dateIso}
            type="button"
            role={dayView ? "tab" : undefined}
            aria-selected={dayView ? on : undefined}
            aria-current={d.isToday ? "date" : undefined}
            aria-label={`${d.label}${d.isToday ? ", oggi" : ""}${d.entries.length ? `, ${d.entries.length} impegni` : ""}`}
            onClick={() =>
              dayView ? setPicked(d.dateIso) : dayRefs.current[d.dateIso]?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className={`relative flex flex-col items-center gap-1 rounded-[14px] pb-[9px] pt-2 ${
              on ? "bg-trama-navy text-white" : d.isPast ? "text-ink-3" : "text-[#4B5563]"
            } ${dayView && d.isToday && !on ? "ring-1 ring-inset ring-trama-primary/40" : ""}`}
          >
            {missing && (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#E5675B] ring-2 ring-trama-page"
                data-testid="strip-missing-dot"
              />
            )}
            <span className="text-[11px] font-semibold">{d.letter}</span>
            <span className={`text-[16px] font-bold ${on ? "" : d.isPast ? "" : "text-ink"}`}>{d.dayOfMonth}</span>
            <span className="flex h-1.5 gap-[3px]">
              {d.closureLabels.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#8B93A1]" />}
              {dotKidIds.slice(0, 3).map((id) => (
                <span
                  key={id}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: KID_DOTS[Math.max(kidOrder.indexOf(id), 0) % KID_DOTS.length], opacity: d.isPast ? 0.5 : 1 }}
                />
              ))}
            </span>
          </button>
          );
        })}
      </div>
      </div>

      {/* LEGENDA DEI PALLINI + CHI RESTA SCOPERTO (15/10/2026, "spiegami
          pallini gialli e grigi e perché da completare"). Un colore per figlio
          (stesso ordine degli avatar), grigio = scuola chiusa. */}
      {(week.days.some((d) => d.closureLabels.length > 0 || d.kidIds.length > 0) || kidList.length > 1) && (
        <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-2">
          {kidList.map((k) => (
            <span key={k.id} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: KID_DOTS[Math.max(kidOrder.indexOf(k.id), 0) % KID_DOTS.length] }} />
              {k.name}
            </span>
          ))}
          {week.days.some((d) => d.closureLabels.length > 0) && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#8B93A1]" />
              Scuola chiusa
            </span>
          )}
          {dayView && week.days.some((d) => !d.isPast && d.coordination.missingCount > 0) && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#E5675B]" />
              Passaggio da decidere
            </span>
          )}
        </div>
      )}
      {/* 20/10/2026 — "SCUOLA CHIUSA, NON C'È ANCORA NIENTE" (Fabrizio: con il
          filtro su Lino, Franchidea risultava scoperta pur avendo la gara; e
          per Lino mancava cosa fare). Ora conta gli impegni di tutti i figli
          (allKidIds) e mostra solo i figli scelti nel filtro; per ognuno:
          Trova attività, Aggiungi impegno, Non serve (school_calendar_overrides). */}
      {(() => {
        const uncovered = uncoveredClosureDays(week.days, alertKids, handledClosureDays);
        const hasClosure = week.days.some((d) => d.closureLabels.length > 0 && !d.isPast && !d.isWeekend);
        const skipped = hasClosure ? notNeededThisWeek.filter((k) => alertKids.some((a) => a.id === k.id)) : [];
        if (uncovered.length === 0 && skipped.length === 0) return null;
        const action =
          "flex min-h-[40px] items-center rounded-[12px] border border-[#E9D7B4] bg-white px-3 text-[13px] font-semibold text-[#5C3600] active:bg-black/[0.03]";
        return (
          <div className="flex flex-col gap-3 rounded-[12px] bg-[#FFF8EB] px-3.5 py-3 text-[13px] text-[#5C3600]" data-testid="closure-alert">
            {uncovered.map((u) => (
              <div key={u.kidId} className="flex flex-col gap-2">
                <span className="flex items-start gap-2.5">
                  <i className="ti ti-school mt-px text-[17px] text-[#9A5A00]" aria-hidden="true" />
                  <span>
                    Scuola chiusa {joinItalian(u.dayLabels)}: per <b className="font-semibold">{u.kidName}</b> non c&apos;è ancora niente.
                  </span>
                </span>
                <span className="flex flex-wrap gap-2 pl-[27px]">
                  <Link href={findHref} className={action}>
                    Trova attività
                  </Link>
                  {addHref && (
                    <Link href={addHref} className={action}>
                      Aggiungi impegno
                    </Link>
                  )}
                  <button type="button" onClick={() => onClosureNotNeeded(u.kidId, true)} className={action}>
                    Non serve
                  </button>
                </span>
              </div>
            ))}
            {skipped.map((k) => (
              <span key={k.id} className="flex items-center gap-2.5 text-[12.5px] text-[#7A5A2E]">
                <i className="ti ti-check text-[16px]" aria-hidden="true" />
                <span className="flex-1">
                  Per <b className="font-semibold">{k.name}</b> questa settimana non serve organizzare niente.
                </span>
                <button type="button" onClick={() => onClosureNotNeeded(k.id, false)} className="min-h-[36px] px-1 font-semibold text-trama-accent-ink">
                  Annulla
                </button>
              </span>
            ))}
          </div>
        );
      })()}

      {/* AGENDA */}
      {dayView && selectedIdx >= 0 ? (
        <div className="mt-1">
          <PlannerDayFocus
            day={week.days[selectedIdx]}
            nextDay={week.days[selectedIdx + 1] ?? null}
            kids={alertKids}
            kidOrder={kidOrder}
            todayIso={todayIso}
            onAssign={() => onAssign(selectedIso)}
            onSelect={setPicked}
            passages={passages}
            emptyWeekNodi={nodiEnabled && isPlannerWeekEmpty(week)}
          />
        </div>
      ) : (
      <div className="mt-1 flex flex-col gap-[22px]">
        {week.days.map((d) => (
          <DaySection key={d.dateIso} day={d} kidOrder={kidOrder} onAssign={() => onAssign(d.dateIso)} refFn={(el) => {
            dayRefs.current[d.dateIso] = el;
          }} />
        ))}
      </div>
      )}

      {/* AZIONI DELLA SETTIMANA — 21/10/2026 (Fabrizio: "un separatore a fine
          settimana, poi le azioni"): linea sottile e un po' d'aria, così
          domenica non sembra legata ai pulsanti. */}
      {beforeActions}
      <div className="mt-2 border-t border-trama-line pt-4" data-testid="week-actions">
      <div className={`grid gap-2 ${onExport ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          onClick={onShare}
          className="flex min-h-[46px] items-center justify-center gap-2 rounded-[14px] border border-[#E3E6EC] bg-white text-[13px] font-semibold text-trama-navy active:scale-[0.98]"
        >
          <i className="ti ti-share text-[17px]" aria-hidden="true" />
          {shareLabel}
        </button>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-[14px] border border-[#E3E6EC] bg-white text-[13px] font-semibold text-trama-navy active:scale-[0.98]"
          >
            <i className="ti ti-calendar-share text-[17px]" aria-hidden="true" />
            Esporta calendario
          </button>
        )}
      </div>
      </div>
    </>
  );
}

function RoundButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#E8EBF0] bg-white text-trama-navy active:scale-95"
    >
      <i className={`ti ${icon} text-[18px]`} aria-hidden="true" />
    </button>
  );
}

function DaySection({
  day,
  kidOrder,
  onAssign,
  refFn,
}: {
  day: WeekDayModel;
  kidOrder: string[];
  onAssign: () => void;
  refFn: (el: HTMLElement | null) => void;
}) {
  const closure = day.closureLabels.length > 0 && (
    <span className="rounded-full bg-[#F6F4EF] px-2 py-0.5 text-[11px] font-semibold text-[#4B5563]">
      <i className="ti ti-school mr-1 text-[12px]" aria-hidden="true" />
      Scuola chiusa
    </span>
  );

  if (day.entries.length === 0 && day.coordination.mode === "none") {
    return (
      <section ref={refFn} aria-label={day.label} className={`flex scroll-mt-4 items-center justify-between px-0.5 pt-1 ${day.isPast ? "opacity-55" : ""}`}>
        <span className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold text-trama-navy">{day.label}</h3>
          {day.isToday && <TodayChip />}
          {closure}
        </span>
        <span className="text-[13px] text-ink-2">Giornata libera</span>
      </section>
    );
  }

  const weekdayName = WEEKDAYS.find((w) => addDaysIso(mondayOfIso(day.dateIso), w.dayOffset) === day.dateIso)?.value;
  return (
    <section ref={refFn} aria-label={day.isToday ? `${day.label}, oggi` : day.label} className={`flex scroll-mt-4 flex-col gap-2 ${day.isPast ? "opacity-55" : ""}`}>
      <div className="flex items-center gap-2">
        <h3 className={`text-[13px] font-bold ${day.isPast ? "text-[#4B5563]" : "text-trama-navy"}`}>{day.label}</h3>
        {day.isToday && <TodayChip />}
        {closure}
      </div>
      <div className={`flex flex-col rounded-2xl bg-white ${day.isToday ? cardShadow : "border border-trama-line"}`}>
        {day.entries.map((e, i) => (
          <AgendaItemRow key={e.id} entry={e} orderedKidIds={kidOrder} divider={i < day.entries.length - 1 || day.coordination.mode !== "none"} />
        ))}
        <DayCoordinationBlock
          coordination={day.coordination}
          kidOrder={kidOrder}
          title={day.isToday ? "Chi accompagna oggi" : `Chi accompagna ${weekdayName ? WEEKDAY_NAME[weekdayName] : ""}`}
          onAssign={day.isPast ? undefined : onAssign}
        />
      </div>
    </section>
  );
}

function TodayChip() {
  return <span className="rounded-full bg-trama-primary px-2 py-0.5 text-[11px] font-bold text-white">Oggi</span>;
}

// ─── Stagione ───────────────────────────────────────────────────────────

function SeasonView({
  weeks,
  kids,
  kidFilter,
  todayIso,
  missingSlotsByStart,
  holidaySummary,
  holidayPeriods,
  schoolCoverage = null,
  filter,
  onFilter,
  onOpenWeek,
  onToggleDismissed,
  budget,
  onBudget,
}: {
  weeks: SeasonWeek[];
  kids: Kid[];
  kidFilter: string | null;
  todayIso: string;
  missingSlotsByStart: Record<string, number>;
  holidaySummary: SeasonSummaryModel | null;
  holidayPeriods: HolidayPeriodRow[];
  /** Correzioni dal test UX (21/10/2026). null = come prima. */
  schoolCoverage?: SchoolCoverage | null;
  filter: SeasonFilter;
  onFilter: (f: SeasonFilter) => void;
  onOpenWeek: (startIso: string) => void;
  onToggleDismissed: (row: SeasonRow, next: boolean) => void;
  budget: BudgetSummary;
  onBudget: () => void;
}) {
  const kidList = useMemo(() => kids.map((k) => ({ id: k.id, name: k.name })), [kids]);

  const summer = useMemo(
    () =>
      buildSeasonSummary({
        title: periodTitleForSeason(weeks),
        kidIds: kidFilter ? [kidFilter] : kidList.map((k) => k.id),
        todayIso,
        isNewFamily: false,
        weeks: weeks.map((w) => ({
          index: w.index,
          startDate: w.startDate,
          endDate: w.endDate,
          dateRange: w.dateRange,
          dismissed: w.dismissed,
          awaitingPartnerConfirmation: w.awaitingPartnerConfirmation,
          coveredKidIds: Array.from(
            new Set(
              w.coveredKids
                .filter((k) => k.partnerDecision !== "rejected" && (kidFilter === null || k.kidId === kidFilter))
                .map((k) => k.kidId)
            )
          ),
          missingCoordinationSlots: missingSlotsByStart[w.startDate] ?? 0,
        })),
      }),
    [weeks, kidFilter, kidList, todayIso, missingSlotsByStart]
  );
  // A estate finita: in cima i ponti e le vacanze dei prossimi mesi (come in Home).
  const summary = summer.isOver && holidaySummary ? holidaySummary : summer;

  const groups = useMemo(
    () => buildSeasonRows({ weeks, kids: kidList, kidFilter, todayIso, missingSlotsByStart, filter }),
    [weeks, kidList, kidFilter, todayIso, missingSlotsByStart, filter]
  );
  const coverage = useMemo(() => coverageByKid({ weeks, kids: kidList }), [weeks, kidList]);

  // Correzioni dal test UX (21/10/2026), UX-PARENT-007: estate finita e
  // nessun riepilogo "Ponti e vacanze" (scuola non impostata o nessuna
  // chiusura in vista) → uno stato iniziale che spiega cosa serve, e
  // l'estate passata chiusa in fondo invece di "0 di 0" come contenuto
  // principale. Senza il flag (schoolCoverage null): come prima.
  const noHolidayState = Boolean(schoolCoverage) && summer.isOver && holidaySummary === null;
  const holidayMode = (summer.isOver && holidaySummary !== null) || noHolidayState;
  const [showPastSummer, setShowPastSummer] = useState(false);
  const nameOf = (id: string) => kidList.find((k) => k.id === id)?.name ?? "";

  return (
    <>
      {noHolidayState && schoolCoverage ? (
        <section data-testid="season-no-school" className="flex flex-col gap-2 rounded-2xl border border-trama-line bg-white p-4">
          <h2 className="font-poppins text-[17px] font-semibold text-ink">Ponti e vacanze</h2>
          {schoolCoverage.configured === 0 ? (
            <>
              <p className="text-[14px] leading-snug text-ink-2">
                Indica la scuola dei tuoi figli: qui vedrai i prossimi ponti e le vacanze, e chi resta a casa.
              </p>
              {schoolCoverage.missing[0] && (
                <Link
                  href={schoolSetupHref(schoolCoverage.missing[0].id)}
                  className="mt-1 flex min-h-[44px] w-fit items-center rounded-[12px] bg-trama-primary px-4 text-[14px] font-bold text-white active:bg-trama-primary-press"
                >
                  Indica la scuola
                </Link>
              )}
            </>
          ) : (
            <p className="text-[14px] leading-snug text-ink-2">Nessuna chiusura della scuola nei prossimi mesi.</p>
          )}
        </section>
      ) : (
        <SeasonSummaryCard model={summary} onWeekClick={onOpenWeek} />
      )}
      {holidayMode && schoolCoverage && schoolCoverage.configured > 0 && <SchoolCoverageNote coverage={schoolCoverage} />}

      {/* A estate finita: ponti e vacanze uno per riga, con le azioni
          (segnalazione live 14/10: "da organizzare" ma nessuna azione). */}
      {holidayMode && holidayPeriods.length > 0 && (
        <section aria-labelledby="ponti-h" className="flex flex-col gap-2">
          <h2 id="ponti-h" className="mt-1 font-poppins text-[17px] font-semibold text-ink">
            Chiusure della scuola
          </h2>
          <div className="flex flex-col rounded-2xl border border-trama-line bg-white">
            {holidayPeriods.map((p, i) => {
              const chip = STATE_CHIP[p.state];
              const kidsHome = p.kidIds.map(nameOf).filter(Boolean);
              return (
                <div key={p.startDate} className={`flex flex-col gap-2 px-4 py-3.5 ${i < holidayPeriods.length - 1 ? "border-b border-[#F0F2F5]" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[14.5px] font-semibold text-ink">{closureRangeLabel(p.startDate, p.endDate)}</span>
                      <span className="text-[12.5px] leading-snug text-ink-2">
                        {[p.labels.join(", "), kidsHome.length ? `${kidsHome.join(" e ")} a casa` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {chip && <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${chip.className}`}>{chip.label}</span>}
                  </div>
                  <div className="flex gap-2">
                    {p.state !== "organized" && (
                      <Link
                        href={`/nextgen/search?week=${mondayOfIso(p.startDate)}`}
                        className="flex min-h-[44px] items-center rounded-[12px] border border-[#D9DDE5] bg-white px-3.5 text-[13px] font-bold text-trama-primary active:bg-black/[0.03]"
                      >
                        Trova attività
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenWeek(p.startDate)}
                      className="flex min-h-[44px] items-center rounded-[12px] px-3 text-[13px] font-semibold text-trama-accent-ink"
                    >
                      {p.state === "organized" ? "Vedi la settimana" : "Apri la settimana"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="px-1 text-[12px] text-ink-2">
            Una chiusura è organizzata quando ogni figlio a casa ha un&apos;attività o un impegno che copre la giornata.
          </p>
        </section>
      )}

      {holidayMode && (
        <button
          type="button"
          aria-expanded={showPastSummer}
          onClick={() => setShowPastSummer((v) => !v)}
          className="mt-1 flex items-center justify-between rounded-2xl border border-trama-line bg-white px-4 py-3 text-left text-[13.5px] font-semibold text-ink"
        >
          {summer.title} · conclusa
          <i className={`ti ${showPastSummer ? "ti-chevron-up" : "ti-chevron-down"} text-[16px] text-ink-2`} aria-hidden="true" />
        </button>
      )}

      {(!holidayMode || showPastSummer) && (
      <>
      {kidList.length > 1 && !summer.isOver && (
        <div className="flex flex-wrap gap-2" aria-label="Copertura per figlio">
          {coverage.map((c) => (
            <span key={c.kidId} className="flex items-center gap-2 rounded-full border border-[#E3E6EC] bg-white py-1 pl-1 pr-3 text-[12.5px] text-[#374151]">
              <KidAvatar name={c.name} tone={kidToneFor(c.kidId, kidList.map((k) => k.id))} size={22} />
              <span>
                <b className="font-semibold text-ink">{c.name}</b> {c.covered} di {c.needed}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center justify-between gap-3">
        <h2 className="font-poppins text-[17px] font-semibold text-ink">Settimana per settimana</h2>
      </div>
      <div role="group" aria-label="Filtra settimane" className="flex gap-2">
        {(
          [
            ["all", "Tutte"],
            ["to_fix", "Da sistemare"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => onFilter(key)}
            className={`min-h-[36px] rounded-full px-3.5 text-[13px] font-semibold ${
              filter === key ? "bg-trama-navy text-white" : "border border-[#E3E6EC] bg-white text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#D6DAE3] px-4 py-4 text-[13.5px] text-ink-2">
          {filter === "to_fix" ? "Niente da sistemare: tutte le settimane che servono sono a posto." : "Nessuna settimana in questo periodo."}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.label} aria-label={g.label} className="flex flex-col gap-2">
            <h3 className="mt-1 text-[12px] font-bold uppercase tracking-wide text-ink-3">{g.label}</h3>
            <div className="flex flex-col rounded-2xl border border-trama-line bg-white">
              {g.rows.map((r, i) => (
                <SeasonWeekRow
                  key={r.startDate}
                  row={r}
                  divider={i < g.rows.length - 1}
                  onOpen={() => onOpenWeek(r.startDate)}
                  onToggleDismissed={(next) => onToggleDismissed(r, next)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      </>
      )}

      {budget.totalSpent > 0 && (
        <button
          type="button"
          onClick={onBudget}
          className="mt-1 flex items-center gap-3 rounded-2xl border border-trama-line bg-white px-4 py-3 text-left active:scale-[0.99]"
        >
          <i className="ti ti-wallet text-[20px] text-trama-navy" aria-hidden="true" />
          <span className="flex flex-1 flex-col">
            <span className="text-[12px] text-ink-2">Speso nella stagione</span>
            <span className="text-[15px] font-semibold text-ink">
              {budget.totalSpent.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </span>
          </span>
          <span className="text-[13px] font-semibold text-trama-accent-ink">Vedi dettaglio</span>
        </button>
      )}
    </>
  );
}

function SeasonWeekRow({
  row,
  divider,
  onOpen,
  onToggleDismissed,
}: {
  row: SeasonRow;
  divider: boolean;
  onOpen: () => void;
  onToggleDismissed: (next: boolean) => void;
}) {
  const chip = STATE_CHIP[row.state];
  const detail =
    row.lines.length > 0
      ? row.lines
      : row.state === "not_needed"
        ? ["Segnata come non necessaria"]
        : row.state === "to_organize"
          ? ["Ancora niente in programma"]
          : [];
  return (
    <div className={`flex flex-col gap-2 px-4 py-3.5 ${divider ? "border-b border-[#F0F2F5]" : ""} ${row.isPast ? "opacity-60" : ""}`}>
      <button type="button" onClick={onOpen} className="flex items-start gap-3 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14.5px] font-semibold text-ink">{row.dateLabel}</span>
          {detail.map((l) => (
            <span key={l} className="text-[12.5px] leading-snug text-ink-2">
              {l}
            </span>
          ))}
          {row.state === "to_complete" && row.missingKidNames.length > 0 && (
            <span className="text-[12.5px] font-semibold text-[#8A4B00]">Manca {row.missingKidNames.join(" e ")}</span>
          )}
        </span>
        {chip && <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${chip.className}`}>{chip.label}</span>}
      </button>
      {!row.isPast && (row.state === "to_organize" || row.state === "not_needed") && (
        <div className="flex gap-2">
          {row.state === "to_organize" && (
            <Link
              href={`/nextgen/search?week=${row.startDate}`}
              className="flex min-h-[44px] items-center rounded-[12px] border border-[#D9DDE5] bg-white px-3.5 text-[13px] font-bold text-trama-primary active:bg-black/[0.03]"
            >
              Trova attività
            </Link>
          )}
          <button
            type="button"
            onClick={() => onToggleDismissed(row.state !== "not_needed")}
            className="flex min-h-[44px] items-center rounded-[12px] px-3 text-[13px] font-semibold text-trama-accent-ink"
          >
            {row.state === "not_needed" ? "Ripristina" : "Non serve"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Pannelli ───────────────────────────────────────────────────────────

function Sheet({
  title,
  onClose,
  children,
  tall = false,
  ownHistoryEntry = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
  /** false = il foglio È la pagina (aperto da un link, es. "Assegna" in Home): Indietro torna da dove si veniva. */
  ownHistoryEntry?: boolean;
}) {
  useCloseOnBack(ownHistoryEntry, onClose); // 15/10/2026: "Indietro" chiude il foglio
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="presentation">
      <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-[rgba(23,42,77,0.45)]" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(23,42,77,0.18)] ${tall ? "h-[88%]" : "max-h-[88%]"}`}
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-3">
          <h2 className="flex-1 font-poppins text-[18px] font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F3F6] text-trama-navy"
          >
            <i className="ti ti-x text-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{children}</div>
      </section>
    </div>
  );
}

function MonthSheet({
  anchorIso,
  todayIso,
  bookings,
  externalItems,
  hoursByActivityDbId,
  kidNameById,
  kidOrder,
  kidFilter,
  closureDates,
  onPick,
  onClose,
}: {
  anchorIso: string;
  todayIso: string;
  bookings: AgendaBookingInput[];
  externalItems: Parameters<typeof buildTodayAgenda>[0]["externalItems"];
  hoursByActivityDbId: Record<string, string | undefined>;
  kidNameById: Record<string, string>;
  kidOrder: string[];
  kidFilter: string | null;
  closureDates: Set<string>;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const [anyDay, setAnyDay] = useState(anchorIso);
  const month = useMemo(
    () =>
      buildMonthModel({
        anyDayIso: anyDay,
        todayIso,
        closureDates,
        kidIdsByDate: (iso) => {
          const entries = buildTodayAgenda({ todayIso: iso, bookings, externalItems, hoursByActivityDbId, kidNameById });
          const ids = Array.from(new Set(entries.flatMap((e) => e.kids.map((k) => k.id))));
          return kidFilter ? ids.filter((id) => id === kidFilter) : ids;
        },
      }),
    [anyDay, todayIso, closureDates, bookings, externalItems, hoursByActivityDbId, kidNameById, kidFilter]
  );
  const selectedMonday = mondayOfIso(anchorIso);
  return (
    <Sheet title="Mese" onClose={onClose}>
      <div className="flex items-center gap-2 pb-3">
        <span className="flex-1 font-poppins text-[16px] font-semibold capitalize text-ink">{month.label}</span>
        <RoundButton label="Mese precedente" icon="ti-chevron-left" onClick={() => setAnyDay(month.prevFirstIso)} />
        <RoundButton label="Mese successivo" icon="ti-chevron-right" onClick={() => setAnyDay(month.nextFirstIso)} />
      </div>
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold text-ink-3" aria-hidden="true">
        {["L", "M", "M", "G", "V", "S", "D"].map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {month.rows.map((r) => (
          <button
            key={r.mondayIso}
            type="button"
            onClick={() => onPick(r.mondayIso)}
            aria-label={`Apri la settimana dal ${Number(r.mondayIso.slice(8, 10))}`}
            className={`grid grid-cols-7 rounded-[12px] py-1.5 ${r.mondayIso === selectedMonday ? "bg-trama-primary-soft" : "active:bg-black/[0.03]"}`}
          >
            {r.cells.map((c) => (
              <span key={c.dateIso} className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-semibold ${
                    c.isToday ? "bg-trama-navy text-white" : c.inMonth ? "text-ink" : "text-ink-3/50"
                  }`}
                >
                  {c.dayOfMonth}
                </span>
                <span className="flex h-1.5 gap-[3px]">
                  {c.closure && <span className="h-1.5 w-1.5 rounded-full bg-[#8B93A1]" />}
                  {c.kidIds.slice(0, 3).map((id) => (
                    <span key={id} className="h-1.5 w-1.5 rounded-full" style={{ background: KID_DOTS[Math.max(kidOrder.indexOf(id), 0) % KID_DOTS.length] }} />
                  ))}
                </span>
              </span>
            ))}
          </button>
        ))}
      </div>
      {/* 15/10/2026: legenda dei pallini anche nel Mese. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-[12px] text-ink-2">
        {kidOrder.map((id, i) => (
          <span key={id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: KID_DOTS[i % KID_DOTS.length] }} />
            {kidNameById[id]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#8B93A1]" />
          Scuola chiusa
        </span>
      </div>
      <p className="pt-2 text-[12px] text-ink-2">Tocca una riga per aprire quella settimana.</p>
    </Sheet>
  );
}

function AssignSheet({
  day,
  mondayIso,
  kidOrder,
  options,
  responsibilities,
  bookings,
  externalItems,
  kidNameById,
  kidFilter,
  onChange,
  onClose,
  todayIso,
  plusEnabled = false,
  partnerOnTrama = false,
  onShareWeek,
  ownHistoryEntry = true,
}: {
  day: WeekDayModel | null;
  mondayIso: string;
  kidOrder: string[];
  options: ResponsibleOption[];
  responsibilities: WeekResponsibility[];
  bookings: AgendaBookingInput[];
  externalItems: AgendaExternalInput[];
  kidNameById: Record<string, string>;
  kidFilter: string | null;
  /** setState del Planner: accetta anche una funzione (aggiornamenti in sequenza). */
  onChange: Dispatch<SetStateAction<WeekResponsibility[]>>;
  onClose: () => void;
  todayIso: string;
  /** 20/10/2026 — "chi-accompagna-veloce": tutto l'impegno, inviti, notifica. */
  plusEnabled?: boolean;
  partnerOnTrama?: boolean;
  onShareWeek?: () => void;
  ownHistoryEntry?: boolean;
}) {
  const showToast = useNextgenToast();
  const [otherFor, setOtherFor] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  // 20/10/2026 — CHI ACCOMPAGNA PIÙ VELOCE. Prima ogni tocco aspettava il
  // server (e il ridisegno del Planner) con la riga bloccata: ora la scelta si
  // vede subito e si salva dietro; se il salvataggio fallisce torna com'era.
  // seqRef: per ogni passaggio conta solo la risposta dell'ultimo tocco.
  const seqRef = useRef<Record<string, number>>({});
  // Ultima scelta fatta: sotto quel passaggio compaiono le proposte
  // (tutto l'impegno, invita l'altro genitore, manda il piano).
  const [offer, setOffer] = useState<AssignOffer | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  // Passaggi affidati o tolti all'altro genitore in questo giro: una sola
  // notifica alla chiusura del foglio.
  const partnerChanges = useRef<AssignChange[]>([]);
  if (!day) return null;
  const weekday = WEEKDAYS.find((w) => addDaysIso(mondayIso, w.dayOffset) === day.dateIso)?.value ?? null;
  if (!weekday) return null;
  const kidsToday = coordinationDaysForWeek(bookings, externalItems, mondayIso, kidNameById).filter(
    (k) => k.dates.includes(day.dateIso) && (kidFilter === null || k.kidId === kidFilter)
  );

  function current(kidId: string, moment: Moment): WeekResponsibility | undefined {
    return responsibilities.find((r) => r.kidId === kidId && r.weekStartDate === mondayIso && r.weekday === weekday && r.moment === moment);
  }

  const sameSlot = (r: WeekResponsibility, kidId: string, week: string, wd: Weekday, moment: Moment) =>
    r.kidId === kidId && r.weekStartDate === week && r.weekday === wd && r.moment === moment;

  function close() {
    const changes = partnerChanges.current;
    partnerChanges.current = [];
    if (plusEnabled && partnerOnTrama && changes.length > 0) void notifyPartnerAssignmentsAction(changes).catch(() => undefined);
    onClose();
  }

  async function choose(kidId: string, kidName: string, moment: Moment, opt: ResponsibleOption | null, label?: string) {
    const key = `${kidId}__${moment}`;
    const seq = (seqRef.current[key] ?? 0) + 1;
    seqRef.current[key] = seq;
    const before = current(kidId, moment) ?? null;
    const next: WeekResponsibility | null = opt
      ? {
          kidId,
          weekStartDate: mondayIso,
          weekday: weekday!,
          moment,
          responsible: opt.value,
          responsibleLabel: opt.value === "altro" ? (label ?? opt.label) : null,
          familyPersonId: opt.familyPersonId ?? null,
        }
      : null;
    // Subito a schermo.
    onChange((cur) => [...cur.filter((r) => !sameSlot(r, kidId, mondayIso, weekday!, moment)), ...(next ? [next] : [])]);
    if (plusEnabled && isPartnerChoice(before?.responsible) !== isPartnerChoice(next?.responsible)) {
      partnerChanges.current.push({ dateIso: day!.dateIso, kidName, moment, assigned: isPartnerChoice(next?.responsible) });
    }
    if (opt && plusEnabled) {
      const commitments = otherDaysOfCommitments({ dateIso: day!.dateIso, todayIso, kidId, bookings, externalItems });
      setOffer({ key, kidId, kidName, moment, opt, label, commitments });
    } else if (!opt) {
      setOffer((o) => (o?.key === key ? null : o));
    }
    // Poi il salvataggio, dietro.
    const fail = { error: "Non siamo riusciti a salvare, riprova." };
    const res = opt
      ? await setResponsibilityAction(kidId, mondayIso, weekday!, moment, opt.value, label ?? opt.label, opt.familyPersonId).catch(() => fail)
      : await clearResponsibilityAction(kidId, mondayIso, weekday!, moment).catch(() => fail);
    if (seqRef.current[key] !== seq) return; // un tocco più recente ha già deciso
    if (res.error) {
      onChange((cur) => [...cur.filter((r) => !sameSlot(r, kidId, mondayIso, weekday!, moment)), ...(before ? [before] : [])]);
      setOffer((o) => (o?.key === key ? null : o));
      showToast(res.error);
      return;
    }
    if (opt) markFirstUsefulAction("chi_porta");
  }

  async function applyToAll(c: CommitmentDays) {
    if (!offer) return;
    const { kidId, kidName, moment, opt, label } = offer;
    setApplyingAll(true);
    const rows: WeekResponsibility[] = c.dates.flatMap((iso) => {
      const week = mondayOfIso(iso);
      const wd = WEEKDAYS.find((w) => addDaysIso(week, w.dayOffset) === iso)?.value;
      if (!wd) return [];
      return [
        {
          kidId,
          weekStartDate: week,
          weekday: wd,
          moment,
          responsible: opt.value,
          responsibleLabel: opt.value === "altro" ? (label ?? opt.label) : null,
          familyPersonId: opt.familyPersonId ?? null,
        },
      ];
    });
    const previous = responsibilities;
    onChange((cur) => [...cur.filter((r) => !rows.some((n) => sameSlot(r, n.kidId, n.weekStartDate, n.weekday, n.moment))), ...rows]);
    const res: { error?: string } = await setResponsibilityForDatesAction(kidId, c.dates, moment, opt.value, label ?? opt.label, opt.familyPersonId).catch(
      () => ({ error: "Non siamo riusciti a salvare, riprova." })
    );
    setApplyingAll(false);
    if (res.error) {
      onChange(previous);
      showToast(res.error);
      return;
    }
    if (isPartnerChoice(opt.value)) {
      for (const n of rows) {
        const was = previous.find((r) => sameSlot(r, n.kidId, n.weekStartDate, n.weekday, n.moment));
        if (!isPartnerChoice(was?.responsible)) {
          const offset = WEEKDAYS.find((w) => w.value === n.weekday)?.dayOffset ?? 0;
          partnerChanges.current.push({ dateIso: addDaysIso(n.weekStartDate, offset), kidName, moment, assigned: true });
        }
      }
    }
    showToast(`Fatto: ${label ?? opt.label} anche negli altri ${c.dates.length === 1 ? "giorno" : `${c.dates.length} giorni`}`);
    setOffer((o) => (o ? { ...o, commitments: o.commitments.filter((x) => x.key !== c.key) } : o));
  }

  // "altro" con una persona salvata: si confronta la persona; "Altro…" libero
  // ha il suo pulsante a parte (sotto).
  const isSelected = (r: WeekResponsibility | undefined, o: ResponsibleOption) =>
    Boolean(r) && r!.responsible === o.value && (o.value !== "altro" || r!.familyPersonId === o.familyPersonId);

  return (
    <Sheet title={`Chi accompagna · ${day.label}`} onClose={close} ownHistoryEntry={ownHistoryEntry}>
      <div className="flex flex-col gap-5">
        {kidsToday.length === 0 && <p className="text-[13.5px] text-ink-2">Nessun passaggio da organizzare in questa giornata.</p>}
        {kidsToday.map((kid) => (
          <div key={kid.kidId} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <KidAvatar name={kid.kidName} tone={kidToneFor(kid.kidId, kidOrder)} size={26} />
              <span className="text-[15px] font-semibold text-ink">{kid.kidName}</span>
            </div>
            {MOMENTS.map((mo) => {
              const r = current(kid.kidId, mo.value);
              const key = `${kid.kidId}__${mo.value}`;
              const freeLabel = r && r.responsible === "altro" && !r.familyPersonId ? r.responsibleLabel : null;
              return (
                <div key={mo.value} className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-ink-2">
                    {mo.value === "andata" ? "Porta" : "Ritira"}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {options
                      .filter((o) => !(o.value === "altro" && !o.familyPersonId))
                      .map((o) => {
                        const selected = isSelected(r, o);
                        return (
                          <button
                            key={`${o.value}-${o.familyPersonId ?? ""}`}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => void choose(kid.kidId, kid.kidName, mo.value, selected ? null : o)}
                            className={`min-h-[38px] rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-60 ${
                              selected ? "bg-trama-navy text-white" : "border border-[#E3E6EC] bg-white text-ink"
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    <button
                      type="button"
                      aria-pressed={Boolean(freeLabel)}
                      onClick={() => {
                        setOtherFor(key);
                        setOtherText(freeLabel ?? "");
                      }}
                      className={`min-h-[38px] rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-60 ${
                        freeLabel ? "bg-trama-navy text-white" : "border border-dashed border-[#C9CED8] bg-white text-ink"
                      }`}
                    >
                      {freeLabel ?? "Altro…"}
                    </button>
                  </div>
                  {otherFor === key && (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const text = otherText.trim();
                        if (!text) return;
                        const generic = options.find((o) => o.value === "altro" && !o.familyPersonId);
                        if (generic) void choose(kid.kidId, kid.kidName, mo.value, generic, text);
                        setOtherFor(null);
                      }}
                    >
                      <label className="sr-only" htmlFor={`altro-${key}`}>
                        Chi se ne occupa
                      </label>
                      <input
                        id={`altro-${key}`}
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder="Es. Zio Marco"
                        className="min-h-[40px] flex-1 rounded-xl border border-[#E3E6EC] px-3 text-[14px]"
                      />
                      <button type="submit" className="min-h-[44px] rounded-[12px] bg-trama-primary px-4 text-[13px] font-bold text-white active:bg-trama-primary-press">
                        Salva
                      </button>
                    </form>
                  )}
                  {offer?.key === key && plusEnabled && (
                    <AssignOfferRow
                      offer={offer}
                      applying={applyingAll}
                      partnerOnTrama={partnerOnTrama}
                      onApply={(c) => void applyToAll(c)}
                      onShareWeek={onShareWeek}
                      onDismiss={() => setOffer(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <button type="button" onClick={close} className="min-h-[48px] rounded-[12px] bg-trama-primary text-[14px] font-bold text-white active:bg-trama-primary-press">
          Fatto
        </button>
      </div>
    </Sheet>
  );
}

// 22/10/2026 — chi accompagna per passaggio: stesso foglio, contenuto per
// passaggio (components/nextgen/PassageAssignBody.tsx), stesse proposte.
function PassageAssignSheet({
  day,
  ownHistoryEntry,
  onShareWeek,
  onClose,
  partnerOnTrama,
  personFirst = false,
  ...body
}: Omit<Parameters<typeof PassageAssignBody>[0], "day" | "renderOffer"> & {
  day: WeekDayModel | null;
  ownHistoryEntry: boolean;
  onShareWeek?: () => void;
  /** 28/10/2026 — prima chi, poi i passaggi (PassageBusyDayBody); spento = come prima. */
  personFirst?: boolean;
}) {
  if (!day) return null;
  if (personFirst) {
    return (
      <Sheet title={`Chi accompagna · ${day.label}`} onClose={onClose} ownHistoryEntry={ownHistoryEntry}>
        <PassageBusyDayBody {...body} day={day} partnerOnTrama={partnerOnTrama} onShareWeek={onShareWeek} onClose={onClose} />
      </Sheet>
    );
  }
  return (
    <Sheet title={`Chi accompagna · ${day.label}`} onClose={onClose} ownHistoryEntry={ownHistoryEntry}>
      <PassageAssignBody
        {...body}
        day={day}
        partnerOnTrama={partnerOnTrama}
        onClose={onClose}
        renderOffer={({ offer, applying, onApply, onDismiss }) => (
          <AssignOfferRow offer={offer} applying={applying} partnerOnTrama={partnerOnTrama} onApply={onApply} onShareWeek={onShareWeek} onDismiss={onDismiss} />
        )}
      />
    </Sheet>
  );
}

// 20/10/2026 — proposte dopo una scelta in "Chi accompagna" (release
// "chi-accompagna-veloce"): tutto l'impegno, invito all'altro genitore se non
// è su TRAMA, piano da mandare a chi non ha l'app.
interface AssignOffer {
  key: string;
  kidId: string;
  kidName: string;
  moment: Moment;
  opt: ResponsibleOption;
  label?: string;
  commitments: CommitmentDays[];
}

function AssignOfferRow({
  offer,
  applying,
  partnerOnTrama,
  onApply,
  onShareWeek,
  onDismiss,
}: {
  offer: AssignOffer;
  applying: boolean;
  partnerOnTrama: boolean;
  onApply: (c: CommitmentDays) => void;
  onShareWeek?: () => void;
  onDismiss: () => void;
}) {
  const who = offer.label ?? offer.opt.label;
  const isPartner = offer.opt.value === "partner";
  const isOutside = offer.opt.value !== "io" && !isPartner;
  const items: ReactNode[] = [];
  for (const c of offer.commitments) {
    const last = c.dates[c.dates.length - 1];
    items.push(
      <div key={c.key} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
          Anche {c.dates.length === 1 ? "l'altro giorno" : `gli altri ${c.dates.length} giorni`} di <b className="font-semibold">{c.title}</b>
          {c.dates.length > 1 ? ` (fino a ${shortDayIt(last)})` : ` (${shortDayIt(last)})`}?
        </span>
        <button
          type="button"
          disabled={applying}
          onClick={() => onApply(c)}
          className="min-h-[40px] rounded-[12px] bg-trama-primary px-3.5 text-[13px] font-bold text-white active:bg-trama-primary-press disabled:opacity-60"
        >
          {applying ? "Un attimo…" : "Sì, applica"}
        </button>
      </div>
    );
  }
  if (isPartner && !partnerOnTrama) {
    items.push(
      <p key="invita" className="text-[13px] leading-snug text-ink-2">
        {who} non è ancora su TRAMA.{" "}
        <Link href="/nextgen/profile/famiglia" className="font-semibold text-trama-accent-ink">
          Invita {who}
        </Link>
        : vedrete lo stesso Planner e riceverà un avviso per i passaggi affidati.
      </p>
    );
  } else if (isPartner && partnerOnTrama) {
    items.push(
      <p key="avviso" className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
        <i className="ti ti-bell" aria-hidden="true" />
        Quando chiudi, {who} riceve un avviso con i passaggi affidati.
      </p>
    );
  }
  if (isOutside && onShareWeek) {
    items.push(
      <div key="piano" className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{who} non usa TRAMA? Manda il piano della settimana.</span>
        <button
          type="button"
          onClick={onShareWeek}
          className="min-h-[40px] rounded-[12px] border border-[#D9DDE5] bg-white px-3.5 text-[13px] font-semibold text-trama-primary active:bg-black/[0.03]"
        >
          <i className="ti ti-share mr-1" aria-hidden="true" />
          Manda il piano
        </button>
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-2 rounded-[12px] bg-trama-primary-soft px-3 py-2.5" data-testid="assign-offer">
      {items}
      <button type="button" onClick={onDismiss} className="min-h-[32px] self-end text-[12.5px] font-semibold text-ink-2">
        Non ora
      </button>
    </div>
  );
}

// ─── Chi fa cosa: tutta la settimana ────────────────────────────────────

function WeekWhoSheet({
  week,
  mondayIso,
  kidOrder,
  options,
  bookings,
  externalItems,
  kidNameById,
  kidFilter,
  responsibilities,
  onChange,
  onOpenDay,
  onClose,
}: {
  week: ReturnType<typeof buildWeekModel>;
  mondayIso: string;
  kidOrder: string[];
  options: ResponsibleOption[];
  bookings: AgendaBookingInput[];
  externalItems: AgendaExternalInput[];
  kidNameById: Record<string, string>;
  kidFilter: string | null;
  responsibilities: WeekResponsibility[];
  onChange: (next: WeekResponsibility[]) => void;
  onOpenDay: (dateIso: string) => void;
  onClose: () => void;
}) {
  const showToast = useNextgenToast();
  const [busy, setBusy] = useState<Moment | null>(null);
  const kidsThisWeek = coordinationDaysForWeek(bookings, externalItems, mondayIso, kidNameById).filter(
    (k) => kidFilter === null || k.kidId === kidFilter
  );
  const days = week.days.filter((d) => d.coordination.mode !== "none");
  const quick = options.filter((o) => !(o.value === "altro" && !o.familyPersonId));

  async function sameAllWeek(moment: Moment, opt: ResponsibleOption) {
    if (kidsThisWeek.length === 0) return;
    setBusy(moment);
    try {
      const res = await setWeekBulkResponsibilityAction(
        kidsThisWeek.map((k) => k.kidId),
        mondayIso,
        [moment],
        opt.value,
        opt.label,
        opt.familyPersonId
      );
      if (res.error) {
        showToast(res.error);
        return;
      }
      const kidIds = new Set(kidsThisWeek.map((k) => k.kidId));
      const rest = responsibilities.filter((r) => !(r.weekStartDate === mondayIso && r.moment === moment && kidIds.has(r.kidId)));
      const added: WeekResponsibility[] = kidsThisWeek.flatMap((k) =>
        WEEKDAYS.map((wd) => ({
          kidId: k.kidId,
          weekStartDate: mondayIso,
          weekday: wd.value,
          moment,
          responsible: opt.value,
          responsibleLabel: opt.value === "altro" ? opt.label : null,
          familyPersonId: opt.familyPersonId ?? null,
        }))
      );
      onChange([...rest, ...added]);
      showToast(`${moment === "andata" ? "Porta" : "Ritira"}: ${opt.label} per tutta la settimana`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet title={`Chi fa cosa · ${week.label}`} onClose={onClose} tall>
      <div className="flex flex-col gap-5">
        <section aria-label="Giorno per giorno" className="flex flex-col rounded-[18px] border border-trama-line">
          {days.map((d, i) => (
            <button
              key={d.dateIso}
              type="button"
              disabled={d.isPast}
              onClick={() => onOpenDay(d.dateIso)}
              className={`flex flex-col gap-2 px-4 py-3 text-left disabled:opacity-55 ${i < days.length - 1 ? "border-b border-[#F0F2F5]" : ""}`}
            >
              <span className="flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-trama-navy">{d.label}</span>
                {!d.isPast && (
                  <span className="text-[12.5px] font-bold text-trama-accent-ink">{d.coordination.missingCount > 0 ? "Assegna" : "Modifica"}</span>
                )}
              </span>
              <CoordinationTable coordination={d.coordination} kidOrder={kidOrder} />
            </button>
          ))}
        </section>

        {kidsThisWeek.length > 0 && (
          <section aria-labelledby="same-week-h" className="flex flex-col gap-3 rounded-[18px] bg-[#F6F4EF] p-4">
            <h3 id="same-week-h" className="text-[14px] font-semibold text-ink">
              Uguale per tutta la settimana
            </h3>
            {MOMENTS.map((mo) => (
              <div key={mo.value} className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-ink-2">{mo.value === "andata" ? "Porta" : "Ritira"}</span>
                <div className="flex flex-wrap gap-1.5" aria-busy={busy === mo.value}>
                  {quick.map((o) => (
                    <button
                      key={`${o.value}-${o.familyPersonId ?? ""}`}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => sameAllWeek(mo.value, o)}
                      className="min-h-[38px] rounded-full border border-[#E3E6EC] bg-white px-3.5 text-[13px] font-semibold text-ink disabled:opacity-60"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[12px] text-ink-2">Vale per {kidsThisWeek.map((k) => k.kidName).join(" e ")}, da lunedì a venerdì. Poi puoi cambiare un singolo giorno.</p>
          </section>
        )}

        <button type="button" onClick={onClose} className="min-h-[48px] rounded-[12px] bg-trama-primary text-[14px] font-bold text-white active:bg-trama-primary-press">
          Fatto
        </button>
      </div>
    </Sheet>
  );
}

// ─── Rete di sicurezza ──────────────────────────────────────────────────

/** Un errore in un componente esistente (es. la mappa) non deve far cadere
 *  tutto il Planner: si mostra un messaggio e si torna indietro. */
class SafeBoundary extends Component<
  { name: string; fallback: (error: unknown, retry: () => void) => ReactNode; children: ReactNode },
  { error: unknown; attempt: number }
> {
  state = { error: null as unknown, attempt: 0 };
  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error("errore sconosciuto") };
  }
  componentDidCatch(error: unknown) {
    console.error("[PlannerV2] sottovista non caricata", error);
    // POLISH V2 (14/10/2026): traccia nella telemetria esistente (product_events), mai bloccante.
    const short = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    void recordBetaSignalAction("planner_subview_error", `${this.props.name} ${short}`.slice(0, 60)).catch(() => {});
    // Dopo un nuovo deploy il telefono può avere ancora la vecchia versione
    // dell'app: il pezzo di codice della mappa non esiste più (ChunkLoadError).
    // Si ricarica la pagina una volta sola.
    const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    if (/ChunkLoadError|Loading chunk|dynamically imported module/i.test(msg)) {
      try {
        if (!window.sessionStorage.getItem("trama_chunk_reload")) {
          window.sessionStorage.setItem("trama_chunk_reload", "1");
          window.location.reload();
        }
      } catch {
        // mai bloccante
      }
    }
  }
  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 })));
    }
    // key = tentativo: "Riprova" rimonta da zero la sottovista (mappa nuova).
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}

function SubviewError({
  error,
  what,
  showDiagnostics,
  onRetry,
  onBack,
}: {
  error: unknown;
  what: string;
  showDiagnostics: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  // 14/10/2026: anche le prime righe dello stack (funzione che ha sbagliato),
  // per trovare la causa se l'errore si ripresenta.
  const where =
    error instanceof Error && error.stack
      ? error.stack
          .split("\n")
          .slice(1, 4)
          .map((l) => l.trim().replace(/^at /, "").replace(/\(?https?:\/\/[^)]*\/([^/)]+)\)?/g, "$1"))
          .join(" ← ")
      : "";
  const detail = error instanceof Error ? `${error.name}: ${error.message}${where ? ` · ${where}` : ""}` : String(error);
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-trama-line bg-white p-5">
      <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <i className="ti ti-map-off text-[20px] text-ink-2" aria-hidden="true" />
        Non siamo riusciti a caricare {what}.
      </span>
      <span className="text-[13.5px] text-ink-2">Il resto del Planner funziona normalmente.</span>
      {/* Solo per l'Admin piattaforma: il dettaglio tecnico serve a capire la causa. Pilot e Tutti non lo vedono. */}
      {showDiagnostics && (
        <code className="max-w-full break-words rounded-lg bg-[#F6F4EF] px-2 py-1 text-[11px] text-[#4B5563]">{detail.slice(0, 360)}</code>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onRetry} className="min-h-[44px] rounded-[12px] bg-trama-primary px-4 text-[14px] font-bold text-white active:bg-trama-primary-press">
          Riprova
        </button>
        <button type="button" onClick={onBack} className="min-h-[44px] rounded-[12px] px-3 text-[14px] font-semibold text-trama-accent-ink">
          Torna al Planner
        </button>
      </div>
    </div>
  );
}
