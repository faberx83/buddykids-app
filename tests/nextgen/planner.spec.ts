import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: NEXTGEN - Planner (Sprint 3)
// Il Planner diventa la feature principale: timeline familiare completa,
// sovrapposizioni, budget impegnato, consigli mirati alla settimana
// prioritaria. Reindirizzato da un link dedicato in Dashboard e da
// NextgenBottomNav (nuovo, solo sotto /nextgen).

test.describe("NEXTGEN - Planner (Sprint 3)", () => {
  test("TC-N13 - /nextgen/planner mostra la timeline completa delle 13 settimane", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await expect(page.getByText(/settimane coperte/)).toBeVisible();
    await expect(page.getByText("Timeline della stagione")).toBeVisible();
    await expect(page.getByText("Settimana 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Settimana 13", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  // Gate C (28/07): questo test (Sprint 3, "sempre visibile") è in
  // contraddizione diretta con TC-263 (Sprint correttivo,
  // planner-organizzazione-sprint1.spec.ts), che verifica l'esatto
  // contrario per una decisione di design deliberata di Fabrizio ("il
  // Budget impegnato non mi interessa qui, c'è una sezione dedicata no?"):
  // la card è stata rimossa dal tab Organizzazione e vive solo nel tab
  // Budget (PlannerClient.tsx righe 753-756). TEST OBSOLETO: aggiornato per
  // riflettere il comportamento attuale invece di contraddire TC-263.
  //
  // Gate C (28/07), seconda ondata: la card nel tab Budget (PlannerBudgetView)
  // non usa più la scritta "Budget impegnato" — rinominata in "Budget estate"
  // (intestazione)/"Budget pianificato" (dato) nel redesign Sprint 5.1.
  // Etichetta obsoleta anche qui, aggiornata a quella reale.
  test("TC-N14 - Budget impegnato visibile nel tab Budget del Planner", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    await page.getByRole("button", { name: "Budget" }).click();
    await expect(page.getByText("Budget estate")).toBeVisible();
  });

  // Segnalazione 24/08/2026 (Fabrizio): "la descrizione della sezione è
  // sbagliata" — la card introduttiva del Planner (PlannerClient.tsx) aveva
  // solo due varianti di testo (budget vs. tutto il resto): su "Mappa" e
  // "Gruppi" restava visibile "La timeline completa della tua famiglia per
  // l'estate", pensato per Organizzazione e non pertinente per quelle due
  // sezioni. Fix: una descrizione per ciascuna delle 4 modalità
  // (PLANNER_MODE_DESCRIPTIONS). Verifica che ogni tab mostri la propria
  // descrizione E non quella (sbagliata) di un'altra sezione.
  test("TC-N684 - ogni modalità del Planner mostra la propria descrizione, non quella di un'altra", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const wrongForMappaEGruppi = page.getByText("La timeline completa della tua famiglia per l'estate.");

    await expect(wrongForMappaEGruppi).toBeVisible(); // corretta per Organizzazione (tab di default)

    await page.getByRole("button", { name: "Mappa" }).click();
    await expect(page.getByText("Dove sono i centri e le attività della tua famiglia.")).toBeVisible();
    await expect(wrongForMappaEGruppi).not.toBeVisible();

    await page.getByRole("button", { name: "Gruppi" }).click();
    await expect(page.getByText("Le community e i gruppi a cui la tua famiglia partecipa.")).toBeVisible();
    await expect(wrongForMappaEGruppi).not.toBeVisible();

    await page.getByRole("button", { name: "Budget" }).click();
    await expect(page.getByText("Quanto stai spendendo per questa estate.")).toBeVisible();
    await expect(wrongForMappaEGruppi).not.toBeVisible();
  });

  // SPRINT 5.1: TC-N15 aggiornato al testo reale della CTA in Home ("Apri
  // Planner", non più "Apri il planner completo" — testo mai allineato al
  // codice dopo il redesign Hero Card).
  test("TC-N15 - La CTA 'Apri Planner' in Home porta a /nextgen/planner", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("link", { name: "Apri Planner" }).click();
    await expect(page).toHaveURL(/\/nextgen\/planner/);
  });

  test("TC-N16 - NextgenBottomNav permette di raggiungere Home/Planner/Scopri in un tocco", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    // getByRole con "name" fa match per substring sul nome accessibile: la
    // card CTA "Apri Planner Organizzazione, ..." matcha anche lei, oltre al
    // link della bottom nav — strict mode violation trovata nel run reale
    // del 28/07 (Gate C Cluster A). app/nextgen/layout.tsx renderizza
    // {children} PRIMA di <NextgenBottomNav/>, quindi .last() è sempre il
    // link di nav.
    await page.getByRole("link", { name: "Planner" }).last().click();
    await expect(page).toHaveURL(/\/nextgen\/planner/);
    await page.getByRole("link", { name: "Scopri" }).click();
    await expect(page).toHaveURL(/\/nextgen\/search/);
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/nextgen$/);
  });

  // REBRAND TRAMA Sprint 1: bottom nav a 5 voci (Home/Planner/Scopri/
  // Prenotazioni/Profilo), vedi NextgenBottomNav.tsx. Al rebrand entrambe le
  // ultime due puntavano a pagine LEGACY (fuori da /nextgen) — tradeoff
  // accettato con Fabrizio finché non avessero una schermata NEXTGEN
  // dedicata. SPRINT 6: "Profilo" ora ha la sua pagina NEXTGEN dedicata
  // (/nextgen/profile, vedi tests/nextgen/profile-6.spec.ts) — TEST DEBT
  // corretto qui en passant: asseriva ancora /profile (LEGACY). Il tradeoff
  // resta valido solo per "Prenotazioni".
  test("TC-N88 - NextgenBottomNav include Prenotazioni (LEGACY) e Profilo (NEXTGEN dedicata)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    // Gate C (28/07): la Home mostra ANCHE "Gestisci tutte le prenotazioni →"
    // (card riepilogo) — getByRole senza {exact:true} matcha per default in
    // modo case-insensitive/substring, quindi "Prenotazioni" risolveva a
    // entrambi i link (strict mode violation). {exact:true} isola il link
    // della bottom nav (nome accessibile esattamente "Prenotazioni").
    await page.getByRole("link", { name: "Prenotazioni", exact: true }).click();
    await expect(page).toHaveURL(/\/prenotazioni/);
    await page.goto("/nextgen");
    await page.getByRole("link", { name: "Profilo" }).click();
    await expect(page).toHaveURL(/\/nextgen\/profile/);
  });

  // SPRINT CORRETTIVO (feedback Fabrizio): con 5 modalità sempre presenti,
  // "Budget" (4a) resta spesso tagliato fuori dallo schermo — l'utente non
  // sapeva che la riga scorre. PlannerModeTabs ora mostra una sfumatura a
  // destra quando c'è altro contenuto da scorrere, e la nasconde una volta
  // raggiunta la fine dello scroll (vedi componente per il dettaglio).
  test("TC-N91 - I tab del Planner mostrano una sfumatura di scroll quando 'Budget'/'Gruppi' sono fuori schermo", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account genitore di test.");
    await page.setViewportSize({ width: 375, height: 700 });
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const scrollContainer = page.locator(".no-scrollbar").first();
    const { scrollWidth, clientWidth } = await scrollContainer.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    test.skip(scrollWidth <= clientWidth + 4, "Su questo viewport i 5 tab entrano già interamente: nulla da scorrere.");

    // All'inizio (scroll a sinistra) la sfumatura destra deve essere visibile...
    const rightFade = page.locator("div.pointer-events-none.absolute.right-0");
    await expect(rightFade).toBeVisible();

    // ...e sparire una volta scrollato fino in fondo.
    await scrollContainer.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(rightFade).toHaveCount(0);
  });

  // SPRINT CORRETTIVO (feedback Fabrizio): "se vado sopra budget direi che
  // deve essere sul rosso" — prima usava trama-orange (stesso tono dei
  // warning), ora red-500 per un allarme più netto e distinguibile.
  test("TC-N92 - Modalità Budget: superare il tetto colora la barra e il testo di rosso (non più arancione)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con spesa già sopra il tetto impostato.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Budget" }).click();

    const overBudgetText = page.getByText(/hai superato il budget/);
    if (!(await overBudgetText.isVisible().catch(() => false))) {
      test.skip(true, "L'account di test non è sopra il tetto budget impostato.");
    }
    await expect(overBudgetText).toHaveClass(/text-red-500/);
    await expect(overBudgetText).not.toHaveClass(/text-trama-orange/);
  });

  // PRE-LAUNCH REMEDIATION WAVE 1 — R-09 (decisione Fabrizio, 24/08/2026):
  // area di regressione esplicitamente richiesta, oltre ai test puri su
  // computeWeekStatus (tests/nextgen/planner-week-status.spec.ts). Il fix
  // del 06/08/2026 (Task #518/#519) ha aggiunto "?week=<data ISO>" al link
  // "Riempi" (vedi PlannerClient.tsx riga ~797) letto da
  // SearchDiscoveryClient.tsx (riga ~262) per pre-applicare il filtro
  // settimana in Scopri — nessun test end-to-end lo copriva ancora.
  test("TC-N670 - 'Riempi' su una settimana scoperta porta a Scopri con quella settimana già preselezionata", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana scoperta futura.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const riempiButton = page.getByRole("link", { name: "Riempi" }).first();
    if (!(await riempiButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana scoperta futura per l'account di test (nessun bottone 'Riempi' visibile).");
    }
    const href = await riempiButton.getAttribute("href");
    expect(href).toMatch(/\/nextgen\/search\?week=\d{4}-\d{2}-\d{2}/);

    await riempiButton.click();
    await expect(page).toHaveURL(/\/nextgen\/search\?week=\d{4}-\d{2}-\d{2}/);

    // Il filtro data letto da "?week=" deve risultare già applicato/attivo
    // nel pannello filtri di Scopri, non solo presente nell'URL — altrimenti
    // il fix di sincronizzazione risulterebbe rotto senza che l'URL lo tradisca.
    // Il chip filtro (un <div onClick>, non un <button> — nessun ruolo ARIA
    // implicito) cambia etichetta da "Date" a "Settimane (N)" solo quando
    // selectedWeekStarts.length > 0 (SearchDiscoveryClient.tsx riga ~508) —
    // con un solo "?week=" atteso "Settimane (1)".
    await expect(page.getByText("Settimane (1)", { exact: true })).toBeVisible();
  });

  // R-09: le due viste ("Stato per settimana" compatta e riga Timeline)
  // devono SEMPRE concordare sullo stesso stato per la stessa settimana in
  // una famiglia con più di un figlio — regressione storica già corretta
  // una volta (segnalata da Fabrizio: "c'è qualcosa che non quadra, né nei
  // dati né nei colori", vedi commento in PlannerClient.tsx riga ~590) per
  // una isPartial locale che ignorava awaitingPartnerConfirmation. Da
  // allora entrambe le viste usano la STESSA computeWeekStatus — questo
  // test verifica che il testo "manca N bambino/i" mostrato nella Timeline
  // corrisponda davvero al numero di figli non coperti in quella settimana.
  test("TC-N671 - famiglia con più figli: 'manca N bambino/i' nella Timeline riflette il conteggio reale dei figli scoperti", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con 2+ figli e almeno una settimana con copertura parziale.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const partialLabel = page.getByText(/manca \d+ bambino\/i/).first();
    if (!(await partialLabel.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana con copertura parziale per l'account di test.");
    }
    const text = await partialLabel.textContent();
    const match = text?.match(/manca (\d+) bambino\/i/);
    expect(match).not.toBeNull();
    const missingCount = Number(match?.[1]);
    expect(missingCount).toBeGreaterThan(0);

    // La striscia compatta "Stato per settimana" (sopra la Timeline) per la
    // STESSA settimana deve mostrare lo stesso stato "Copertura parziale"
    // (WEEK_STATUS_LABEL.partial, vedi R-19/Wave 1) — coerenza garantita solo
    // perché entrambe le viste chiamano la stessa computeWeekStatus. Recupera
    // l'indice settimana dall'id della riga Timeline (week-row-N) per
    // trovare il bottone corrispondente nella striscia (title include
    // "Settimana N").
    const rowId = await page
      .locator("[id^='week-row-']")
      .filter({ has: partialLabel })
      .first()
      .getAttribute("id");
    expect(rowId).toMatch(/^week-row-\d+$/);
    const weekIndex = rowId?.replace("week-row-", "");
    const compactBar = page.locator(`button[title*="Settimana ${weekIndex} "]`);
    await expect(compactBar).toHaveAttribute("title", /Copertura parziale/);
  });

  // Segnalazione 26/08/2026 (Fabrizio): "l'opzione di segnare una settimana
  // come 'non mi serve' è rimasta solo su Legacy?" — verificato: sì,
  // toggleWeekDismissedAction (app/actions/profile.ts) era chiamata solo da
  // components/PlannerView.tsx (LEGACY); qui in NEXTGEN lo stato "dismissed"
  // era solo letto/mostrato, mai impostabile. Wiring aggiunto: stesso bottone
  // "Non mi serve"/"Ripristina" di PlannerView, stessa azione server, nessuna
  // nuova colonna/tabella. Verifica end-to-end: click su "Non mi serve" ->
  // etichetta "Non ti serve" + bottone "Ripristina" al suo posto, contatore
  // "X di Y settimane coperte" aggiornato (denominatore -1); click su
  // "Ripristina" -> torna "Scoperta"/"Riempi", contatore ripristinato.
  test("TC-N685 - 'Non mi serve' in NEXTGEN Planner esclude/ripristina una settimana (parità con LEGACY)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana scoperta futura.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");

    const nonMiServeButton = page.getByRole("button", { name: "Non mi serve" }).first();
    if (!(await nonMiServeButton.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana scoperta futura per l'account di test (nessun bottone 'Non mi serve' visibile).");
    }

    const countBefore = await page.getByText(/settimane coperte/).textContent();
    const neededBefore = Number(countBefore?.match(/di (\d+) settimane coperte/)?.[1]);
    expect(Number.isNaN(neededBefore)).toBe(false);

    const row = page.locator("[id^='week-row-']").filter({ has: nonMiServeButton }).first();
    await nonMiServeButton.click();

    // Optimistic update: la riga mostra subito "Non ti serve" + "Ripristina",
    // senza attendere il round-trip server (router.refresh() arriva dopo).
    await expect(row.getByText("Non ti serve")).toBeVisible();
    const ripristinaButton = row.getByRole("button", { name: "Ripristina" });
    await expect(ripristinaButton).toBeVisible();
    await expect(row.getByRole("button", { name: "Non mi serve" })).toHaveCount(0);

    await expect(page.getByText(/settimane coperte/)).toContainText(`di ${neededBefore - 1} settimane coperte`);

    await ripristinaButton.click();
    await expect(row.getByRole("button", { name: "Non mi serve" })).toBeVisible();
    await expect(page.getByText(/settimane coperte/)).toContainText(`di ${neededBefore} settimane coperte`);
  });
});
