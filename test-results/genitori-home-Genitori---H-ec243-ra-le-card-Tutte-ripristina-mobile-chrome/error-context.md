# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: genitori/home.spec.ts >> Genitori - Home >> TC-013 - selezionare una categoria filtra le card, 'Tutte' ripristina
- Location: tests/genitori/home.spec.ts:12:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('🔥 Popolari vicino a te')
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByText('🔥 Popolari vicino a te')

```

```yaml
- text: BK
- heading "BuddyKids" [level=1]
- paragraph: Accedi a BuddyKids
- text: Email
- textbox "tuamail@esempio.it"
- text: Password
- textbox "••••••••"
- button "Password dimenticata?"
- button "Accedi"
- button "Non hai un account? Registrati"
- alert
```

# Test source

```ts
  1  | import { test, expect, gotoAsRole } from "../fixtures/roles";
  2  | 
  3  | // Area: Genitori - Home
  4  | // Test implementati (selettori presi da app/(main)/page.tsx e components/HomeFeed.tsx).
  5  | 
  6  | test.describe("Genitori - Home", () => {
  7  |   test.beforeEach(async ({ page }) => {
  8  |     await gotoAsRole(page, "parent", "/");
  9  |   });
  10 | 
  11 |   // TC-013 - Filtro categoria in Home
  12 |   test("TC-013 - selezionare una categoria filtra le card, 'Tutte' ripristina", async ({ page }) => {
> 13 |     await expect(page.getByText("🔥 Popolari vicino a te")).toBeVisible();
     |                                                             ^ Error: expect(locator).toBeVisible() failed
  14 | 
  15 |     await page.getByText("Sport", { exact: true }).click();
  16 |     await expect(page.getByText("🔥 Attività in questa categoria")).toBeVisible();
  17 | 
  18 |     await page.getByText("Tutte", { exact: true }).click();
  19 |     await expect(page.getByText("🔥 Popolari vicino a te")).toBeVisible();
  20 |   });
  21 | 
  22 |   // TC-014 - Geolocalizzazione Home (permesso concesso)
  23 |   test("TC-014 - 'Usa posizione' con permesso concesso mostra un conteggio di centri", async ({
  24 |     page,
  25 |     context,
  26 |   }) => {
  27 |     await context.grantPermissions(["geolocation"]);
  28 |     await context.setGeolocation({ latitude: 45.4642, longitude: 9.19 }); // Milano
  29 | 
  30 |     await page.getByRole("button", { name: "Usa posizione" }).click();
  31 |     await expect(page.getByText(/centri nel raggio di 5 km/)).toBeVisible({ timeout: 10_000 });
  32 |   });
  33 | 
  34 |   // TC-015 - Geolocalizzazione negata
  35 |   test("TC-015 - 'Usa posizione' con permesso negato mostra un messaggio d'errore leggibile", async ({
  36 |     page,
  37 |     context,
  38 |   }) => {
  39 |     await context.clearPermissions(); // permesso non concesso -> il browser blocca/rifiuta
  40 |     await page.getByRole("button", { name: "Usa posizione" }).click();
  41 |     // L'app non deve crashare: la CTA resta cliccabile e/o appare un messaggio di errore.
  42 |     await expect(page.locator("body")).not.toContainText("Application error");
  43 |   });
  44 | 
  45 |   // TC-023 - Ricerca con geolocalizzazione da Home -> Cerca
  46 |   test("TC-023 - 'Vedi in Cerca' dopo la geolocalizzazione porta a /search con lat/lng", async ({
  47 |     page,
  48 |     context,
  49 |   }) => {
  50 |     await context.grantPermissions(["geolocation"]);
  51 |     await context.setGeolocation({ latitude: 45.4642, longitude: 9.19 });
  52 | 
  53 |     await page.getByRole("button", { name: "Usa posizione" }).click();
  54 |     await expect(page.getByRole("button", { name: "Vedi in Cerca" })).toBeVisible({ timeout: 10_000 });
  55 |     await page.getByRole("button", { name: "Vedi in Cerca" }).click();
  56 | 
  57 |     await expect(page).toHaveURL(/\/search\?.*lat=.*lng=/);
  58 |   });
  59 |   // Priorita: Alta | Precondizioni: Almeno un'attivita inserita in Supabase
  60 |   // Passi: Login come genitore -> apri '/'
  61 |   // Risultato atteso: Le card 'Popolari' mostrano attivita reali dal DB, non i dati demo
  62 |   test.fixme("TC-012 - Home mostra attivita reali", async ({ page }) => {
  63 |     // TODO: implementare - vedi i test gia completati in questo file per esempio.
  64 |   });
  65 | 
  66 | });
  67 | 
```