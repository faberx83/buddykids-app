import { getActivities } from "@/lib/data/activities";
import SearchClient from "./SearchClient";

export default async function SearchPage() {
  const activities = await getActivities();
  return <SearchClient initialActivities={activities} />;
}
