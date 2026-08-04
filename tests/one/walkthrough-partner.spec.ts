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
    // Titolo aggiornato da "Configura le settimane" a "Informazioni di base"
    // (DEC-69, Visual Acceptance Gate §15): il target reale di questo step è
    // la card "Informazioni generali", che non contiene affatto settimane/
    // capacità — testo corretto per non fuorviare l'utente.
    const missingBadge = page.getByRole("status").filter({ hasText: "Informazioni di base" });
    await expect(missingBadge).toBeVisible();
    // Nessun link "Vai al..." qui: /new non è un'attività reale (nessun id),
    // il badge non deve offrire un link che porterebbe a un 404.
    await expect(missingBadge.getByRole("link")).toHaveCount(0);
  });

  // DEC-69 (Visual Acceptance Gate §15) — bug reale trovato da Fabrizio: il
  // badge "target non trovato" per lo step "Configura i Giorni spot" dava
  // solo testo ("apri il calendario disponibilità...") senza un modo
  // cliccabile per arrivarci quando lo step diventa corrente sulla pagina di
  // modifica (dopo aver pubblicato). Verifica diretta della funzione pura
  // matchesSpotlightRoute/costruzione del link è già coperta da
  // tests/one/spotlight-position.spec.ts; qui verifichiamo il link REALE nel
  // badge, che richiede il motore Walkthrough completo (server action +
  // persistenza) — non estraibile in un test "no browser".
  //
  // DEC-71 (Visual Acceptance Gate §15) — secondo bug reale trovato da
  // Fabrizio, integrato in questo stesso test perché richiede lo stesso
  // avanzamento sequenziale: per gli step "manuali" (configure_weeks,
  // configure_pricing — il target è un'intera card con più campi, non un
  // singolo pulsante), un click su QUALUNQUE campo reale dentro la card
  // (es. la checkbox "Ingresso anticipato (pre-servizio)") faceva scattare
  // subito l'avanzamento allo step successivo, impedendo di finire di
  // compilare gli altri campi. Ora questi step richiedono "Inizia" poi il
  // pulsante esplicito "Ho finito, continua →"; un click su un campo reale
  // dentro la card, da solo, non deve più avanzare nulla.
  test("TC-N615 - step 'manuali' (Informazioni di base/Servizi extra) richiedono il pulsante esplicito 'Ho finito, continua' (un click su un campo reale non avanza da solo); il badge 'target non trovato' per Giorni spot mostra un link reale verso il Calendario disponibilità", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato, l'account center_admin di test e un'attività esistente nel centro collegato."
    );

    await loginAs(page, "center_admin");
    // Apre un'attività esistente del centro di test (il centro collegato
    // all'account TEST_CENTER_ADMIN_EMAIL ne ha già almeno una, vedi
    // TRAMA_ONE_PRODUCTION_HYGIENE.md §3): click reale sulla prima card, non
    // un URL con id inventato.
    await page.goto("/center/activities");
    await page.locator("a[href^='/center/activities/']").first().click();
    await expect(page).toHaveURL(/\/center\/activities\/[^/]+$/);

    // Step "configure_weeks" (DEC-71): manuale, Inizia poi "Ho finito,
    // continua" — non basta più un click generico dentro la card.
    const weeksDialog = page.getByRole("dialog", { name: "Informazioni di base" });
    await weeksDialog.getByRole("button", { name: "Inizia" }).click();
    await weeksDialog.getByRole("button", { name: "Ho finito, continua →" }).click();

    // Step "configure_pricing": stesso pattern manuale — ma prima
    // verifichiamo il bug reale di Fabrizio: cliccare un campo REALE dentro
    // la card (checkbox "Ingresso anticipato") non deve avanzare da solo.
    const pricingDialog = page.getByRole("dialog", { name: "Servizi extra e pasto" });
    await pricingDialog.getByRole("button", { name: "Inizia" }).click();
    await page.getByRole("checkbox", { name: "Ingresso anticipato (pre-servizio)" }).click();
    await expect(pricingDialog).toBeVisible(); // ancora qui: il click sul campo non ha avanzato lo step
    await expect(pricingDialog.getByText("Compila con calma i campi di questa sezione, poi continua.")).toBeVisible();
    await pricingDialog.getByRole("button", { name: "Ho finito, continua →" }).click();

    // Step "publish": resta click-based, l'azione stessa (salvare) È il
    // completamento genuino dello step — comportamento invariato.
    await page.locator('[data-spotlight="publish"]').click();

    const missingBadge = page.getByRole("status").filter({ hasText: "Configura i Giorni spot" });
    await expect(missingBadge).toBeVisible();
    const link = missingBadge.getByRole("link", { name: "Vai al Calendario disponibilità →" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /\/center\/activities\/[^/]+\/calendar$/);
    await link.click();
    await expect(page).toHaveURL(/\/center\/activities\/[^/]+\/calendar$/);
  });
});
