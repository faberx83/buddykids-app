import { notFound } from "next/navigation";
import { getActivityBySlug, getPromotionsForActivity } from "@/lib/data/activities";
import { getFavoriteActivityIds } from "@/lib/data/favorites";
import { getApprovedCertificationsForActivity } from "@/lib/data/certifications";
import { getActivityDays, getBookedDayDatesForActivity } from "@/lib/data/activity-days";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import PhoneShell from "@/components/PhoneShell";
import DetailClient from "./DetailClient";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const activity = await getActivityBySlug(id);
  if (!activity) return notFound();

  // nextgen (01/09/2026, segnalazione Fabrizio "grafica legacy" nel dettaglio
  // attività): non esiste una route /nextgen/activity/... dedicata — Legacy e
  // NextGen linkano entrambi a /activity/[id] (vedi components/PlannerView.tsx,
  // components/nextgen/BookingVisualCard.tsx, components/nextgen/
  // PlannerMapView.tsx, app/nextgen/community/[id]/CommunityDetailClient.tsx),
  // quindi il flag va risolto qui server-side, stesso resolver TRAMA_ONE_ENABLED
  // già usato da app/booking/[id]/page.tsx. A differenza della Prenotazione,
  // questa pagina permette la visione anonima (nessun redirect al login) — se
  // non c'è un utente autenticato risolviamo semplicemente a false invece di
  // forzare un login, che sarebbe un cambio di comportamento e non solo di stile.
  let nextgen = false;
  // PLANNER BETA v1.1 (Wave 4, punto 22 "Activity Detail booking-aware") —
  // segnalazione: "Home → Prossimo appuntamento → Activity Detail" mostrava
  // ancora 'Prenota ora' anche per un'attività già prenotata (semanticamente
  // errato). La CTA dell'Activity Detail deve dipendere dallo STATO REALE
  // del genitore rispetto all'attività (booking esistente/status/
  // canCancelOrModify), non dalla route di provenienza — quindi lo stato si
  // risolve QUI, una sola volta, per qualunque punto di ingresso (Home,
  // Planner, Scopri, Le mie prenotazioni linkano tutti alla stessa route
  // condivisa /activity/[id], vedi commento sopra). Riuso: getMyBookingsForParent
  // (stessa funzione di "Le mie prenotazioni"/Planner, già calcola status e
  // canCancelOrModify) — nessuna nuova query/tabella, nessuna nuova
  // interpretazione dello stato prenotazione.
  let existingBooking: { id: string; status: "pending" | "confirmed" | "cancelled"; canCancelOrModify: boolean } | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [flagResult, bookings] = await Promise.all([
        resolveFeatureFlag({
          flagName: "TRAMA_ONE_ENABLED",
          userId: user.id,
          role: "parent",
          tenant: "family",
          correlationId: generateCorrelationId(),
        }),
        getMyBookingsForParent(),
      ]);
      nextgen = flagResult;
      // getMyBookingsForParent() è già ordinata per created_at desc: .find
      // restituisce quindi la prenotazione ATTIVA più recente per questa
      // attività se il genitore ne ha più di una (es. bambini diversi in
      // momenti diversi) — "cancelled" non conta come prenotazione attiva.
      const match = activity.dbId
        ? bookings.find((b) => b.activityDbId === activity.dbId && b.status !== "cancelled")
        : undefined;
      if (match) {
        existingBooking = { id: match.id, status: match.status, canCancelOrModify: match.canCancelOrModify };
      }
    }
  }

  // TRAMA ONE Build Sprint 3: "Giorni spot" — la disponibilità giorno-per-
  // giorno serve solo per attività che NON sono a sola settimana intera
  // (bookingMode "day_only"/"mixed"). Per "week_only" (o assente = comportamento
  // storico) saltiamo del tutto la query, invariato per tutte le attività non
  // ancora configurate a Giorni spot lato Gestore.
  const wantsDayAvailability = activity.bookingMode && activity.bookingMode !== "week_only";
  const [promotions, favoriteIds, certifications, days, bookedDayDates] = await Promise.all([
    getPromotionsForActivity(activity),
    getFavoriteActivityIds(),
    getApprovedCertificationsForActivity(activity.dbId),
    wantsDayAvailability ? getActivityDays(activity) : Promise.resolve([]),
    // Segnalazione 25/08/2026 (Fabrizio): i giorni già prenotati per questa
    // attività devono distinguersi visivamente nella scheda "Giorni spot",
    // altrimenti sembra che il genitore non abbia prenotato nulla.
    wantsDayAvailability && activity.dbId
      ? getBookedDayDatesForActivity(activity.dbId)
      : Promise.resolve(new Set<string>()),
  ]);
  const initialFavorite = Boolean(activity.dbId && favoriteIds.has(activity.dbId));

  return (
    <PhoneShell>
      <DetailClient
        activity={activity}
        promotions={promotions}
        initialFavorite={initialFavorite}
        certifications={certifications}
        days={days}
        bookedDayDates={[...bookedDayDates]}
        nextgen={nextgen}
        existingBooking={existingBooking}
      />
    </PhoneShell>
  );
}
