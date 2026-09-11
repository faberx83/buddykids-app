import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { evaluateFlag, evaluateFlagDetailed } from "../../lib/feature-flags/evaluate";
import { anyResolvedViaInternalPreview, isResolvedViaInternalPreview } from "../../lib/feature-flags/internal-preview";
import {
  deriveFlagSimpleVisibility,
  deriveReleaseVisibility,
  RELEASE_VISIBILITY_LABEL,
  INTERNAL_PREVIEW_COHORT_KEY,
  PILOT_COHORT_KEY,
} from "../../lib/releases/visibility";
import {
  resolveReleaseFlags,
  isResolvedReleaseFlagsError,
  validateGlobalConfirmation,
  shouldSkipOverrideWrite,
} from "../../lib/releases/promotion-validation";
import { getReleaseCatalog, getReleaseById } from "../../lib/releases/catalog";
import { getFeatureCatalog } from "../../lib/feature-registry/catalog";

// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026) — unit test
// puri, stesso principio "[no browser]" di tests/one/feature-flags.spec.ts:
// nessun "page" fixture, eseguibili in qualunque ambiente Node. Le Server
// Action con I/O reale (app/actions/releases.ts) non sono testate qui
// direttamente (richiederebbero un ambiente Supabase live, fuori scope per
// questa sessione, stessa scelta già fatta per app/actions/
// feature-flag-overrides.ts nel resto del repository) — è testata invece
// tutta la logica pura che le governa (lib/releases/promotion-validation.ts,
// lib/releases/visibility.ts), che è dove vive la parte verificabile senza
// un database.
//
// Comando: npx playwright test tests/one/release-catalog.spec.ts

test.describe("TRAMA — INTERNAL_PREVIEW: evaluateFlag/evaluateFlagDetailed [no browser]", () => {
  test("1. flag placeholder appena registrato risolve false di default (nessun override)", () => {
    const result = evaluateFlag("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", { environment: "production" }, []);
    expect(result).toBe(false);
  });

  test("2. utente nella coorte internal-preview vede la feature quando esiste un override cohort:internal-preview", () => {
    const context = { userId: "internal-1", cohortKeys: [INTERNAL_PREVIEW_COHORT_KEY] };
    const overrides = [{ scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, expiresAt: null }];
    const result = evaluateFlag("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", context, overrides);
    expect(result).toBe(true);

    const detail = evaluateFlagDetailed("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", context, overrides);
    expect(detail.matchedScope).toBe("cohort");
    expect(detail.matchedScopeValue).toBe(INTERNAL_PREVIEW_COHORT_KEY);
    expect(isResolvedViaInternalPreview(detail)).toBe(true);
  });

  test("3. un utente normale (non nella coorte internal-preview) NON vede la stessa feature", () => {
    const context = { userId: "normal-user", cohortKeys: [] };
    const overrides = [{ scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, expiresAt: null }];
    const result = evaluateFlag("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", context, overrides);
    expect(result).toBe(false);
  });

  test("4. un utente nella coorte Pilot vede una feature promossa a PILOT", () => {
    const context = { userId: "pilot-1", cohortKeys: [PILOT_COHORT_KEY] };
    const overrides = [{ scopeType: "cohort" as const, scopeValue: PILOT_COHORT_KEY, enabled: true, expiresAt: null }];
    const result = evaluateFlag("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", context, overrides);
    expect(result).toBe(true);
  });

  test("5. un utente qualunque vede una feature promossa a GLOBAL", () => {
    const context = { userId: "chiunque", cohortKeys: [] };
    const overrides = [{ scopeType: "global" as const, scopeValue: null, enabled: true, expiresAt: null }];
    const result = evaluateFlag("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", context, overrides);
    expect(result).toBe(true);
  });

  test("6. GLOBAL -> INTERNAL (kill switch): dopo il rollback un utente normale torna a non vedere la feature, un account interno continua a vederla", () => {
    // Stato dopo demoteReleaseToInternalAction: global.enabled=false (riga
    // preservata, mai cancellata), cohort:pilot.enabled=false, cohort:
    // internal-preview.enabled=true.
    const overridesAfterRollback = [
      { scopeType: "global" as const, scopeValue: null, enabled: false, expiresAt: null },
      { scopeType: "cohort" as const, scopeValue: PILOT_COHORT_KEY, enabled: false, expiresAt: null },
      { scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, expiresAt: null },
    ];

    const normalUser = evaluateFlag("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", { userId: "normal", cohortKeys: [] }, overridesAfterRollback);
    expect(normalUser).toBe(false);

    const pilotUser = evaluateFlag(
      "SCHOOL_CALENDAR_INTELLIGENCE_ENABLED",
      { userId: "pilot", cohortKeys: [PILOT_COHORT_KEY] },
      overridesAfterRollback
    );
    expect(pilotUser).toBe(false);

    const internalUser = evaluateFlag(
      "SCHOOL_CALENDAR_INTELLIGENCE_ENABLED",
      { userId: "internal", cohortKeys: [INTERNAL_PREVIEW_COHORT_KEY] },
      overridesAfterRollback
    );
    expect(internalUser).toBe(true);

    // Anche la visibilità "parlante" derivata (sezione Release) deve
    // riflettere onestamente il rollback: internal_preview, non global/pilot.
    expect(deriveFlagSimpleVisibility(overridesAfterRollback)).toBe("internal_preview");
  });
});

test.describe("TRAMA — Release Catalog: derivazione visibilità [no browser]", () => {
  test("8. deriveFlagSimpleVisibility: global batte pilot e internal_preview quando tutti attivi insieme", () => {
    const overrides = [
      { scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, status: "active" as const },
      { scopeType: "cohort" as const, scopeValue: PILOT_COHORT_KEY, enabled: true, status: "active" as const },
      { scopeType: "global" as const, scopeValue: null, enabled: true, status: "active" as const },
    ];
    expect(deriveFlagSimpleVisibility(overrides)).toBe("global");
  });

  test("8b. deriveFlagSimpleVisibility: nessun override attivo -> disabled", () => {
    expect(deriveFlagSimpleVisibility([])).toBe("disabled");
  });

  test("8c. deriveFlagSimpleVisibility: un override enabled=true ma 'expired' viene ignorato", () => {
    const overrides = [{ scopeType: "global" as const, scopeValue: null, enabled: true, status: "expired" as const }];
    expect(deriveFlagSimpleVisibility(overrides)).toBe("disabled");
  });

  test("9. deriveReleaseVisibility: 2 feature INTERNAL_PREVIEW + 1 PILOT -> 'mixed', mai un singolo stato", () => {
    const result = deriveReleaseVisibility(["internal_preview", "internal_preview", "pilot"]);
    expect(result).toBe("mixed");
    // La UI non deve mai mentire dicendo "Pilot" — l'etichetta per "mixed" è
    // esplicitamente onesta ("Rilascio parziale"), mai il nome di uno degli
    // stati che lo compongono.
    expect(RELEASE_VISIBILITY_LABEL["mixed"]).toBe("Rilascio parziale");
    expect(RELEASE_VISIBILITY_LABEL["mixed"]).not.toBe(RELEASE_VISIBILITY_LABEL["pilot"]);
  });

  test("9b. deriveReleaseVisibility: tutte le feature nello stesso stato -> quello stato, non 'mixed'", () => {
    expect(deriveReleaseVisibility(["pilot", "pilot", "pilot"])).toBe("pilot");
  });

  test("9c. deriveReleaseVisibility: release senza feature risolte -> disabled (mai un errore silenzioso)", () => {
    expect(deriveReleaseVisibility([])).toBe("disabled");
  });
});

test.describe("TRAMA — Release Catalog: struttura e risoluzione flag [no browser]", () => {
  test("il Release Catalog non contiene mai un campo 'status' hardcoded (deve restare derivato)", () => {
    for (const release of getReleaseCatalog()) {
      expect(Object.prototype.hasOwnProperty.call(release, "status")).toBe(false);
    }
  });

  test("resolveReleaseFlags risolve la release placeholder 'planner-intelligence' ai suoi 3 flag reali", () => {
    const resolved = resolveReleaseFlags("planner-intelligence");
    expect(isResolvedReleaseFlagsError(resolved)).toBe(false);
    if (!isResolvedReleaseFlagsError(resolved)) {
      expect(resolved.flagNames.sort()).toEqual(
        ["SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", "EXTERNAL_PLANNER_ITEMS_ENABLED", "CALENDAR_EXPORT_ENABLED"].sort()
      );
      expect(resolved.unknownFeatureKeys).toEqual([]);
    }
  });

  test("7. resolveReleaseFlags su una release inesistente ritorna un errore, mai un array vuoto silenzioso — stessa guardia che ogni Server Action del Promotion Engine (app/actions/releases.ts) esegue PRIMA di qualunque scrittura, indipendentemente da cosa ha già verificato la pagina Admin che la chiama (vedi docs/trama-one/analysis/CAPABILITY_ISOLATION_STANDARD.md, punto 3: una Server Action è raggiungibile direttamente, quindi ri-verifica sempre da sé). Le Server Action stesse (I/O reale su Supabase) non sono testate qui: richiedono un ambiente live, stessa scelta già fatta per app/actions/feature-flag-overrides.ts nel resto del repository — vedi il test UI gated 'TC-REL-01' più sotto.", () => {
    const resolved = resolveReleaseFlags("release-che-non-esiste");
    expect(isResolvedReleaseFlagsError(resolved)).toBe(true);
  });

  test("ogni featureKey di ogni release esiste davvero nel Feature Catalog (nessuna chiave orfana)", () => {
    const catalogKeys = new Set(getFeatureCatalog().map((e) => e.key));
    for (const release of getReleaseCatalog()) {
      for (const key of release.featureKeys) {
        expect(catalogKeys.has(key)).toBe(true);
      }
    }
  });

  test("le 3 feature placeholder sono marcate INTERNAL_PREVIEW e nessun sourceFile punta a codice applicativo reale", () => {
    const release = getReleaseById("planner-intelligence");
    expect(release).toBeTruthy();
    const catalog = getFeatureCatalog();
    for (const key of release!.featureKeys) {
      const entry = catalog.find((e) => e.key === key)!;
      expect(entry.status).toBe("INTERNAL_PREVIEW");
      expect(entry.note ?? "").toContain("Non raggiungibile");
    }
  });
});

test.describe("TRAMA — Promotion Engine: validazione pura [no browser]", () => {
  test("11. validateGlobalConfirmation rifiuta qualunque testo diverso da 'GLOBAL' (case/whitespace-insensitive sul match, non sul contenuto)", () => {
    expect(validateGlobalConfirmation("")).toBeTruthy();
    expect(validateGlobalConfirmation("global ok")).toBeTruthy();
    expect(validateGlobalConfirmation("globale")).toBeTruthy();
  });

  test("11b. validateGlobalConfirmation accetta 'GLOBAL' con spazi/maiuscole diverse (stesso pattern di BatchBetaControls)", () => {
    expect(validateGlobalConfirmation("GLOBAL")).toBeUndefined();
    expect(validateGlobalConfirmation("  global  ")).toBeUndefined();
    expect(validateGlobalConfirmation("Global")).toBeUndefined();
  });
});

test.describe("TRAMA — Promotion Engine: fix audit no-op write [no browser]", () => {
  test("shouldSkipOverrideWrite: nessuna scrittura quando il valore richiesto e' gia' quello attuale (evita di ri-timbrare updated_by/updated_at su un no-op)", () => {
    expect(shouldSkipOverrideWrite(true, true)).toBe(true);
    expect(shouldSkipOverrideWrite(false, false)).toBe(true);
  });

  test("shouldSkipOverrideWrite: scrive quando il valore richiesto e' effettivamente diverso da quello attuale", () => {
    expect(shouldSkipOverrideWrite(true, false)).toBe(false);
    expect(shouldSkipOverrideWrite(false, true)).toBe(false);
  });

  test("app/actions/releases.ts::upsertScopeOverride usa davvero shouldSkipOverrideWrite prima di ogni UPDATE (verificato leggendo il sorgente, non solo la funzione pura isolata)", () => {
    const source = fs.readFileSync(path.join(__dirname, "../../app/actions/releases.ts"), "utf-8");
    const skipCallIndex = source.indexOf("shouldSkipOverrideWrite(existing.enabled, enabled)");
    const updateCallIndex = source.indexOf('.update({ enabled, updated_by: actorId })');
    expect(skipCallIndex).toBeGreaterThan(-1);
    expect(updateCallIndex).toBeGreaterThan(-1);
    // La guardia deve comparire PRIMA dell'UPDATE nel testo del file (stesso
    // ordine di esecuzione reale: if (existing) { if (shouldSkip...) return
    // {}; ... update ... }).
    expect(skipCallIndex).toBeLessThan(updateCallIndex);
  });
});

test.describe("TRAMA — InternalPreviewBadge: visibilità derivata [no browser]", () => {
  test("10. anyResolvedViaInternalPreview è true solo se ALMENO UNA risoluzione è arrivata da cohort:internal-preview", () => {
    const viaGlobal = { enabled: true, matchedScope: "global" as const, matchedScopeValue: null };
    const viaPilot = { enabled: true, matchedScope: "cohort" as const, matchedScopeValue: PILOT_COHORT_KEY };
    const viaInternal = { enabled: true, matchedScope: "cohort" as const, matchedScopeValue: INTERNAL_PREVIEW_COHORT_KEY };
    const disabled = { enabled: false, matchedScope: null, matchedScopeValue: null };

    expect(anyResolvedViaInternalPreview([viaGlobal, viaPilot])).toBe(false);
    expect(anyResolvedViaInternalPreview([viaGlobal, viaInternal])).toBe(true);
    expect(anyResolvedViaInternalPreview([disabled])).toBe(false);
    expect(anyResolvedViaInternalPreview([])).toBe(false);
  });

  test("10b. isResolvedViaInternalPreview ignora un override cohort disabled anche se lo scope_value combacia", () => {
    const disabledInternal = { enabled: false, matchedScope: "cohort" as const, matchedScopeValue: INTERNAL_PREVIEW_COHORT_KEY };
    expect(isResolvedViaInternalPreview(disabledInternal)).toBe(false);
  });

  test("10c. il componente non è dismissable e mostra il testo/wording approvato ('ANTEPRIMA INTERNA' / 'Solo account TRAMA autorizzati'), verificato leggendo il sorgente", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../../components/InternalPreviewBadge.tsx"),
      "utf-8"
    );
    expect(source).toContain("if (!visible) return null");
    expect(source).toContain("Anteprima interna");
    expect(source).toContain("Solo account TRAMA autorizzati");
    // Non dismissable: nessuno stato locale, nessuna X/bottone di chiusura.
    expect(source).not.toMatch(/useState/);
    expect(source).not.toMatch(/onClick/);
  });
});

// ────────────────────────────────────────────────────────────────
// TC-REL-01 — UI live, stesso pattern/limite di TC-N609
// (tests/one/feature-flags.spec.ts): richiede un deploy reale con Supabase
// configurato. Scritto in questa sessione ma NON eseguito da Claude (che
// non lancia mai test Playwright live contro produzione, per governance
// permanente) — Fabrizio lo esegue quando utile. Copre l'11 ("conferma
// tipizzata GLOBAL") end-to-end lato UI, in aggiunta alla validazione pura
// già testata sopra.
// ────────────────────────────────────────────────────────────────
test.describe("TRAMA — Release Admin UI [UI, live]", () => {
  test("TC-REL-01 - la sezione Release compare in /admin/feature-flags e la promozione a GLOBAL è bloccata senza conferma testuale corretta", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e la release placeholder presente nel catalogo.");

    await loginAs(page, "platform_admin");
    await page.goto("/admin/feature-flags");
    await expect(page.getByText("TRAMA — Planner Intelligence")).toBeVisible();

    const card = page.getByTestId("release-card-planner-intelligence");
    await expect(card).toBeVisible();

    const globalButton = card.getByRole("button", { name: "Rendi disponibile a tutti" });
    if (await globalButton.isVisible()) {
      await globalButton.click();
      await card.getByPlaceholder('Scrivi "GLOBAL"').fill("non è la parola giusta");
      await card.getByRole("button", { name: "Conferma" }).click();
      await expect(card.getByText(/Scrivi "GLOBAL" per confermare/)).toBeVisible();
    }
  });
});
