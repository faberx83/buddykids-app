import { test, expect } from "../fixtures/roles";
import { gotoAsRole, loginAs, isRealDeployment } from "../fixtures/roles";

// Area: Multi-tenant / PWA
// Generato da BuddyKids_Test_Case.xlsx - 5 casi.
// I test con test.fixme() sono placeholder tracciabili (1 per TC-ID): contengono
// precondizioni/passi/risultato atteso come commento, pronti da completare.
//
// SPRINT 3 (NEXTGEN) — aggiunta la coppia TC-098/TC-099: richiesta di
// Fabrizio di poter installare LEGACY e NEXTGEN come DUE app separate sullo
// stesso telefono ("così le ho tutte e due"), senza banner "Installa"
// sovrapposti. Vedi public/manifest-nextgen.json (scope/start_url/id
// "/nextgen", distinto da quello di LEGACY che ha scope "/") e
// components/InstallPrompt.tsx (prop routeExclude).

test.describe("Multi-tenant / PWA", () => {
  // Priorita: Alta | Precondizioni: I tre alias .vercel.app configurati
  // Passi: Apri i tre alias (family/partner/admin)
  // Risultato atteso: Ognuno mostra l'app corretta senza login incrociato
  test.fixme("TC-093 - Routing per sottodominio/alias", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede i tre alias/domini .vercel.app pubblicati
  });

  // Priorita: Alta | Precondizioni: Nessuna
  // Passi: DevTools -> Application -> Manifest su ciascun alias
  // Risultato atteso: Nome, icone e colori corretti per il tenant, nessun errore 'No manifest detected'
  test.fixme("TC-094 - Manifest PWA per tenant", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede i tre alias/domini .vercel.app pubblicati
  });

  // Priorita: Alta | Precondizioni: Chrome Android
  // Passi: Verifica banner 'Installa' su ciascuna delle tre app
  // Risultato atteso: Installazione riuscita, icona corretta in home screen
  test.fixme("TC-095 - Installazione PWA Android", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede un device Android reale (installazione PWA)
  });

  // Priorita: Media | Precondizioni: Login gia fatto su un alias
  // Passi: Apri un secondo alias
  // Risultato atteso: Richiede login separato (cookie non condiviso tra .vercel.app diversi)
  test.fixme("TC-096 - Login separato per alias .vercel.app", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede i tre alias/domini .vercel.app pubblicati
  });

  // Priorita: Alta | Precondizioni: Pagina con contenuto lungo, mobile
  // Passi: Scorri la pagina in una qualsiasi delle 3 app
  // Risultato atteso: La barra di navigazione/menu resta visibile (fissa in cima o in fondo) durante lo scroll
  test.fixme("TC-097 - Barra di navigazione fissa durante lo scroll (mobile)", async ({ page }) => {
    // ESCLUSO dall'automazione: richiede i tre alias/domini .vercel.app pubblicati
  });

  // Priorita: Alta | Precondizioni: account genitore di test
  // Passi: Confronta <link rel="manifest"> su "/" (LEGACY) e su "/nextgen" (NEXTGEN)
  // Risultato atteso: due manifest DIVERSI (manifest-family.json vs manifest-nextgen.json),
  // cosi' il browser puo' trattarli come due app installabili separate.
  test("TC-098 - Manifest NEXTGEN distinto da quello LEGACY", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");

    await page.goto("/");
    const legacyManifest = await page.locator('link[rel="manifest"]').getAttribute("href");

    await page.goto("/nextgen");
    const nextgenManifest = await page.locator('link[rel="manifest"]').getAttribute("href");

    expect(nextgenManifest).toBe("/manifest-nextgen.json");
    expect(nextgenManifest).not.toBe(legacyManifest);
  });

  // Priorita: Alta | Precondizioni: Nessuna (deliberatamente NON autenticato)
  // Passi: Richiedi /manifest-family.json senza sessione (es. Chrome che
  // valuta l'installabilita' della PWA prima che l'utente abbia un account)
  // Risultato atteso: risposta 200 con JSON valido, NON un redirect a /auth/login
  //
  // BUG TROVATO+CORRETTO (segnalato da Fabrizio: "app genitori non gira il
  // manifest, non riesco a installarla come app"): il gate di autenticazione
  // del tenant famiglia in proxy.ts non escludeva /manifest*.json (a
  // differenza del gate di ruolo per partner./admin., che lo fa gia') -
  // un utente senza sessione otteneva un redirect HTML al login al posto del
  // manifest JSON, e Chrome marcava la PWA come non installabile.
  test("TC-219 - Il manifest famiglia resta accessibile senza sessione (installabilita' PWA)", async ({ request }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato (il bug si manifesta solo li').");
    const res = await request.get("/manifest-family.json", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("TRAMA");
  });

  // Priorita: Alta | Precondizioni: Nessuna (deliberatamente NON autenticato)
  // Passi: Richiedi /internal/beta-pipeline senza secret e senza sessione
  // Risultato atteso: risposta JSON 401 "unauthorized" diretta, MAI un redirect a /auth/login
  //
  // SPRINT 8 (correzione architettura) — l'endpoint dell'automazione BETA
  // pipeline viveva inizialmente sotto app/api/internal/beta-pipeline: si e'
  // scoperto che lo strumento di fetch usato dal task schedulato scarta in
  // silenzio (nessun errore, risposta vuota) qualsiasi URL il cui path
  // contiene il segmento "/api/" - non un blocco di Vercel, verificato anche
  // su domini pubblici estranei. Spostato fuori da /api, sotto /internal:
  // questo test copre sia che il path resti raggiungibile senza passare dal
  // gate di ruolo/tenant di proxy.ts (come /api), sia - implicitamente - che
  // non sia tornato sotto /api per errore in un refactor futuro.
  test("TC-N301 - L'endpoint automazione BETA pipeline resta raggiungibile senza sessione, fuori da /api", async ({ request }) => {
    const res = await request.get("/internal/beta-pipeline", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  // Priorita: Alta | Precondizioni: Chrome Android o desktop, cache/service worker puliti
  // Passi: Installa l'app da "/" (LEGACY), poi visita "/nextgen" e installa anche quella
  // Risultato atteso: due icone separate in home screen/launcher ("BuddyKids" e
  // "BuddyKids NextGen"), nessun banner "Installa" sovrapposto quando si e' su /nextgen
  test.fixme("TC-099 - Installazione DOPPIA: LEGACY e NEXTGEN come app separate", async ({ page }) => {
    // ESCLUSO dall'automazione: beforeinstallprompt/installazione reale richiedono
    // un browser/device reale, non simulabile in Playwright headless.
  });

  // Priorita: Bassa | Precondizioni: Login Gestore o Admin, navigazione tra pagine
  // Passi: Cambia pagina cosi' da attivare la Suspense fallback (loading.tsx)
  // Risultato atteso: lo spinner TRAMA e' navy (non a colori) su Partner,
  // bianco su sfondo navy su Admin (vedi TramaSpinner.tsx#tone, app/center/
  // loading.tsx, app/admin/loading.tsx) - richiesta di Fabrizio dopo il giro
  // loghi: lo spinner deve seguire il colore del marchio del pannello.
  test.fixme("TC-217 - Spinner di caricamento monocromatico coerente col logo del pannello", async ({ page }) => {
    // ESCLUSO dall'automazione: loading.tsx e' una Suspense fallback
    // transitoria (spesso troppo rapida da catturare in modo affidabile in
    // Playwright senza throttling di rete artificiale) - verifica visiva.
  });

});
