import { test, expect } from "@playwright/test";
import { isRealDeployment } from "../fixtures/roles";
import {
  validateExternalPlannerItemInput,
  buildExternalPlannerItemInputFromCuratedLead,
  type ExternalPlannerItemInput,
} from "../../lib/planner/external-planner-items-core";
import { REAL_DISCOVERY_LEADS, type DiscoveryLeadRecord } from "../../lib/discovery/real-dataset";
import { KNOWN_PRODUCT_EVENTS } from "../../lib/telemetry/known-events";

// TRAMA — EXTERNAL PLANNER ITEMS. Stesso principio "[no browser]" già
// stabilito da curated-favorites.spec.ts/real-discovery-pilot.spec.ts:
// lib/data/external-planner-items.ts#validateExternalPlannerItemInput/
// buildExternalPlannerItemInputFromCuratedLead sono logica pura (nessun
// I/O) — testate qui senza mock Supabase. I casi che richiedono davvero un
// DB/una sessione reale (create/edit/delete/refresh persistence/auth-RLS/
// multi-child leakage/Curated→Planner end-to-end/Coverage live/Feature
// Flag OFF→ON) sono gated `isRealDeployment`, stesso pattern del resto di
// tests/one/ — MIGRATION 39 NON ANCORA APPLICATA in produzione as-of questa
// sessione: anche in un deploy reale questi test falliranno con 42P01
// finché Fabrizio non la applica (comportamento atteso, non un bug — vedi
// supabase/migration_39_external_planner_items.sql).
//
// Comando (solo i test puri): npx playwright test tests/one/external-planner-items.spec.ts --grep "no browser"

function input(overrides: Partial<ExternalPlannerItemInput> = {}): ExternalPlannerItemInput {
  return {
    kind: "commitment",
    title: "Dentista",
    startDate: "2026-10-06",
    endDate: "2026-10-06",
    allDay: true,
    startTime: null,
    endTime: null,
    location: null,
    notes: null,
    externalUrl: null,
    kidIds: ["kid-1"],
    ...overrides,
  };
}

function lead(overrides: Partial<DiscoveryLeadRecord> = {}): DiscoveryLeadRecord {
  return { ...REAL_DISCOVERY_LEADS[0], ...overrides };
}

test.describe("External Planner Items — validateExternalPlannerItemInput (no browser)", () => {
  test("EPI-01 [no browser] - input minimo valido (solo campi obbligatori) passa", () => {
    expect(validateExternalPlannerItemInput(input()).valid).toBe(true);
  });

  test("EPI-02 [no browser] - titolo vuoto/whitespace rifiutato", () => {
    expect(validateExternalPlannerItemInput(input({ title: "" })).valid).toBe(false);
    expect(validateExternalPlannerItemInput(input({ title: "   " })).valid).toBe(false);
  });

  test("EPI-03 [no browser] - nessun bambino selezionato rifiutato (campo obbligatorio, sezione 3/4 del task)", () => {
    const result = validateExternalPlannerItemInput(input({ kidIds: [] }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/bambino/i);
  });

  test("EPI-04 [no browser] - multi-day valido: end_date dopo start_date", () => {
    const result = validateExternalPlannerItemInput(input({ startDate: "2026-06-10", endDate: "2026-06-14" }));
    expect(result.valid).toBe(true);
  });

  test("EPI-05 [no browser] - one-day valido: end_date == start_date", () => {
    const result = validateExternalPlannerItemInput(input({ startDate: "2026-06-10", endDate: "2026-06-10" }));
    expect(result.valid).toBe(true);
  });

  test("EPI-06 [no browser] - end_date PRIMA di start_date rifiutato (multi-day invertito)", () => {
    const result = validateExternalPlannerItemInput(input({ startDate: "2026-06-14", endDate: "2026-06-10" }));
    expect(result.valid).toBe(false);
  });

  test("EPI-07 [no browser] - all_day=true: orari non validati anche se incoerenti (ignorati per costruzione)", () => {
    const result = validateExternalPlannerItemInput(
      input({ allDay: true, startTime: "18:00", endTime: "09:00" })
    );
    expect(result.valid).toBe(true);
  });

  test("EPI-08 [no browser] - all_day=false, stesso giorno, ora fine prima di ora inizio: rifiutato", () => {
    const result = validateExternalPlannerItemInput(
      input({ allDay: false, startDate: "2026-10-06", endDate: "2026-10-06", startTime: "18:00", endTime: "09:00" })
    );
    expect(result.valid).toBe(false);
  });

  test("EPI-09 [no browser] - multi-child: due o più kidIds valido", () => {
    const result = validateExternalPlannerItemInput(input({ kidIds: ["kid-1", "kid-2"] }));
    expect(result.valid).toBe(true);
  });
});

test.describe("External Planner Items — buildExternalPlannerItemInputFromCuratedLead / SNAPSHOT PRINCIPLE (no browser)", () => {
  test("EPI-10 [no browser] - lead con date note: snapshot usa le date reali del lead, non 'oggi'", () => {
    const l = lead({ startDate: "2026-06-15", endDate: "2026-06-19" });
    const built = buildExternalPlannerItemInputFromCuratedLead(l, ["kid-1"]);
    expect(built.startDate).toBe("2026-06-15");
    expect(built.endDate).toBe("2026-06-19");
    expect(built.kind).toBe("activity");
    expect(built.kidIds).toEqual(["kid-1"]);
  });

  test("EPI-11 [no browser] - lead SOURCE-ONLY senza date note: fallback sicuro a 'oggi', mai un dato inventato più specifico", () => {
    const l = lead({ startDate: null, endDate: null });
    const built = buildExternalPlannerItemInputFromCuratedLead(l, ["kid-1"]);
    const today = new Date().toISOString().slice(0, 10);
    expect(built.startDate).toBe(today);
    expect(built.endDate).toBe(today);
    expect(built.notes).toMatch(/non indicate/i);
  });

  test("EPI-12 [no browser] - titolo/organizzatore/url snapshot dal lead, invariati per qualunque valore del dataset", () => {
    const l = lead();
    const built = buildExternalPlannerItemInputFromCuratedLead(l, ["kid-1"]);
    expect(built.title).toBe(l.activityTitle);
    expect(built.externalUrl).toBe(l.registrationUrl || l.officialUrl);
  });

  test("EPI-13 [no browser] - lo snapshot è sempre valido secondo validateExternalPlannerItemInput (nessun campo obbligatorio mancante)", () => {
    for (const l of REAL_DISCOVERY_LEADS.slice(0, 5)) {
      const built = buildExternalPlannerItemInputFromCuratedLead(l, ["kid-1"]);
      expect(validateExternalPlannerItemInput(built).valid).toBe(true);
    }
  });
});

test.describe("External Planner Items — Analytics whitelist (no browser)", () => {
  test("EPI-14 [no browser] - sezione 25 del task: i 4 eventi minimi sono registrati in KNOWN_PRODUCT_EVENTS", () => {
    for (const event of [
      "external_planner_item_created",
      "external_planner_item_updated",
      "external_planner_item_deleted",
      "curated_added_to_planner",
    ]) {
      expect((KNOWN_PRODUCT_EVENTS as readonly string[]).includes(event)).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// SCENARI GATED — richiedono deploy reale (DB, RLS, sessione utente reale,
// migration 39 applicata, EXTERNAL_PLANNER_ITEMS_ENABLED risolto per
// l'account di test). REQUIRES LIVE VALIDATION — mai eseguiti in questo
// sandbox: elencati qui come test manuali per Fabrizio (sezione 31 del
// task, "Nessun browser reale disponibile — STATIC ONLY").
// ════════════════════════════════════════════════════════════════
test.describe("External Planner Items — scenari live (REQUIRES LIVE VALIDATION)", () => {
  test("EPI-L01 - MANUAL: creare un impegno one-off (all-day) e vederlo nel Planner dopo refresh", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con migration 39 applicata e flag risolto true.");
  });
  test("EPI-L02 - MANUAL: creare un impegno timed (all_day=false, orari) e vederlo correttamente formattato", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L03 - MANUAL: creare un impegno multi-day (es. 10-14 giugno) e verificarne il rendering su week/month boundary", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L04 - MANUAL: modificare titolo/date/orari/luogo/note di un impegno esistente, verificare persistenza", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L05 - MANUAL: eliminare un impegno (soft-delete) — non deve più comparire nel Planner dopo refresh", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L06 - AUTH/RLS: un genitore non deve mai vedere/modificare gli impegni di un altro genitore", () => {
    test.skip(!isRealDeployment, "Richiede due account di test reali e verifica diretta Supabase (RLS) — REQUIRES LIVE VALIDATION.");
  });
  test("EPI-L07 - CHILD: impegno associato a un solo bambino — visibile solo per quel bambino nei filtri Planner", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L08 - CHILD: impegno associato a più bambini della stessa famiglia — nessuna duplicazione della riga", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L09 - CHILD: nessun leakage di kid_id tra famiglie diverse (RLS su external_planner_item_kids)", () => {
    test.skip(!isRealDeployment, "Richiede due account di test reali — REQUIRES LIVE VALIDATION.");
  });
  test("EPI-L10 - DISCOVERY: 'Aggiungi al Planner' su una Scoperta INVITABLE crea l'item, nessun center_lead creato come side-effect", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con REAL_DISCOVERY_DATASET_ENABLED + EXTERNAL_PLANNER_ITEMS_ENABLED attivi.");
  });
  test("EPI-L11 - DISCOVERY: 'Aggiungi al Planner' su una Scoperta SOURCE-ONLY funziona allo stesso modo", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L12 - DISCOVERY: lo snapshot sopravvive a una modifica del dataset code-based (deploy con lead aggiornato)", () => {
    test.skip(!isRealDeployment, "Richiede una modifica reale di lib/discovery/real-dataset.ts tra due deploy — REQUIRES LIVE VALIDATION.");
  });
  test("EPI-L13 - DISCOVERY: rimuovere un lead dal dataset code-based non fa sparire l'item già nel Planner", () => {
    test.skip(!isRealDeployment, "Richiede una modifica reale del dataset — REQUIRES LIVE VALIDATION.");
  });
  test("EPI-L14 - DISCOVERY: aggiungere ai Preferiti E al Planner sono stati indipendenti (uno non tocca l'altro)", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L15 - PLANNER: la sezione 'I tuoi impegni' compare nella pagina Planner senza rompere Timeline/Missioni/Promemoria", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L16 - COVERAGE: un Commitment (es. dentista 1h) NON marca la settimana come 'covered'/'priority' cambiato", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale — verifica diretta di computeWeekStatus invariato per la settimana interessata.");
  });
  test("EPI-L17 - COVERAGE: un'Activity full-day esterna (centro estivo) NON marca comunque la settimana 'covered' in questo rilascio (regola conservativa V1)", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L18 - COVERAGE: School Calendar 'da organizzare'/'già coperta' invariato dalla presenza di un impegno esterno", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con SCHOOL_CALENDAR_INTELLIGENCE_ENABLED attivo.");
  });
  test("EPI-L19 - COVERAGE: la copertura Partner esistente (booking_weeks/booking_days) resta bit-per-bit invariata", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("EPI-L20 - REGRESSION: bookings/Discovery/Curated Favorites/Proponi invito/School Calendar/Notifiche invariati dopo il rilascio", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale — golden journey completa.");
  });
  test("EPI-L21 - FEATURE FLAG OFF: nessuna traccia UI di 'I tuoi impegni'/'Aggiungi al Planner' per un utente senza cohort internal-preview", () => {
    test.skip(!isRealDeployment, "Richiede un account di test reale senza l'override.");
  });
  test("EPI-L22 - FEATURE FLAG internal-preview: sezione Planner + CTA Discovery visibili, badge ANTEPRIMA INTERNA corretto", () => {
    test.skip(!isRealDeployment, "Richiede un account di test reale con l'override cohort:internal-preview.");
  });
});
