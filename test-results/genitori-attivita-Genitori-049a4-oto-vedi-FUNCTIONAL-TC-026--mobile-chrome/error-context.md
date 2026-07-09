# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: genitori/attivita.spec.ts >> Genitori - Attivita >> TC-026 - il preferito NON persiste dopo reload (comportamento noto, vedi FUNCTIONAL-TC-026)
- Location: tests/genitori/attivita.spec.ts:20:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.ti-heart-filled').first()
Expected: 0
Received: 1
Timeout:  8000ms

Call log:
  - Expect "toHaveCount" with timeout 8000ms
  - waiting for locator('.ti-heart-filled').first()
    20 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: 🏊
      - button "" [ref=e7] [cursor=pointer]:
        - generic [ref=e8]: 
      - button "" [ref=e9] [cursor=pointer]:
        - generic [ref=e10]: 
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: Summer Camp Acquatico
          - generic [ref=e15]: Centro Sportivo Lido — Porta Nuova, Milano
        - generic [ref=e16]:
          - generic [ref=e17]: 
          - generic [ref=e18]: "4.9"
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: 
          - text: 1.2 km · Porta Nuova, Milano
        - generic [ref=e22]:
          - generic [ref=e23]: 
          - text: 6-14 anni
        - generic [ref=e24]:
          - generic [ref=e25]: 
          - text: 08:00 - 17:30
      - generic [ref=e26]:
        - generic [ref=e27]:
          - generic [ref=e28]: 
          - text: Piscina
        - generic [ref=e29]:
          - generic [ref=e30]: 
          - text: Inglese
        - generic [ref=e31]:
          - generic [ref=e32]: 
          - text: Pranzo incl.
        - generic [ref=e33]:
          - generic [ref=e34]: 
          - text: Navetta
        - generic [ref=e35]:
          - generic [ref=e36]: 
          - text: Outdoor
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]: 🏷️
          - generic [ref=e40]:
            - text: Venerdì scontato
            - generic [ref=e41]: · ogni venerdì
          - generic [ref=e42]: "-15%"
        - generic [ref=e43]:
          - generic [ref=e44]: ⚡
          - generic [ref=e45]: Ultimi posti settimana 2 — sconto last-minute
          - generic [ref=e46]: "-20%"
      - generic [ref=e47]: Un'estate all'insegna dell'acqua, del divertimento e della crescita! Il nostro Summer Camp offre attività in piscina, giochi di squadra, lezioni di nuoto e molto altro in un ambiente sicuro e accogliente, con istruttori qualificati e certificati.
      - generic [ref=e49]: Programma della giornata
      - generic [ref=e50]:
        - generic [ref=e51]:
          - generic [ref=e53]: 08:00
          - generic [ref=e54]: Accoglienza e giochi liberi
        - generic [ref=e55]:
          - generic [ref=e57]: 09:00
          - generic [ref=e58]: Attività in piscina — nuoto e acquagym
        - generic [ref=e59]:
          - generic [ref=e61]: 12:30
          - generic [ref=e62]: Pranzo incluso + riposo
        - generic [ref=e63]:
          - generic [ref=e65]: 14:00
          - generic [ref=e66]: Laboratori creativi e sport
        - generic [ref=e67]:
          - generic [ref=e69]: 16:30
          - generic [ref=e70]: Merenda e giochi outdoor
        - generic [ref=e71]:
          - generic [ref=e73]: 17:30
          - generic [ref=e74]: Uscita / navetta di ritorno
      - generic [ref=e76]:
        - generic [ref=e77]:
          - generic [ref=e78]: 
          - text: Costo settimana
        - generic [ref=e79]: €280
      - generic [ref=e80]:
        - generic [ref=e81]:
          - generic [ref=e82]: 
          - text: Settimane disponibili
        - generic [ref=e83]: 6 di 8
      - generic [ref=e84]:
        - generic [ref=e85]:
          - generic [ref=e86]: 
          - text: Posti rimasti
        - generic [ref=e87]: ⚠️ Solo 3!
      - generic [ref=e89]: Servizi disponibili
      - generic [ref=e90]:
        - generic [ref=e91]:
          - generic [ref=e92]: 
          - text: Pre-scuola
          - generic [ref=e93]: · dalle 07:30 · +€5/sett
        - generic [ref=e94]:
          - generic [ref=e95]: 
          - text: Post-scuola
          - generic [ref=e96]: · fino alle 18:30 · +€8/sett
        - generic [ref=e97]:
          - generic [ref=e98]: 
          - text: Pranzo
          - generic [ref=e99]: · incluso
        - generic [ref=e100]:
          - generic [ref=e101]: 
          - text: Bar nel centro
        - generic [ref=e102]:
          - generic [ref=e103]: 
          - text: Servizio navetta
          - generic [ref=e104]: · +€30/sett
      - generic [ref=e106]: Recensioni (128)
      - generic [ref=e107]:
        - generic [ref=e108]:
          - generic [ref=e109]: AL
          - generic [ref=e110]: Anna L.
          - generic [ref=e111]: ★★★★★
        - generic [ref=e112]: Mia figlia ha adorato ogni momento! Staff super professionale e attento. La riscriviamo il prossimo anno senza dubbi!
      - generic [ref=e113]:
        - generic [ref=e114]:
          - generic [ref=e115]: MR
          - generic [ref=e116]: Marco R.
          - generic [ref=e117]: ★★★★★
        - generic [ref=e118]: Organizzazione impeccabile. I bambini tornano a casa stanchi ma felicissimi ogni giorno. Consigliatissimo!
    - generic [ref=e120]:
      - generic [ref=e121]:
        - generic [ref=e122]: €280
        - generic [ref=e123]: per settimana
      - link "Prenota ora" [ref=e124] [cursor=pointer]:
        - /url: /booking/summer-camp-acquatico
  - button "👨‍👩‍👧 Genitore " [ref=e126] [cursor=pointer]:
    - generic [ref=e127]: 👨‍👩‍👧
    - text: Genitore
    - generic [ref=e128]: 
  - button "Open Next.js Dev Tools" [ref=e134] [cursor=pointer]:
    - img [ref=e135]
  - alert [ref=e138]
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
  25 |     await heart.click();
  26 |     await page.reload();
  27 |     // Stato atteso oggi: torna non-preferito (useState locale, non salvato).
> 28 |     await expect(page.locator(".ti-heart-filled").first()).toHaveCount(0);
     |                                                            ^ Error: expect(locator).toHaveCount(expected) failed
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