import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getPlannerData } from "@/lib/data/planner";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities } from "@/lib/data/activities";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import PrenotazioniClient from "@/app/(main)/prenotazioni/PrenotazioniClient";
import PrenotazioniV2Client from "./PrenotazioniV2Client";

// TRAMA ONE — Prenotazioni NEXTGEN-native (24/08/2026): chiude il gap di
// "shell discontinuity" segnalato da Fabrizio ("le prenotazioni vanno ancora
// sul vecchio schema"). Il contenuto (PrenotazioniClient) è già TRAMA-current
// (Sprint 4, DEC-42) e condiviso senza dipendenze LEGACY-specifiche: questa
// pagina lo monta sotto /nextgen così eredita il guscio NEXTGEN (layout +
// NextgenBottomNav) invece di quello LEGACY (app/(main)/layout.tsx +
// BottomNav), con showBrandIcon=true come ogni altra pagina NEXTGEN Genitore.
// Riuso deliberato (non duplicazione): stessa logica di fetch di
// app/(main)/prenotazioni/page.tsx, che resta invariata per il call site
// LEGACY esistente.

// TRAMA — PRENOTAZIONI V2 (14/10/2026): con BOOKINGS_V2_ENABLED acceso la
// pagina diventa PrenotazioniV2Client; spento, errore di lettura o utente
// non autenticato → PrenotazioniClient (LEGACY condiviso), invariato.
async function bookingsV2Enabled(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const r = await resolveFeatureFlagVisibility({
      flagName: "BOOKINGS_V2_ENABLED",
      userId: user.id,
      role: "parent",
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
    return r.enabled;
  } catch {
    return false;
  }
}

function romeTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .slice(0, 10);
}

export default async function NextgenPrenotazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ kid?: string; bookingId?: string; id?: string }>;
}) {
  const { kid, bookingId, id } = await searchParams;

  if (await bookingsV2Enabled()) {
    const [bookings, kids, activities] = await Promise.all([
      getMyBookingsForParent(),
      getKidsForUser(),
      getActivities().catch(() => []),
    ]);
    const hoursByActivityDbId: Record<string, string | undefined> = {};
    for (const a of activities) if (a.dbId) hoursByActivityDbId[a.dbId] = a.hours;
    return (
      <PrenotazioniV2Client
        todayIso={romeTodayIso()}
        bookings={kid ? bookings.filter((b) => b.kidIds.includes(kid)) : bookings}
        kidOrder={kids.map((k) => k.id)}
        hoursByActivityDbId={hoursByActivityDbId}
        initialBookingId={id ?? bookingId ?? null}
      />
    );
  }

  const [bookings, planner, kids] = await Promise.all([
    getMyBookingsForParent(),
    getPlannerData(),
    getKidsForUser(),
  ]);

  return (
    <div className="animate-fade-in">
      <PrenotazioniClient
        bookings={bookings}
        planner={planner}
        kids={kids}
        initialKidFilter={kid ?? null}
        initialHighlightBookingId={bookingId ?? null}
        showBrandIcon
      />
    </div>
  );
}
