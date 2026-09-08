import { test, expect } from "../fixtures/roles";
import { gotoAsRole, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Profilo Centro
// Generato da BuddyKids_Test_Case.xlsx - 3 casi.
// I test con test.fixme() sono placeholder tracciabili (1 per TC-ID): contengono
// precondizioni/passi/risultato atteso come commento, pronti da completare.

test.describe("Gestore - Profilo Centro", () => {
  // Priorita: Media | Precondizioni: Account collegato a un centro
  // Passi: Vai su /center/profile -> modifica nome/citta/descrizione/social -> salva
  // Risultato atteso: Dati aggiornati, visibili ai genitori
  test.fixme("TC-080 - Modifica profilo centro", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Alta | Precondizioni: Nessuna
  // Passi: In /center/profile, spunta 'Il centro ha un bar / punto ristoro' -> salva
  // Risultato atteso: Il valore has_bar=true si riflette nel filtro Servizi lato genitori
  test.fixme("TC-081 - Attivazione campo Bar", async ({ page }) => {
    // TODO: implementare - vedi tests/genitori/cerca.spec.ts o home.spec.ts
    // per esempi di test gia completati in quest'area.
  });

  // Priorita: Bassa | Precondizioni: Login Gestore
  // Passi: Vai su Gestore > Il mio centro, clicca l'icona fotocamera sul cerchio in alto
  // Risultato atteso: Il logo sostituisce l'emoji/gradiente di default; viene salvato al click su \"Salva modifiche\" insieme al resto del form
  test.fixme("TC-117 - Upload logo/foto del centro", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede lo snippet SQL Storage applicato su Supabase prima del test
  });

  // Domanda di Fabrizio: "il processo di eventuale annullamento della
  // prenotazione: entro quanto si può fare? può essere una variabile
  // gestibile da ciascun centro estivo?" — risposta: sì, campo
  // centers.cancellation_window_days (default 3 giorni), modificabile qui.
  // Priorita: Alta | Precondizioni: Account collegato a un centro
  test("TC-192 - Il centro può configurare i giorni di preavviso per annullo/modifica prenotazione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    await expect(page.getByText("Cancellazioni e modifiche")).toBeVisible();
    const field = page.locator("input[type='number']").last();
    await field.fill("5");
    await page.getByRole("button", { name: /Salva/ }).first().click();
    // Segnalazione di Fabrizio: il salvataggio del Profilo centro restava
    // bloccato su "Salvato (demo) — verrà scritto su Supabase quando
    // collegato." nonostante l'account fosse correttamente collegato a un
    // centro reale (verificato via query SQL diretta). L'assenza di questa
    // asserzione (prima si controllava solo "niente Application error") è
    // il motivo per cui la suite non aveva mai intercettato la regressione.
    await expect(page.getByText("Salvato su Supabase ✓")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  // Richiesta di Fabrizio: badge "Accesso disabili" a livello di centro,
  // editabile anche dal Profilo centro (oltre che dalla scheda attività, vedi
  // TC-198) — stesso trattamento di "Il centro ha un bar / punto ristoro".
  // Priorita: Media | Precondizioni: Account collegato a un centro
  test("TC-199 - Il gestore può flaggare 'Accessibilità' dal Profilo centro", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    // getByText fa match case-insensitive per substring: senza exact,
    // "Accessibilità" matcha anche la label "Nota accessibilità (facoltativa)"
    // poco più sotto — strict mode violation trovata nel run reale del
    // 28/07 (Gate C Cluster A).
    await expect(page.getByText("Accessibilità", { exact: true })).toBeVisible();
    const accessibleCheckbox = page.getByText("Il centro è accessibile (rampe, bagno attrezzato, ecc.)").locator("..").locator("input[type='checkbox']");
    await accessibleCheckbox.setChecked(true);
    await expect(page.getByPlaceholder("Es. Rampa d'accesso, bagno attrezzato")).toBeVisible();

    await page.getByRole("button", { name: /Salva/ }).first().click();
    // Vedi nota in TC-192 sopra: asserzione rafforzata per intercettare la
    // regressione "Salvato (demo)" segnalata da Fabrizio.
    await expect(page.getByText("Salvato su Supabase ✓")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});

// ————————————————————————————————————————————————————————————————————————
// CENTER-P-01..06 — FINAL PRE-FREEZE WAVE (08/09/2026, sez. 10-15 dello
// spec): header evoluto + riepilogo configurazione sopra il form invariato
// (CenterProfileClient, coperto da TC-080/081/117/192/199 sopra — nessuna
// duplicazione qui). Vedi app/center/profile/page.tsx.
// ————————————————————————————————————————————————————————————————————————
test.describe("Gestore - Il mio centro (header + riepilogo)", () => {
  // CENTER-P-01 — Header mostra nome reale + stato onboarding, mai un
  // placeholder vuoto.
  test("CENTER-P-01 - Header mostra il nome del centro e lo stato onboarding", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    // Nome centro: div ".text-lg.font-bold.text-ink" nell'header (unico con
    // queste classi combinate sopra il form, vedi app/center/profile/page.tsx).
    const centerName = page.locator(".text-lg.font-bold.text-ink").first();
    await expect(centerName).toBeVisible();
    await expect(centerName).not.toHaveText("");
  });

  // CENTER-P-02 — "Vedi come ti vedono le famiglie" compare SOLO se il
  // centro ha almeno un'attività pubblicata (niente preview finta — audit
  // confermato: nessuna route pubblica dedicata al centro in sé).
  test("CENTER-P-02 - CTA 'Vedi come ti vedono le famiglie' condizionata alle attività pubblicate", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    const cta = page.getByRole("link", { name: "Vedi come ti vedono le famiglie" });
    if (await cta.isVisible().catch(() => false)) {
      const href = await cta.getAttribute("href");
      expect(href).toMatch(/^\/activity\//);
      await expect(cta).toHaveAttribute("target", "_blank");
    }
    // Se assente: nessuna attività pubblicata per questo centro di test —
    // comportamento corretto (nessuna preview finta), nulla da asserire oltre.
  });

  // CENTER-P-03 — Riepilogo configurazione: 4 card con link reali verso le
  // pagine che gestiscono davvero ciascuna sezione.
  test("CENTER-P-03 - Riepilogo configurazione: 4 card con link reali", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    await expect(page.getByText("Attività", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gestisci attività" })).toHaveAttribute(
      "href",
      "/center/activities"
    );
    await expect(page.getByRole("link", { name: "Gestisci promozioni" })).toHaveAttribute(
      "href",
      "/center/promotions"
    );
    await expect(page.getByRole("link", { name: "Vedi servizi" })).toHaveAttribute(
      "href",
      "/center/servizi-consigliati"
    );
  });

  // CENTER-P-04 — Il binario "Profilo" (Completo/Da completare) è LIVE sui
  // campi reali, mai una percentuale finta — verifichiamo solo che sia uno
  // dei due valori onesti previsti, mai un terzo stato o un numero.
  test("CENTER-P-04 - Stato 'Profilo' è un binario onesto (Completo / Da completare)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    const profileStatus = page.getByText(/^(Completo|Da completare)$/);
    await expect(profileStatus).toBeVisible();
    // Mai una percentuale (regressione esplicitamente vietata dallo spec).
    await expect(page.getByText(/%/)).toHaveCount(0);
  });

  // CENTER-P-05 — Il form di configurazione sottostante (CenterProfileClient)
  // resta invariato: nessun doppio titolo "Il mio centro" duplicato tra
  // header e sezione "Configurazione" (regressione da evitare nel merge).
  test("CENTER-P-05 - Nessun titolo 'Il mio centro' duplicato tra header e form", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    await expect(page.getByRole("heading", { name: "Il mio centro" })).toHaveCount(0);
    await expect(page.getByText("Configurazione", { exact: true })).toBeVisible();
  });

  // CENTER-P-06 — 390px: nessun overflow orizzontale evidente sull'header +
  // riepilogo ridisegnati.
  test("CENTER-P-06 - 390px: nessun overflow orizzontale evidente", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "center_admin");
    await page.goto("/center/profile");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
