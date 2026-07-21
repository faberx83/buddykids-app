import {
  getActivities,
  getActivityAvailabilityByWeek,
  getActivitiesWithOpenDaySpots,
} from "@/lib/data/activities";
import { getSeasonYear } from "@/lib/data/season-year";
import { getKidsForUser } from "@/lib/data/kids";
import SearchClient from "./SearchClient";

export default async function SearchPage() {
  const [activities, seasonYear, kids, activitiesWithDaySpots] = await Promise.all([
    getActivities(),
    getSeasonYear(),
    getKidsForUser(),
    getActivitiesWithOpenDaySpots(),
  ]);
  // Richiede seasonYear (già risolto sopra) per generare la griglia delle 13
  // settimane della disponibilità — fatta apposta in una seconda query dopo,
  // non in parallelo con getSeasonYear.
  const availabilityByWeek = await getActivityAvailabilityByWeek(seasonYear);
  return (
    <SearchClient
      initialActivities={activities}
      seasonYear={seasonYear}
      kids={kids}
      availabilityByWeek={availabilityByWeek}
      activitiesWithDaySpots={Array.from(activitiesWithDaySpots)}
    />
  );
}
