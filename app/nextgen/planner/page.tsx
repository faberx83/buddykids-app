import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPlannerData } from "@/lib/data/planner";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities, getActivityAvailabilityByWeek } from "@/lib/data/activities";
import { getSeasonYear } from "@/lib/data/season-year";
import { computeSmartMatches } from "@/lib/nextgen/smart-search";
import { computeKidOverlaps, computeBudgetSummary, computePriorityWeekIndex } from "@/lib/nextgen/planner-insights";
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
  const [planner, bookings, kids, activities, availabilityByWeek] = await Promise.all([
    getPlannerData(),
    getMyBookingsForParent(),
    getKidsForUser(),
    getActivities(),
    getActivityAvailabilityByWeek(seasonYear),
  ]);

  const overlaps = computeKidOverlaps(bookings);
  const budget = computeBudgetSummary(bookings);
  const priorityIndex = computePriorityWeekIndex(planner.weeks);
  const priorityWeek = planner.weeks.find((w) => w.index === priorityIndex) ?? null;

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
    />
  );
}
