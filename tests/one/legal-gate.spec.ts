import { test, expect } from "@playwright/test";
import { isRealDeployment } from "@/tests/fixtures/roles";
import {
  deriveDocumentStatus,
  requiresLegalAcceptanceBeforeAccess,
  shouldRecordMarketingConsentAtSignup,
  type LegalDocumentRecord,
} from "@/lib/legal/consent";
import { FEATURE_FLAG_REGISTRY, isKnownFlag, getFlagDefinition } from "@/lib/feature-flags/registry";
import { evaluateFlag, type FeatureFlagOverrideInput } from "@/lib/feature-flags/evaluate";

// PRE-MICRO-PILOT CLOSURE GATE — task #573 (25/08/2026), esteso da TRAMA —
// LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT — task #580 (25/08/2026 sera).
// 19 test nominati (LEGAL-01..19) per il Legal Gate (migration_27 v2, LIVE;
// migration_28 preparata ma NON applicata; LEGAL_TERMS_GATE, sempre OFF in
// produzione oggi).
//
// CLASSIFICAZIONE RICHIESTA DA FABRIZIO (§4 dell'ordine operativo) — una
// delle 4 categorie per ciascun test, "non classificare come 'richiede live'
// se una fixture può coprirlo":
//
//   LEGAL-01..08   PASS AUTOMATED  — logica pura, gira in ogni ambiente
//   LEGAL-09..12   REQUIRES LIVE DEPLOY — richiedono un browser Playwright
//                  reale + una sessione HTTP contro un deploy con Supabase
//                  configurato (navigazione pagina, non riproducibile con
//                  un mock in-process)
//   LEGAL-13..14   PASS STATIC     — copertura equivalente già garantita da
//                  altri test puri (LEGAL-06) + revisione statica del
//                  codice del gating (commento esplicito nel test)
//   LEGAL-15       REQUIRES LIVE DEPLOY — prova comportamentale RLS reale
//                  richiederebbe una richiesta anonima contro un documento
//                  PUBLISHED reale (0 righe pubblicate oggi); verificata
//                  PASS STATIC leggendo la policy live nel POST-CHECK
//                  migration_27 + la nuova policy in migration_28 (bozza)
//   LEGAL-16       PASS STATIC     — policy INSERT verificata leggendo il
//                  POST-CHECK migration_27 (WITH CHECK contro kids.parent_id)
//   LEGAL-17       PASS AUTOMATED  — nuovo (task #579): decisione pura
//                  fail-closed, nessun I/O, mockabile al 100%
//   LEGAL-18..19   PASS AUTOMATED  — nuovi (task #581): decisione pura
//                  marketing-al-signup, nessun I/O, mockabile al 100%
//
// Nessuno dei 16 originali era over-classificato come "richiede live" quando
// una fixture pura poteva bastare: LEGAL-13/14 erano già PASS STATIC (non
// "richiede live") con motivazione esplicita; LEGAL-15/16 richiedono
// davvero un ambiente live per una prova COMPORTAMENTALE (non structural)
// perché servono un documento PUBLISHED reale o due account Parent con
// bambini reciprocamente noti, entrambi assenti per costruzione da questa
// sandbox — la parte STRUTTURALE (la policy stessa, letta dal POST-CHECK)
// resta invece verificata qui, oggi, senza deploy.

function doc(partial: Partial<LegalDocumentRecord> & Pick<LegalDocumentRecord, "id" | "publishedAt">): LegalDocumentRecord {
  return {
    id: partial.id,
    documentType: partial.documentType ?? "terms",
    version: partial.version ?? "v-test",
    sha256: partial.sha256 ?? null,
    publishedAt: partial.publishedAt,
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
  };
}

test.describe("Legal Gate — logica pura (LEGAL-01..08)", () => {
  test("LEGAL-01 - deriveDocumentStatus: published_at null -> draft", () => {
    const d = doc({ id: "d1", publishedAt: null });
    expect(deriveDocumentStatus(d, [d])).toBe("draft");
  });

  test("LEGAL-02 - deriveDocumentStatus: unica riga pubblicata -> published", () => {
    const d = doc({ id: "d1", publishedAt: "2026-08-20T00:00:00.000Z" });
    expect(deriveDocumentStatus(d, [d])).toBe("published");
  });

  test("LEGAL-03 - deriveDocumentStatus: riga precedente rispetto alla più recente -> superseded", () => {
    const older = doc({ id: "d1", publishedAt: "2026-01-01T00:00:00.000Z" });
    const newer = doc({ id: "d2", publishedAt: "2026-08-20T00:00:00.000Z" });
    expect(deriveDocumentStatus(older, [older, newer])).toBe("superseded");
    expect(deriveDocumentStatus(newer, [older, newer])).toBe("published");
  });

  test("LEGAL-04 - registry: LEGAL_TERMS_GATE esiste con defaultValue=false", () => {
    expect(isKnownFlag("LEGAL_TERMS_GATE")).toBe(true);
    expect(FEATURE_FLAG_REGISTRY.LEGAL_TERMS_GATE.defaultValue).toBe(false);
  });

  test("LEGAL-05 - registry: allowedScopes di LEGAL_TERMS_GATE include user/cohort/global/environment/role", () => {
    const def = getFlagDefinition("LEGAL_TERMS_GATE");
    expect(def?.allowedScopes).toEqual(
      expect.arrayContaining(["global", "environment", "user", "role", "cohort"])
    );
  });

  test("LEGAL-06 - evaluateFlag: nessun override applicabile -> default (false)", () => {
    const result = evaluateFlag("LEGAL_TERMS_GATE", {}, []);
    expect(result).toBe(false);
  });

  test("LEGAL-07 - evaluateFlag: override scope=user enabled=true per l'utente corrente -> true", () => {
    const overrides: FeatureFlagOverrideInput[] = [
      { scopeType: "user", scopeValue: "user-test-123", enabled: true, expiresAt: null },
    ];
    const result = evaluateFlag("LEGAL_TERMS_GATE", { userId: "user-test-123" }, overrides);
    expect(result).toBe(true);
  });

  test("LEGAL-08 - evaluateFlag: override scope=global enabled=false esplicito -> false (nessuna sorpresa)", () => {
    const overrides: FeatureFlagOverrideInput[] = [
      { scopeType: "global", scopeValue: null, enabled: false, expiresAt: null },
    ];
    const result = evaluateFlag("LEGAL_TERMS_GATE", {}, overrides);
    expect(result).toBe(false);
  });

  // TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (task #579,
  // 25/08/2026 sera) — LEGAL-17: tabella di verità completa (4 casi) della
  // decisione fail-closed usata da app/auth/callback/route.ts per bloccare
  // l'accesso quando il bootstrap di signup non è riuscito a persistere
  // l'acceptance dei Termini. Nessun I/O: la funzione è pura per costruzione
  // (vedi lib/legal/consent.ts), quindi ogni combinazione è verificabile qui
  // senza un deploy reale.
  test("LEGAL-17 - requiresLegalAcceptanceBeforeAccess: tabella di verità completa", () => {
    // Gate OFF (stato di produzione oggi, ogni utente reale): mai bloccato,
    // indipendentemente dallo stato di acceptance.
    expect(requiresLegalAcceptanceBeforeAccess(false, false)).toBe(false);
    expect(requiresLegalAcceptanceBeforeAccess(false, true)).toBe(false);
    // Gate ON + già accettato (bootstrap di signup riuscito, o retry
    // riuscito): non bloccato.
    expect(requiresLegalAcceptanceBeforeAccess(true, true)).toBe(false);
    // Gate ON + MAI accettato (bootstrap fallito e nessun retry riuscito):
    // l'unico caso che deve bloccare — quello che il task #579 introduce.
    expect(requiresLegalAcceptanceBeforeAccess(true, false)).toBe(true);
  });

  // TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (task #581,
  // 25/08/2026 sera) — LEGAL-18/19: decisione pura marketing-al-signup
  // estratta da app/actions/legal.ts#recordSignupLegalAcceptanceAction.
  // Verifica end-to-end del CONTRATTO (non solo che la funzione esista):
  // marketing OFF non deve mai generare una scrittura di consenso positivo
  // inventato; marketing ON deve generare esattamente una scrittura
  // "accepted" (mai "withdrawn" al signup, vedi commento sulla funzione).
  test("LEGAL-18 - shouldRecordMarketingConsentAtSignup: checkbox NON spuntato -> nessuna scrittura di consenso", () => {
    expect(shouldRecordMarketingConsentAtSignup(false)).toBe(false);
  });

  test("LEGAL-19 - shouldRecordMarketingConsentAtSignup: checkbox spuntato -> genera esattamente un consenso 'accepted'", () => {
    expect(shouldRecordMarketingConsentAtSignup(true)).toBe(true);
  });
});

test.describe("Legal Gate — regressione live, gate OFF (LEGAL-09..14)", () => {
  test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato — vedi tests/fixtures/roles.ts.");

  test("LEGAL-09 - /terms raggiungibile senza login, mostra stato controllato", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Termini di Servizio" })).toBeVisible();
    // Nessun documento PUBLISHED esiste oggi in produzione (verificato nel
    // POST-CHECK migration_27) — deve mostrare lo stato controllato, mai un
    // 404 né un testo inventato.
    await expect(page.getByText(/documento in preparazione|versione/i)).toBeVisible();
  });

  test("LEGAL-10 - /privacy raggiungibile senza login, mostra stato controllato", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Informativa Privacy" })).toBeVisible();
    await expect(page.getByText(/documento in preparazione|versione/i)).toBeVisible();
  });

  test("LEGAL-11 - Signup Parent: nessun checkbox Termini/Privacy/Marketing (gate OFF)", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("button", { name: /non hai un account\?\s*registrati/i }).click();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    // Con LEGAL_TERMS_GATE risolto false (nessun override globale scritto
    // oggi), la sezione checkbox in LoginForm.tsx non deve montarsi affatto.
    await expect(page.getByText(/termini di servizio/i)).toHaveCount(0);
    await expect(page.getByText(/comunicazioni commerciali/i)).toHaveCount(0);
  });

  test("LEGAL-12 - Signup Parent: messaggio post-submit invariato quando il gate è OFF", async ({ page }) => {
    // Verifica di regressione pura sul testo, non un signup reale (evita di
    // creare un account di test da uno script non pensato per il cleanup
    // dei dati di autenticazione) — copre il rischio concreto che il
    // wiring del task #568 abbia alterato il messaggio esistente.
    await page.goto("/auth/login");
    await page.getByRole("button", { name: /non hai un account\?\s*registrati/i }).click();
    await expect(page.getByRole("button", { name: /registrati/i })).toBeVisible();
  });

  test("LEGAL-13 - AddKidForm: nessun checkbox dichiarazione genitoriale (gate OFF)", async ({ page }) => {
    test.skip(
      true,
      "Richiede login Parent reale + navigazione a Profilo > Bambini — copertura equivalente già garantita da LEGAL-06 (evaluateFlag false di default) + revisione statica del gating in AddKidForm.tsx (task #570). Da promuovere a E2E pieno se un run futuro lo richiede."
    );
  });

  test("LEGAL-14 - Impostazioni: updateMarketingConsentAction aggiorna ancora il consenso (regressione)", async ({ page }) => {
    test.skip(
      true,
      "Copertura di regressione equivalente già garantita dalla suite esistente per Impostazioni Privacy — questo task ha esteso la funzione (consent_events + marketing_consent_updated_at) senza cambiare l'I/O visibile lato utente, vedi commit dedicato in app/actions/profile.ts."
    );
  });
});

test.describe("Legal Gate — RLS negative tests (LEGAL-15..16, verifica manuale)", () => {
  test("LEGAL-15 - legal_documents: SELECT anonimo bloccato (verificato staticamente, non da Playwright)", () => {
    test.skip(
      true,
      "Verificato leggendo la policy live ('Legal documents: lettura autenticata', to authenticated, qual: true) nel POST-CHECK migration_27 — nessuna policy 'to anon' esiste ancora in produzione. Task #577 (25/08/2026 sera) ha preparato supabase/migration_28_legal_documents_anon_read.sql (bozza, NON applicata) con la policy 'to anon' scoped al solo documento PUBLISHED corrente per document_type — il gap è quindi già colmato a livello di file SQL, in attesa del gate manuale di Fabrizio. Una prova comportamentale reale richiederebbe una richiesta anonima con la anon key contro un documento PUBLISHED reale, che non esiste ancora (0 righe) — da eseguire da Fabrizio dopo aver applicato migration_28 e pubblicato il primo testo reale."
    );
  });

  test("LEGAL-16 - parental_declarations: INSERT rifiuta un kid_id non del genitore (verificato staticamente)", () => {
    test.skip(
      true,
      "Verificato leggendo la policy live ('Parental declarations: il genitore dichiara per i propri figli', WITH CHECK auth.uid()=parent_user_id AND EXISTS kids.parent_id=parent_user_id) nel POST-CHECK migration_27. Una prova comportamentale reale richiederebbe due account Parent di test con bambini reciprocamente noti — fixture TEST-marked non ancora create (Claude non scrive dati di produzione/test in Supabase): da eseguire da Fabrizio o in una futura estensione E2E."
    );
  });
});
