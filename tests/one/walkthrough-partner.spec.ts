import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// TRAMA ONE — CONTROLLED BETA EXPERIENCE GATE (§7-14, DEC-58/DEC-60).
//
// Riscrittura di questo file: la vecchia versione (Sprint 2) testava la
// WalkthroughCard testuale montata sulla route orfana /center/one
// ("Pubblica la tua prima attività" / bottone "Inizia" dentro una card).
// Quella card è stata RIMOSSA da /center/one (vedi app/center/one/page.tsx)
// perché il vero Spotlight ora vive direttamente sulle pagine reali
// (components/spotlight/PartnerSpotlight.tsx, montato in
// app/center/layout.tsx) — quindi i vecchi TC-N414/TC-N415, che asserivano
// contro /center/one, non hanno più nulla da verificare in quella route e
// vanno riscritti contro /center/activities, la pagina reale dove vive il
// primo step ("create_activity").
//
// Nessuna modifica al motore Walkthrough generico stesso (start/complete/
// skip/persistenza) qui: quello resta coperto da tests/one/onboarding.spec.ts
// e da tests/one/feature-flags.spec.ts. Questo file copre SOLO il nuovo
// comportamento Spotlight: overlay ancorato a un elemento DOM reale,
// completamento via click genuino (non un bottone "Continua" del tour).
//
// Richiede un browser reale contro un deploy con Supabase configurato e
// l'account center_admin di test con l'override TRAMA_ONE_ENABLED=true
// (DEC-34) — lo stesso già usato da tests/one/onboarding-remediation.spec.ts.

test.describe("TRAMA ONE — Spotlight reale Partner (Controlled Beta, §7-14)", () => {
  // Stesso motivo della versione precedente di questo file: TC-N415
  // avvia davvero lo step (scrittura reale su tutorial_progress) e
  // TC-N416 dipende da quello stato — serializzazione esplicita
  // necessaria anche dentro la stessa run (fullyParallel:true non basta).
  test.describe.configure({ mode: "serial" });

  test("TC-N414 - Partner: /center/activities mostra lo Spotlight reale ancorato al pulsante '+ Nuova attività', non una card testuale scollegata", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account center_admin di test (override TRAMA_ONE_ENABLED, vedi DEC-34)."
    );

    await loginAs(page, "center_admin");
    await page.goto("/center/activities");

    // Il target reale esiste nel DOM (data-spotlight, vedi
    // app/center/activities/page.tsx) — non un doppione del tour.
    const realTarget = page.getByRole("link", { name: "+ Nuova attività" });
    await expect(realTarget).toHaveAttribute("data-spotlight", "create_activity");

    // Il popover è un dialog ANCORATO a quel target (lib/spotlight/
    // position.ts), non una card fissa altrove nella pagina.
    const dialog = page.getByRole("dialog", { name: "Crea l'attività" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Passo 1 di 6")).toBeVisible();
    await expect(
      dialog.getByText('Vai su "Le tue attività" e crea una nuova scheda: nome, fascia d\'età, descrizione.')
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Inizia" })).toBeVisible();
  });

  test("TC-N415 - avviare lo step ('Inizia') lo marca 'in_progress' con persistenza reale (non solo stato locale del componente)", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account center_admin di test (override TRAMA_ONE_ENABLED, vedi DEC-34)."
    );

    await loginAs(page, "center_admin");
    await page.goto("/center/activities");
    await page.getByRole("dialog", { name: "Crea l'attività" }).getByRole("button", { name: "Inizia" }).click();

    const dialog = page.getByRole("dialog", { name: "Crea l'attività" });
    await expect(dialog.getByText("Fatto? Clicca l'elemento evidenziato per continuare.")).toBeVisible();

    // Ricarico la pagina: se lo stato è davvero persistito su
    // tutorial_progress (e non solo nello useState locale), lo step resta
    // "in_progress" e il messaggio di completamento reale ricompare, invece
    // di tornare al bottone "Inizia" iniziale.
    await page.reload();
    await expect(
      page.getByRole("dialog", { name: "Crea l'attività" }).getByText("Fatto? Clicca l'elemento evidenziato per continuare.")
    ).toBeVisible();
  });

  test("TC-N416 - completare lo step con un click GENUINO sull'elemento reale (non un bottone del tour) fa avanzare il percorso allo step successivo", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account center_admin di test (override TRAMA_ONE_ENABLED, vedi DEC-34)."
    );

    await loginAs(page, "center_admin");
    await page.goto("/center/activities");
    // Prosegue dallo stato "in_progress" lasciato da TC-N415bis (serial).

    // L'azione che avanza il percorso è il click sul VERO pulsante applicativo
    // "+ Nuova attività" — non un "Continua" dentro il popover: verifica che
    // la navigazione reale avvenga (il click non viene intercettato/bloccato
    // dall'overlay Spotlight).
    await page.getByRole("link", { name: "+ Nuova attività" }).click();
    await expect(page).toHaveURL(/\/center\/activities\/new$/);

    // Lo step "create_activity" è ora completato e il percorso è passato a
    // "configure_weeks" (spotlightRoute "/center/activities/*", che include
    // anche /new — ma quel target non esiste sulla pagina di creazione, solo
    // su ActivityEditForm.tsx per un'attività già esistente): lo Spotlight
    // deve quindi mostrare il badge "target non trovato" con il titolo dello
    // step successivo, non restare ancorato al pulsante ormai scomparso.
    const missingBadge = page.getByRole("status").filter({ hasText: "Configura le settimane" });
    await expect(missingBadge).toBeVisible();
  });
});
