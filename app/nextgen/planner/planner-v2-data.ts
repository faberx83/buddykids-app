// TRAMA — PLANNER V2 (14/10/2026). Assemblaggio server-side dei dati del
// Planner V2, chiamato da app/nextgen/planner/page.tsx SOLO con
// PLANNER_V2_ENABLED acceso. Nessuna nuova tabella, nessuna scrittura:
// stesse funzioni di lettura del Planner attuale e della Home V2. Il
// passaggio da una settimana all'altra avviene sul client (logica pura in
// lib/nextgen/planner-week.ts), quindi qui si legge tutto una volta sola.

import { getPlannerData } from "@/lib/data/planner";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities } from "@/lib/data/activities";
import { getParentProfile } from "@/lib/data/profile";
import { getResponsibilitiesForParent } from "@/lib/data/responsibilities";
import { getFamilyPeopleForParent } from "@/lib/data/family-people";
import { getPlannerMapPins } from "@/lib/data/planner-map";
import { getParentAddresses } from "@/lib/data/addresses";
import { getCommunitiesForUser } from "@/lib/data/communities";
import { getGroupsForUser } from "@/lib/data/groups";
import { getExternalPlannerItemsForParent, type ExternalPlannerItem } from "@/lib/data/external-planner-items";
import { getKidClosureIntervalsForParent } from "@/lib/data/school-calendar";
import { getClosureNotNeededForParent } from "@/lib/data/closure-not-needed";
import { getFamilyForUser } from "@/lib/data/family";
import { CHI_ACCOMPAGNA_PLUS_FLAG } from "@/lib/nextgen/assign-plus";
import { notNeededCoverage } from "@/lib/nextgen/closure-not-needed";
import { createClient } from "@/lib/supabase/server";
import { getUnifiedFavoritesForParent } from "@/lib/data/favorites";
import { getPlannerCalendarItemsForParent, type PlannerCalendarItem } from "@/lib/planner/calendar-items";
import { computeBudgetSummary } from "@/lib/nextgen/planner-insights";
import { buildCoverage, buildHolidaySummary, closureState, holidayPeriodsInRange, listClosurePeriods, weekdaysBetween } from "@/lib/nextgen/holiday-summary";
import { countSavedNotInPlanner, savedNotInPlanner, type SavedItemInput } from "@/lib/nextgen/planner-season";
import { getWeeksForActivity } from "@/lib/data/weeks";
import { getActivityDays } from "@/lib/data/activity-days";
import { resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import type PlannerV2Client from "./PlannerV2Client";

export type PlannerV2Props = Parameters<typeof PlannerV2Client>[0];

function romeTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .slice(0, 10);
}

async function flagOn(flagName: string, userId: string, role: string): Promise<boolean> {
  try {
    const r = await resolveFeatureFlagVisibility({
      flagName,
      userId,
      role,
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
    return r.enabled;
  } catch {
    return false;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function loadPlannerV2Props({
  userId,
  role,
  searchParams,
}: {
  userId: string;
  role: string;
  searchParams: Record<string, string | undefined>;
}): Promise<PlannerV2Props> {
  const todayIso = romeTodayIso();
  const [externalEnabled, schoolEnabled, exportEnabled, navV2Enabled, assignPlusEnabled, weeklyRoutineEnabled] = await Promise.all([
    flagOn("EXTERNAL_PLANNER_ITEMS_ENABLED", userId, role),
    flagOn("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", userId, role),
    flagOn("CALENDAR_EXPORT_ENABLED", userId, role),
    flagOn("NAV_V2_ENABLED", userId, role),
    flagOn(CHI_ACCOMPAGNA_PLUS_FLAG, userId, role),
    flagOn("WEEKLY_ROUTINE_ENABLED", userId, role),
  ]);
  // 20/10/2026 — Chi accompagna più veloce: l'altro genitore è su TRAMA (nella
  // stessa famiglia)? Decide fra "riceverà una notifica" e "invitalo".
  const partnerOnTrama = assignPlusEnabled
    ? await getFamilyForUser()
        .then((f) => (f?.members ?? []).some((m) => !m.isMe))
        .catch(() => false)
    : false;

  const [planner, bookings, kids, activities, profile, responsibilities, familyPeople, mapPins, addresses, communities, groups, favorites] =
    await Promise.all([
      getPlannerData(),
      getMyBookingsForParent(),
      getKidsForUser(),
      getActivities(),
      getParentProfile(),
      getResponsibilitiesForParent(),
      getFamilyPeopleForParent(),
      getPlannerMapPins(),
      getParentAddresses(),
      getCommunitiesForUser(),
      getGroupsForUser(),
      getUnifiedFavoritesForParent().catch(() => []),
    ]);

  const externalItems: ExternalPlannerItem[] = externalEnabled
    ? await getExternalPlannerItemsForParent().catch((): ExternalPlannerItem[] => [])
    : [];
  const calendarExportItems: PlannerCalendarItem[] = exportEnabled
    ? await getPlannerCalendarItemsForParent().catch((): PlannerCalendarItem[] => [])
    : [];

  // Chiusure scolastiche: etichette per giorno (Settimana, Mese) e
  // riepilogo "Ponti e vacanze" a estate finita (Stagione).
  const closureData = schoolEnabled
    ? await getKidClosureIntervalsForParent(kids.map((k) => k.id)).catch(() => ({ hasAnySchoolProfile: false, closuresByKid: [] }))
    : { hasAnySchoolProfile: false, closuresByKid: [] };
  const closureLabelsByDate: Record<string, string[]> = {};
  // 21/10/2026 — settimana tipo: giorni senza scuola, vacanze estive comprese
  // (l'orario della scuola lì non compare).
  const schoolClosedDates = new Set<string>();
  for (const { closures } of closureData.closuresByKid) {
    for (const c of closures) for (const d of weekdaysBetween(c.startDate, c.endDate)) schoolClosedDates.add(d);
  }
  for (const { closures } of closureData.closuresByKid) {
    for (const c of closures) {
      if (c.kind === "summer_break") continue;
      for (const d of weekdaysBetween(c.startDate, c.endDate)) {
        const list = closureLabelsByDate[d] ?? [];
        if (c.label && !list.includes(c.label)) list.push(c.label);
        closureLabelsByDate[d] = list;
      }
    }
  }
  // 20/10/2026 — "Non serve" sulle chiusure (lib/nextgen/closure-not-needed.ts):
  // conta come copertura di quei giorni per quel figlio.
  const closureNotNeeded = schoolEnabled ? await getClosureNotNeededForParent(await createClient(), userId) : [];
  const coverage = [
    ...buildCoverage({
      bookings: bookings.map((b) => ({ status: b.status, partnerDecision: b.partnerDecision, kidIds: b.kidIds, weeks: b.weeks, dayDates: b.dayDates })),
      externalItems,
    }),
    ...notNeededCoverage(closureNotNeeded),
  ];
  const closurePeriods = schoolEnabled
    ? listClosurePeriods(closureData.closuresByKid, todayIso).map((p) => ({ ...p, state: closureState(p, coverage) }))
    : [];
  const holidaySummary = schoolEnabled ? buildHolidaySummary({ periods: closurePeriods, todayIso }) : null;
  // Le stesse chiusure, una per riga, con le azioni (Stagione a estate finita).
  const holidayPeriods = holidayPeriodsInRange(closurePeriods, todayIso).map((p) => ({
    startDate: p.startDate,
    endDate: p.endDate,
    labels: p.labels,
    kidIds: p.kidIds,
    weekdayCount: p.weekdayCount,
    state: p.state,
  }));

  // Salvati: preferiti con una data possibile, non ancora prenotati né nel Planner.
  // 20/10/2026: con nome e date di disponibilità, per mostrarli nel Planner
  // solo nella settimana in cui servono (savedForWeek in planner-season.ts).
  const partnerRanges = new Map<string, { startDate: string; endDate: string }[]>();
  await Promise.all(
    favorites.map(async (f) => {
      if (f.kind !== "partner") return;
      const key = f.activity.dbId ?? f.activity.id;
      const [weeks, days] = await Promise.all([
        getWeeksForActivity(f.activity).catch(() => []),
        f.activity.bookingMode && f.activity.bookingMode !== "week_only" ? getActivityDays(f.activity).catch(() => []) : Promise.resolve([]),
      ]);
      const ranges = [
        ...weeks
          .filter((w) => w.offered !== false && !w.soldOut && w.startDate && w.endDate)
          .map((w) => ({ startDate: w.startDate!, endDate: w.endDate! })),
        ...days.filter((d) => d.isOpen).map((d) => ({ startDate: d.date, endDate: d.date })),
      ].filter((r) => r.endDate >= todayIso);
      partnerRanges.set(key, ranges);
    })
  );
  const datedRange = (start: string | null, end: string | null) =>
    start ? [{ startDate: start, endDate: end ?? start }].filter((r) => r.endDate >= todayIso) : [];
  const saved: SavedItemInput[] = favorites.map((f): SavedItemInput =>
    f.kind === "partner"
      ? {
          kind: "partner",
          ref: f.activity.dbId ?? f.activity.id,
          title: f.activity.name,
          ranges: partnerRanges.get(f.activity.dbId ?? f.activity.id) ?? [],
        }
      : f.kind === "curated"
        ? { kind: "curated", ref: f.curatedLeadId, title: f.lead.activityTitle, ranges: datedRange(f.lead.startDate, f.lead.endDate) }
        : {
            kind: "community",
            ref: f.discovery.id,
            altRefs: [f.favoriteId],
            title: f.discovery.title,
            ranges: datedRange(f.discovery.startDate, f.discovery.endDate),
          }
  );
  const savedInput = {
    saved,
    bookedActivityDbIds: bookings
      .filter((b) => b.status !== "cancelled" && b.partnerDecision !== "rejected")
      .map((b) => b.activityDbId)
      .filter((id): id is string => Boolean(id)),
    externalSourceRefs: externalItems.map((i) => i.sourceRef).filter((r): r is string => Boolean(r)),
  };
  const savedCount = countSavedNotInPlanner(savedInput);
  const savedPending = savedNotInPlanner(savedInput).map((s) => ({ title: s.title ?? "", ranges: s.ranges ?? [] }));

  const hoursByActivityDbId: Record<string, string | undefined> = {};
  for (const a of activities) if (a.dbId) hoursByActivityDbId[a.dbId] = a.hours;

  const view = searchParams.view === "stagione" || searchParams.mode === "budget" ? "stagione" : "settimana";
  const week = searchParams.week && ISO_DATE.test(searchParams.week) ? searchParams.week : null;
  const panel =
    searchParams.panel === "mappa" || searchParams.mode === "mappa"
      ? "mappa"
      : searchParams.panel === "gruppi" || searchParams.mode === "gruppi"
        ? "gruppi"
        : // 15/10/2026: "Chi accompagna" dal + apre direttamente il foglio della settimana.
          searchParams.panel === "chi"
          ? "chi"
          : // 20/10/2026: "Assegna" dalla Home apre direttamente la scelta di
            // chi porta e chi ritira in quel giorno (?assegna=AAAA-MM-GG).
            searchParams.assegna && ISO_DATE.test(searchParams.assegna)
            ? { assign: searchParams.assegna }
            : null;

  return {
    todayIso,
    initialView: view,
    initialWeek: week,
    initialPanel: panel,
    kids,
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      partnerDecision: b.partnerDecision,
      activityName: b.activityName,
      activityDbId: b.activityDbId,
      centerName: b.centerName,
      isDayBased: b.isDayBased,
      dayDates: b.dayDates,
      weeks: b.weeks.map((w) => ({ startDate: w.startDate, endDate: w.endDate })),
      kidIds: b.kidIds,
      kidNames: b.kidNames,
    })),
    hoursByActivityDbId,
    externalItems,
    externalEnabled,
    responsibilities,
    parentRole: profile.parentRole,
    familyPeople,
    closureLabelsByDate,
    closureNotNeeded,
    schoolClosedDates: Array.from(schoolClosedDates).sort(),
    holidaySummary,
    holidayPeriods,
    summerWeeks: planner.weeks,
    budget: computeBudgetSummary(bookings, activities),
    seasonBudgetTarget: profile.seasonBudgetTarget,
    mapPins,
    addresses,
    communities,
    groups,
    savedCount,
    savedPending,
    navV2Enabled,
    assignPlusEnabled,
    partnerOnTrama,
    weeklyRoutineEnabled,
    // POLISH V2 (14/10/2026): il dettaglio tecnico degli errori lo vede solo l'Admin piattaforma.
    showDiagnostics: role === "platform_admin",
    calendarExportEnabled: exportEnabled,
    calendarExportItems,
  };
}
