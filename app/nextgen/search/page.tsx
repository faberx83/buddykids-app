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
import { getCuratedFavoriteLeadIds } from "@/lib/data/curated-favorites";
// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), NOVITÀ TRAMA — LEVEL 2.
// Caso reale scelto per il MVP (§15 del task: "preferenza: Scoperte TRAMA
// in /nextgen/search").
import { getContextualAnnouncementForSurface } from "@/lib/data/announcements";
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
import { persistProductEvent } from "@/lib/telemetry/events";
import { REAL_DISCOVERY_LEADS, type DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";
// TRAMA — EXTERNAL PLANNER ITEMS (sezioni 7/15/16 del task): "Aggiungi al
// Planner" da una Scoperta TRAMA. Stesso pattern Dark Release delle altre
// capability gated di questa pagina — flag risolto server-side, dataset
// (qui: solo il set di curated_lead_id già nel Planner, per il badge "✓ Nel
// Planner") fetchato SOLO se abilitato.
import { getCuratedLeadIdsInPlanner, getCommunityDiscoveryIdsInPlanner } from "@/lib/data/external-planner-items";
// TRAMA — RADAR / COMMUNITY DISCOVERY (13/10/2026), patch 2: stesso pattern
// Dark Release — flag RADAR_ENABLED risolto server-side, scoperte community
// lette SOLO se il flag risolve true per questo utente.
import { getVisibleCommunityDiscoveries } from "@/lib/data/radar";
import { isRadarPhotoAvailable } from "@/lib/radar/provider";
import type { CommunityDiscoveryRecord } from "@/lib/radar/community";
import { getActivityOpenRanges, getActivityDateRows, getTestFixtureCenterIds } from "@/lib/data/activities";
import { getInactiveCenterIdsForViewer, unionCenterIds } from "@/lib/data/center-activation";
// TRAMA — CORREZIONI DAL TEST UX (21/10/2026): date vere su card e periodi.
import { PARENT_UX_FIX_FLAG, summarizeActivityDates, withoutTestFixtures, type ActivityDateSummary } from "@/lib/nextgen/parent-ux-fix";
import { getKidClosureIntervalsForParent } from "@/lib/data/school-calendar";
import { listClosurePeriods } from "@/lib/nextgen/holiday-summary";
import { buildDiscoverPeriods, type DiscoverPeriod } from "@/lib/nextgen/discover-v2";
import { getSeasonWeekRanges, isoDate } from "@/lib/season-weeks";

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
  const [allActivities, kids, planner, availabilityByWeek, activitiesWithDaySpots, favoriteActivityIds, curatedFavoriteLeadIds] =
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
      // TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), CURATED
      // FAVORITES — stesso principio, sulla tabella curated_favorites.
      getCuratedFavoriteLeadIds(),
    ]);
  // Correzioni dal test UX (21/10/2026), ciclo 4-L: può perdere i centri di prova (sotto).
  let activities = allActivities;
  const contextualAnnouncement = await getContextualAnnouncementForSurface("/nextgen/search");

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
  // TRAMA — EXTERNAL PLANNER ITEMS: stessi 2 default sicuri delle altre
  // capability gated di questa pagina.
  let externalPlannerItemsEnabled = false;
  let curatedLeadIdsInPlanner: string[] = [];
  let radarEnabled = false;
  let communityDiscoveries: CommunityDiscoveryRecord[] = [];
  let communityIdsInPlanner: string[] = [];
  // TRAMA — SCOPRI V2 (14/10/2026): null = Scopri attuale, invariato.
  let discoverV2: { periods: DiscoverPeriod[]; activityRanges: Record<string, { start: string; end: string }[]> } | null = null;
  // TRAMA — CORREZIONI DAL TEST UX (21/10/2026): null = comportamento di prima.
  let parentUxFix: { dateSummaries: Record<string, ActivityDateSummary> } | null = null;
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
    const [realDiscoveryDetail, externalPlannerItemsDetail, radarDetail, discoverV2Detail, schoolDetail, uxFixDetail] = await Promise.all([
      resolveFeatureFlagVisibility({
        flagName: "REAL_DISCOVERY_DATASET_ENABLED",
        userId: user?.id ?? null,
        role,
        tenant: "family",
        correlationId: generateCorrelationId(),
      }),
      resolveFeatureFlagVisibility({
        flagName: "EXTERNAL_PLANNER_ITEMS_ENABLED",
        userId: user?.id ?? null,
        role,
        tenant: "family",
        correlationId: generateCorrelationId(),
      }),
      resolveFeatureFlagVisibility({
        flagName: "RADAR_ENABLED",
        userId: user?.id ?? null,
        role,
        tenant: "family",
        correlationId: generateCorrelationId(),
      }),
      resolveFeatureFlagVisibility({
        flagName: "DISCOVER_V2_ENABLED",
        userId: user?.id ?? null,
        role,
        tenant: "family",
        correlationId: generateCorrelationId(),
      }).catch(() => ({ enabled: false })),
      resolveFeatureFlagVisibility({
        flagName: "SCHOOL_CALENDAR_INTELLIGENCE_ENABLED",
        userId: user?.id ?? null,
        role,
        tenant: "family",
        correlationId: generateCorrelationId(),
      }).catch(() => ({ enabled: false })),
      resolveFeatureFlagVisibility({
        flagName: PARENT_UX_FIX_FLAG,
        userId: user?.id ?? null,
        role,
        tenant: "family",
        correlationId: generateCorrelationId(),
      }).catch(() => ({ enabled: false })),
    ]);
    if (user && discoverV2Detail.enabled) {
      try {
        const [activityRanges, closureData] = await Promise.all([
          getActivityOpenRanges(),
          schoolDetail.enabled
            ? getKidClosureIntervalsForParent(kids.map((k) => k.id)).catch(() => ({ hasAnySchoolProfile: false, closuresByKid: [] }))
            : Promise.resolve({ hasAnySchoolProfile: false, closuresByKid: [] }),
        ]);
        const seasonRanges = getSeasonWeekRanges(seasonYear);
        const summer =
          seasonRanges.length > 0
            ? { start: isoDate(seasonRanges[0].start), end: isoDate(seasonRanges[seasonRanges.length - 1].end) }
            : null;
        discoverV2 = {
          activityRanges,
          periods: buildDiscoverPeriods({
            todayIso,
            closures: listClosurePeriods(closureData.closuresByKid, todayIso),
            summer,
            summerYear: summer ? seasonYear : null,
          }),
        };
      } catch {
        discoverV2 = null; // ripiego: Scopri attuale
      }
    }
    // Correzioni dal test UX (21/10/2026), UX-PARENT-002, ciclo 4-L: i
    // centri di prova (centers.is_test_fixture) fuori dal catalogo famiglie,
    // con o senza Scopri V2. L'Admin piattaforma continua a vederli.
    // Portale centri V2 (27/10/2026, PARTNER_V2_ENABLED): anche i centri non
    // ancora attivati da TRAMA restano fuori dal catalogo.
    if (user) {
      const inactive = await getInactiveCenterIdsForViewer(user.id, role);
      if (uxFixDetail.enabled || inactive.size > 0) {
        const fixtures = uxFixDetail.enabled ? await getTestFixtureCenterIds() : new Set<string>();
        activities = withoutTestFixtures(activities, unionCenterIds(fixtures, inactive), role);
      }
    }
    // Solo con Scopri V2: le correzioni riguardano la presentazione V2.
    if (user && discoverV2 && uxFixDetail.enabled) {
      try {
        const rows = await getActivityDateRows();
        const dateSummaries: Record<string, ActivityDateSummary> = {};
        for (const a of activities) {
          if (a.dbId) dateSummaries[a.dbId] = summarizeActivityDates(rows[a.dbId], todayIso, a.bookingMode);
        }
        parentUxFix = { dateSummaries };
      } catch {
        parentUxFix = null; // ripiego: Scopri V2 di prima
      }
    }
    // Il Radar richiede un utente autenticato (invio contenuti, preferiti).
    radarEnabled = Boolean(user) && radarDetail.enabled;
    if (radarEnabled) {
      communityDiscoveries = await getVisibleCommunityDiscoveries(supabase);
      if (externalPlannerItemsDetail.enabled) {
        communityIdsInPlanner = Array.from(await getCommunityDiscoveryIdsInPlanner());
      }
    }
    if (realDiscoveryDetail.enabled) {
      // Dataset code-based (nessuna query, nessun I/O) — vedi
      // lib/discovery/real-dataset.ts. Il filtro per compatibilità con la
      // settimana selezionata resta lato client (SearchDiscoveryClient già
      // legge il query param "week", stesso pattern di §14 del report).
      realDiscoveryLeads = REAL_DISCOVERY_LEADS;
    }
    externalPlannerItemsEnabled = externalPlannerItemsDetail.enabled;
    if (externalPlannerItemsEnabled) {
      curatedLeadIdsInPlanner = Array.from(await getCuratedLeadIdsInPlanner());
    }
    realDiscoveryBadgeVisible = anyResolvedViaInternalPreview([realDiscoveryDetail, externalPlannerItemsDetail, radarDetail]);

    // TRAMA — FAMILY-FIRST BETA PASS (07/10/2026): segnale "apertura Scopri"
    // (product_events, best-effort: mai bloccante per la pagina).
    if (user) {
      try {
        await persistProductEvent(
          { event: "discovery_opened", correlationId: generateCorrelationId(), tenant: "family", role },
          { supabase, userId: user.id }
        );
      } catch {
        // telemetria persa: nessun impatto sulla pagina
      }
    }
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
      curatedFavoriteLeadIds={Array.from(curatedFavoriteLeadIds)}
      externalPlannerItemsEnabled={externalPlannerItemsEnabled}
      curatedLeadIdsInPlanner={curatedLeadIdsInPlanner}
      radarEnabled={radarEnabled}
      radarPhotoEnabled={isRadarPhotoAvailable()}
      communityDiscoveries={communityDiscoveries}
      communityIdsInPlanner={communityIdsInPlanner}
      discoverV2={discoverV2}
      parentUxFix={parentUxFix}
      contextualAnnouncement={
        contextualAnnouncement
          ? {
              id: contextualAnnouncement.id,
              userTitle: contextualAnnouncement.userTitle,
              userBody: contextualAnnouncement.userBody,
              deepLink: contextualAnnouncement.deepLink,
            }
          : null
      }
    />
  );
}
