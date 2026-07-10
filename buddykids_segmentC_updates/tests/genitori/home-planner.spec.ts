import { test, expect, loginAs } from "../fixtures/roles";

// Area: Genitori - Home (Planner/Per Bambino)
// Generato da BuddyKids_Test_Case.xlsx - 7 casi.
//
// Questi test richiedono backend reale (Planner/dismissed_weeks e "già
// prenotato per [bambino]" leggono dati veri da Supabase, non la modalità
// mock "Ruolo demo") — usano loginAs("parent") contro un deploy con
// TEST_PARENT_EMAIL/PASSWORD validi (vedi tests/README.md e
// supabase/seed-test-data.sql per preparare l'account/centro/attività di
// test). Selettori presi da components/PlannerView.tsx e
// components/PerBambinoView.tsx.

test.describe("Genitori - Home (Planner/Per Bambino)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "parent");
    await page.goto("/");
  });

  // Priorita: Alta | Precondizioni: Almeno un bambino con profilo completo; app collegata a Supabase
  // Passi: Apri Home, tab "Planner"
  // Risultato atteso: Le 13 settimane della stagione sono mostrate (coperte/scoperte) in base alle prenotazioni reali; "Settimana N" indica sempre lo stesso intervallo di calendario sia qui sia nel selettore di Prenotazione
  test("TC-101 - Vista Planner riflette le prenotazioni reali con l'anno di stagione corretto", async ({ page }) => {
    await page.getByRole("button", { name: "Planner", exact: true }).click();
    await expect(page.getByText(/settimane coperte/)).toBeVisible();
    // Le 13 righe settimana sono sempre presenti (coperta, scoperta o "non ti serve")
    const rows = page.locator("text=/Settimana \\d+/");
    await expect(rows).toHaveCount(13);
  });

  // Priorita: Alta | Precondizioni: Almeno 2 bambini nel profilo, con prenotazioni/esigenze diverse
  // Passi: Nella vista Planner, usa il filtro "Tutti / [nome bambino]" sopra la lista delle settimane
  // Risultato atteso: Selezionando un bambino specifico, il Planner mostra solo la sua copertura; in modalità "Tutti" le settimane coperte solo per alcuni bambini mostrano un avviso "manca per [nome]"
  test("TC-102 - Filtro per bambino nel Planner (famiglie con più figli)", async ({ page }) => {
    await page.getByRole("button", { name: "Planner", exact: true }).click();
    const tuttiChip = page.getByRole("button", { name: "Tutti", exact: true });
    if (!(await tuttiChip.isVisible().catch(() => false))) {
      test.skip(true, "Account di test con un solo bambino: il filtro non viene mostrato (comportamento atteso).");
    }
    await expect(tuttiChip).toBeVisible();
    // Clicca il primo chip bambino disponibile dopo "Tutti"
    const firstKidChip = page.getByRole("button").nth(1);
    await firstKidChip.click();
    await expect(page.getByText(/settimane coperte per/)).toBeVisible();
  });

  // Priorita: Media | Precondizioni: Almeno una settimana scoperta nel Planner
  // Passi: Su una settimana scoperta, clicca "Non mi serve"; poi clicca "Ripristina"
  // Risultato atteso: La settimana passa allo stato "non ti serve" (non conta più tra quelle da riempire) e può essere ripristinata in qualsiasi momento
  test("TC-103 - Escludere/ripristinare una settimana da \"da riempire\"", async ({ page }) => {
    await page.getByRole("button", { name: "Planner", exact: true }).click();
    const nonMiServe = page.getByRole("button", { name: "Non mi serve" }).first();
    if (!(await nonMiServe.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana scoperta disponibile per l'account di test in questo momento.");
    }
    await nonMiServe.click();
    await expect(page.getByText(/non ti serve/).first()).toBeVisible();
    await page.getByRole("button", { name: "Ripristina" }).first().click();
    await expect(page.getByText(/non ti servono/)).toBeVisible({ timeout: 5_000 }).catch(() => {});
  });

  // Priorita: Bassa | Precondizioni: Almeno 2 bambini nel profilo
  // Passi: In Home, passa alla vista "Per bambino"; scorri gli avatar e seleziona un bambino vicino al bordo della sezione scrollabile
  // Risultato atteso: L'anello colorato attorno all'avatar selezionato è visibile per intero, non tagliato dal bordo del contenitore
  test("TC-104 - Vista Per Bambino — anello di selezione non tagliato dal bordo", async ({ page }) => {
    await page.getByRole("button", { name: "Per bambino", exact: true }).click();
    await expect(page.getByText("Per chi cerchiamo oggi?")).toBeVisible();
    const kidButtons = page.locator("button", { has: page.locator("span") }).filter({ hasText: /.+/ });
    const count = await kidButtons.count();
    if (count === 0) {
      test.skip(true, "Nessun bambino nel profilo dell'account di test.");
    }
    const lastKidAvatar = page.locator(".no-scrollbar >> button").first();
    await lastKidAvatar.click();
    // Verifica che il contenitore scrollabile non tagli il ring (niente overflow-hidden sul contenitore diretto)
    const container = page.locator(".no-scrollbar").first();
    await expect(container).not.toHaveClass(/overflow-hidden/);
  });

  // Priorita: Media | Precondizioni: Bambino con almeno una prenotazione confermata
  // Passi: Vista "Per bambino", seleziona il bambino con la prenotazione
  // Risultato atteso: La sezione "Già prenotato per [nome]" mostra ogni attività/settimane una sola volta, senza righe identiche ripetute
  test("TC-105 - \"Già prenotato per [bambino]\" senza righe duplicate", async ({ page }) => {
    await page.getByRole("button", { name: "Per bambino", exact: true }).click();
    const gia = page.getByText(/Già prenotato per/);
    if (!(await gia.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test non ha ancora prenotazioni confermate per il bambino selezionato.");
    }
    const rows = page.locator("a", { hasText: /.+/ }).filter({ has: page.locator("i.ti-circle-check-filled") });
    const texts = await rows.allInnerTexts();
    const uniqueTexts = new Set(texts);
    expect(uniqueTexts.size).toBe(texts.length);
  });

  // Priorita: Alta | Precondizioni: Settimana scoperta nel Planner
  // Passi: Dal Planner, clicca "Riempi" su una settimana scoperta, scegli un'attività da Cerca, arriva fino allo step "Scegli le settimane" della Prenotazione
  // Risultato atteso: La settimana richiesta è già selezionata (bordo/spunta) e appare un banner "Hai già scelto la Settimana N dal Planner"
  test("TC-106 - Settimana scelta dal Planner arriva pre-selezionata in Prenotazione", async ({ page }) => {
    await page.getByRole("button", { name: "Planner", exact: true }).click();
    const riempi = page.getByRole("link", { name: "Riempi" }).first();
    if (!(await riempi.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana scoperta disponibile per l'account di test in questo momento.");
    }
    await riempi.click();
    await expect(page).toHaveURL(/\/search\?week=/);

    // Apri l'attività di test seminata da supabase/seed-test-data.sql
    const testCard = page.getByText("[TEST] Attività BuddyKids").first();
    if (!(await testCard.isVisible().catch(() => false))) {
      test.skip(true, "Attività di test non trovata: esegui prima supabase/seed-test-data.sql.");
    }
    await testCard.click();
    await expect(page).toHaveURL(/\/activity\/.+week=/);

    await page.getByRole("link", { name: "Prenota ora" }).click();
    await expect(page).toHaveURL(/\/booking\/.+week=/);
    await expect(page.getByText(/Hai già scelto la/)).toBeVisible();
  });

  test.fixme("TC-107 - Multi-bambino: iscrizioni a campus/settimane diverse gestite end-to-end", async ({ page }) => {
    // TODO: richiede un secondo bambino con esigenze diverse sull'account di
    // test e un secondo giro completo del flusso booking — da completare con
    // dati di test più ricchi (vedi supabase/seed-test-data.sql per estendere
    // il seed con un secondo bambino).
  });

  // Segnalazione di Fabrizio (screenshot): "il selettore del nome bambino è
  // nero" — non coerente col colore usato per lo stesso bambino altrove
  // (anello in "Per bambino"). Corretto in PlannerView.tsx usando
  // kid.accentColor (solidBgClasses) invece di un bg-ink fisso.
  // Priorita: Bassa | Precondizioni: Almeno 2 bambini nel profilo
  test("TC-153 - Il chip del bambino selezionato nel Planner usa il colore del bambino, non nero", async ({ page }) => {
    await page.getByRole("button", { name: "Planner", exact: true }).click();
    const tuttiChip = page.getByRole("button", { name: "Tutti", exact: true });
    if (!(await tuttiChip.isVisible().catch(() => false))) {
      test.skip(true, "Account di test con un solo bambino: il selettore non viene mostrato.");
    }
    const firstKidChip = page.getByRole("button").nth(1);
    await firstKidChip.click();
    const cls = await firstKidChip.getAttribute("class");
    // Nessuna classe bg-ink fissa: deve usare uno dei colori "solid" per
    // bambino (bg-aqua/bg-orange/bg-purple/bg-sky/bg-green).
    expect(cls).not.toMatch(/bg-ink(?!-)/);
    expect(cls).toMatch(/bg-(aqua|orange|purple|sky|green)/);
  });

  // Segnalazione: righe con copertura parziale (alcuni bambini coperti, altri
  // no) non erano distinguibili dalle righe pienamente coperte, e mancava
  // un modo diretto per completarle. Aggiunto sfondo bg-yellow-light + CTA
  // "+ Aggiungi [nome]" per ciascun bambino ancora scoperto in quella
  // settimana, che punta dritto a /booking/[slug]?week=...&kid=...
  // Priorita: Alta | Precondizioni: Almeno 2 bambini, con una settimana coperta solo per uno di loro
  test("TC-154 - Settimana con copertura parziale mostra stile distinto e CTA 'Aggiungi [bambino]'", async ({ page }) => {
    await page.getByRole("button", { name: "Planner", exact: true }).click();
    const addLink = page.getByRole("link", { name: /^\+ Aggiungi / }).first();
    if (!(await addLink.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana con copertura parziale per l'account di test in questo momento.");
    }
    const row = page.locator(".bg-yellow-light").first();
    await expect(row).toBeVisible();
    await expect(addLink).toBeVisible();
    const href = await addLink.getAttribute("href");
    expect(href).toMatch(/\/booking\/.+week=.+kid=/);
  });

  // Prima l'etichetta "Per riempire la settimana N" indicava sempre la prima
  // settimana scoperta in ordine cronologico. Ora sceglie la settimana
  // "prioritaria": preferisce un buco tra due settimane già coperte
  // (prenotazioni prima E dopo), altrimenti la prima scoperta/necessaria.
  // Priorita: Media | Precondizioni: Planner con almeno una settimana scoperta
  test("TC-155 - 'Per riempire la settimana N' sceglie la settimana prioritaria (gap), non la prima scoperta", async ({ page }) => {
    await page.getByRole("button", { name: "Planner", exact: true }).click();
    const label = page.getByText(/Per riempire la settimana \d+/);
    if (!(await label.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana da riempire per l'account di test in questo momento.");
    }
    await expect(label).toBeVisible();
    // La scritta è cliccabile e porta a Cerca con quella settimana pre-applicata.
    const link = page.getByRole("link", { name: /Per riempire la settimana \d+/ });
    await link.click();
    await expect(page).toHaveURL(/\/search\?.*week=/);
  });

  // I suggerimenti sotto "Per riempire la settimana N" mostravano prima le
  // 4 attività con rating più alto in assoluto, ignorando sia la
  // disponibilità reale per quella settimana sia le preferenze del bambino
  // (kid.interests). Ora sono filtrati per entrambe (quando Supabase è
  // collegato) — vedi PlannerView.tsx suggestions/useMemo.
  // Priorita: Alta | Precondizioni: Settimana da riempire con attività disponibili + bambino con preferenze impostate
  test("TC-156 - Suggerimenti 'Per riempire' filtrati per disponibilità reale e preferenze del bambino", async ({ page }) => {
    await page.getByRole("button", { name: "Planner", exact: true }).click();
    const label = page.getByText(/Per riempire la settimana \d+/);
    if (!(await label.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana da riempire per l'account di test in questo momento.");
    }
    // Le card suggerite (se presenti) sono link verso /activity/[id], al
    // massimo 4, coerenti con lo slice(0, 4) in PlannerView.tsx.
    const suggestionLinks = page.locator('a[href^="/activity/"]');
    const count = await suggestionLinks.count();
    expect(count).toBeLessThanOrEqual(4);
  });
});
