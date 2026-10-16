// TRAMA — CONSENSI E INFORMATIVE, pacchetto 2 (16/10/2026) [no browser].
// Testi bozza in lib/legal/texts, pubblicazione con impronta sha256,
// pagine /privacy e /terms, dichiarazione genitoriale, release dedicata.

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { test, expect } from "@playwright/test";
import { LATEST_LEGAL_VERSION, isDraftLegalVersion, legalTextFor } from "../../lib/legal/texts";
import { parseLegalText } from "../../lib/legal/parse";
import { CURRENT_PARENTAL_DECLARATION_VERSION } from "../../lib/legal/consent";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

test.describe("TRAMA — Testi legali [no browser]", () => {
  test("LT-01 il file di pubblicazione registra le impronte esatte dei testi nel codice", () => {
    const sql = read("supabase/legal_publish_2026-10-16_bozza1.sql");
    for (const type of ["privacy_notice", "terms"] as const) {
      const v = LATEST_LEGAL_VERSION[type];
      const text = legalTextFor(type, v)!;
      expect(text.length).toBeGreaterThan(1500);
      expect(sql).toMatch(new RegExp(`\\('${type}',\\s+'${v}',\\s+'${sha(text)}', now\\(\\)\\)`));
    }
    // non è una migrazione applicata in automatico: la pubblicazione la decide Fabrizio
    expect(sql).not.toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("on conflict (document_type, version) do nothing;");
  });

  test("LT-02 bozze dichiarate: segnaposti da completare, nessuna promessa di conformità", () => {
    for (const type of ["privacy_notice", "terms"] as const) {
      const text = legalTextFor(type, LATEST_LEGAL_VERSION[type])!;
      expect(isDraftLegalVersion(LATEST_LEGAL_VERSION[type])).toBe(true);
      expect(text).toContain("[RAGIONE SOCIALE DA COMPLETARE]");
      expect(text).toContain("privacy@tramapp.it");
      expect(text.toLowerCase()).not.toMatch(/conforme al gdpr|pienamente conforme/);
    }
    const privacy = legalTextFor("privacy_notice", LATEST_LEGAL_VERSION.privacy_notice)!;
    for (const t of ["Supabase", "Vercel", "OpenStreetMap", "Garante", "maggiorenne", "Cookie"]) expect(privacy).toContain(t);
    const terms = legalTextFor("terms", LATEST_LEGAL_VERSION.terms)!;
    expect(terms).toContain("non è un'iscrizione");
    expect(terms).toContain("In TRAMA non si paga nulla");
  });

  test("LT-03 impaginazione: titoli, elenchi e tabella riconosciuti", () => {
    const blocks = parseLegalText(legalTextFor("privacy_notice", LATEST_LEGAL_VERSION.privacy_notice)!);
    expect(blocks[0]).toEqual({ kind: "h1", text: "Informativa privacy di TRAMA" });
    expect(blocks.filter((b) => b.kind === "h2").length).toBeGreaterThanOrEqual(10);
    const table = blocks.find((b) => b.kind === "table") as { kind: "table"; rows: string[][] };
    expect(table.rows[0]).toEqual(["Finalità", "Base giuridica"]);
    expect(table.rows.length).toBeGreaterThan(4);
    expect(blocks.some((b) => b.kind === "ul")).toBe(true);
  });

  test("LT-04 le pagine mostrano il testo solo se l'impronta coincide con quella pubblicata", () => {
    const page = read("components/LegalPublicPage.tsx");
    expect(page).toContain("legalTextSha256(text) === doc.sha256");
    expect(page).toContain("Bozza in revisione legale");
    expect(read("app/privacy/page.tsx")).toContain('type="privacy_notice"');
    expect(read("app/terms/page.tsx")).toContain('type="terms"');
  });

  test("LT-05 dichiarazione del genitore: stessa versione nel testo e nel registro; stesso testo ovunque", () => {
    expect(read("components/legal/ParentalDeclarationText.tsx")).toContain(
      `PARENTAL_DECLARATION_TEXT_VERSION = "${CURRENT_PARENTAL_DECLARATION_VERSION}"`
    );
    for (const f of ["components/AddKidForm.tsx", "components/nextgen/OnboardingV2.tsx"]) {
      expect(read(f)).toContain("<ParentalDeclarationText kidName={name} />");
      expect(read(f)).not.toContain("Dichiaro di essere titolare");
    }
  });

  test("LT-06 release 'Consensi e informative' con le due funzioni del gate", () => {
    const rel = RELEASE_CATALOG.find((r) => r.id === "consensi-informative");
    expect(rel?.featureKeys).toEqual(["legal_terms_gate_signup", "legal_terms_gate_parental_declaration"]);
    for (const k of rel!.featureKeys) expect(FEATURE_CATALOG.find((f) => f.key === k)?.releaseEligible).toBe(true);
    expect(read("supabase/migration_43_family_invites.sql")).toContain("-- STATO: PREPARATA, NON APPLICATA");
  });

  test("LT-07 al Pilot basta il link d'invito beta: la coorte arriva dal codice, solo se valido", () => {
    const page = read("app/auth/login/page.tsx");
    expect(page).toContain("const signupCohort = betaCode ? await cohortForBetaInviteCode(betaCode) : null;");
    expect(page).toContain("extraCohortKeys: signupCohort ? [signupCohort] : [],");
    const cohort = read("lib/legal/signup-cohort.ts");
    for (const t of ["if (!data || !data.active) return null;", "expires_at", "redeemed_count"]) expect(cohort).toContain(t);
    expect(read("lib/feature-flags/resolve.ts")).toContain("...extraCohortKeys.filter(Boolean)");
  });
});

test.describe("TRAMA — Informative dentro l'app [no browser]", () => {
  test("LT-08 Privacy e Termini leggibili dall'app (Profilo → Privacy e account, Cos'è TRAMA)", () => {
    expect(read("app/nextgen/informative/privacy/page.tsx")).toContain('variant="app"');
    expect(read("app/nextgen/informative/termini/page.tsx")).toContain('variant="app"');
    expect(read("components/PrivacyView.tsx")).toContain('"/nextgen/informative/privacy"');
    expect(read("app/nextgen/trama/page.tsx")).toContain('href="/nextgen/informative/termini"');
    // beta senza pagamenti: niente "Metodi di pagamento" nelle Impostazioni V2
    expect(read("app/nextgen/profile/impostazioni/ImpostazioniHubClient.tsx")).not.toContain("Metodi di pagamento");
  });

  test("LT-09 Home: l'avviso 'mancano accompagnamenti' solo quando il blocco di oggi finisce fuori schermo", () => {
    expect(read("app/nextgen/HomeDashboardV2Client.tsx")).toContain("{urgentAlert && agenda.length > 3 && (");
  });
});
