// TRAMA — IMPOSTAZIONI V2 (20/10/2026, Fabrizio: "la sezione preferenze
// (tutta la sezione impostazioni) ha ancora layout vecchio… sistemiamolo").
// Le tre pagine dell'area famiglie usano i componenti condivisi con la prop
// `v2`; V1 e portale Partner restano com'erano. [no browser] + 1 browser.

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { loginAs, isRealDeployment } from "../fixtures/roles";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — Impostazioni V2 [no browser]", () => {
  test("IMP-01 le tre pagine dell'app usano la variante V2, con freccia verso Impostazioni", () => {
    const pref = read("app/nextgen/profile/impostazioni/preferenze/page.tsx");
    expect(pref).toContain("<ProfilePreferencesSection\n          v2");
    expect(pref).toContain("briefingSlot={");
    expect(pref).toContain("helpSlot={");
    expect(pref).toMatch(/<WalkthroughRestartButton\s+v2/);
    expect(read("app/nextgen/profile/impostazioni/sicurezza/page.tsx")).toContain("<ProfileSecuritySection v2 />");
    expect(read("app/nextgen/profile/impostazioni/privacy/page.tsx")).toContain("<ProfilePrivacySection v2 ");
    for (const p of ["preferenze", "sicurezza", "privacy"]) {
      expect(read(`app/nextgen/profile/impostazioni/${p}/page.tsx`), p).toContain('backHref="/nextgen/profile/impostazioni"');
    }
  });

  test("IMP-02 V1 e portale Partner invariati: nessuno passa v2", () => {
    for (const p of ["components/PreferenzeView.tsx", "components/SicurezzaView.tsx", "components/PrivacyView.tsx", "app/center/account/preferenze/page.tsx", "app/center/account/sicurezza/page.tsx"]) {
      expect(read(p), p).not.toMatch(/\bv2\b/);
    }
    expect(read("components/ProfilePreferencesSection.tsx")).toContain("v2 = false,");
    expect(read("components/ProfileSecuritySection.tsx")).toContain("{ v2 = false }: { v2?: boolean } = {}");
    expect(read("components/ProfilePrivacySection.tsx")).toContain("v2 = false,");
  });

  test("IMP-03 interruttori veri (role=switch), notifiche prima, scelte non ancora attive raccolte in 'In arrivo'", () => {
    const ui = read("components/nextgen/settings-v2.tsx");
    expect(ui).toContain('role="switch"');
    expect(ui).toContain("aria-checked={checked}");
    const s = read("components/ProfilePreferencesSection.tsx");
    const v2 = s.slice(s.indexOf("if (v2) {"));
    expect(v2.indexOf('title="Notifiche"')).toBeLessThan(v2.indexOf("{briefingSlot}"));
    expect(v2.indexOf("{helpSlot}")).toBeLessThan(v2.indexOf('title="In arrivo"'));
    expect(v2).toContain('label="Notifiche push"');
    // Stessa iscrizione reale del browser di prima, non un semplice salvataggio.
    expect(v2).toContain("onChange={handleTogglePush}");
    expect(read("components/nextgen/DailyBriefingSettings.tsx")).toContain('title="Il buongiorno di TRAMA"');
  });

  test("IMP-04 Privacy V2: documenti dentro l'app, cancellazione sempre con conferma", () => {
    const s = read("components/ProfilePrivacySection.tsx");
    expect(s).toContain('href="/nextgen/informative/privacy"');
    expect(s).toContain('href="/nextgen/informative/termini"');
    expect(s).toContain("onClick={() => setConfirmingDelete(true)}");
    expect(s).toContain("() => void handleRequestDeletion(),");
  });
});

test.describe("TRAMA — Impostazioni V2", () => {
  test("IMP-05 Preferenze: sezioni nuove e interruttore notifiche push", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile/impostazioni/preferenze");
    await expect(page.getByRole("heading", { name: "Notifiche" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Notifiche push" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In arrivo" })).toBeVisible();
  });
});
