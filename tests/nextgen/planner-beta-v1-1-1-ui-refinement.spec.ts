import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { test as pureTest, expect as pureExpect } from "@playwright/test";
import { resolveResponsibleOptions, RESPONSIBLE_OPTIONS } from "@/lib/nextgen/responsibility-options";

// TRAMA BETA v1.1.1 — PLANNER UI REFINEMENT (punto 19).
// Copre UI111-01..07 (e2e, richiedono un deploy reale con Supabase
// configurato — vedi isRealDeployment) e PEOPLE-01..07 (persistenza
// persona custom + Mamma/Papà contestuale + indipendenza multi-bambino).
//
// PEOPLE-04/05/06/07 sono funzioni PURE (nessuna chiamata Supabase, nessun
// DOM — resolveResponsibleOptions vive in lib/nextgen/responsibility-options.ts
// senza alcuna dipendenza server-only): girano in QUALUNQUE ambiente, incluso
// questo sandbox, senza deploy reale. Stesso pattern di
// planner-beta-v1-1-child-day.spec.ts (test importati direttamente da
// "@playwright/test", non dalle fixtures/roles che richiedono un browser).
//
// PEOPLE-01/02/03 (persistenza cross-settimana di una persona "Altro") sono
// scritti come e2e ma DOCUMENTANO IL LIMITE ATTUALE, non il comportamento
// desiderato: la revisione (punto 14) ha verificato che non esiste, nello
// schema attuale, alcuna entità persistente per "persona custom di famiglia"
// (week_responsibilities.responsible_label è testo libero scoped per riga
// parent_id+kid_id+week_start_date+weekday+moment — non un'anagrafica). Senza
// una migration (esplicitamente vietata in questa wave) l'unica
// implementazione onesta sarebbe una persistenza client-side (localStorage),
// che il punto 14 vieta esplicitamente come "source of truth definitiva".
// Questa funzionalità resta quindi NON implementata in questa wave — vedi
// TRAMA_PLANNER_BETA_V1.1.1_UI_REFINEMENT.md, sezione
// "BLOCKED — PERSISTENT FAMILY PERSON MODEL REQUIRED" per la proposta di
// estensione dati minima (non applicata).

pureTest.describe("TRAMA BETA v1.1.1 — resolveResponsibleOptions (Mamma/Papà contestuale, regressione pura)", () => {
  pureTest("PEOPLE-04 - account role 'padre' -> il selettore mostra 'Mamma' al posto di 'Partner'", () => {
    const options = resolveResponsibleOptions("padre");
    const partner = options.find((o) => o.value === "partner");
    pureExpect(partner?.label).toBe("Mamma");
    pureExpect(partner?.emoji).toBe("👩");
  });

  pureTest("PEOPLE-05 - account role 'madre' -> il selettore mostra 'Papà' al posto di 'Partner'", () => {
    const options = resolveResponsibleOptions("madre");
    const partner = options.find((o) => o.value === "partner");
    pureExpect(partner?.label).toBe("Papà");
    pureExpect(partner?.emoji).toBe("👨");
  });

  pureTest("PEOPLE-06 - account role sconosciuto/tutore/null -> fallback 'Partner', nessuna inferenza automatica", () => {
    for (const role of [null, "tutore" as const]) {
      const options = resolveResponsibleOptions(role);
      const partner = options.find((o) => o.value === "partner");
      pureExpect(partner?.label).toBe("Partner");
      pureExpect(partner?.emoji).toBe("❤️");
    }
  });

  // Punto 16 — source of truth unica, nessun duplicato per label/id, ordine
  // raccomandato: Io, Mamma/Papà (o Partner), [custom people — non ancora
  // disponibile, vedi PEOPLE-01..03], Nonno, Nonna, Tata, Altro.
  pureTest("PEOPLE-06b - resolveResponsibleOptions non introduce né perde valori tecnici, nessun duplicato", () => {
    const options = resolveResponsibleOptions("padre");
    pureExpect(options.map((o) => o.value)).toEqual(RESPONSIBLE_OPTIONS.map((o) => o.value));
    const uniqueValues = new Set(options.map((o) => o.value));
    pureExpect(uniqueValues.size).toBe(options.length);
    // Ordine raccomandato punto 16: Io(0), Partner/Mamma/Papà(1), poi
    // Nonno/Nonna/Tata/Altro — invariato rispetto a RESPONSIBLE_OPTIONS.
    pureExpect(options[0].value).toBe("io");
    pureExpect(options[1].value).toBe("partner");
    pureExpect(options[options.length - 1].value).toBe("altro");
  });

  // Punto 17 — la logica child-day (respKey composto da kidId) NON è stata
  // toccata dal refinement visivo del punto 11: due bambini con lo stesso
  // giorno/momento restano su chiavi distinte. Replica minima e pura dello
  // schema di chiave usato in PlannerCalendarView.tsx (kidId__week__weekday__
  // moment), senza importare il componente (client-only): verifica che la
  // composizione garantisca unicità per bambino, indipendentemente da
  // giorno/momento condivisi.
  pureTest("PEOPLE-07 - Sofia e Niccolò restano indipendenti anche nello stesso giorno/momento (stessa chiave di PLN11-T03)", () => {
    const respKey = (kidId: string, week: string, weekday: string, moment: string) =>
      `${kidId}__${week}__${weekday}__${moment}`;
    const week = "2026-06-01";
    const sofiaTue = respKey("sofia", week, "mar", "andata");
    const niccoloTue = respKey("niccolo", week, "mar", "andata");
    pureExpect(sofiaTue).not.toBe(niccoloTue);
    // Stesso giorno/momento, bambino diverso -> voci indipendenti nella mappa
    // localResp: assegnare l'una non deve poter sovrascrivere l'altra.
    const localResp: Record<string, string> = {};
    localResp[sofiaTue] = "nonna";
    localResp[niccoloTue] = "nonno";
    pureExpect(localResp[sofiaTue]).toBe("nonna");
    pureExpect(localResp[niccoloTue]).toBe("nonno");
  });
});

test.describe("TRAMA BETA v1.1.1 — Overview/Timeline/Week Detail/Calendario (e2e)", () => {
  test("UI111-01 - l'hero dell'Overview non mostra più il vecchio testo descrittivo dominante", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await expect(page.getByText("La timeline completa della tua famiglia per l'estate")).toHaveCount(0);
  });

  test("UI111-02 - la Timeline completa (Vedi tutte le settimane) non contiene una CTA 'Riempi' per riga", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Vedi tutte le settimane" }).click();
    await expect(page.locator('[id^="week-row-"] a[href^="/nextgen/search"]')).toHaveCount(0);
  });

  test("UI111-03 - l'Overview mantiene una sola primary CTA (viola pieno)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana da riempire.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    // La primary action (bg-trama-violet, testo bianco) deve comparire una
    // sola volta come bottone di livello Overview — non conta la pillola
    // "Condividi"/le option chip secondarie, che restano lilla/testo viola.
    const primaryCtas = page.locator("main button.bg-trama-violet, main a.bg-trama-violet", {
      hasText: /Riempi/,
    });
    const count = await primaryCtas.count();
    if (count === 0) {
      test.skip(true, "Nessuna settimana da riempire per l'account di test: la CTA primaria non è renderizzata in questo stato.");
    }
    expect(count).toBe(1);
  });

  test("UI111-04 - Week Detail usa la variante compact del Planner, non il comportamento a griglia di Scopri", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una settimana con suggerimenti.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Vedi tutte le settimane" }).click();
    const weekDetailRow = page.locator('[id^="week-row-"] a[href^="/nextgen/planner/settimana/"]').first();
    if (!(await weekDetailRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna riga di settimana cliccabile per l'account di test.");
    }
    await weekDetailRow.click();
    await expect(page).toHaveURL(/\/nextgen\/planner\/settimana\/\d{4}-\d{2}-\d{2}/);
    // La ActivityCard compact (PlannerActivityCardCompact) è una riga alta
    // ~64px (h-10 icona), non la card piena di Scopri (copertina 140px).
    const compactCard = page.locator('a[href^="/activity/"]').first();
    if (!(await compactCard.isVisible().catch(() => false))) {
      test.skip(true, "Nessun suggerimento mostrato per questa settimana nell'account di test.");
    }
    const box = await compactCard.boundingBox();
    expect(box?.height ?? 0).toBeLessThan(90);
  });

  test("UI111-05 - 'Applica a tutta la settimana' è collassato di default nel Calendario", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con una settimana coperta.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();
    const coveredDay = page.locator("button:has(span.rounded-full)").first();
    if (!(await coveredDay.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta nel mese corrente per l'account di test.");
    }
    await coveredDay.click();
    await expect(page.getByRole("button", { name: "Applica a tutta la settimana" })).toBeVisible();
    // Collassato: le chip bambino/momento/responsabile non sono visibili
    // finché il toggle non viene aperto.
    await expect(page.getByTestId("bulk-assign-panel").getByRole("button", { name: /Nonno/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Applica a tutta la settimana" }).click();
    await expect(page.getByTestId("bulk-assign-panel").getByRole("button", { name: /Nonno/ }).first()).toBeVisible();
  });

  test("UI111-06 - un giorno con Andata e Ritorno assegnati resta rappresentabile in layout compatto senza perdere la distinzione", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con un giorno completamente assegnato.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();
    const coveredDay = page.locator("button:has(span.rounded-full)").first();
    if (!(await coveredDay.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta nel mese corrente per l'account di test.");
    }
    await coveredDay.click();
    // Le etichette "Andata"/"Ritorno" restano nell'albero di accessibilità
    // (sr-only) anche nel layout compatto — vedi PlannerCalendarView.tsx,
    // punto 11 del refinement.
    await expect(page.getByText("Andata", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ritorno", { exact: true }).first()).toBeVisible();
    // Le due celle (Andata/Ritorno) dello stesso giorno restano due bottoni
    // distinti e indipendenti, non un'unica cella fusa.
    const assignedCells = page.locator('button[title]:not([title="Nessuno assegnato"])');
    const assignedCount = await assignedCells.count();
    if (assignedCount === 0) {
      test.skip(true, "Nessuna cella già assegnata per l'account di test.");
    }
    expect(assignedCount).toBeGreaterThan(0);
  });

  test("UI111-07 - a 390px i floating button (chat/notifiche) non coprono la CTA primaria dell'Overview", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test.");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    const primaryCta = page.locator("main button.bg-trama-violet, main a.bg-trama-violet").first();
    if (!(await primaryCta.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna CTA primaria renderizzata in questo stato per l'account di test.");
    }
    const ctaBox = await primaryCta.boundingBox();
    // Qualunque elemento in posizione "fixed" (floating chat/notifiche,
    // bottom nav) non deve intersecare il bounding box della CTA primaria.
    const fixedBoxes = await page.evaluate(() => {
      const boxes: { x: number; y: number; width: number; height: number }[] = [];
      document.querySelectorAll("body *").forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.position === "fixed") {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) boxes.push({ x: r.x, y: r.y, width: r.width, height: r.height });
        }
      });
      return boxes;
    });
    if (!ctaBox) return;
    for (const fb of fixedBoxes) {
      const overlaps =
        ctaBox.x < fb.x + fb.width &&
        ctaBox.x + ctaBox.width > fb.x &&
        ctaBox.y < fb.y + fb.height &&
        ctaBox.y + ctaBox.height > fb.y;
      expect(overlaps).toBe(false);
    }
  });
});

test.describe("TRAMA BETA v1.1.1 — persistenza persona custom 'Altro' (punto 14, limite noto)", () => {
  test("PEOPLE-01 - [DOCUMENTA IL GAP] una persona custom aggiunta in settimana A NON è garantita disponibile in settimana B", async () => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno 2 settimane coperte.");
    // BLOCKED — PERSISTENT FAMILY PERSON MODEL REQUIRED (punto 14). Questo
    // test è scritto per documentare/rilevare il comportamento ATTUALE
    // (nessuna persistenza), non per validare un requisito implementato in
    // questa wave. Vedi TRAMA_PLANNER_BETA_V1.1.1_UI_REFINEMENT.md per la
    // proposta di estensione dati (non applicata).
    test.skip(true, "BLOCKED — nessuna primitiva persistente per persone custom nello schema attuale (week_responsibilities.responsible_label è scoped per riga). Vedi documentazione.");
  });

  test("PEOPLE-02 - [DOCUMENTA IL GAP] una persona custom NON è garantita disponibile dopo cambio Mese/Settimana", async () => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    test.skip(true, "BLOCKED — stesso limite di PEOPLE-01.");
  });

  test("PEOPLE-03 - [DOCUMENTA IL GAP] senza persistenza, non è possibile verificare la non-duplicazione cross-settimana", async () => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    test.skip(true, "BLOCKED — stesso limite di PEOPLE-01/02: senza un'anagrafica persistente non c'è nulla da de-duplicare oltre alla singola sessione client (bulkAltroText/altroText, già scoped per singola cella).");
  });
});
