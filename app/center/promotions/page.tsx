import PromotionsClient from "./PromotionsClient";
import { getActivitiesForCenter, getPromotionsForActivities } from "@/lib/data/activities";
import { getCenterContext } from "@/lib/data/center-admin";

export default async function CenterPromotionsPage() {
  const { centerDbId, centerSlug } = await getCenterContext();
  const myActivities = await getActivitiesForCenter(centerDbId, centerSlug);
  const myPromotions = await getPromotionsForActivities(myActivities);

  return <PromotionsClient activities={myActivities} initialPromotions={myPromotions} />;
}
