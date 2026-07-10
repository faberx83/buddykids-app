import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Il mio account
// Generato da BuddyKids_Test_Case.xlsx - profilo PERSONALE del gestore,
// distinto da /center/profile (profilo del CENTRO — business, vedi
// tests/gestore/profilo-centro.spec.ts). Nuova funzionalità: prima di questa
// pagina il gestore non aveva alcuna sezione di dati personali/sicurezza.

test.describe("Gestore - Il mio account", () => {
  // TC-138 - Pagina profilo personale distinta dal profilo del centro
  // AGGIORNATO: Sicurezza/Preferenze/Notifiche/Privacy e account sono ora
  // voci di un menu "Impostazioni" (righe cliccabili) che aprono ciascuna
  // una sotto-pagina dedicata sotto /center/account/... — non più sezioni
  // inline sulla stessa pagina (stessa struttura del profilo genitore, vedi
  // tests/genitori/profilo.spec.ts TC-148).
  test("TC-138 - '/center/account' mostra il menu Impostazioni e apre la sotto-pagina Sicurezza", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/account");

    // Non è il profilo del centro: niente campo "Nome del centro" o heading "Il mio centro".
    await expect(page.getByText("Il mio centro")).toHaveCount(0);
    await expect(page.getByText("Nome del centro")).toHaveCount(0);

    // Sezioni del profilo personale, condivise con il profilo genitore —
    // raggruppate sotto "Impostazioni" > Sicurezza/Preferenze/Notifiche/
    // Privacy e account (ProfileSettingsSection, componente condiviso).
    await expect(page.getByRole("button", { name: "Modifica" })).toBeVisible();
    await expect(page.getByText("Impostazioni", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sicurezza/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Preferenze/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Notifiche/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Privacy e account/ })).toBeVisible();

    // Il selettore "Sei: Padre/Madre/Tutore" non ha senso per un gestore.
    await expect(page.getByRole("button", { name: "Madre" })).toHaveCount(0);

    // L'uscita dall'account vive SOLO qui.
    await expect(page.getByRole("button", { name: /Esci dall.?account/i })).toBeVisible();

    // La voce "Sicurezza" apre la sotto-pagina dedicata.
    await page.getByRole("link", { name: /Sicurezza/ }).click();
    await expect(page).toHaveURL(/\/center\/account\/sicurezza/);
    await expect(page.locator("#security-new-password")).toBeVisible();
  });

  // TC-144 - Badge profilo in alto a destra (coerenza con l'app genitore) e
  // logout non più persistente in sidebar/header.
  // NUOVA FUNZIONALITÀ: prima il gestore non aveva alcun badge verso il
  // proprio account, e il logout era sempre visibile in sidebar (desktop) e
  // header (mobile) — ora vive solo dentro "Il mio account", come nell'app
  // genitore (vedi components/dashboard/DashboardLayout.tsx: AccountBadge).
  test("TC-144 - il badge profilo porta a 'Il mio account'; il logout non è più in sidebar/header", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    // Nessun logout persistente fuori da "Il mio account".
    await expect(page.getByRole("button", { name: /Esci dall.?account/i })).toHaveCount(0);

    // Esistono DUE badge nel DOM (sidebar desktop + header mobile, sempre
    // entrambi presenti — solo nascosti via CSS a seconda del viewport, vedi
    // DashboardLayout.tsx): ":visible" seleziona quello effettivamente
    // interagibile nel viewport corrente, invece di un .first()/.last() che
    // romperebbe su uno dei due progetti Playwright (chromium/mobile-chrome).
    await page.locator('a[aria-label="Vai al tuo account"]:visible').click();
    await expect(page).toHaveURL(/\/center\/account/);
  });

  // Segnalazione di Fabrizio: "nella scheda profilo gestore forse non serve
  // avere genere e data di nascita ma altre info più legate al business" —
  // ProfileHeaderClient ora nasconde Genere/Data di nascita lato gestore
  // (showPersonalDetails={false}) e mostra "Ruolo in azienda" al loro posto
  // (showBusinessRole={true}), mentre il profilo genitore resta invariato.
  // Priorita: Media | Precondizioni: Nessuna
  test("TC-183 - Il profilo personale del gestore mostra 'Ruolo in azienda' invece di genere/data di nascita", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/account");

    await page.getByRole("button", { name: "Modifica" }).click();
    await expect(page.getByText("Ruolo in azienda")).toBeVisible();
    await expect(page.getByText("Genere", { exact: true })).toHaveCount(0);
    await expect(page.locator("#profile-dob")).toHaveCount(0);

    await page.getByRole("button", { name: "Responsabile struttura" }).click();
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByText(/Salvo…|Salvato/)).toBeVisible().catch(() => {});

    await page.reload();
    await page.getByRole("button", { name: "Modifica" }).click();
    await expect(page.getByRole("button", { name: "Responsabile struttura" })).toHaveClass(/bg-sky/);
  });
});
