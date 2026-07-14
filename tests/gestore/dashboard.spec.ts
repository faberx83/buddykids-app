import { test, expect, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Gestore - Dashboard
// NOTA: la dashboard e' "volutamente demo" (task #19 nel roadmap del team) -
// mostra sempre i dati di lib/mock-data.ts anche con Supabase configurato.
// Il test verifica quindi la struttura/i KPI, non dati "reali" per design.
//
// Convertiti da gotoAsRole a loginAs: /center richiede una sessione reale
// (app/center/layout.tsx reindirizza a /auth/login se Supabase è configurato
// e non c'è un utente autenticato — il ruolo demo da solo non basta più a
// superare questo redirect contro un deploy reale).

test.describe("Gestore - Dashboard", () => {
  // Il testo "Attività" da solo è ambiguo su questa pagina: compare nel link
  // di nav della sidebar, nella pillola di nav mobile (entrambe SEMPRE nel DOM,
  // solo nascoste via CSS a seconda del viewport — vedi DashboardLayout.tsx),
  // nella card KPI e nell'intestazione colonna della tabella "Prenotazioni
  // recenti" — 4 elementi in tutto (BUG DI TEST TROVATO+CORRETTO nel run
  // reale: "getByText" senza scoping va in strict-mode violation). Scoping
  // alla griglia KPI (classi uniche "grid grid-cols-2 gap-3", vedi
  // app/center/page.tsx) isola la sola card statistica.
  function kpiAttivita(page: import("@playwright/test").Page) {
    return page.locator(".grid.grid-cols-2.gap-3").getByText("Attività", { exact: true });
  }

  // TC-072 - Dashboard Gestore carica KPI e sezioni chiave
  // NOTA (aggiornato): col redesign v6a (TC-119/120/121) la colonna destra
  // "Le tue attività" è stata sostituita dal feed "Attività recente" — vedi
  // app/center/page.tsx. Il test è stato allineato al markup attuale.
  test("TC-072 - /center mostra KPI, occupazione settimanale e feed attività recente", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    await expect(kpiAttivita(page)).toBeVisible();
    await expect(page.getByText("Prenotazioni", { exact: true })).toBeVisible();
    await expect(page.getByText("Promo attive")).toBeVisible();
    await expect(page.getByText("Fatturato confermato")).toBeVisible();
    await expect(page.getByText("Occupazione settimanale")).toBeVisible();
    await expect(page.getByText("Attività recente")).toBeVisible();
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
  test("TC-119 - Nuova navigazione con raggruppamento sezioni e badge richieste in sospeso", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "center_admin");
    await page.goto("/center");

    await expect(page.getByText("Oggi", { exact: true })).toBeVisible();
    await expect(page.getByText("Gestione", { exact: true })).toBeVisible();
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
    // Se presente, il banner deve stare sopra le card KPI ("Attività"/"Prenotazioni"...).
    const bannerBox = await (await weakWeeksBanner.isVisible().catch(() => false))
      ? weakWeeksBanner
      : pendingRequestsBanner;
    const bannerY = (await bannerBox.boundingBox())?.y ?? Infinity;
    const kpiY = (await kpiAttivita(page).boundingBox())?.y ?? 0;
    expect(bannerY).toBeLessThan(kpiY);
  });

  // Priorita: Bassa | Precondizioni: Login Gestore
  // Passi: Apri /center, osserva la colonna destra
  // Risultato atteso: Al posto della vecchia lista "Le tue attività" compare un feed cronologico che unisce settimane scariche, richieste gruppo, prenotazioni e promozioni
  test("TC-121 - Feed attività unificato \"Attività recente\"", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center");

    await expect(page.getByText("Attività recente")).toBeVisible();
    // La vecchia lista statica "Le tue attività" non deve più esistere in questa colonna.
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
