import { activities, demoCenterAdminCenterId, promotions } from "@/lib/mock-data";
import PromotionsClient from "./PromotionsClient";

export default function CenterPromotionsPage() {
  const myActivities = activities.filter((a) => a.centerId === demoCenterAdminCenterId);
  const myPromotions = promotions.filter((p) =>
    myActivities.some((a) => a.id === p.activityId)
  );

  return <PromotionsClient activities={myActivities} initialPromotions={myPromotions} />;
}
