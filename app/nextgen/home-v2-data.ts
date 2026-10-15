// TRAMA — HOME V2 (Fase 1, 13/10/2026). Assemblaggio server-side dei dati
// della Home V2, chiamato da app/nextgen/page.tsx SOLO con HOME_V2_ENABLED
// acceso. Nessuna nuova tabella, nessuna scrittura: orchestra funzioni di
// lettura già esistenti (stesse usate dalla Home attuale e dal Planner) e
// la logica pura di lib/nextgen/{home-inbox,today-agenda,season-summary}.ts
// e lib/nextgen/holiday-summary.ts (ponti e vacanze, prossima chiusura).
//
// Fetch in più rispetto alla Home attuale (solo qui, mai nella Home
// attuale): impegni esterni (solo con EXTERNAL_PLANNER_ITEMS_ENABLED),
// intervalli di chiusura scolastica (solo con
// SCHOOL_CALENDAR_INTELLIGENCE_ENABLED), inviti ai gruppi.

import type { PlannerData } from "@/lib/data/planner";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities, isMockActivitiesArray } from "@/lib/data/activities";
import { getTodayCheckinsForParent } from "@/lib/data/checkin";
import { getResponsibilitiesForParent, getKidsBookedDaysForWeek } from "@/lib/data/responsibilities";
import { isParentProfileIncomplete, getParentProfile } from "@/lib/data/profile";
import { getMyGroupInvites } from "@/lib/data/groups";
import { getExternalPlannerItemsForParent } from "@/lib/data/external-planner-items";
import { getKidClosureIntervalsForParent } from "@/lib/data/school-calendar";
import { computeMatchesForKid } from "@/lib/matching";
import { resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { WEEKDAYS, resolveResponsibleDisplay } from "@/lib/nextgen/responsibility-options";
import { computeRolesToCover } from "@/lib/nextgen/week-roles";
import { dayCoordinationSlots } from "@/lib/nextgen/planner-week";
import { buildTodayAgenda, summarizeDayCoordination, type DayCoordinationSlotInput } from "@/lib/nextgen/today-agenda";
import { selectUrgentTodayAlert, type HomeInboxInput } from "@/lib/nextgen/home-inbox";
import { buildSeasonSummary, periodTitleForSeason } from "@/lib/nextgen/season-summary";
import { buildCoverage, buildHolidaySummary, closureState, listClosurePeriods } from "@/lib/nextgen/holiday-summary";
import { NEW_EXTERNAL_ITEM_HREF } from "@/lib/planner/new-external-item-link";
import type { Activity, Kid, GroupInviteItem } from "@/lib/types";
import type { ExternalPlannerItem } from "@/lib/data/external-planner-items";
import type HomeDashboardV2Client from "./HomeDashboardV2Client";

export type HomeV2Props = Parameters<typeof HomeDashboardV2Client>[0];

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Data di oggi a Roma (il server gira in UTC: tra mezzanotte e le 2 il giorno sarebbe sbagliato). */
export function romeTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function mondayOfIso(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return addDaysIso(iso, -((d.getUTCDay() + 6) % 7));
}

async function flagOn(flagName: string, userId: string): Promise<boolean> {
  try {
    const detail = await resolveFeatureFlagVisibility({
      flagName,
      userId,
      role: "parent",
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
    return detail.enabled;
  } catch {
    return false; // fail-closed, stesso principio di resolveFeatureFlag
  }
}

/** Stessa idea della Home attuale (app/nextgen/page.tsx): prima un consiglio per figlio, poi i migliori punteggi. */
function pickRecommendations(activities: Activity[], kids: Kid[], max: number) {
  type Rec = { activity: Activity; kidName: string; matchPercent: number };
  const all: Rec[] = [];
  for (const a of activities) {
    for (const kid of kids) {
      const match = computeMatchesForKid(kid, [a])[0];
      all.push({ activity: a, kidName: kid.name, matchPercent: match?.matchPercent ?? 0 });
    }
  }
  const out: Rec[] = [];
  const used = new Set<string>();
  if (kids.length > 1) {
    for (const kid of kids) {
      const best = all
        .filter((r) => r.kidName === kid.name && !used.has(r.activity.id))
        .sort((a, b) => b.matchPercent - a.matchPercent)[0];
      if (best) {
        out.push(best);
        used.add(best.activity.id);
      }
    }
  }
  for (const r of all.slice().sort((a, b) => b.matchPercent - a.matchPercent)) {
    if (out.length >= max) break;
    if (used.has(r.activity.id)) continue;
    out.push(r);
    used.add(r.activity.id);
  }
  return out.slice(0, max).map((r) => ({ activity: r.activity, kidName: r.kidName }));
}

/** Primo e ultimo giorno prenotato: settimane intere o giorni spot. */
function bookingSpan(b: { weeks: { startDate: string; endDate: string }[]; dayDates: string[] }): {
  firstDate: string | null;
  lastDate: string | null;
} {
  const starts = [...b.weeks.map((w) => w.startDate), ...b.dayDates].sort();
  const ends = [...b.weeks.map((w) => w.endDate), ...b.dayDates].sort();
  return { firstDate: starts[0] ?? null, lastDate: ends[ends.length - 1] ?? null };
}

export async function loadHomeV2Props({
  userId,
  fullName,
  planner,
}: {
  userId: string;
  fullName: string | null;
  planner: PlannerData;
}): Promise<HomeV2Props> {
  const todayIso = romeTodayIso();
  const weekStartIso = mondayOfIso(todayIso);

  const [externalEnabled, schoolEnabled, navV2Enabled] = await Promise.all([
    flagOn("EXTERNAL_PLANNER_ITEMS_ENABLED", userId),
    flagOn("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", userId),
    // Nuova barra (14/10): il Profilo si apre dall'avatar nell'intestazione.
    flagOn("NAV_V2_ENABLED", userId),
  ]);

  const weekdayDatesUnion = Array.from(
    new Set(
      planner.weeks
        .filter((w) => !w.dismissed)
        .flatMap((w) => WEEKDAYS.map((wd) => addDaysIso(w.startDate, wd.dayOffset)))
    )
  );

  const [
    bookings,
    kids,
    activities,
    todayCheckins,
    profileIncomplete,
    profile,
    responsibilities,
    bookedDays,
    groupInvites,
    externalItems,
  ] = await Promise.all([
    getMyBookingsForParent(),
    getKidsForUser(),
    getActivities(),
    getTodayCheckinsForParent(),
    isParentProfileIncomplete(),
    getParentProfile(),
    getResponsibilitiesForParent(),
    getKidsBookedDaysForWeek(weekdayDatesUnion),
    getMyGroupInvites().catch((): GroupInviteItem[] => []),
    externalEnabled
      ? getExternalPlannerItemsForParent().catch((): ExternalPlannerItem[] => [])
      : Promise.resolve([] as ExternalPlannerItem[]),
  ]);

  const kidList = kids.map((k) => ({ id: k.id, name: k.name }));
  const kidNameById: Record<string, string> = Object.fromEntries(kidList.map((k) => [k.id, k.name]));
  const kidIds = kidList.map((k) => k.id);

  // ── Oggi ──
  const hoursByActivityDbId: Record<string, string | undefined> = {};
  for (const a of activities) if (a.dbId) hoursByActivityDbId[a.dbId] = a.hours;
  const agenda = buildTodayAgenda({
    todayIso,
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      partnerDecision: b.partnerDecision,
      activityName: b.activityName,
      activityDbId: b.activityDbId,
      centerName: b.centerName,
      isDayBased: b.isDayBased,
      dayDates: b.dayDates,
      weeks: b.weeks,
      kidIds: b.kidIds,
      kidNames: b.kidNames,
    })),
    externalItems: externalItems.map((i) => ({
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
    })),
    hoursByActivityDbId,
    kidNameById,
  });

  // 15/10/2026 (Fabrizio: "Si confermo"): Porta/Ritira di oggi con la STESSA
  // regola del Planner V2 — tutto l'anno (prima solo nelle settimane
  // dell'estate: a ottobre il blocco non compariva mai) e anche per gli
  // impegni aggiunti a mano. Solo lun–ven, come week_responsibilities.
  const coordinationInput = {
    bookings: bookings.map((b) => ({
      status: b.status,
      kidIds: b.kidIds,
      kidNames: b.kidNames,
      weeks: b.weeks,
      dayDates: b.dayDates,
    })),
    externalItems: externalItems.map((i) => ({ startDate: i.startDate, endDate: i.endDate, kidIds: i.kidIds })),
    responsibilities,
    kidNameById,
    labelFor: (r: (typeof responsibilities)[number]) => resolveResponsibleDisplay(r, profile.parentRole).label,
  };
  const slots: DayCoordinationSlotInput[] = dayCoordinationSlots({ ...coordinationInput, dateIso: todayIso });
  const coordination = summarizeDayCoordination(slots);
  const urgentAlert = selectUrgentTodayAlert(
    slots.map((s) => ({ ...s, date: todayIso })),
    todayIso,
    weekStartIso
  );

  // ── Da fare ──
  // Prossimi 7 giorni, stessa regola di "Oggi" (prima: solo settimane estive).
  const soon: { kidName: string; moment: (typeof slots)[number]["moment"]; date: string }[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const date = addDaysIso(todayIso, i);
    for (const s of dayCoordinationSlots({ ...coordinationInput, dateIso: date })) {
      if (s.label === null) soon.push({ kidName: s.kidName, moment: s.moment, date });
    }
  }
  const inboxInput: Omit<HomeInboxInput, "pushInactive"> = {
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      partnerDecision: b.partnerDecision,
      activityName: b.activityName,
      kidNames: b.kidNames,
      weeksLabel: b.weeksLabel,
      ...bookingSpan(b),
      acceptedDayCount: b.acceptedDayCount,
      totalDayCount: b.totalDayCount,
    })),
    todayIso,
    upcomingCoordination:
      soon.length > 0
        ? {
            missingCount: soon.length,
            firstKidName: soon[0].kidName,
            firstMoment: soon[0].moment,
            firstDate: soon[0].date,
            weekStartDate: mondayOfIso(soon[0].date),
          }
        : null,
    groupInvites: groupInvites.map((g) => ({
      id: g.id,
      groupName: g.groupName,
      inviterName: g.inviterName,
      activityName: g.activityName,
    })),
    profileIncomplete,
  };

  // ── Riepilogo del periodo ──
  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  const isNewFamily = kidList.length === 0 || (activeBookings.length === 0 && externalItems.length === 0);
  const summary = buildSeasonSummary({
    title: periodTitleForSeason(planner.weeks),
    kidIds,
    todayIso,
    isNewFamily,
    weeks: planner.weeks.map((w) => ({
      index: w.index,
      startDate: w.startDate,
      endDate: w.endDate,
      dateRange: w.dateRange,
      dismissed: w.dismissed,
      awaitingPartnerConfirmation: w.awaitingPartnerConfirmation,
      coveredKidIds: Array.from(
        new Set(w.coveredKids.filter((k) => k.partnerDecision !== "rejected").map((k) => k.kidId))
      ),
      missingCoordinationSlots: computeRolesToCover(w.startDate, bookedDays, responsibilities).missingSlots,
    })),
  });

  // ── Prossima chiusura (e passo "scuola" del benvenuto) ──
  const closureData = schoolEnabled
    ? await getKidClosureIntervalsForParent(kidIds).catch(() => ({ hasAnySchoolProfile: false, closuresByKid: [] }))
    : { hasAnySchoolProfile: false, closuresByKid: [] };
  // Chiusure dei prossimi mesi con il loro stato (organizzata / da
  // completare / da organizzare) — lib/nextgen/holiday-summary.ts.
  const coverage = buildCoverage({
    bookings: bookings.map((b) => ({
      status: b.status,
      partnerDecision: b.partnerDecision,
      kidIds: b.kidIds,
      weeks: b.weeks,
      dayDates: b.dayDates,
    })),
    externalItems,
  });
  const closurePeriods = schoolEnabled
    ? listClosurePeriods(closureData.closuresByKid, todayIso).map((p) => ({ ...p, state: closureState(p, coverage) }))
    : [];
  // "Prossima chiusura" = la prima futura NON ancora organizzata (14/10:
  // una chiusura già coperta non deve più chiedere "Organizza").
  const closure = closurePeriods.find((p) => p.startDate > todayIso && p.state !== "organized") ?? null;
  // Fuori stagione estiva il riepilogo diventa "Ponti e vacanze".
  const holidaySummary = schoolEnabled ? buildHolidaySummary({ periods: closurePeriods, todayIso }) : null;

  const welcome =
    summary.state === "welcome"
      ? {
          body:
            "Mettete qui le attività che i vostri figli fanno già, anche se il centro non è su TRAMA. Al resto pensiamo insieme.",
          steps: [
            {
              label: "Aggiungi i tuoi figli",
              detail: kidList.length > 0 ? kidList.map((k) => k.name).join(" · ") : "Nome ed età",
              done: kidList.length > 0,
            },
            {
              label: "Aggiungi un impegno della settimana",
              detail: "Nuoto, inglese, calcio: ciò che fanno già",
              done: activeBookings.length > 0 || externalItems.length > 0,
            },
            ...(schoolEnabled
              ? [{ label: "Indica la scuola", detail: "Ti avvisiamo prima di ogni chiusura", done: closureData.hasAnySchoolProfile }]
              : []),
          ],
          cta:
            kidList.length === 0
              ? { label: "Aggiungi i tuoi figli", href: "/nextgen/profile?addKid=1" }
              : externalEnabled
                ? { label: "Aggiungi il primo impegno", href: NEW_EXTERNAL_ITEM_HREF }
                : { label: "Cerca un'attività", href: "/nextgen/search" },
        }
      : null;

  const attention = summary.firstAttention;
  const attentionAction = attention
    ? attention.state === "to_organize"
      ? { label: "Organizza", href: `/nextgen/planner/settimana/${attention.startDate}` }
      : { label: "Completa", href: `/nextgen/planner?mode=calendario&week=${attention.startDate}` }
    : null;

  // ── Suggerimenti: solo se c'è una settimana libera da riempire ──
  const recommendations =
    planner.firstUncoveredIndex !== null && kidList.length > 0 ? pickRecommendations(activities, kids, 3) : [];

  return {
    firstName: fullName?.split(" ")[0] ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    todayIso,
    weekStartIso,
    kids: kidList,
    agenda,
    coordination,
    urgentAlert,
    inboxInput,
    todayCheckins,
    // Estate interamente trascorsa (es. vista a ottobre): al posto di "14
    // settimane da organizzare" già passate, il riepilogo "Ponti e vacanze"
    // dei prossimi mesi di scuola (o niente, senza calendario scolastico).
    // Lo stato di benvenuto resta, perché non dipende dalle date.
    summary: summary.isOver && summary.state !== "welcome" ? holidaySummary : summary,
    welcome,
    attentionAction,
    notStartedAction: { label: "Inizia a pianificare", href: "/nextgen/planner" },
    nextClosure: closure
      ? {
          startDate: closure.startDate,
          endDate: closure.endDate,
          labels: closure.labels,
          kidNames: closure.kidIds.map((id) => kidNameById[id]).filter(Boolean),
          weekdayCount: closure.weekdayCount,
        }
      : null,
    recommendations,
    recommendationsTitle: "Idee per le settimane libere",
    externalPlannerItemsEnabled: externalEnabled,
    navV2Enabled,
    activitiesAreMockFallback: isMockActivitiesArray(activities),
  };
}
