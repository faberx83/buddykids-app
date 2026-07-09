# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: genitori/cerca.spec.ts >> Genitori - Cerca >> TC-016 - digitare il nome di un'attività filtra la lista
- Location: tests/genitori/cerca.spec.ts:16:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.textContent: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByText(/\d+ attività trovate/)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]: BK
    - heading "BuddyKids" [level=1] [ref=e6]
    - paragraph [ref=e7]: Accedi a BuddyKids
    - generic [ref=e8]:
      - generic [ref=e9]: Email
      - textbox "tuamail@esempio.it" [ref=e10]
      - generic [ref=e11]: Password
      - textbox "••••••••" [ref=e12]
      - button "Password dimenticata?" [ref=e13] [cursor=pointer]
      - button "Accedi" [ref=e14] [cursor=pointer]
    - button "Non hai un account? Registrati" [ref=e15] [cursor=pointer]
  - alert [ref=e16]
```

# Test source

```ts
  1  | import { test, expect, gotoAsRole } from "../fixtures/roles";
  2  | 
  3  | // Area: Genitori - Cerca
  4  | // Test implementati (selettori presi da app/(main)/search/SearchClient.tsx).
  5  | 
  6  | test.describe("Genitori - Cerca", () => {
  7  |   test.beforeEach(async ({ page }) => {
  8  |     await gotoAsRole(page, "parent", "/search");
  9  |   });
  10 | 
  11 |   function resultsCount(page: import("@playwright/test").Page) {
  12 |     return page.getByText(/\d+ attività trovate/);
  13 |   }
  14 | 
  15 |   // TC-016 - Ricerca testuale
  16 |   test("TC-016 - digitare il nome di un'attività filtra la lista", async ({ page }) => {
> 17 |     const before = await resultsCount(page).textContent();
     |                                             ^ Error: locator.textContent: Test timeout of 30000ms exceeded.
  18 |     const searchBox = page.getByPlaceholder("Cerca attività, centri, sport...");
  19 |     await searchBox.fill("zzzznonexistentzzzz");
  20 |     await expect(page.getByText("0 attività trovate")).toBeVisible();
  21 | 
  22 |     await searchBox.fill("");
  23 |     await expect(resultsCount(page)).not.toHaveText(before ?? "");
  24 |   });
  25 | 
  26 |   // TC-018 - Filtro Prezzo
  27 |   test("TC-018 - abbassare il tetto massimo di prezzo riduce i risultati", async ({ page }) => {
  28 |     const before = await resultsCount(page).textContent();
  29 | 
  30 |     await page.getByText("Prezzo", { exact: true }).click();
  31 |     const slider = page.locator('input[type="range"]');
  32 |     await slider.fill("50"); // tetto minimo possibile
  33 | 
  34 |     await expect(resultsCount(page)).not.toHaveText(before ?? "");
  35 |     await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
  36 |   });
  37 | 
  38 |   // TC-020 - Filtro Servizi - Bar
  39 |   test("TC-020 - filtro 'Bar nel centro' mostra solo centri con bar", async ({ page }) => {
  40 |     await page.getByText("Servizi", { exact: true }).click();
  41 |     await page.getByText("🥤 Bar nel centro").click();
  42 | 
  43 |     await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
  44 |     // La lista si aggiorna (numero risultati coerente col filtro applicato).
  45 |     await expect(resultsCount(page)).toBeVisible();
  46 |   });
  47 | 
  48 |   // TC-022 - Azzeramento filtri
  49 |   test("TC-022 - 'Azzera' riporta tutti i filtri al default e chiude il pannello", async ({ page }) => {
  50 |     await page.getByText("Servizi", { exact: true }).click();
  51 |     await page.getByText("🥤 Bar nel centro").click();
  52 |     await expect(page.getByRole("button", { name: /^Azzera/ })).toBeEnabled();
  53 | 
  54 |     await page.getByRole("button", { name: /^Azzera/ }).click();
  55 | 
  56 |     await expect(page.getByRole("button", { name: /^Azzera$/ })).toBeDisabled();
  57 |     // Il pannello "Servizi" aperto deve richiudersi.
  58 |     await expect(page.getByText("🥤 Bar nel centro")).not.toBeVisible();
  59 |   });
  60 |   // Priorita: Media | Precondizioni: Nessuna
  61 |   // Passi: Apri filtro 'Eta' -> sposta gli slider min/max
  62 |   // Risultato atteso: La lista si aggiorna mostrando solo attivita compatibili con la fascia
  63 |   test.fixme("TC-017 - Filtro Eta", async ({ page }) => {
  64 |     // TODO: implementare - vedi i test gia completati in questo file per esempio.
  65 |   });
  66 | 
  67 |   // Priorita: Media | Precondizioni: Nessuna
  68 |   // Passi: Apri filtro 'Zona' -> digita una via/quartiere presente in un indirizzo
  69 |   // Risultato atteso: Restano solo le attivita con quell'indirizzo/centro
  70 |   test.fixme("TC-019 - Filtro Zona (testo)", async ({ page }) => {
  71 |     // TODO: implementare - vedi i test gia completati in questo file per esempio.
  72 |   });
  73 | 
  74 |   // Priorita: Media | Precondizioni: Nessuna
  75 |   // Passi: Seleziona singolarmente Pranzo incluso / Pre-scuola / Post-scuola
  76 |   // Risultato atteso: La lista si filtra coerentemente con i campi dell'attivita
  77 |   test.fixme("TC-021 - Filtro Servizi - Pranzo/Pre/Post", async ({ page }) => {
  78 |     // TODO: implementare - vedi i test gia completati in questo file per esempio.
  79 |   });
  80 | 
  81 |   // Priorita: Media | Precondizioni: Aver cliccato 'Usa posizione' in Home
  82 |   // Passi: Da Home, dopo la geolocalizzazione, clicca 'Vedi in Cerca'
  83 |   // Risultato atteso: Si apre /search?lat=..&lng=.. con distanze reali calcolate e badge 'Vicino a te'
  84 |   test.fixme("TC-023 - Ricerca con geolocalizzazione da Home", async ({ page }) => {
  85 |     // Test reale gia' presente in tests/genitori/home.spec.ts (flusso Home -> Cerca con geolocalizzazione).
  86 |   });
  87 | 
  88 |   // Priorita: Bassa | Precondizioni: Nessuna
  89 |   // Passi: Clicca il chip 'Date'
  90 |   // Risultato atteso: Dovrebbe aprire un filtro per data/settimana
  91 |   test.fixme("TC-024 - Filtro Date", async ({ page }) => {
  92 |     // TODO: implementare - vedi i test gia completati in questo file per esempio.
  93 |   });
  94 | 
  95 | });
  96 | 
```