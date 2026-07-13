import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPlannerData } from "@/lib/data/planner";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities, getActivityAvailabilityByWeek } from "@/lib/data/activities";
import { getSeasonYear } from "@/lib/data/season-year";
import { getParentProfile } from "@/lib/data/profile";
import { getResponsibilitiesForParent } from "@/lib/data/responsibilities";
import { getPlanSharesForParent } from "@/lib/data/plan-shares";
import { getPlannerMapPins } from "@/lib/data/planner-map";
import { computeSmartMatches } from "@/lib/nextgen/smart-search";
import { computeKidOverlaps, computeBudgetSummary, computePriorityWeekIndex } from "@/lib/nextgen/planner-insights";
import { computeMissions } from "@/lib/nextgen/missions";
import { computeReminders } from "@/lib/nextgen/reminders";
import PlannerClient from "./PlannerClient";

// SPRINT 3 (NEXTGEN) — "trasformare il Planner nella feature principale del
// prodotto... il cuore dell'esperienza" (richiesta di Fabrizio): timeline
// familiare, copertura, sovrapposizioni, settimane scoperte, budget usato,
// attività consigliate — tutto in una sola pagina. Nessuna nuova query di
// base: riusa getPlannerData/getMyBookingsForParent/getKidsForUser/
// getActivities/getActivityAvailabilityByWeek (stesse di Dashboard Sprint 1 e
// Ricerca Sprint 2) + computeSmartMatches (Sprint 2, invariato). Le uniche
// funzioni NUOVE sono in lib/nextgen/planner-insights.ts (sovrapposizioni e
// budget), che leggono solo i dati già qui, senza toccare il DB una volta di
// più.
export default async function NextgenPlannerPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-8 text-sm text-ink-2">
        Modalità demo: collega Supabase per il Planner NEXTGEN con dati reali.
      </div>
    );
  }

  const seasonYear = await getSeasonYear();
  const [planner, bookings, kids, activities, availabilityByWeek, profile, responsibilities, existingShares, mapPins] =
    await Promise.all([
      getPlannerData(),
      getMyBookingsForParent(),
      getKidsForUser(),
      getActivities(),
      getActivityAvailabilityByWeek(seasonYear),
      getParentProfile(),
      getResponsibilitiesForParent(),
      getPlanSharesForParent(),
      getPlannerMapPins(),
    ]);

  const overlaps = computeKidOverlaps(bookings);
  const budget = computeBudgetSummary(bookings, activities);
  const priorityIndex = computePriorityWeekIndex(planner.weeks);
  const priorityWeek = planner.weeks.find((w) => w.index === priorityIndex) ?? null;
  const missions = computeMissions(planner, bookings, activities, kids);
  const todayIso = new Date().toISOString().slice(0, 10);
  const reminders = computeReminders(planner, bookings, priorityIndex, overlaps, budget, profile.seasonBudgetTarget, todayIso);

  const recommendations = priorityWeek
    ? computeSmartMatches(activities, kids, {
        uncoveredWeekStart: priorityWeek.startDate,
        availabilityByWeek,
      }).slice(0, 4)
    : [];

  return (
    <PlannerClient
      planner={planner}
      kids={kids}
      overlaps={overlaps}
      budget={budget}
      priorityIndex={priorityIndex}
      recommendations={recommendations}
      missions={missions}
      reminders={reminders}
      seasonBudgetTarget={profile.seasonBudgetTarget}
      responsibilities={responsibilities}
      existingShares={existingShares}
      mapPins={mapPins}
    />
  );
}
