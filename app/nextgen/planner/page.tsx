import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPlannerData } from "@/lib/data/planner";
import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getKidsForUser } from "@/lib/data/kids";
import { getActivities, getActivityAvailabilityByWeek } from "@/lib/data/activities";
import { getSeasonYear } from "@/lib/data/season-year";
import { getParentProfile } from "@/lib/data/profile";
import { getResponsibilitiesForParent, getKidsBookedDaysForWeek } from "@/lib/data/responsibilities";
import { WEEKDAYS } from "@/lib/nextgen/responsibility-options";
// TRAMA BETA v1.1.1 — FINAL GAP CLOSURE (punto 6/7): elenco delle persone
// custom persistenti del genitore, per il selettore "Chi fa cosa?". Degrada
// a [] se supabase/migration_32_family_people.sql non è ancora stata
// applicata (vedi lib/data/family-people.ts) — nessun impatto sul resto
// della pagina se la migrazione non è ancora stata eseguita.
import { getFamilyPeopleForParent } from "@/lib/data/family-people";
import { getPlanSharesForParent } from "@/lib/data/plan-shares";
import { getPlannerMapPins } from "@/lib/data/planner-map";
import { getParentAddresses } from "@/lib/data/addresses";
import { getCommunitiesForUser } from "@/lib/data/communities";
import { getGroupsForUser } from "@/lib/data/groups";
import { computeSmartMatches } from "@/lib/nextgen/smart-search";
import { computeKidOverlaps, computeBudgetSummary, computePriorityWeekIndex } from "@/lib/nextgen/planner-insights";
import { computeMissions } from "@/lib/nextgen/missions";
import { computeReminders } from "@/lib/nextgen/reminders";
import PlannerClient from "./PlannerClient";
// TRAMA — Calendar Export V1 · ANTEPRIMA INTERNA (11/09/2026, richiesta di
// Fabrizio, §7 della spec "obbligatoria": "La pagina/superficie deve
// risolvere la visibilità SERVER-SIDE"). Prima vera pagina che chiama
// resolveFeatureFlagVisibility() (finora usata solo per progettare
// InternalPreviewBadge, mai montata su una pagina reale — vedi commento in
// lib/feature-flags/internal-preview.ts). Import diretto di
// createClient/lib/supabase/server: già importato altrove in questo file
// indirettamente (getMyBookingsForParent ecc. lo fanno internamente), qui
// serve esplicitamente per risolvere userId/role prima di chiamare il
// resolver, stesso pattern di app/one/layout.tsx.
import { createClient } from "@/lib/supabase/server";
import { resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { anyResolvedViaInternalPreview } from "@/lib/feature-flags/internal-preview";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getPlannerCalendarItemsForParent, type PlannerCalendarItem } from "@/lib/planner/calendar-items";
// TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026, §B12 "Dark Release").
// Stesso identico pattern di CALENDAR_EXPORT_ENABLED appena sopra —
// risoluzione server-side, badge SOLO se risolto via internal-preview,
// fetch dei dati SOLO se il flag è davvero abilitato per questo utente.
import { getSchoolCalendarPlannerContext, type SchoolCalendarPlannerContext } from "@/lib/data/school-calendar";

// TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS: stessa tecnica di
// addDaysIso duplicata altrove nel repo (lib/nextgen/week-roles.ts,
// app/nextgen/page.tsx, app/nextgen/planner/settimana/[startDate]/page.tsx).
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// SPRINT 3 (NEXTGEN) — "trasformare il Planner nella feature principale del
// prodotto... il cuore dell'esperienza" (richiesta di Fabrizio): timeline
// familiare, copertura, sovrapposizioni, settimane scoperte, budget usato,
// attività consigliate — tutto in una sola pagina. Nessuna nuova query di
// base: riusa getPlannerData/getMyBookingsForParent/getKidsForUser/
// getActivities/getActivityAvailabilityByWeek (stesse di Dashboard Sprint 1 e
// Ricerca Sprint 2) + computeSmartMatches (Sprint 2, invariato). Le uniche
// funzioni NUOVE sono in lib/nextgen/planner-insights.ts (sovrapposizioni e
// budget), che leggono solo i dati già qui, senza toccare il DB una volta di
// più.
export default async function NextgenPlannerPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-8 text-sm text-ink-2">
        Modalità demo: collega Supabase per il Planner NEXTGEN con dati reali.
      </div>
    );
  }

  // TRAMA — Calendar Export V1 · ANTEPRIMA INTERNA (11/09/2026). Risoluzione
  // server-side di CALENDAR_EXPORT_ENABLED — §7 della spec: "Nessuna CTA,
  // nessun badge, nessuna rotta/azione alternativa per un utente normale".
  // userId/role risolti qui con lo STESSO pattern di app/one/layout.tsx
  // (unica altra pagina che chiama il resolver oggi) — proxy.ts garantisce
  // già login richiesto sul dominio famiglie, quindi user qui non dovrebbe
  // mai essere null, ma il fallback "flag disattivato" resta sicuro anche
  // in quel caso limite.
  let calendarExportEnabled = false;
  let calendarExportBadgeVisible = false;
  let calendarExportItems: PlannerCalendarItem[] = [];
  // TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026, §B12). Stessi 3
  // default sicuri di Calendar Export: OFF finché non risolto, nessun dato
  // fetchato per un utente a cui il flag risolve false.
  let schoolCalendarEnabled = false;
  let schoolCalendarContext: SchoolCalendarPlannerContext = { hasAnySchoolProfile: false, needByWeekIndex: {}, kidIdsWithoutProfile: [] };
  let residenceCity: string | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let role: string | null = null;
    if (user) {
      const { data: profileRow } = await supabase.from("profiles").select("role, city").eq("id", user.id).single();
      role = (profileRow?.role as string) ?? "parent";
      residenceCity = (profileRow?.city as string) ?? null;
    }
    // PERF FIX (14/09/2026, segnalato da Fabrizio: "in generale è rallentata
    // l'app") — le due risoluzioni flag sono INDIPENDENTI (nessuna legge
    // l'output dell'altra) ma venivano awaited in sequenza, aggiungendo un
    // intero round-trip extra ad OGNI caricamento del Planner anche per un
    // utente a cui entrambi i flag risolvono false. Nessun cambio di
    // comportamento — stesso risultato, calcolato in parallelo invece che
    // in coda (§B13 resta rispettato: nessuno stato condiviso tra i due,
    // solo la Promise stessa è parallela).
    const [calendarExportDetail, schoolCalendarDetail] = await Promise.all([
      resolveFeatureFlagVisibility({
        flagName: "CALENDAR_EXPORT_ENABLED",
        userId: user?.id ?? null,
        role,
        tenant: "family",
        correlationId: generateCorrelationId(),
      }),
      resolveFeatureFlagVisibility({
        flagName: "SCHOOL_CALENDAR_INTELLIGENCE_ENABLED",
        userId: user?.id ?? null,
        role,
        tenant: "family",
        correlationId: generateCorrelationId(),
      }),
    ]);
    calendarExportEnabled = calendarExportDetail.enabled;
    schoolCalendarEnabled = schoolCalendarDetail.enabled;
    // Fetch dei dati SOLO se il flag è davvero abilitato per questo utente:
    // un utente normale (flag off) non riceve mai questi dati come prop,
    // nemmeno nascosti via CSS — §7: "nessuna rotta/azione alternativa".
    if (calendarExportEnabled) {
      calendarExportItems = await getPlannerCalendarItemsForParent();
    }

    // Un solo "corner ribbon" ANTEPRIMA INTERNA per la pagina, calcolato
    // sull'insieme di TUTTE le capability gated risolte qui (oggi 2) — vince
    // se ALMENO UNA è stata risolta specificamente via cohort:
    // "internal-preview" (mai per il solo fatto che l'utente appartiene alla
    // coorte, §7 — la stessa garanzia di prima si estende naturalmente a un
    // insieme di detail invece di uno solo).
    calendarExportBadgeVisible = anyResolvedViaInternalPreview([calendarExportDetail, schoolCalendarDetail]);
  }

  const seasonYear = await getSeasonYear();
  const [
    planner,
    bookings,
    kids,
    activities,
    availabilityByWeek,
    profile,
    responsibilities,
    familyPeople,
    existingShares,
    mapPins,
    communities,
    groups,
    addresses,
  ] = await Promise.all([
    getPlannerData(),
    getMyBookingsForParent(),
    getKidsForUser(),
    getActivities(),
    getActivityAvailabilityByWeek(seasonYear),
    getParentProfile(),
    getResponsibilitiesForParent(),
    getFamilyPeopleForParent(),
    getPlanSharesForParent(),
    getPlannerMapPins(),
    getCommunitiesForUser(),
    getGroupsForUser(),
    // SPRINT 4 correttivo (feedback Fabrizio, mockup Mappa: "va bene metter
    // origine uno degli indirizzi, ma lasciare scelta all'utente") — stessi
    // indirizzi già letti per Promemoria/Indirizzi (nessuna nuova query),
    // qui servono per lasciare scegliere l'indirizzo di partenza in
    // PlannerMapView invece di aprire solo la destinazione su Maps.
    getParentAddresses(),
  ]);

  // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS: stessa tecnica già usata
  // in app/nextgen/page.tsx (Home) — union delle date lun-ven di tutte le
  // settimane non "dismissed", una sola query invece di una per settimana
  // (getKidsBookedDaysForWeek accetta già un array arbitrario di date). Il
  // filtro "futuro/rilevante" (stessa convenzione di computeHeroWeeksSummary)
  // viene applicato lato client in PlannerClient.tsx con todayIso, non qui.
  const weekdayDatesUnion = Array.from(
    new Set(
      planner.weeks
        .filter((w) => !w.dismissed)
        .flatMap((w) => WEEKDAYS.map((wd) => addDaysIso(w.startDate, wd.dayOffset)))
    )
  );
  const coordinationBookedDays = await getKidsBookedDaysForWeek(weekdayDatesUnion);

  // TRAMA — SCHOOL CALENDAR INTELLIGENCE (§B12): fetch SOLO se il flag è
  // davvero abilitato per questo utente (stesso principio di
  // calendarExportItems sopra) — planner.weeks/kids sono già disponibili
  // qui (nessuna query duplicata, §B2/§B11: "non duplicare query
  // esistenti"). getSchoolCalendarPlannerContext degrada sempre a un
  // contesto vuoto/sicuro su qualunque errore, non lancia mai un'eccezione.
  if (schoolCalendarEnabled) {
    schoolCalendarContext = await getSchoolCalendarPlannerContext(
      planner.weeks.map((w) => ({ index: w.index, startDate: w.startDate, endDate: w.endDate, covered: w.covered, dismissed: w.dismissed })),
      kids.map((k) => k.id)
    );
  }

  const overlaps = computeKidOverlaps(bookings);
  const budget = computeBudgetSummary(bookings, activities);
  const todayIso = new Date().toISOString().slice(0, 10);
  // BUG CORRETTO 06/08/2026 (segnalato da Fabrizio: "il motore deve sempre
  // funzionare in relazione al timestamp reale... le settimane prima devono
  // già essere non modificabili") — todayIso passato a computePriorityWeekIndex
  // cosi' una settimana già trascorsa e mai coperta non venga più segnalata
  // "priorità" (vedi lib/nextgen/planner-insights.ts).
  const priorityIndex = computePriorityWeekIndex(planner.weeks, todayIso);
  const priorityWeek = planner.weeks.find((w) => w.index === priorityIndex) ?? null;
  const missions = computeMissions(planner, bookings, activities, kids);
  const reminders = computeReminders(planner, bookings, priorityIndex, overlaps, budget, profile.seasonBudgetTarget, todayIso, kids);

  const recommendations = priorityWeek
    ? computeSmartMatches(activities, kids, {
        uncoveredWeekStart: priorityWeek.startDate,
        availabilityByWeek,
      }).slice(0, 4)
    : [];

  return (
    <PlannerClient
      planner={planner}
      kids={kids}
      overlaps={overlaps}
      budget={budget}
      priorityIndex={priorityIndex}
      todayIso={todayIso}
      recommendations={recommendations}
      missions={missions}
      reminders={reminders}
      seasonBudgetTarget={profile.seasonBudgetTarget}
      // TRAMA BETA v1.1.1 (UI Refinement, punto 15) — profile.parentRole era
      // già letto qui (riga sopra, getParentProfile()) ma mai passato a
      // valle: nessuna nuova query, solo un prop in più per risolvere
      // "Mamma"/"Papà" nel selettore Chi fa cosa (vedi
      // lib/nextgen/responsibility-options.ts#resolveResponsibleOptions).
      parentRole={profile.parentRole}
      responsibilities={responsibilities}
      // TRAMA BETA v1.1.1 — ORGANIZATION COMPLETENESS: dati grezzi per il
      // gap di coordinamento stagionale (§9), derivato lato client via
      // computeCoordinationGap, stessa convenzione di heroWeeks/priorityWeek.
      coordinationBookedDays={coordinationBookedDays}
      familyPeople={familyPeople}
      existingShares={existingShares}
      mapPins={mapPins}
      communities={communities}
      groups={groups}
      addresses={addresses}
      // TRAMA — Calendar Export V1 · ANTEPRIMA INTERNA (11/09/2026): items
      // già vuoti/enabled=false per costruzione se il flag è off (vedi
      // sopra) — PlannerClient non deve fare nessuna ulteriore verifica di
      // sicurezza, ma resta comunque difensivo (non mostra nulla se enabled
      // è false, indipendentemente dal contenuto di items).
      calendarExportEnabled={calendarExportEnabled}
      calendarExportBadgeVisible={calendarExportBadgeVisible}
      calendarExportItems={calendarExportItems}
      // TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026): stesso principio
      // difensivo di Calendar Export — schoolCalendarContext è già "vuoto"
      // per costruzione se il flag è off, PlannerClient/i componenti a
      // valle non mostrano nulla in quel caso indipendentemente dal
      // contenuto.
      schoolCalendarEnabled={schoolCalendarEnabled}
      schoolCalendarContext={schoolCalendarContext}
      residenceCity={residenceCity}
    />
  );
}
