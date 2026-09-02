import { notFound, redirect } from "next/navigation";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getActivityBySlug } from "@/lib/data/activities";
import { getWeeksForActivity } from "@/lib/data/weeks";
import { getActivityDays, getBookedDayDatesForActivity } from "@/lib/data/activity-days";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import PhoneShell from "@/components/PhoneShell";
import ModificaPrenotazioneClient from "./ModificaPrenotazioneClient";

// Pagina "Modifica prenotazione" — richiesta di Fabrizio ("SOLO PER TESTARE
// la possibilità di modificare una prenotazione così posso verificare cosa
// succede lato gestore"). Permette di cambiare le settimane selezionate di
// una prenotazione esistente, rispettando la finestra di preavviso
// configurata dal centro (vedi lib/data/my-bookings.ts:canCancelOrModify).
export default async function ModificaPrenotazionePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // nextgen (01/09/2026, segnalazione Fabrizio "grafica legacy" residua su
  // "Modifica prenotazione"): stessa situazione di /booking/[id] — non esiste
  // una route /nextgen/prenotazioni/[id]/modifica dedicata, quindi il flag va
  // risolto qui server-side con lo stesso resolver TRAMA_ONE_ENABLED (vedi
  // app/booking/[id]/page.tsx) invece che dalla route.
  let nextgen = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/auth/login?next=/prenotazioni/${id}/modifica`);
    nextgen = await resolveFeatureFlag({
      flagName: "TRAMA_ONE_ENABLED",
      userId: user.id,
      role: "parent",
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
  }

  const bookings = await getMyBookingsForParent();
  const booking = bookings.find((b) => b.id === id);
  if (!booking) return notFound();

  const activity = await getActivityBySlug(booking.activityId);
  if (!activity) return notFound();

  // Segnalazione Fabrizio 25/08/2026 ("Modifica prenotazione... qual è il
  // processo ipotizzato?" → decisione: editor add/remove completo per i
  // giorni). Carichiamo giorni + già-prenotati SOLO per prenotazioni a
  // Giorni spot (stesso identico gate di app/activity/[id]/page.tsx),
  // nessun costo aggiuntivo per il ramo a settimana intera invariato sotto.
  const [weeks, days, bookedDayDates] = await Promise.all([
    getWeeksForActivity(activity),
    booking.isDayBased ? getActivityDays(activity) : Promise.resolve([]),
    booking.isDayBased && activity.dbId
      ? getBookedDayDatesForActivity(activity.dbId)
      : Promise.resolve(new Set<string>()),
  ]);

  return (
    <PhoneShell>
      <ModificaPrenotazioneClient
        booking={booking}
        activity={activity}
        weeks={weeks}
        days={days}
        bookedDayDates={[...bookedDayDates]}
        nextgen={nextgen}
      />
    </PhoneShell>
  );
}
