import CenterProfileClient from "./CenterProfileClient";
import { getMyCenter } from "@/lib/data/center-admin";

export default async function CenterProfilePage() {
  const { center, dbId } = await getMyCenter();
  return <CenterProfileClient center={center} dbId={dbId} />;
}
