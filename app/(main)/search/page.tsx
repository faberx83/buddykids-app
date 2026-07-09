import { getActivities } from "@/lib/data/activities";
import { getSeasonYear } from "@/lib/data/season-year";
import SearchClient from "./SearchClient";

export default async function SearchPage() {
  const [activities, seasonYear] = await Promise.all([getActivities(), getSeasonYear()]);
  return <SearchClient initialActivities={activities} seasonYear={seasonYear} />;
}
