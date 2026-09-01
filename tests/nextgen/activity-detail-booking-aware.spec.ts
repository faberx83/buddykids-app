import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";

// Area: TRAMA BETA v1.1 — Activity Detail booking-aware CTA (Wave 4 della
// revisione "PLANNER SIMPLIFICATION + BOOKING-AWARE HOME CTA", sezioni
// 21-24). Segnalazione: Home → "Prossimo appuntamento" → scheda attività
// mostrava ancora "Prenota ora" anche per un'attività già prenotata
// (semanticamente errato). La CTA ora dipende dallo STATO REALE del
// genitore rispetto all'attività (booking esistente/status/
// canCancelOrModify — vedi app/activity/[id]/page.tsx), risolto
// server-side una sola volta per qualunque punto di ingresso, MAI dalla
// route di provenienza. Copre HOME-CTA-01..05.

test.describe("TRAMA BETA v1.1 — Activity Detail: CTA booking-aware", () => {
  test("HOME-CTA-01 - attività MAI prenotata dal genitore: CTA acquisitiva 'Prenota ora' presente", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno un'attività mai prenotata.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");

    const firstCard = page.locator('a[href^="/activity/"]').first();
    if (!(await firstCard.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna attività disponibile in Scopri per l'account di test.");
    }
    await firstCard.click();

    // Se questa specifica attività risulta già prenotata dall'account di
    // test, il caso è coperto da HOME-CTA-02/03: qui verifichiamo solo il
    // ramo "nessuna prenotazione esistente".
    const modifica = page.getByRole("link", { name: "Modifica prenotazione" });
    if (await modifica.isVisible().catch(() => false)) {
      test.skip(true, "L'attività trovata risulta già prenotata per l'account di test (caso coperto da HOME-CTA-02/03).");
    }
    await expect(page.getByText("Prenota ora", { exact: true }).first()).toBeVisible();
  });

  test("HOME-CTA-02 - attività GIÀ prenotata (booking attivo): 'Prenota ora' non compare mai", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const heading = page.getByText("Prossimo appuntamento", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione futura per l'account di test.");
    }
    // La card "Prossimo appuntamento" è un link verso /activity/[id] —
    // stessa route condivisa Legacy/NextGen (vedi app/activity/[id]/page.tsx).
    const card = page.locator('a[href^="/activity/"]').first();
    await card.click();

    await expect(page.getByText("Prenota ora", { exact: true })).toHaveCount(0);
  });

  test("HOME-CTA-03 - booking esistente: solo azioni realmente supportate (Modifica, o stato se la finestra è chiusa) — mai una capability inventata", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const heading = page.getByText("Prossimo appuntamento", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione futura per l'account di test.");
    }
    const card = page.locator('a[href^="/activity/"]').first();
    await card.click();

    const modifica = page.getByRole("link", { name: "Modifica prenotazione" });
    const statoText = page.getByText(/Prenotazione confermata|Prenotazione in attesa/);
    const modificaVisible = await modifica.isVisible().catch(() => false);
    const statoVisible = await statoText.isVisible().catch(() => false);
    // Esattamente uno dei due rami deve essere vero: mai entrambi (sarebbe
    // un link rotto accanto a un messaggio di stato), mai nessuno dei due
    // (la CTA sparirebbe senza spiegazione).
    expect(modificaVisible !== statoVisible).toBe(true);
    if (modificaVisible) {
      await expect(modifica).toHaveAttribute("href", /^\/prenotazioni\/.+\/modifica$/);
    } else {
      // Nessuna azione fittizia proposta: solo lo stato + rimando al
      // "Contatta il gestore" già presente in cima alla scheda.
      await expect(page.getByText('Per modifiche, usa "Contatta il gestore" sopra')).toBeVisible();
    }
  });

  test("HOME-CTA-04 - la CTA booking-aware usa i componenti/token visivi NextGen (nessuno stile azzurrino Legacy)", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test NextGen con almeno una prenotazione attiva.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const heading = page.getByText("Prossimo appuntamento", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione futura per l'account di test.");
    }
    const card = page.locator('a[href^="/activity/"]').first();
    await card.click();

    const modifica = page.getByRole("link", { name: "Modifica prenotazione" });
    if (!(await modifica.isVisible().catch(() => false))) {
      test.skip(true, "Finestra di modifica non disponibile per questa prenotazione (verificato invece da HOME-CTA-03).");
    }
    const className = await modifica.getAttribute("class");
    expect(className).toContain("bg-trama-violet");
    expect(className).not.toContain("bg-sky");
  });

  // Requisito esplicito: "A parità di user + activity + booking state la
  // CTA deve essere semanticamente coerente. NON introdurre logiche tipo
  // 'se vengo da Home allora CTA X'." — verificato navigando alla STESSA
  // scheda attività da due punti di ingresso diversi (Home e navigazione
  // diretta all'URL) e confrontando la CTA renderizzata.
  test("HOME-CTA-05 - stessa attività/stesso stato prenotazione: CTA coerente indipendentemente dal punto di ingresso", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con almeno una prenotazione attiva.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");

    const heading = page.getByText("Prossimo appuntamento", { exact: true });
    if (!(await heading.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna prenotazione futura per l'account di test.");
    }
    const card = page.locator('a[href^="/activity/"]').first();
    const href = await card.getAttribute("href");
    expect(href).toMatch(/^\/activity\//);

    // Punto di ingresso 1: click dalla card Home.
    await card.click();
    const ctaFromHome = (await page.getByRole("link", { name: "Modifica prenotazione" }).isVisible().catch(() => false))
      ? "modifica"
      : (await page.getByText(/Prenotazione confermata|Prenotazione in attesa/).isVisible().catch(() => false))
        ? "stato"
        : "prenota-ora";

    // Punto di ingresso 2: navigazione diretta allo stesso URL (stessa
    // route condivisa, nessun parametro di provenienza).
    await page.goto(href!);
    const ctaFromDirectUrl = (await page.getByRole("link", { name: "Modifica prenotazione" }).isVisible().catch(() => false))
      ? "modifica"
      : (await page.getByText(/Prenotazione confermata|Prenotazione in attesa/).isVisible().catch(() => false))
        ? "stato"
        : "prenota-ora";

    expect(ctaFromDirectUrl).toBe(ctaFromHome);
  });
});
