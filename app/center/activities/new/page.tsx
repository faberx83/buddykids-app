import { getCenterContext } from "@/lib/data/center-admin";
import NewActivityForm from "./NewActivityForm";

export default async function NewActivityPage() {
  const { centerDbId } = await getCenterContext();

  return <NewActivityForm centerReady={!!centerDbId} />;
}
