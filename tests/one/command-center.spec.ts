import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { computeQueuePriority, compareQueuesByPriority, QUEUE_STALE_THRESHOLD_DAYS } from "@/lib/command-center/priority";

// TRAMA ONE Build Sprint 6 — Command Center Admin (E08, ACR-001/008/015,
// DEC-51). lib/command-center/priority.ts è logica PURA (nessuna I/O): può
// essere testata con test()/expect() di Playwright senza fixture `page` e
// SENZA bisogno di un browser reale né di un deploy — stesso principio già
// verificato in questo repository per lib/feature-flags/evaluate.ts e
// lib/day-pricing.ts (vedi tests/one/feature-flags.spec.ts).

test.describe("Sprint 6 - Command Center: classificazione priorità (no browser)", () => {
  test("coda vuota (count=0) è sempre priorità bassa, indipendentemente dall'età", () => {
    expect(computeQueuePriority(0, null)).toBe("bassa");
    expect(computeQueuePriority(0, 30)).toBe("bassa");
  });

  test("coda con elementi ma senza età nota (oldestPendingDays=null) è priorità media", () => {
    expect(computeQueuePriority(3, null)).toBe("media");
  });

  test("coda con elemento più vecchio sotto la soglia è priorità media", () => {
    expect(computeQueuePriority(1, QUEUE_STALE_THRESHOLD_DAYS - 0.5)).toBe("media");
  });

  test("coda con elemento più vecchio esattamente alla soglia è priorità alta", () => {
    expect(computeQueuePriority(1, QUEUE_STALE_THRESHOLD_DAYS)).toBe("alta");
  });

  test("coda con elemento più vecchio oltre la soglia è priorità alta", () => {
    expect(computeQueuePriority(5, QUEUE_STALE_THRESHOLD_DAYS + 10)).toBe("alta");
  });

  test("ordinamento: priorità alta sempre prima di media e bassa", () => {
    const queues = [
      { key: "a", priority: "bassa" as const, count: 100 },
      { key: "b", priority: "alta" as const, count: 1 },
      { key: "c", priority: "media" as const, count: 50 },
    ];
    const sorted = [...queues].sort(compareQueuesByPriority);
    expect(sorted.map((q) => q.key)).toEqual(["b", "c", "a"]);
  });

  test("ordinamento: a parità di priorità, conteggio più alto prima", () => {
    const queues = [
      { key: "low-count", priority: "media" as const, count: 2 },
      { key: "high-count", priority: "media" as const, count: 20 },
    ];
    const sorted = [...queues].sort(compareQueuesByPriority);
    expect(sorted.map((q) => q.key)).toEqual(["high-count", "low-count"]);
  });

  test("ordinamento stabile: priorità sempre decisiva anche con conteggi opposti al 'buon senso'", () => {
    // Una coda 'alta' con un solo elemento viene comunque prima di una
    // 'bassa' con molti elementi (una coda 'bassa' per costruzione ha
    // count=0, ma la funzione non assume questo vincolo su input arbitrari
    // — verifichiamo che la priorità resti sempre il criterio primario).
    const queues = [
      { key: "bassa-tanti", priority: "bassa" as const, count: 999 },
      { key: "alta-uno", priority: "alta" as const, count: 1 },
    ];
    const sorted = [...queues].sort(compareQueuesByPriority);
    expect(sorted.map((q) => q.key)).toEqual(["alta-uno", "bassa-tanti"]);
  });
});

test.describe("TRAMA ONE — Command Center Admin (Sprint 6, E08)", () => {
  test("TC-N611 - Admin: /admin/one mostra le code operative aggregate con etichette di priorità", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account platform_admin di test."
    );

    await loginAs(page, "platform_admin");
    await page.goto("/admin/one");

    // Il testo esatto dipende dai dati reali del centro/attività di test
    // (conteggi variabili), quindi verifichiamo la STRUTTURA della vista
    // (etichette delle code, sempre presenti a prescindere dal conteggio)
    // piuttosto che numeri specifici — stesso principio di
    // tests/one/onboarding-remediation.spec.ts per contenuti dinamici.
    await expect(page.getByText("Onboarding centri in revisione")).toBeVisible();
    await expect(page.getByText("Prenotazioni in attesa di risposta Partner")).toBeVisible();
    await expect(page.getByText("Richieste genitore aperte")).toBeVisible();
    await expect(page.getByText("Segnalazioni centro non iscritto da qualificare")).toBeVisible();
    await expect(page.getByText("Certificazioni servizio da approvare")).toBeVisible();
    await expect(page.getByText("Segnalazioni BETA nuove")).toBeVisible();
    await expect(page.getByText("Allarmi feature flag (override scaduti/in scadenza)")).toBeVisible();

    // Il riepilogo testuale in cima alla pagina deve sempre menzionare
    // "elementi in sospeso" (anche se il conteggio totale è zero) — prova
    // che la funzione di summarizzazione gira senza errori sui dati reali.
    await expect(page.getByText(/elementi in sospeso su tutte le code/)).toBeVisible();

    // La sezione Walkthrough preesistente (Sprint 1) deve restare visibile:
    // il Command Center è additivo, non ha rimosso capability esistenti
    // (DEC-15, nessuna dismissione senza approvazione esplicita).
    // TRAMA ONE Build Sprint 6 (hardening walkthrough, task #418) — la
    // sezione Walkthrough è stata estesa con funnel/drop-off (vedi
    // tests/one/walkthrough-funnel.spec.ts), il titolo esatto è cambiato di
    // conseguenza; resta comunque visibile sotto le code del Command
    // Center, invariante verificata da questo stesso test.
    await expect(
      page.getByText('Walkthrough "Benvenuto in TRAMA ONE" — avanzamento e funnel (Sprint 6, hardening)')
    ).toBeVisible();

    // Ogni coda deve linkare alla pagina Admin per dominio già esistente
    // (rollback gate: nessuna pagina viene sostituita).
    await expect(page.getByRole("link", { name: /Onboarding centri in revisione/ })).toHaveAttribute(
      "href",
      "/admin/one/onboarding"
    );
    await expect(page.getByRole("link", { name: /Allarmi feature flag/ })).toHaveAttribute(
      "href",
      "/admin/feature-flags"
    );
  });

  // CONTROLLED BETA EXPERIENCE GATE (§3/§16, DEC-58/DEC-61) — fase E
  // (wiring): fino a questo momento /admin/one era raggiungibile solo per
  // digitazione diretta dell'URL (verificato da TC-N304/TC-N611), MAI da
  // una voce di menu — il gap era esplicitamente noto e documentato in
  // DEC-58 ("da cablare... SOLO dopo il restyle"). Il restyle è chiuso
  // (DEC-59), quindi la voce "Command Center" è stata aggiunta al menu
  // Admin (app/admin/layout.tsx), condizionata a TRAMA_ONE_ENABLED come
  // ogni altro accesso a questa route.
  test("TC-N418 - Admin: la voce 'Command Center' compare nel menu quando il flag è attivo e porta a /admin/one", async ({
    page,
  }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e l'account platform_admin di test."
    );

    await loginAs(page, "platform_admin");
    await page.goto("/admin");

    const navLink = page.getByRole("link", { name: "Command Center" });
    await expect(navLink).toBeVisible();
    await expect(navLink).toHaveAttribute("href", "/admin/one");

    await navLink.click();
    await expect(page).toHaveURL(/\/admin\/one$/);
  });
});
