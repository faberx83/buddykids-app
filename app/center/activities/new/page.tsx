import { getCenterContext } from "@/lib/data/center-admin";
import NewActivityForm from "./NewActivityForm";
import TemplateActivityForm from "@/components/center/TemplateActivityForm";
import { describeDates, getTemplate, templateDates } from "@/lib/centers/activity-templates";
import { partnerShellEnabledForCurrentUser } from "@/lib/centers/partner-v2-flag";

// Difensivo, vedi nota in app/center/activities/[id]/page.tsx.
export const dynamic = "force-dynamic";

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ modello?: string | string[] }>;
}) {
  const { centerDbId } = await getCenterContext();

  // Portale centri V2 (28/10/2026): "Crea da modello" (ponte, Natale,
  // pomeriggi) con i giorni della stagione già pronti. Senza guscio, o senza
  // modello, il modulo di sempre.
  const modello = (await searchParams).modello;
  const template = getTemplate(typeof modello === "string" ? modello : null);
  if (template && centerDbId && (await partnerShellEnabledForCurrentUser())) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    const dates = templateDates(template.key, today);
    return <TemplateActivityForm template={template} datesCount={dates.length} datesLabel={describeDates(dates)} />;
  }

  return <NewActivityForm centerReady={!!centerDbId} />;
}
