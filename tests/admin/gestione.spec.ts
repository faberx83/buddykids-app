import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Admin - Gestione
// Convertiti da gotoAsRole a loginAs: /admin reindirizza a /auth/login se
// Supabase è configurato e non c'è sessione reale.

test.describe("Admin - Gestione", () => {
  // TC-083 - Elenco attivita (tutte) - noto FUNCTIONAL: dati sempre mock (task #19)
  test("TC-083 - /admin/activities elenca le attività (oggi: dati demo)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/activities");
    await expect(page.getByText("Summer Camp Acquatico")).toBeVisible();
  });

  // TC-088 - Gestione tag piattaforma (richiede Supabase configurato per la scrittura)
  test("TC-088 - creare un tag lo rende subito selezionabile", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede Supabase configurato (scrittura reale).");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/tags");

    await page.getByRole("button", { name: "+ Nuovo tag" }).click();
    const label = `Test ${Date.now()}`;
    await page.getByPlaceholder("Es. Avventura").fill(label);
    await page.getByRole("button", { name: "Crea tag" }).click();

    await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 });
  });
  // Priorita: Media | Precondizioni: Nessuna
  // Passi: Apri /admin/bookings
  // Risultato atteso: Dovrebbe riflettere le prenotazioni reali
  test.fixme("TC-084 - Elenco prenotazioni (tutte)", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // PRE-MICRO-PILOT GATE — R-01 (task #557, 25/08/2026): /admin/centers era
  // sempre lib/mock-data.ts (vedi commento rimosso in questo stesso file
  // sopra TC-N672), reso reale su listAllCentersForAdmin(). Requisito
  // esplicito di Fabrizio: "centro reale presente". "Centro Sportivo Lido"
  // è un centro seed stabile (supabase/seed.sql, non lo script di pulizia
  // effimero usato per i dati di test) — non dovrebbe mai scomparire tra un
  // run e l'altro.
  test("TC-085 - /admin/centers elenca i centri reali (dati Supabase, non mock)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/centers");

    await expect(page.getByRole("heading", { name: "Centri" })).toBeVisible();
    await expect(page.getByText("Centro Sportivo Lido")).toBeVisible();
    // Colonne richieste da Fabrizio: Comune + Attività (nessuna query SQL o
    // conoscenza dell'ID necessaria per capire di che centro si tratta).
    await expect(page.getByRole("columnheader", { name: "Comune" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Attività" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Stato attivazione" })).toBeVisible();
  });

  // Requisito esplicito di Fabrizio: "centro mock/test chiaramente
  // classificato" — senza che l'Admin debba interrogare Supabase a mano.
  // "[TEST] Centro BuddyKids" è un centro di test persistente (non uno dei
  // due generati con timestamp dagli script di prova estemporanei), quindi
  // stabile come fixture per questo assert.
  test("TC-085b - Un centro di test/demo è marcato chiaramente in elenco", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/centers");

    const testRow = page.getByRole("row", { name: /\[TEST\] Centro BuddyKids/ });
    await expect(testRow).toBeVisible();
    await expect(testRow.getByText("Test/demo")).toBeVisible();
  });

  // Priorita: Alta | Precondizioni: Nessuna
  // Passi: Su /admin/centers, usa il form 'Nuovo centro' -> compila -> salva
  // Risultato atteso: Il centro viene creato su Supabase
  test.fixme("TC-086 - Creazione nuovo centro", async ({ page }) => {
    // TODO: implementare - vedi i test gia completati in questo file per esempio.
  });

  // Requisito esplicito di Fabrizio: "click dettaglio" deve funzionare senza
  // conoscere l'ID a memoria — click diretto dall'elenco, non un goto()
  // manuale a /admin/centers/[id].
  test("TC-087 - Dettaglio centro: click da elenco mostra i dati reali", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Admin di test.");
    await loginAs(page, "platform_admin");
    await page.goto("/admin/centers");

    const row = page.getByRole("row", { name: /Centro Sportivo Lido/ });
    await row.getByRole("link", { name: "Dettaglio →" }).click();

    await expect(page).toHaveURL(/\/admin\/centers\/.+/);
    await expect(page.getByRole("heading", { name: "Centro Sportivo Lido" })).toBeVisible();
    await expect(page.getByText("Attività (")).toBeVisible();
    await expect(page.getByText("Storico attivazione")).toBeVisible();
  });

  // Priorita: Bassa | Precondizioni: Login Admin piattaforma
  // Passi: Vai su Admin > Fornitori consigliati, crea/modifica un fornitore e carica una foto
  // Risultato atteso: La foto sostituisce l'emoji sia nella tabella Admin sia nella card mostrata ai Gestori in \"Servizi consigliati\"
  test.fixme("TC-118 - Upload foto/logo fornitore", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede lo snippet SQL Storage applicato su Supabase prima del test
  });

  // PRE-LAUNCH REMEDIATION WAVE 1 — R-14 (decisione Fabrizio, 24/08/2026):
  // app/actions/admin.ts (createCenterAndAssignAction/assignCenterAdminAction)
  // ora rifiuta esplicitamente un chiamante non platform_admin PRIMA di
  // toccare il database (requireCallerIsPlatformAdmin), in aggiunta alla RLS
  // esistente (difesa in profondità, non una sostituzione).
  //
  // Percorso negativo verificato qui: un utente autenticato ma non-Admin
  // (center_admin) non vede/raggiunge affatto /admin/centers — la UI blocca
  // già a monte (AccessGate di DashboardLayout, requiredRole="platform_admin").
  // Questo è il percorso reale che qualunque utente del prodotto incontra.
  //
  // NON automatizzato in questo file (gap dichiarato, non nascosto): un
  // secondo percorso — un center_admin che invoca DIRETTAMENTE la Server
  // Action bypassando del tutto la UI Admin (es. richiesta HTTP fabbricata a
  // mano verso l'endpoint interno di Next.js Server Actions) — richiederebbe
  // di replicare il protocollo wire di Next.js per le Server Action (header
  // "Next-Action" con un id calcolato per build, encoding multipart) in modo
  // fragile e non documentato pubblicamente da Next.js: nessun test in
  // questo repository lo fa oggi per nessuna Server Action. La protezione
  // per QUEL percorso specifico è verificata CODE_VERIFIED (lettura diretta
  // di app/actions/admin.ts: requireCallerIsPlatformAdmin viene chiamato
  // come prima istruzione di entrambe le funzioni, prima di ogni lettura/
  // scrittura), non AUTOMATED_LIVE_TESTED — coerente con la disciplina sui
  // livelli di evidenza dell'Audit 360°.
  test("TC-N672 - Un center_admin non raggiunge /admin/centers (percorso negativo R-14, livello UI)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account center_admin di test.");
    await loginAs(page, "center_admin");
    await page.goto("/admin/centers");

    // AccessGate (DashboardLayout, requiredRole="platform_admin") mostra un
    // messaggio di permesso mancante invece del form "Nuovo centro"/elenco.
    await expect(page.getByText(/non ha i permessi di|pensata per il ruolo/)).toBeVisible();
    await expect(page.getByText("Nuovo centro")).not.toBeVisible();
  });
});
