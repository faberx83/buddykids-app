import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner Organizzazione, Sprint correttivo (feedback
// dettagliato di Fabrizio su 8 screenshot: bug "5 di 4 settimane coperte",
// triangolo su settimane "non ti serve", genere/dedup nel testo
// sovrapposizioni, CTA sui banner, check prenotazione più stringente,
// badge Beta al posto di NEXTGEN, nuova sezione Promemoria e avvisi).
//
// NOTA: alcuni comportamenti (overshoot "X di Y" con settimana
// dismissed+covered, triangolo su riga dismissed con overlap, genere
// femminile nel testo sovrapposizioni, conflitto di prenotazione stesso
// bambino) richiedono precondizioni di dati molto specifiche (settimane
// marcate "non mi serve" DOPO una prenotazione attiva, una bambina con
// overlap, due prenotazioni reali sovrapposte) non ottenibili in modo
// affidabile con l'unico account di test disponibile — coperti da
// test.fixme() con la constatazione dell'esito atteso, verifica manuale
// raccomandata prima del rilascio (stessa convenzione già usata altrove in
// questa suite, es. TC-N73..77).

test.describe("NEXTGEN - Planner Organizzazione, sprint correttivo (feedback dettagliato)", () => {
  test("TC-262 - Badge 'Beta' nell'angolo al posto del pill 'NextGen'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText("Beta", { exact: true })).toBeVisible();
    await expect(page.getByText("NextGen", { exact: true })).toHaveCount(0);
  });

  // Fabrizio: "il Budget impegnato non mi interessa qui, c'è una sezione
  // dedicata no?" — rimossa la card duplicata dal tab Organizzazione,
  // resta solo nel tab Budget.
  test("TC-263 - 'Budget impegnato' non è più duplicato nel tab Organizzazione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText("Budget impegnato")).toHaveCount(0);
    await page.getByRole("button", { name: "Budget" }).click();
    await expect(page.getByText("Budget impegnato")).toBeVisible();
  });

  // Fabrizio: "le notifiche nascoste... devono avere una CTA?" — ogni
  // alert (Promemoria/Missione) porta ora un'azione (scorre a una
  // settimana, cambia tab, o naviga altrove) quando ha senso averla.
  test("TC-264 - Un banner con azione (freccia) porta da qualche parte senza errori", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const actionableAlert = page.locator(".ti-chevron-right").first();
    if (!(await actionableAlert.isVisible().catch(() => false))) {
      test.skip(true, "Nessun banner con azione visibile per l'account di test in questo momento.");
    }
    await actionableAlert.locator("xpath=ancestor::*[self::a or self::button][1]").click();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("TC-265 - La pagina 'Promemoria e avvisi' è raggiungibile da Profilo ed è segnata come anteprima", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/profile");
    await page.getByText("Promemoria e avvisi").click();

    await expect(page).toHaveURL(/\/nextgen\/planner\/promemoria/);
    await expect(page.getByText("Anteprima", { exact: true })).toBeVisible();
    await expect(page.getByText("Promemoria attivo")).toBeVisible();

    // Il toggle è solo stato locale (nessun salvataggio reale, per scelta
    // esplicita — vedi PromemoriaClient.tsx): cliccarlo non deve rompere
    // la pagina.
    await page.getByText("Promemoria attivo").click();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  // Fabrizio: "sullo stesso bambino forse va introdotto un check più
  // stringente" (invece del generico "Prosegui comunque").
  test.fixme(
    "TC-266 - Conflitto di prenotazione sullo stesso bambino offre 'Mantieni entrambe' o 'Annulla l'altra e prenota questa'",
    async () => {
      // Precondizione non fixturabile in modo affidabile con un solo
      // account di test: serve un bambino con una prenotazione ATTIVA su
      // un'attività A, poi avviare una nuova prenotazione su un'attività B
      // diversa che copre la STESSA settimana per lo stesso bambino.
      // Risultato atteso (vedi BookingClient.tsx): il box "Attenzione:
      // settimana già impegnata" mostra due bottoni — "Mantieni entrambe"
      // (submitBooking(true), come il precedente "Prosegui comunque") e
      // "Annulla l'altra e prenota questa" (cancella la prenotazione
      // esistente via cancelBookingAction, poi prenota la nuova; se la
      // vecchia non è più annullabile per finestra scaduta, mostra
      // l'errore e non prenota comunque la nuova). Verificare manualmente
      // con due prenotazioni reali prima del rilascio.
    }
  );

  test.fixme(
    "TC-267 - 'X di Y settimane coperte' non supera mai Y anche con una settimana dismissed+covered",
    async () => {
      // Precondizione: prenotare un'attività per la Settimana N, poi
      // marcare la Settimana N come "non mi serve" (dismissed) SENZA
      // annullare la prenotazione — scenario limite non riproducibile
      // deterministicamente con l'account di test condiviso. Risultato
      // atteso (vedi lib/data/planner.ts#coveredNeededCount e
      // PlannerClient.tsx): il numeratore usa solo settimane coperte E
      // non-dismissed, quindi "X di Y" non supera mai Y; la Settimana N
      // in Timeline mostra "Non ti serve" senza il triangolo di
      // sovrapposizione anche se un overlap reale esiste su quella
      // settimana (il segnale resta comunque nel box "Sovrapposizioni
      // da controllare").
    }
  );
});
