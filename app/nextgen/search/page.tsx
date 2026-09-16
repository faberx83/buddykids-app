import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getActivities,
  getActivityAvailabilityByWeek,
  getActivitiesWithOpenDaySpots,
} from "@/lib/data/activities";
import { getKidsForUser } from "@/lib/data/kids";
import { getPlannerData } from "@/lib/data/planner";
import { getSeasonYear } from "@/lib/data/season-year";
import { getFavoriteActivityIds } from "@/lib/data/favorites";
import SearchDiscoveryClient from "./SearchDiscoveryClient";
// TRAMA — REAL DISCOVERY PILOT (16/09/2026) · ANTEPRIMA INTERNA. Stesso
// identico pattern Dark Release di app/nextgen/planner/page.tsx
// (CALENDAR_EXPORT_ENABLED/SCHOOL_CALENDAR_INTELLIGENCE_ENABLED): il flag va
// risolto SERVER-SIDE, il dataset (code-based, zero I/O — vedi
// lib/discovery/real-dataset.ts) viene passato al client SOLO se il flag
// risolve true per questo utente, mai altrimenti — un utente a cui il flag
// risolve false riceve esattamente lo stesso identico prop di prima
// (array vuoto), nessuna differenza di comportamento.
import { createClient } from "@/lib/supabase/server";
import { resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { anyResolvedViaInternalPreview } from "@/lib/feature-flags/internal-preview";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { REAL_DISCOVERY_LEADS, type DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";

// SPRINT 2 (NEXTGEN) — "Ricerca e scoperta": ordinamento intelligente sopra
// il contesto del genitore. Nessuna nuova query: riusa getActivities/
// getKidsForUser/getPlannerData/getActivityAvailabilityByWeek, già usate in
// LEGACY (Cerca, Home, Planner) — stesso layer dati, zero duplicazione.
//
// SPRINT 5.7 (NEXTGEN) — seasonYear ora passato al client per calcolare le
// 13 settimane stagionali del filtro "Data" (ripristinato da LEGACY).
export default async function NextgenSearchPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-8 text-sm text-ink-2">
        Modalità demo: collega Supabase per la Ricerca NEXTGEN con dati reali.
      </div>
    );
  }

  const seasonYear = await getSeasonYear();
  const [activities, kids, planner, availabilityByWeek, activitiesWithDaySpots, favoriteActivityIds] =
    await Promise.all([
      getActivities(),
      getKidsForUser(),
      getPlannerData(),
      getActivityAvailabilityByWeek(seasonYear),
      getActivitiesWithOpenDaySpots(),
      // FIX (segnalazione Fabrizio 06/09/2026: "il preferito non si vede
      // nella lista Scopri") — stessa fonte già usata dal Dettaglio
      // attività (lib/data/favorites.ts), qui serve per inizializzare il
      // cuore delle card della lista con lo stato reale invece che sempre
      // vuoto.
      getFavoriteActivityIds(),
    ]);

  const uncoveredWeek = planner.weeks.find((w) => w.index === planner.firstUncoveredIndex) ?? null;
  // BUG CORRETTO 07/08/2026 — stesso pattern di app/nextgen/planner/page.tsx:
  // "oggi" calcolato una volta lato server, passato al client per nascondere
  // le settimane passate dal filtro "Settimane di camp" (vedi
  // SearchDiscoveryClient.tsx).
  const todayIso = new Date().toISOString().slice(0, 10);

  // TRAMA — REAL DISCOVERY PILOT (16/09/2026). Default sicuro: nessun dato,
  // nessun badge, finché il flag non risolve true per QUESTO utente — stesso
  // principio "OFF finché non risolto" degli altri 3 flag Dark Release già
  // in produzione (Calendar Export, School Calendar Intelligence, Global
  // Action Progress).
  let realDiscoveryLeads: DiscoveryLeadRecord[] = [];
  let realDiscoveryBadgeVisible = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let role: string | null = null;
    if (user) {
      const { data: profileRow } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      role = (profileRow?.role as string) ?? "parent";
    }
    const realDiscoveryDetail = await resolveFeatureFlagVisibility({
      flagName: "REAL_DISCOVERY_DATASET_ENABLED",
      userId: user?.id ?? null,
      role,
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
    if (realDiscoveryDetail.enabled) {
      // Dataset code-based (nessuna query, nessun I/O) — vedi
      // lib/discovery/real-dataset.ts. Il filtro per compatibilità con la
      // settimana selezionata resta lato client (SearchDiscoveryClient già
      // legge il query param "week", stesso pattern di §14 del report).
      realDiscoveryLeads = REAL_DISCOVERY_LEADS;
    }
    realDiscoveryBadgeVisible = anyResolvedViaInternalPreview([realDiscoveryDetail]);
  }

  return (
    <SearchDiscoveryClient
      activities={activities}
      kids={kids}
      seasonYear={seasonYear}
      uncoveredWeekStart={uncoveredWeek?.startDate ?? null}
      uncoveredWeekLabel={uncoveredWeek ? `${uncoveredWeek.label} (${uncoveredWeek.dateRange})` : null}
      availabilityByWeek={availabilityByWeek}
      activitiesWithDaySpots={Array.from(activitiesWithDaySpots)}
      todayIso={todayIso}
      favoriteActivityIds={Array.from(favoriteActivityIds)}
      realDiscoveryLeads={realDiscoveryLeads}
      realDiscoveryBadgeVisible={realDiscoveryBadgeVisible}
    />
  );
}
