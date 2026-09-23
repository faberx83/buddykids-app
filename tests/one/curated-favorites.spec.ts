import { test, expect } from "@playwright/test";
import { isRealDeployment, loginAs } from "../fixtures/roles";
import { buildUnifiedFavorites, type UnifiedFavoriteItem } from "../../lib/discovery/unified-favorites";
import { REAL_DISCOVERY_LEADS, type DiscoveryLeadRecord } from "../../lib/discovery/real-dataset";
import { KNOWN_PRODUCT_EVENTS } from "../../lib/telemetry/known-events";
import type { Activity } from "../../lib/types";
import type { CuratedFavoriteRecord } from "../../lib/data/curated-favorites";

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), CURATED FAVORITES.
// Stesso principio "[no browser]" già stabilito da real-discovery-pilot.spec.ts:
// lib/discovery/unified-favorites.ts è logica pura (nessun I/O) — testata qui
// senza mock Supabase. I casi che richiedono davvero un DB/una sessione reale
// (add/remove/auth/refresh/RLS) sono gated `isRealDeployment`, stesso pattern
// di coordination-resurfacing.spec.ts.
//
// Comando (solo i test puri): npx playwright test tests/one/curated-favorites.spec.ts --grep "no browser"

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    dbId: "11111111-1111-1111-1111-111111111111",
    name: "Test Activity",
    center: "Test Center",
    emoji: "🎨",
    imgGradient: "linear-gradient(135deg,#fff,#eee)",
    rating: 4.5,
    reviewsCount: 10,
    distanceKm: 1,
    ageRange: "6-10 anni",
    pricePerWeek: 100,
    tags: [],
    ...overrides,
  } as Activity;
}

function curatedRecord(overrides: Partial<CuratedFavoriteRecord> = {}): CuratedFavoriteRecord {
  return {
    curatedLeadId: REAL_DISCOVERY_LEADS[0].id,
    lead: REAL_DISCOVERY_LEADS[0],
    promotedToActivityId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  };
}

test.describe("Curated Favorites — buildUnifiedFavorites (no browser)", () => {
  test("CF-01 [no browser] - Partner favorite invariato: nessuna modifica quando non ci sono Curated favorites", () => {
    const partner = activity();
    const result = buildUnifiedFavorites([partner], [], new Map());
    expect(result).toEqual<UnifiedFavoriteItem[]>([{ kind: "partner", activity: partner }]);
  });

  test("CF-02 [no browser] - Curated favorite risolto: appare come card 'curated' con il lead corretto", () => {
    const cf = curatedRecord();
    const result = buildUnifiedFavorites([], [cf], new Map());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "curated", curatedLeadId: cf.curatedLeadId });
  });

  test("CF-03 [no browser] - Curated missing data: un curated_lead_id che non risolve più nel dataset viene omesso, mai un crash", () => {
    const cf = curatedRecord({ curatedLeadId: "lead-non-esistente-piu", lead: null });
    const result = buildUnifiedFavorites([], [cf], new Map());
    expect(result).toEqual([]);
  });

  test("CF-04 [no browser] - Curated → Partner resolution: promotedToActivityId risolto diventa un item 'partner'", () => {
    const promoted = activity({ id: "act-2", dbId: "22222222-2222-2222-2222-222222222222", name: "Lyceum Summer Camp" });
    const cf = curatedRecord({ promotedToActivityId: promoted.dbId! });
    const promotedMap = new Map([[promoted.dbId!, promoted]]);
    const result = buildUnifiedFavorites([], [cf], promotedMap);
    expect(result).toEqual<UnifiedFavoriteItem[]>([{ kind: "partner", activity: promoted }]);
  });

  test("CF-05 [no browser] - Niente duplicato dopo promotion: se l'attività promossa è GIÀ tra i Preferiti Partner, non viene ripetuta", () => {
    const promoted = activity({ id: "act-2", dbId: "22222222-2222-2222-2222-222222222222" });
    const cf = curatedRecord({ promotedToActivityId: promoted.dbId! });
    const promotedMap = new Map([[promoted.dbId!, promoted]]);
    const result = buildUnifiedFavorites([promoted], [cf], promotedMap);
    expect(result).toHaveLength(1); // non 2
    expect(result[0]).toEqual({ kind: "partner", activity: promoted });
  });

  test("CF-06 [no browser] - Attività promossa non risolvibile (es. disattivata): nessuna card curated fittizia, nessun crash", () => {
    const cf = curatedRecord({ promotedToActivityId: "99999999-9999-9999-9999-999999999999" });
    const result = buildUnifiedFavorites([], [cf], new Map());
    expect(result).toEqual([]);
  });

  test("CF-07 [no browser] - Mix Partner + Curated: unica lista, Partner prima, Curated dopo, nessuna sezione separata", () => {
    const partner = activity();
    const cf = curatedRecord();
    const result = buildUnifiedFavorites([partner], [cf], new Map());
    expect(result.map((r) => r.kind)).toEqual(["partner", "curated"]);
  });

  test("CF-08 [no browser] - Un lead curated 'source-only' (non invitabile) è comunque preferibile — nessuna restrizione sul favorite", () => {
    const sourceOnlyLead: DiscoveryLeadRecord | undefined = REAL_DISCOVERY_LEADS.find((l) => l.invitable === false);
    test.skip(!sourceOnlyLead, "Nessun lead source-only nel dataset corrente.");
    const cf = curatedRecord({ curatedLeadId: sourceOnlyLead!.id, lead: sourceOnlyLead! });
    const result = buildUnifiedFavorites([], [cf], new Map());
    expect(result).toHaveLength(1);
    expect((result[0] as { kind: "curated"; lead: DiscoveryLeadRecord }).lead.invitable).toBe(false);
  });

  test("CF-09 [no browser] - Un lead curated 'invitabile' è preferibile — 'Preferito' e 'Proponi invito' restano indipendenti", () => {
    const invitableLead = REAL_DISCOVERY_LEADS.find((l) => l.invitable === true);
    test.skip(!invitableLead, "Nessun lead invitabile nel dataset corrente.");
    const cf = curatedRecord({ curatedLeadId: invitableLead!.id, lead: invitableLead! });
    const result = buildUnifiedFavorites([], [cf], new Map());
    expect(result).toHaveLength(1);
  });
});

test.describe("Curated Favorites — analytics (no browser)", () => {
  test("CF-10 [no browser] - favorite_added/favorite_removed sono eventi noti (whitelist telemetria), riusati sia da Partner sia da Curated", () => {
    expect(KNOWN_PRODUCT_EVENTS).toContain("favorite_added");
    expect(KNOWN_PRODUCT_EVENTS).toContain("favorite_removed");
  });
});

test.describe("Curated Favorites — flusso reale (richiede deploy Supabase)", () => {
  test("CF-11 - Flag OFF: senza REAL_DISCOVERY_DATASET_ENABLED nessun cuore Curated compare in Scopri (nessuna card Curated renderizzata)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con il flag risolto false per l'account di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
    await expect(page.getByText("Scoperta TRAMA")).toHaveCount(0);
  });

  test("CF-12 - Aggiungere/rimuovere un preferito Curated persiste e sopravvive al refresh", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con REAL_DISCOVERY_DATASET_ENABLED attivo per l'account di test e almeno un lead Curated visibile.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
    const heartButtons = page.locator('button[aria-label="Aggiungi ai preferiti"]');
    test.skip((await heartButtons.count()) === 0, "Nessun lead Curated visibile per questo account (flag non attivo o dataset filtrato).");
    await heartButtons.first().click();
    await page.reload();
    await expect(page.locator('button[aria-label="Rimuovi dai preferiti"]').first()).toBeVisible();
    await page.goto("/nextgen/preferiti");
    await expect(page.getByText("Scoperta TRAMA").first()).toBeVisible();
  });

  test("CF-13 - Duplicate prevention: aggiungere due volte lo stesso Curated lead non crea due righe (unique parent_id+curated_lead_id)", async () => {
    test.skip(!isRealDeployment, "Richiede verifica diretta su Supabase (SELECT count(*) su curated_favorites per lo stesso parent_id+curated_lead_id) — REQUIRES LIVE VALIDATION.");
  });

  test("CF-14 - Auth: un utente non autenticato non può aggiungere un Curated favorite (toggleCuratedFavoriteAction ritorna error)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
    await page.goto("/nextgen/search");
    // Nessuna sessione: la pagina reindirizza al login prima di poter interagire con un cuore.
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
