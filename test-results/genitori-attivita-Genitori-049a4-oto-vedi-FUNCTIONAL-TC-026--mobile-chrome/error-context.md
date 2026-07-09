# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: genitori/attivita.spec.ts >> Genitori - Attivita >> TC-026 - il preferito NON persiste dopo reload (comportamento noto, vedi FUNCTIONAL-TC-026)
- Location: tests/genitori/attivita.spec.ts:20:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.ti-heart, .ti-heart-filled').first()

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
  3  | // Area: Genitori - Attivita
  4  | // ID attivita reale preso da lib/mock-data.ts (dati demo).
  5  | const DEMO_ACTIVITY_ID = "summer-camp-acquatico";
  6  | 
  7  | test.describe("Genitori - Attivita", () => {
  8  |   // TC-025 - Apertura scheda attivita
  9  |   test("TC-025 - aprire una card da Home porta al dettaglio con dati reali", async ({ page }) => {
  10 |     await gotoAsRole(page, "parent", "/");
  11 |     await page.getByText("Summer Camp Acquatico").first().click();
  12 | 
  13 |     await expect(page).toHaveURL(new RegExp(`/activity/${DEMO_ACTIVITY_ID}`));
  14 |     await expect(page.getByText("Servizi disponibili")).toBeVisible();
  15 |     await expect(page.getByRole("link", { name: "Prenota ora" })).toBeVisible();
  16 |   });
  17 | 
  18 |   // TC-026 - Preferiti (cuore) - noto FUNCTIONAL/gap: non persiste al reload (useState locale).
  19 |   // Il test verifica lo stato ATTUALE noto (fallisce quando il gap verra' risolto: aggiornare allora).
  20 |   test("TC-026 - il preferito NON persiste dopo reload (comportamento noto, vedi FUNCTIONAL-TC-026)", async ({
  21 |     page,
  22 |   }) => {
  23 |     await gotoAsRole(page, "parent", `/activity/${DEMO_ACTIVITY_ID}`);
  24 |     const heart = page.locator(".ti-heart, .ti-heart-filled").first();
> 25 |     await heart.click();
     |                 ^ Error: locator.click: Test timeout of 30000ms exceeded.
  26 |     await page.reload();
  27 |     // Stato atteso oggi: torna non-preferito (useState locale, non salvato).
  28 |     await expect(page.locator(".ti-heart-filled").first()).toHaveCount(0);
  29 |   });
  30 |   // Priorita: Media | Precondizioni: Attivita con prenotazioni concluse
  31 |   // Passi: Apri il dettaglio di un'attivita
  32 |   // Risultato atteso: Ci si aspetta di vedere eventuali recensioni reali dei genitori
  33 |   test.fixme("TC-027 - Recensioni", async ({ page }) => {
  34 |     // TODO: implementare - vedi i test gia completati in questo file per esempio.
  35 |   });
  36 | 
  37 |   // Priorita: Media | Precondizioni: Il gestore ha creato una promozione attiva
  38 |   // Passi: Apri il dettaglio dell'attivita promozionata
  39 |   // Risultato atteso: Il badge/sconto della promozione e visibile ai genitori
  40 |   test.fixme("TC-028 - Promozioni attive visibili", async ({ page }) => {
  41 |     // TODO: implementare - vedi i test gia completati in questo file per esempio.
  42 |   });
  43 | 
  44 |   // Priorita: Bassa | Precondizioni: Attività con copertina/galleria caricate dal Gestore (vedi TC-116)
  45 |   // Passi: Apri il dettaglio di un'attività con foto caricate
  46 |   // Risultato atteso: L'header mostra la copertina reale (non il gradiente) e sotto ai badge compare una striscia orizzontale scorrevole con le foto della galleria
  47 |   test.fixme("TC-115 - Galleria foto e copertina personalizzata nel dettaglio attività", async ({ page }) => {
  48 |     // ESCLUSO dall'automazione: dipende da TC-116 (upload immagini) non ancora testabile
  49 |   });
  50 | 
  51 | });
  52 | 
```