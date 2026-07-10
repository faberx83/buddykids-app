import { notFound, redirect } from "next/navigation";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getActivityBySlug } from "@/lib/data/activities";
import { getWeeksForActivity } from "@/lib/data/weeks";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/auth/login?next=/prenotazioni/${id}/modifica`);
  }

  const bookings = await getMyBookingsForParent();
  const booking = bookings.find((b) => b.id === id);
  if (!booking) return notFound();

  const activity = await getActivityBySlug(booking.activityId);
  if (!activity) return notFound();

  const weeks = await getWeeksForActivity(activity);

  return (
    <PhoneShell>
      <ModificaPrenotazioneClient booking={booking} activity={activity} weeks={weeks} />
    </PhoneShell>
  );
}
