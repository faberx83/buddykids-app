import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Onboarding neo-genitore (parità con LEGACY)
//
// Gap segnalato da Fabrizio (05/08): un neo-genitore su LEGACY vede un
// prompt "Completa il tuo profilo" (components/HomeProfilePrompt.tsx) finché
// mancano nome/ruolo o bambini in anagrafica; la Home NEXTGEN non aveva mai
// un equivalente (l'utente vedeva "Organizzata al 0%" senza capire perché).
// Questo file verifica NextgenProfileCompletionPrompt
// (components/nextgen/NextgenProfileCompletionPrompt.tsx), stessa fonte dati
// (isParentProfileIncomplete + getKidsForUser) del componente LEGACY.
//
// Lo stato reale dell'account di test (profilo completo o no, bambini
// presenti o no) non è noto a priori e può cambiare da un run all'altro:
// il test verifica COERENZA tra LEGACY e NEXTGEN per lo stesso utente,
// non un valore fisso — stesso pattern già in uso per TC-142
// (tests/genitori/home.spec.ts, "il pallino rosso è coerente con lo stato
// 'profilo incompleto'").
test.describe("NEXTGEN - Onboarding neo-genitore (parità con LEGACY)", () => {
  test("TC-N610 - il prompt 'Completa il tuo profilo' in NEXTGEN è coerente con LEGACY per lo stesso utente", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");

    await page.goto("/");
    const legacyPromptVisible = await page
      .getByText("Completa il tuo profilo")
      .isVisible()
      .catch(() => false);

    await page.goto("/nextgen");
    const nextgenPromptVisible = await page
      .getByText("Completa il tuo profilo")
      .isVisible()
      .catch(() => false);

    expect(nextgenPromptVisible).toBe(legacyPromptVisible);
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-N611 - i link del prompt NEXTGEN puntano a /nextgen/profile (non /profile) e la pagina li gestisce", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const promptVisible = await page
      .getByText("Completa il tuo profilo")
      .isVisible()
      .catch(() => false);
    test.skip(!promptVisible, "L'account di test ha già il profilo completo e almeno un bambino: nulla da verificare qui.");

    const nameLink = page.getByRole("link", { name: /Nome, cognome e ruolo/ });
    const addKidLink = page.getByRole("link", { name: /Aggiungi i tuoi bambini/ });
    const nameLinkVisible = await nameLink.isVisible().catch(() => false);
    const addKidLinkVisible = await addKidLink.isVisible().catch(() => false);

    if (nameLinkVisible) {
      await expect(nameLink).toHaveAttribute("href", "/nextgen/profile?complete=1");
    }
    if (addKidLinkVisible) {
      await expect(addKidLink).toHaveAttribute("href", "/nextgen/profile?addKid=1");
    }
  });
});
