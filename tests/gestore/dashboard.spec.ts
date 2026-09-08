import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Dashboard
// NOTA: dopo R-02 (24/08/2026) la dashboard legge dati REALI da Supabase
// (non più lib/mock-data.ts) — i test verificano struttura/testi stabili,
// non valori esatti (che dipendono dai dati demo/reali del centro di test).
//
// Convertiti da gotoAsRole a loginAs: /center richiede una sessione reale
// (app/center/layout.tsx reindirizza a /auth/login se Supabase è configurato
// e non c'è un utente autenticato — il ruolo demo da solo non basta più a
// superare questo redirect contro un deploy reale).
//
// FINAL PRE-FREEZE WAVE (08/09/2026) — redesign "Oggi al centro" +
// "Collegamenti rapidi" (commit 23d31e8/02b53d7, sezioni 1-9 dello spec):
// TC-072/TC-120/TC-121 sotto erano rotti dal redesign (testavano "Promo
// attive"/"Occupazione settimanale"/"Attività recente", tutti rimossi) senza
// mai essere stati aggiornati in quella sessione — BUG DI TEST TROVATO+
// CORRETTO qui, stesso pattern già visto altrove in questa suite (es.
// task #26, redesign Planner Overview). Nuovi test DASH-P-01..10 aggiunti
// più sotto per il contenuto effettivamente nuovo.

test.describe("Gestore - Dashboard", () => {
  // Il testo "Attività" da solo è ambiguo su questa pagina: compare nel link
  // di nav della sidebar, nella pillola di nav mobile (entrambe SEMPRE nel DOM,
  // solo nascoste via CSS a seconda del viewport — vedi DashboardLayout.tsx),
  // nella card KPI e nell'intestazione colonna della tabella "Prenotazioni
  // recenti" — BUG DI TEST TROVATO+CORRETTO nel run reale: "getByText" senza
  // scoping va in strict-mode violation. Scoping alla griglia KPI (unica con
  // le classi "grid grid-cols-2 gap-3 md:grid-cols-4", vedi app/center/
  // page.tsx — distinta dalla griglia "Collegamenti rapidi" che usa
  // "sm:grid-cols-4" invece di "md:grid-cols-4") isola la sola card
  // statistica. Label esatta cambiata da "Attività" a "Attività pubblicate"
  // nel redesign 07/09/2026 — aggiornato di conseguenza.
  function kpiGrid(page: import("@playwright/test").Page) {
    return page.locator(".grid.grid-cols-2.gap-3.md\\:grid-cols-4");
  }

  // TC-072 - Dashboard Gestore carica KPI e sezioni chiave
  // Allineato al markup post-redesign 07/09/2026: "Promo attive"/
  // "Occupazione settimanale"/"Attività recente" non esistono più (vedi nota
  // di classe sopra) — sostituiti da "Attività pubblicate"/"Fatturato in
  // sospeso"/"Prenotazioni recenti".
  test("TC-072 - /center mostra KPI e prenotazioni recenti", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const main = page.getByRole("main");
    await expect(kpiGrid(page).getByText("Attività pubblicate", { exact: true })).toBeVisible();
    await expect(main.getByText("Prenotazioni in attesa", { exact: true })).toBeVisible();
    await expect(main.getByText("Fatturato confermato")).toBeVisible();
    await expect(main.getByText("Fatturato in sospeso")).toBeVisible();
    await expect(main.getByText("Prenotazioni recenti")).toBeVisible();
  });
  // Priorita: Media | Precondizioni: Login Gestore, almeno una Richiesta Gruppo in sospeso
  // Passi: Apri /center, osserva il menu laterale
  // Risultato atteso: Le voci di menu sono raggruppate sotto intestazioni ("Oggi"/"Gestione"); la voce "Richieste Gruppo" mostra un badge rosso col numero di richieste in sospeso
  // BUG DI TEST TROVATO+CORRETTO (run reale, solo mobile-chrome): le intestazioni
  // di sezione ("Oggi"/"Gestione") esistono SOLO nella sidebar desktop
  // (DashboardLayout.tsx: <aside className="hidden ... md:flex">) — su mobile
  // la sidebar è "display:none" per design, sostituita da una pillola di nav
  // orizzontale SENZA intestazioni di sezione. Forziamo un viewport desktop:
  // la funzionalità testata (raggruppamento sezioni) è intrinsecamente desktop.
  // TEST OBSOLETO (trovato nel run reale del 28/07, Gate C Cluster C):
  // "Gestione" non esiste più come singola intestazione — vedi
  // app/center/layout.tsx, commento su navItems: il gruppo unico "Gestione"
  // (7 voci) è stato diviso in sotto-gruppi tematici ("Attività"/"Presenze"/
  // "Richieste"/"Team"/"Account") in uno sprint successivo a questo test,
  // che non era mai stato aggiornato di conseguenza. Verifichiamo ora i
  // sotto-gruppi reali invece dell'intestazione unica ormai inesistente.
  test("TC-119 - Nuova navigazione con raggruppamento sezioni e badge richieste in sospeso", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "center_admin");
    await page.goto("/center");

    await expect(page.getByText("Oggi", { exact: true })).toBeVisible();
    await expect(page.getByText("Attività", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Presenze", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Richieste", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Richieste Gruppo/ })).toBeVisible();
    // Il badge (pallino rosso col conteggio) è opzionale in modalità demo
    // (0 richieste in sospeso -> nascosto per design, vedi DashboardLayout.tsx):
    // verifichiamo solo che la voce di menu esista, non il numero esatto.
  });

  // Priorita: Media | Precondizioni: Centro con almeno una settimana con occupazione bassa, o una Richiesta Gruppo in sospeso
  // Passi: Apri /center
  // Risultato atteso: In cima alla dashboard compaiono banner dedicati per le settimane scariche e per le richieste in sospeso, prima delle metriche KPI
  test("TC-120 - Banner settimane scariche / richieste gruppo in sospeso", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const weakWeeksBanner = page.getByText(/sotto il 40% di occupazione/);
    const pendingRequestsBanner = page.getByText(/richiest[ae] gruppo in attesa/);
    const anyBannerVisible =
      (await weakWeeksBanner.isVisible().catch(() => false)) ||
      (await pendingRequestsBanner.isVisible().catch(() => false));
    if (!anyBannerVisible) {
      test.skip(true, "Nessuna settimana scarica né richiesta gruppo in sospeso nei dati demo attuali.");
    }
    // Se presente, il banner deve stare sopra la griglia KPI.
    const bannerBox = await (await weakWeeksBanner.isVisible().catch(() => false))
      ? weakWeeksBanner
      : pendingRequestsBanner;
    const bannerY = (await bannerBox.boundingBox())?.y ?? Infinity;
    const kpiY = (await kpiGrid(page).boundingBox())?.y ?? 0;
    expect(bannerY).toBeLessThan(kpiY);
  });

  // Priorita: Bassa | Precondizioni: Login Gestore
  // Passi: Apri /center, osserva la tabella in fondo
  // Risultato atteso: la vecchia lista statica "Le tue attività" (pre-R-02)
  // non esiste più — sostituita dalla tabella reale "Prenotazioni recenti".
  // NOTA: "Attività recente" (feed unificato) è stato A SUA VOLTA rimosso nel
  // redesign 07/09/2026 (sostituito da "Oggi al centro" + banner "cose da
  // guardare oggi", vedi DASH-P-03/04 più sotto) — questo test verificava
  // solo l'assenza del markup pre-R-02, ancora valida.
  test("TC-121 - Tabella \"Prenotazioni recenti\" al posto della vecchia lista statica", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    await expect(page.getByText("Prenotazioni recenti")).toBeVisible();
    await expect(page.getByText("Le tue attività")).toHaveCount(0);
  });

  // TC-215 - Branding: header sidebar usa il vero logo TRAMA (variante NAVY,
  // vedi DashboardLayout.tsx#BrandMark) al posto dell'emoji "🏫" placeholder.
  test("TC-215 - Sidebar Partner mostra il logo NAVY invece dell'emoji", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "center_admin");
    await page.goto("/center");

    await expect(page.locator('img[src="/brand/trama-logo-mark-navy.png"]').first()).toBeVisible();
    await expect(page.getByText("Partner", { exact: true }).first()).toBeVisible();
  });

});

// ————————————————————————————————————————————————————————————————————————
// DASH-P-01..10 — FINAL PRE-FREEZE WAVE (08/09/2026, sez. 1-9 dello spec):
// "Dashboard sempre home del portale Partner" + blocco "Oggi al centro" +
// "Collegamenti rapidi" + trend KPI + regola NO SIGNAL -> NO CARD / stato
// positivo singolo. La maggior parte di questi blocchi è condizionale sui
// dati reali del centro di test (nessuna prenotazione in attesa oggi = nessun
// banner) — dove la precondizione non è verificabile a priori, il test si
// auto-salta invece di forzare uno stato artificiale (stesso pattern già in
// uso in TC-120 sopra), per non testare uno stato falso.
// ————————————————————————————————————————————————————————————————————————
test.describe("Gestore - Dashboard Partner (Daily Workspace)", () => {
  // DASH-P-01 — "Collegamenti rapidi" è SEMPRE visibile (a differenza di
  // "Oggi al centro" e dei banner "cose da guardare", che sono condizionali)
  // con i 4 link reali verso pagine esistenti.
  test("DASH-P-01 - Collegamenti rapidi: 4 link reali sempre visibili", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    await expect(page.getByRole("link", { name: /Report presenze/ })).toHaveAttribute(
      "href",
      "/center/report-presenze"
    );
    await expect(page.getByRole("link", { name: /Promozioni/ })).toHaveAttribute("href", "/center/promotions");
    await expect(page.getByRole("link", { name: /Servizi consigliati/ })).toHaveAttribute(
      "href",
      "/center/servizi-consigliati"
    );
    await expect(page.getByRole("link", { name: /Inviti/ })).toHaveAttribute("href", "/center/invites");
  });

  // DASH-P-02 — "Oggi al centro" è condizionale: compare SOLO se c'è almeno
  // una presenza attesa oggi o una giornata speciale (NO SIGNAL -> NO CARD).
  // Verifichiamo entrambi i rami invece di assumerne uno.
  test("DASH-P-02 - 'Oggi al centro' compare solo con segnale reale per oggi", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const block = page.getByText("Oggi al centro", { exact: true });
    if (await block.isVisible().catch(() => false)) {
      await expect(page.getByRole("link", { name: "Registro presenze" }).first()).toBeVisible();
    } else {
      // Nessun segnale per oggi in questo centro di test: il blocco non deve
      // esistere nel DOM (niente placeholder vuoto).
      await expect(block).toHaveCount(0);
    }
  });

  // DASH-P-03 — Ogni banner "cosa da guardare oggi" ha una propria CTA
  // reale (non un link generico) e naviga alla pagina corretta.
  test("DASH-P-03 - Banner 'prenotazioni in attesa' porta a /center/prenotazioni", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const banner = page.getByText(/prenotazion[ei] in attesa di risposta/);
    if (!(await banner.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione in attesa nei dati del centro di test in questo run.");
    }
    await page.getByRole("link", { name: "Rispondi" }).first().click();
    await expect(page).toHaveURL(/\/center\/prenotazioni/);
  });

  // DASH-P-04 — Regola "stato positivo singolo": quando non c'è NESSUN
  // segnale per oggi (né 'Oggi al centro' né alcun banner 'da guardare'),
  // compare un SOLO banner neutro di conferma — mai zero, mai più di uno.
  test("DASH-P-04 - Nessun segnale per oggi -> un solo banner 'Tutto sotto controllo per oggi.'", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const positiveBanner = page.getByText("Tutto sotto controllo per oggi.");
    const hasOggiAlCentro = await page
      .getByText("Oggi al centro", { exact: true })
      .isVisible()
      .catch(() => false);
    const hasAnyActionBanner =
      (await page
        .getByText(/prenotazion[ei] in attesa di risposta/)
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByText(/richiest[ae] genitore apert[ae]/)
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByText(/richiest[ae] gruppo in attesa/)
        .isVisible()
        .catch(() => false));

    if (hasOggiAlCentro || hasAnyActionBanner) {
      test.skip(true, "Il centro di test ha segnali reali per oggi in questo run: il banner positivo non deve comparire.");
    }
    await expect(positiveBanner).toHaveCount(1);
  });

  // DASH-P-05 — Trend settimanale: quando presente, il testo segue
  // ESATTAMENTE il formato "+N questa settimana" (mai un numero nudo, mai
  // un trend negativo — vedi StatCard.tsx, prop opzionale `trend`).
  test("DASH-P-05 - Trend KPI, quando presente, usa il formato '+N questa settimana'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const trends = page.getByText(/questa settimana/);
    const count = await trends.count();
    if (count === 0) {
      test.skip(true, "Nessuna variazione nella settimana per questo centro di test in questo run.");
    }
    for (let i = 0; i < count; i++) {
      await expect(trends.nth(i)).toHaveText(/^\+(€)?\d+ questa settimana$/);
    }
  });

  // DASH-P-06 — Badge "N in scadenza" sulla card Promozioni: solo quando
  // pertinente (niente placeholder "0 in scadenza").
  test("DASH-P-06 - Badge 'in scadenza' su Promozioni solo se pertinente", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const badge = page.getByText(/\d+ in scadenza/);
    if (await badge.isVisible().catch(() => false)) {
      await expect(badge).toHaveText(/^[1-9]\d* in scadenza$/);
    }
    // Se assente: nessuna promozione in scadenza nei prossimi 7 giorni per
    // questo centro — comportamento corretto, nulla da asserire oltre.
  });

  // DASH-P-07 — La Dashboard è la home ad OGNI accesso (sez. 1 dello spec),
  // ma questo non deve "dirottare" un deep-link diretto verso un'altra
  // sezione del portale Partner: solo "/" viene riscritta su /center dal
  // routing multi-tenant (vedi proxy.ts) — una navigazione diretta a
  // un'altra pagina /center/* deve restarci.
  test("DASH-P-07 - Deep-link diretto a un'altra sezione /center/* non rimbalza su /center", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/activities");
    await expect(page).toHaveURL(/\/center\/activities/);
  });

  // DASH-P-08 — Header pagina: nome del centro reale (non un placeholder) +
  // badge emoji/gradiente del centro.
  test("DASH-P-08 - Header mostra il nome reale del centro", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toHaveText("");
  });

  // DASH-P-09 — Onboarding incompleto: il banner giallo di stato profilo
  // resta sopra ai KPI (nessuna regressione rispetto al comportamento
  // preesistente, solo riverificato dopo il redesign).
  test("DASH-P-09 - Banner 'Profilo centro' (se onboarding incompleto) sta sopra i KPI", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const banner = page.getByText(/^Profilo centro:/);
    if (!(await banner.isVisible().catch(() => false))) {
      test.skip(true, "Il centro di test ha onboarding APPROVED (o è un centro mock) in questo run.");
    }
    const bannerY = (await banner.boundingBox())?.y ?? Infinity;
    const kpiY = (await kpiGrid(page).boundingBox())?.y ?? 0;
    expect(bannerY).toBeLessThan(kpiY);
  });

  // DASH-P-10 — 390px: nessun overflow orizzontale evidente su tutta la
  // Dashboard ridisegnata (stesso principio di ONB-P11 per il carousel).
  test("DASH-P-10 - 390px: nessun overflow orizzontale evidente", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "center_admin");
    await page.goto("/center");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
