import { notFound, redirect } from "next/navigation";
import { getActivityBySlug } from "@/lib/data/activities";
import { getWeeksForActivity, getBookedWeekIdsForActivity } from "@/lib/data/weeks";
import { getKidsForUser } from "@/lib/data/kids";
import { getEligibleInviteDiscount } from "@/lib/data/invites";
import { getActivityDays } from "@/lib/data/activity-days";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag, resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import PhoneShell from "@/components/PhoneShell";
import BookingClient from "./BookingClient";
// RC 20/11 (16/11/2026), Lotto A: le famiglie non entrano nel flusso di un'attività DEMO.
import Link from "next/link";
import { getDemoAccess } from "@/lib/demo/access";
import { DEMO_BADGE, DEMO_BLOCKED_MESSAGE } from "@/lib/nextgen/demo-label";

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kid?: string }>;
}) {
  const { id } = await params;
  // ?kid= (arrivato da "Aggiungi [bambino]" nel Planner, o dal genitore
  // selezionato in Home/Cerca): se presente, "già prenotata" è calcolato
  // SOLO per questo bambino (vedi getBookedWeekIdsForActivity) — altrimenti
  // una settimana già coperta per UN fratello risulterebbe bloccata anche
  // per l'altro che invece va aggiunto.
  const { kid: requestedKidId } = await searchParams;

  // Prenotare scrive davvero su Supabase (bookings/booking_weeks/booking_kids)
  // legato all'utente autenticato: qui, a differenza del dettaglio attività,
  // richiediamo il login prima di entrare nel flusso.
  //
  // nextgen (01/09/2026, segnalazione Fabrizio "grafica legacy" nel flusso di
  // prenotazione): non esiste una route /nextgen/booking dedicata — Legacy e
  // NextGen linkano entrambi a /booking/[id] (vedi app/activity/[id]/
  // DetailClient.tsx e components/PlannerView.tsx) — quindi il flag va
  // risolto qui server-side, stesso resolver TRAMA_ONE_ENABLED già usato da
  // resolveHomeHref() in app/booking/[id]/success/page.tsx, invece che dalla
  // route (che qui non distingue i due profili).
  let nextgen = false;
  // 15/10/2026 — richiesta senza pagamento (vedi BookingClient, prop v2):
  // stessa visibilità di Prenotazioni V2 (BOOKINGS_V2_ENABLED), solo dentro
  // TRAMA ONE. Fail-closed: qualunque errore → flusso di prima.
  let v2 = false;
  let viewerId: string | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/auth/login?next=/booking/${id}`);
    viewerId = user.id;
    nextgen = await resolveFeatureFlag({
      flagName: "TRAMA_ONE_ENABLED",
      userId: user.id,
      role: "parent",
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
    if (nextgen) {
      v2 = await resolveFeatureFlagVisibility({
        flagName: "BOOKINGS_V2_ENABLED",
        userId: user.id,
        role: "parent",
        tenant: "family",
        correlationId: generateCorrelationId(),
      })
        .then((r) => r.enabled)
        .catch(() => false);
    }
  }

  const activity = await getActivityBySlug(id);
  if (!activity) return notFound();

  const demoMode = isSupabaseConfigured ? (await getDemoAccess(activity.dbId, viewerId, { failClosed: false })).mode : "none";
  if (demoMode === "blocked") {
    return (
      <PhoneShell>
        <div data-testid="demo-booking-blocked" className="flex h-full min-h-screen flex-col justify-center gap-4 px-6 py-8 sm:min-h-0 sm:flex-1">
          <span className="self-start rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[12px] font-bold text-[#92400E]">{DEMO_BADGE}</span>
          <h1 className="font-poppins text-[22px] font-semibold leading-tight text-ink">{activity.name}</h1>
          <p className="text-[15px] leading-relaxed text-ink-2">{DEMO_BLOCKED_MESSAGE}</p>
          <Link
            href="/nextgen/search"
            className="flex min-h-[52px] w-full items-center justify-center rounded-[12px] bg-trama-primary text-[16px] font-semibold text-white active:bg-trama-primary-press"
          >
            Torna a Scopri
          </Link>
        </div>
      </PhoneShell>
    );
  }

  // TRAMA ONE Build Sprint 3 — "Giorni spot": stessa condizione della
  // scheda attività (app/activity/[id]/page.tsx) — solo per attività dove il
  // Gestore l'ha configurata, invariato per tutte le altre.
  const wantsDayAvailability = activity.bookingMode && activity.bookingMode !== "week_only";

  const [weeks, kids, bookedWeekIdsSet, inviteDiscount, days] = await Promise.all([
    getWeeksForActivity(activity),
    getKidsForUser(),
    activity.dbId
      ? getBookedWeekIdsForActivity(activity.dbId, requestedKidId)
      : Promise.resolve(new Set<string>()),
    getEligibleInviteDiscount(),
    wantsDayAvailability ? getActivityDays(activity, { includeAfterSeason: true }) /* 03/11/2026: stessa offerta della scheda (UX-CROSS-002) */ : Promise.resolve([]),
  ]);
  const bookedWeekIds = Array.from(bookedWeekIdsSet);

  return (
    <PhoneShell>
      <BookingClient
        activity={activity}
        weeks={weeks}
        kids={kids}
        bookedWeekIds={bookedWeekIds}
        inviteDiscount={inviteDiscount}
        days={days}
        nextgen={nextgen}
        v2={v2}
        demoSimulate={demoMode === "simulate"}
      />
    </PhoneShell>
  );
}
