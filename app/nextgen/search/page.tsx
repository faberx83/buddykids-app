import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getActivities, getActivityAvailabilityByWeek } from "@/lib/data/activities";
import { getKidsForUser } from "@/lib/data/kids";
import { getPlannerData } from "@/lib/data/planner";
import { getSeasonYear } from "@/lib/data/season-year";
import SearchDiscoveryClient from "./SearchDiscoveryClient";

// SPRINT 2 (NEXTGEN) — "Ricerca e scoperta": meno filtri manuali, più
// contesto del genitore. Nessuna nuova query: riusa getActivities/
// getKidsForUser/getPlannerData/getActivityAvailabilityByWeek, già usate in
// LEGACY (Cerca, Home, Planner) — stesso layer dati, zero duplicazione.
export default async function NextgenSearchPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-8 text-sm text-ink-2">
        Modalità demo: collega Supabase per la Ricerca NEXTGEN con dati reali.
      </div>
    );
  }

  const seasonYear = await getSeasonYear();
  const [activities, kids, planner, availabilityByWeek] = await Promise.all([
    getActivities(),
    getKidsForUser(),
    getPlannerData(),
    getActivityAvailabilityByWeek(seasonYear),
  ]);

  const uncoveredWeek = planner.weeks.find((w) => w.index === planner.firstUncoveredIndex) ?? null;

  return (
    <SearchDiscoveryClient
      activities={activities}
      kids={kids}
      uncoveredWeekStart={uncoveredWeek?.startDate ?? null}
      uncoveredWeekLabel={uncoveredWeek ? `${uncoveredWeek.label} (${uncoveredWeek.dateRange})` : null}
      availabilityByWeek={availabilityByWeek}
    />
  );
}
