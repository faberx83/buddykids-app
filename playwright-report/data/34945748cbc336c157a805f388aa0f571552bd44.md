# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gestore/dashboard.spec.ts >> Gestore - Dashboard >> TC-072 - /center mostra KPI, occupazione settimanale e 'Le tue attività'
- Location: tests/gestore/dashboard.spec.ts:10:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Attività', { exact: true })
Expected: visible
Error: strict mode violation: getByText('Attività', { exact: true }) resolved to 4 elements:
    1) <span class="flex-1">Attività</span> aka locator('aside').getByText('Attività')
    2) <a href="/center/activities" class="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors bg-bg text-ink-2">…</a> aka getByRole('link', { name: ' Attività' })
    3) <div class="mt-0.5 text-xs text-ink-2">Attività</div> aka getByRole('main').locator('div').filter({ hasText: /^Attività$/ })
    4) <th class="px-4 py-2 font-medium">Attività</th> aka getByRole('columnheader', { name: 'Attività' })

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByText('Attività', { exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - text:     﨡    
    - generic [ref=e5]:
      - generic [ref=e6]:
        - banner [ref=e7]:
          - generic [ref=e8]:
            - generic [ref=e9]: 🏫
            - generic [ref=e10]: BuddyKids Partner
          - button "Esci dall'account" [ref=e11] [cursor=pointer]:
            - generic [ref=e12]: 
        - navigation [ref=e13]:
          - link " Dashboard" [ref=e14] [cursor=pointer]:
            - /url: /center
            - generic [ref=e15]: 
            - text: Dashboard
          - link " Il mio centro" [ref=e16] [cursor=pointer]:
            - /url: /center/profile
            - generic [ref=e17]: 
            - text: Il mio centro
          - link " Attività" [ref=e18] [cursor=pointer]:
            - /url: /center/activities
            - generic [ref=e19]: 
            - text: Attività
          - link " Promozioni" [ref=e20] [cursor=pointer]:
            - /url: /center/promotions
            - generic [ref=e21]: 
            - text: Promozioni
          - link "﨡 Richieste Gruppo" [ref=e22] [cursor=pointer]:
            - /url: /center/group-requests
            - generic [ref=e23]: 﨡
            - text: Richieste Gruppo
          - link " Servizi consigliati" [ref=e24] [cursor=pointer]:
            - /url: /center/servizi-consigliati
            - generic [ref=e25]: 
            - text: Servizi consigliati
          - link " Inviti" [ref=e26] [cursor=pointer]:
            - /url: /center/invites
            - generic [ref=e27]: 
            - text: Inviti
      - generic [ref=e28]:
        - generic "Le modifiche non vengono ancora salvate su Supabase" [ref=e29]:
          - generic [ref=e30]: 
          - text: Dati demo
        - generic [ref=e31]: Dashboard, grafici e form di questa area sono ancora collegati a dati di esempio — le scritture reali arrivano nel prossimo step.
      - main [ref=e32]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - generic [ref=e35]:
              - heading "Centro Sportivo Lido" [level=1] [ref=e36]
              - paragraph [ref=e37]: Bentornato, Luca
            - generic [ref=e38]: 🏊
          - generic [ref=e40]:
            - generic [ref=e42]: 
            - generic [ref=e43]:
              - generic [ref=e44]: 1 settimana sotto il 40% di occupazione
              - generic [ref=e45]: Valuta uno sconto last-minute
            - link "Crea promo" [ref=e46] [cursor=pointer]:
              - /url: /center/promotions
          - generic [ref=e47]:
            - generic [ref=e48]:
              - generic [ref=e50]: 
              - generic [ref=e51]: "1"
              - generic [ref=e52]: Attività
            - generic [ref=e53]:
              - generic [ref=e55]: 
              - generic [ref=e56]: "4"
              - generic [ref=e57]: Prenotazioni
            - generic [ref=e58]:
              - generic [ref=e60]: 
              - generic [ref=e61]: "2"
              - generic [ref=e62]: Promo attive
            - generic [ref=e63]:
              - generic [ref=e65]: 
              - generic [ref=e66]: €1152
              - generic [ref=e67]: Fatturato confermato
          - generic [ref=e68]:
            - text: Occupazione settimanale
            - paragraph [ref=e69]: Usa questo grafico per capire dove i posti restano vuoti e decidere su quali settimane spingere una promo last-minute.
            - generic [ref=e70]:
              - application [ref=e73]:
                - generic [ref=e96]:
                  - generic [ref=e97]:
                    - generic [ref=e99]: Sett. 1
                    - generic [ref=e101]: Sett. 2
                    - generic [ref=e103]: Sett. 3
                    - generic [ref=e105]: Sett. 4
                    - generic [ref=e107]: Sett. 5
                    - generic [ref=e109]: Sett. 6
                  - generic [ref=e110]:
                    - generic [ref=e112]: 0%
                    - generic [ref=e114]: 25%
                    - generic [ref=e116]: 50%
                    - generic [ref=e118]: 75%
                    - generic [ref=e120]: 100%
              - generic [ref=e121]:
                - generic [ref=e122]: < 40% — consiglia last-minute
                - generic [ref=e124]: 40-70%
                - generic [ref=e126]: "> 70% — ok"
          - generic [ref=e128]:
            - generic [ref=e129]:
              - generic [ref=e130]: Prenotazioni recenti
              - table [ref=e131]:
                - rowgroup [ref=e132]:
                  - row "Bambino Attività Totale Stato" [ref=e133]:
                    - columnheader "Bambino" [ref=e134]
                    - columnheader "Attività" [ref=e135]
                    - columnheader "Totale" [ref=e136]
                    - columnheader "Stato" [ref=e137]
                - rowgroup [ref=e138]:
                  - row "Marco Ferretti Summer Camp Acquatico €592 Confermata" [ref=e139]:
                    - cell "Marco Ferretti" [ref=e140]
                    - cell "Summer Camp Acquatico" [ref=e141]
                    - cell "€592" [ref=e142]
                    - cell "Confermata" [ref=e143]
                  - row "Giulia Marchetti Summer Camp Acquatico €280 Confermata" [ref=e144]:
                    - cell "Giulia Marchetti" [ref=e145]
                    - cell "Summer Camp Acquatico" [ref=e146]
                    - cell "€280" [ref=e147]
                    - cell "Confermata" [ref=e148]
                  - row "Elisa Bruno Summer Camp Acquatico €280 Confermata" [ref=e149]:
                    - cell "Elisa Bruno" [ref=e150]
                    - cell "Summer Camp Acquatico" [ref=e151]
                    - cell "€280" [ref=e152]
                    - cell "Confermata" [ref=e153]
                  - row "Anna Lombardi Summer Camp Acquatico €280 In attesa" [ref=e154]:
                    - cell "Anna Lombardi" [ref=e155]
                    - cell "Summer Camp Acquatico" [ref=e156]
                    - cell "€280" [ref=e157]
                    - cell "In attesa" [ref=e158]
            - generic [ref=e159]:
              - generic [ref=e160]: Attività recente
              - generic [ref=e161]:
                - generic [ref=e162]:
                  - generic [ref=e164]: 
                  - generic [ref=e165]:
                    - generic [ref=e166]: Sett. 6 sotto il 40%
                    - generic [ref=e167]: 3 ore fa
                - generic [ref=e168]:
                  - generic [ref=e170]: 
                  - generic [ref=e171]:
                    - generic [ref=e172]: Promo "Venerdì scontato" attiva
                    - generic [ref=e173]: 2 giorni fa
                - generic [ref=e174]:
                  - generic [ref=e176]: 
                  - generic [ref=e177]:
                    - generic [ref=e178]: Promo "Ultimi posti settimana 2 — sconto last-minute" attiva
                    - generic [ref=e179]: 3 giorni fa
                - generic [ref=e180]:
                  - generic [ref=e182]: 
                  - generic [ref=e183]:
                    - generic [ref=e184]: Prenotazione — Anna Lombardi
                    - generic [ref=e185]: 54 settimane fa
                - generic [ref=e186]:
                  - generic [ref=e188]: 
                  - generic [ref=e189]:
                    - generic [ref=e190]: Prenotazione — Elisa Bruno
                    - generic [ref=e191]: 55 settimane fa
                - generic [ref=e192]:
                  - generic [ref=e194]: 
                  - generic [ref=e195]:
                    - generic [ref=e196]: Prenotazione — Giulia Marchetti
                    - generic [ref=e197]: 56 settimane fa
          - link " Servizi consigliati per il tuo centro Contatti selezionati da BuddyKids (catering e altro) " [ref=e198] [cursor=pointer]:
            - /url: /center/servizi-consigliati
            - generic [ref=e200]: 
            - generic [ref=e201]:
              - generic [ref=e202]: Servizi consigliati per il tuo centro
              - generic [ref=e203]: Contatti selezionati da BuddyKids (catering e altro)
            - generic [ref=e204]: 
  - button "🏫 Gestore centro " [ref=e206] [cursor=pointer]:
    - generic [ref=e207]: 🏫
    - text: Gestore centro
    - generic [ref=e208]: 
  - button "Open Next.js Dev Tools" [ref=e214] [cursor=pointer]:
    - img [ref=e215]
  - alert [ref=e218]
  - generic [ref=e219]: 0%
```

# Test source

```ts
  1  | import { test, expect, gotoAsRole } from "../fixtures/roles";
  2  | 
  3  | // Area: Gestore - Dashboard
  4  | // NOTA: la dashboard e' "volutamente demo" (task #19 nel roadmap del team) -
  5  | // mostra sempre i dati di lib/mock-data.ts anche con Supabase configurato.
  6  | // Il test verifica quindi la struttura/i KPI, non dati "reali" per design.
  7  | 
  8  | test.describe("Gestore - Dashboard", () => {
  9  |   // TC-072 - Dashboard Gestore carica KPI e sezioni chiave
  10 |   test("TC-072 - /center mostra KPI, occupazione settimanale e 'Le tue attività'", async ({ page }) => {
  11 |     await gotoAsRole(page, "center_admin", "/center");
  12 | 
> 13 |     await expect(page.getByText("Attività", { exact: true })).toBeVisible();
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  14 |     await expect(page.getByText("Prenotazioni", { exact: true })).toBeVisible();
  15 |     await expect(page.getByText("Promozioni attive")).toBeVisible();
  16 |     await expect(page.getByText("Fatturato confermato")).toBeVisible();
  17 |     await expect(page.getByText("Occupazione settimanale")).toBeVisible();
  18 |     await expect(page.getByText("Le tue attività")).toBeVisible();
  19 |   });
  20 |   // Priorita: Media | Precondizioni: Login Gestore, almeno una Richiesta Gruppo in sospeso
  21 |   // Passi: Apri /center, osserva il menu laterale
  22 |   // Risultato atteso: Le voci di menu sono raggruppate sotto intestazioni (\"Oggi\"/\"Gestione\"); la voce \"Richieste Gruppo\" mostra un badge rosso col numero di richieste in sospeso
  23 |   test.fixme("TC-119 - Nuova navigazione con raggruppamento sezioni e badge richieste in sospeso", async ({ page }) => {
  24 |     // PENDING: funzionalita non presente nel repo GitHub ispezionato
  25 |     // (risulta implementata in una sessione locale non ancora pushata).
  26 |   });
  27 | 
  28 |   // Priorita: Media | Precondizioni: Centro con almeno una settimana con occupazione bassa, o una Richiesta Gruppo in sospeso
  29 |   // Passi: Apri /center
  30 |   // Risultato atteso: In cima alla dashboard compaiono banner dedicati per le settimane scariche e per le richieste in sospeso, prima delle metriche KPI
  31 |   test.fixme("TC-120 - Banner settimane scariche / richieste gruppo in sospeso", async ({ page }) => {
  32 |     // PENDING: funzionalita non presente nel repo GitHub ispezionato
  33 |     // (risulta implementata in una sessione locale non ancora pushata).
  34 |   });
  35 | 
  36 |   // Priorita: Bassa | Precondizioni: Login Gestore
  37 |   // Passi: Apri /center, osserva la colonna destra
  38 |   // Risultato atteso: Al posto della vecchia lista \"Le tue attività\" compare un feed cronologico che unisce settimane scariche, richieste gruppo, prenotazioni e promozioni
  39 |   test.fixme("TC-121 - Feed attività unificato \"Attività recente\"", async ({ page }) => {
  40 |     // PENDING: funzionalita non presente nel repo GitHub ispezionato
  41 |     // (risulta implementata in una sessione locale non ancora pushata).
  42 |   });
  43 | 
  44 | });
  45 | 
```