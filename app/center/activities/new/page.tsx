import { getCenterContext } from "@/lib/data/center-admin";
import NewActivityForm from "./NewActivityForm";

// Difensivo, vedi nota in app/center/activities/[id]/page.tsx.
export const dynamic = "force-dynamic";

export default async function NewActivityPage() {
  const { centerDbId } = await getCenterContext();

  return <NewActivityForm centerReady={!!centerDbId} />;
}
