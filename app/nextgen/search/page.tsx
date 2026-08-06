import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getActivities,
  getActivityAvailabilityByWeek,
  getActivitiesWithOpenDaySpots,
} from "@/lib/data/activities";
import { getKidsForUser } from "@/lib/data/kids";
import { getPlannerData } from "@/lib/data/planner";
import { getSeasonYear } from "@/lib/data/season-year";
import SearchDiscoveryClient from "./SearchDiscoveryClient";

// SPRINT 2 (NEXTGEN) — "Ricerca e scoperta": ordinamento intelligente sopra
// il contesto del genitore. Nessuna nuova query: riusa getActivities/
// getKidsForUser/getPlannerData/getActivityAvailabilityByWeek, già usate in
// LEGACY (Cerca, Home, Planner) — stesso layer dati, zero duplicazione.
//
// SPRINT 5.7 (NEXTGEN) — seasonYear ora passato al client per calcolare le
// 13 settimane stagionali del filtro "Data" (ripristinato da LEGACY).
export default async function NextgenSearchPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-8 text-sm text-ink-2">
        Modalità demo: collega Supabase per la Ricerca NEXTGEN con dati reali.
      </div>
    );
  }

  const seasonYear = await getSeasonYear();
  const [activities, kids, planner, availabilityByWeek, activitiesWithDaySpots] = await Promise.all([
    getActivities(),
    getKidsForUser(),
    getPlannerData(),
    getActivityAvailabilityByWeek(seasonYear),
    getActivitiesWithOpenDaySpots(),
  ]);

  const uncoveredWeek = planner.weeks.find((w) => w.index === planner.firstUncoveredIndex) ?? null;
  // BUG CORRETTO 07/08/2026 — stesso pattern di app/nextgen/planner/page.tsx:
  // "oggi" calcolato una volta lato server, passato al client per nascondere
  // le settimane passate dal filtro "Settimane di camp" (vedi
  // SearchDiscoveryClient.tsx).
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <SearchDiscoveryClient
      activities={activities}
      kids={kids}
      seasonYear={seasonYear}
      uncoveredWeekStart={uncoveredWeek?.startDate ?? null}
      uncoveredWeekLabel={uncoveredWeek ? `${uncoveredWeek.label} (${uncoveredWeek.dateRange})` : null}
      availabilityByWeek={availabilityByWeek}
      activitiesWithDaySpots={Array.from(activitiesWithDaySpots)}
      todayIso={todayIso}
    />
  );
}
