import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner, Organizzazione semplificata (Sprint correttivo)
// Feedback di Fabrizio (mockup "2. Calendario"): "vorrei semplificare le
// notifiche, sono troppe" + "anche Planner-Calendario finirebbero a
// collassare nella stessa sezione" + "ogni barra del bambino o lo stato per
// settimana deve portare ad un dettaglio del piano". Vedi PlannerClient.tsx
// per il dettaglio completo di ciascuna modifica.

test.describe("NEXTGEN - Planner, Organizzazione semplificata", () => {
  test("TC-N97 - Promemoria/Missioni mostrano un solo avviso di default, con 'Mostra tutti' per il resto", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno 2 avvisi (promemoria+missioni) attivi.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const showAllButton = page.getByRole("button", { name: /Mostra tutti \(\d+\)/ });
    if (!(await showAllButton.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test ha 0 o 1 solo avviso attivo: nulla da espandere.");
    }
    const countMatch = (await showAllButton.textContent())!.match(/\((\d+)\)/);
    const total = countMatch ? Number(countMatch[1]) : 0;

    await showAllButton.click();
    await expect(page.getByRole("button", { name: "Mostra meno" })).toBeVisible();
    // Torna alla visualizzazione compatta.
    await page.getByRole("button", { name: "Mostra meno" }).click();
    await expect(page.getByRole("button", { name: `Mostra tutti (${total})` })).toBeVisible();
  });

  // PLANNER BETA v1.1 (Wave 1, punto 2B) — "Copertura per bambino" è ora
  // essa stessa dietro un secondo livello di disclosure (kidCoverageOpen,
  // default chiuso): l'intestazione va aperta PRIMA di poter cliccare la
  // barra di un bambino. Il vecchio selettore generico
  // 'button[aria-expanded="false"]' agganciava per posizione il primo
  // bottone pieghevole della pagina — ora ce ne sono altri prima nel DOM
  // ("Vedi tutte le settimane", l'intestazione stessa di questa card),
  // quindi sostituito con un selettore scoped al contenuto della riga
  // bambino (nome + "N/M settimane"/"Tutto organizzato!").
  test("TC-N98 - Cliccare la barra di copertura di un bambino apre/chiude il dettaglio settimana per settimana", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con 2+ bambini.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const heading = page.getByRole("button", { name: "Copertura per bambino" });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test ha un solo figlio: la card non è mostrata.");
    }
    await expect(heading).toHaveAttribute("aria-expanded", "false");
    await heading.click();
    await expect(heading).toHaveAttribute("aria-expanded", "true");

    const kidButton = page.getByRole("button", { name: /\d+\/\d+ settimane|Tutto organizzato/ }).first();
    await expect(kidButton).toHaveAttribute("aria-expanded", "false");
    await kidButton.click();
    await expect(kidButton).toHaveAttribute("aria-expanded", "true");

    // Richiudendo, il dettaglio scompare di nuovo.
    await kidButton.click();
    await expect(kidButton).toHaveAttribute("aria-expanded", "false");
  });

  // PLANNER BETA v1.1 (Wave 1, punto 2B) — la striscia compatta "Stato per
  // settimana" verificata da questo test è stata RIMOSSA (ridondante con
  // Timeline + sistema di alert unificato — grep eseguito su tutto
  // app/nextgen prima di rimuoverla, vedi commento in
  // PlannerClient.tsx#jumpToWeek: nessun altro punto del prodotto dipendeva
  // da essa). L'azione jumpToWeek che generava sopravvive solo tramite
  // l'alert "settimana prioritaria" — coperta ora da
  // planner-organizzazione-sprint2.spec.ts#TC-272. Questo test diventa una
  // regressione minima: verifica che la striscia non sia tornata per errore.
  test("TC-N99 - 'Stato per settimana' non è più presente in Organizzazione (rimossa, ridondante con Timeline+alert)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText("Stato per settimana", { exact: true })).toHaveCount(0);
  });

  // Vedi anche family-planner-5-1.spec.ts#TC-N43 (4 tab, non più 5) e
  // family-planner-5-3.spec.ts (tutti i test "Chi fa cosa?"/Condivisione
  // piano, invariati: cliccano ancora un bottone chiamato "Calendario").
  test("TC-N100 - Il riquadro 'Calendario' dentro Organizzazione si apre e chiude senza cambiare tab", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    // NO exact:true su "Calendario": vedi commento su TC-N43
    // (family-planner-5-1.spec.ts) — icona Tabler Icons inquina il nome
    // accessibile del bottone (Gate C Cluster D).
    const toggle = page.getByRole("button", { name: "Calendario" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // exact:true invece qui: "Mese"/"Settimana" senza matchano per substring
    // anche bottoni tipo "Mese precedente" o "Settimana N" (stesso strict
    // mode violation di TC-N50/TC-N54). PLANNER BETA v1.1: la sezione
    // "Stato per settimana" che un tempo condivideva questo problema è
    // stata rimossa (vedi TC-N99), ma il rischio di ambiguità resta con
    // altri elementi della pagina (es. "Settimana N" nella Timeline/
    // "Prossime settimane da completare").
    await expect(page.getByRole("button", { name: "Mese", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settimana", exact: true })).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  // SPRINT 7 — Segnalazione di Fabrizio: "troppe card di notifica, serve una
  // X per chiuderle". Dismiss locale (solo per la sessione corrente, non
  // persistito — vedi PlannerClient.tsx#dismissedAlertIds).
  test("TC-N297 - La X su una card di avviso la nasconde", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test con almeno un avviso attivo.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const dismissButton = page.getByRole("button", { name: "Nascondi questo avviso" }).first();
    if (!(await dismissButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessun avviso attivo per l'account di test.");
    }
    const cardText = await dismissButton
      .locator("xpath=preceding-sibling::*[1]")
      .textContent();
    await dismissButton.click();
    if (cardText) {
      await expect(page.getByText(cardText, { exact: true })).toHaveCount(0);
    }
  });

  // SPRINT 7 — Segnalazione di Fabrizio: "i due promemoria di doppia
  // prenotazione non sono azionabili nonostante lo sembrino" — portavano a
  // "scorri e evidenzia la riga della Timeline", un vicolo cieco (quella
  // riga è solo un link alla scheda attività, non permette di annullare
  // nulla). Ora l'azione porta a "Le mie prenotazioni", dove si può davvero
  // annullare/modificare una delle due prenotazioni in conflitto — sia dal
  // promemoria in cima sia dal box "Sovrapposizioni da controllare".
  // PLANNER BETA v1.1, punto 3 della revisione — il box indipendente
  // "Sovrapposizioni da controllare" è stato RIMOSSO: la ridondanza con
  // l'alert di sovrapposizione (già esistente, computeOverlapReminders in
  // lib/nextgen/reminders.ts) era esplicitamente da eliminare ("le
  // sovrapposizioni devono entrare nello stesso sistema [alert], NON creare
  // nuovi box alert indipendenti"). L'alert stesso è invariato: intero testo
  // cliccabile (non un link separato "Gestisci in Le mie prenotazioni" —
  // quello esiste solo nel Dettaglio Settimana, route diversa), href
  // "/nextgen/prenotazioni" (non "/prenotazioni", diversamente da prima).
  test("TC-N298 - La sovrapposizione confluisce nell'alert unificato e porta a 'Le mie prenotazioni'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con una sovrapposizione attiva.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText("Sovrapposizioni da controllare", { exact: true })).toHaveCount(0);

    const overlapPattern = /risulta prenotat[oa] due volte in .*: controlla quale attività tenere\./;
    let overlapAlert = page.getByRole("link", { name: overlapPattern }).first();
    if (!(await overlapAlert.isVisible().catch(() => false))) {
      const showAll = page.getByRole("button", { name: /Mostra tutti/ });
      if (await showAll.isVisible().catch(() => false)) {
        await showAll.click();
        overlapAlert = page.getByRole("link", { name: overlapPattern }).first();
      }
    }
    if (!(await overlapAlert.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna sovrapposizione attiva per l'account di test.");
    }
    await expect(overlapAlert).toHaveAttribute("href", "/nextgen/prenotazioni");
  });
});
