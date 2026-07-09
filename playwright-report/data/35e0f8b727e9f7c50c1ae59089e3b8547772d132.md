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
    1) <span class="flex-1">Attività</span> aka getByRole('link', { name: ' Attività' })
    2) <a href="/center/activities" class="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors bg-bg text-ink-2">…</a> aka getByText('Attività').nth(1)
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
    - complementary [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: 🏫
        - generic [ref=e8]: BuddyKids Partner
      - navigation [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: Oggi
          - link " Dashboard" [ref=e12] [cursor=pointer]:
            - /url: /center
            - generic [ref=e13]: 
            - generic [ref=e14]: Dashboard
        - generic [ref=e15]:
          - generic [ref=e16]: Gestione
          - link " Il mio centro" [ref=e17] [cursor=pointer]:
            - /url: /center/profile
            - generic [ref=e18]: 
            - generic [ref=e19]: Il mio centro
        - link " Attività" [ref=e21] [cursor=pointer]:
          - /url: /center/activities
          - generic [ref=e22]: 
          - generic [ref=e23]: Attività
        - link " Promozioni" [ref=e25] [cursor=pointer]:
          - /url: /center/promotions
          - generic [ref=e26]: 
          - generic [ref=e27]: Promozioni
        - link "﨡 Richieste Gruppo" [ref=e29] [cursor=pointer]:
          - /url: /center/group-requests
          - generic [ref=e30]: 﨡
          - generic [ref=e31]: Richieste Gruppo
        - link " Servizi consigliati" [ref=e33] [cursor=pointer]:
          - /url: /center/servizi-consigliati
          - generic [ref=e34]: 
          - generic [ref=e35]: Servizi consigliati
        - link " Inviti" [ref=e37] [cursor=pointer]:
          - /url: /center/invites
          - generic [ref=e38]: 
          - generic [ref=e39]: Inviti
      - link " Torna all'app" [ref=e40] [cursor=pointer]:
        - /url: /
        - generic [ref=e41]: 
        - text: Torna all'app
      - button " Esci dall'account" [ref=e42] [cursor=pointer]:
        - generic [ref=e43]: 
        - text: Esci dall'account
    - generic [ref=e44]:
      - text:      﨡  
      - generic [ref=e45]:
        - generic "Le modifiche non vengono ancora salvate su Supabase" [ref=e46]:
          - generic [ref=e47]: 
          - text: Dati demo
        - generic [ref=e48]: Dashboard, grafici e form di questa area sono ancora collegati a dati di esempio — le scritture reali arrivano nel prossimo step.
      - main [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e51]:
            - generic [ref=e52]:
              - heading "Centro Sportivo Lido" [level=1] [ref=e53]
              - paragraph [ref=e54]: Bentornato, Luca
            - generic [ref=e55]: 🏊
          - generic [ref=e57]:
            - generic [ref=e59]: 
            - generic [ref=e60]:
              - generic [ref=e61]: 1 settimana sotto il 40% di occupazione
              - generic [ref=e62]: Valuta uno sconto last-minute
            - link "Crea promo" [ref=e63] [cursor=pointer]:
              - /url: /center/promotions
          - generic [ref=e64]:
            - generic [ref=e65]:
              - generic [ref=e67]: 
              - generic [ref=e68]: "1"
              - generic [ref=e69]: Attività
            - generic [ref=e70]:
              - generic [ref=e72]: 
              - generic [ref=e73]: "4"
              - generic [ref=e74]: Prenotazioni
            - generic [ref=e75]:
              - generic [ref=e77]: 
              - generic [ref=e78]: "2"
              - generic [ref=e79]: Promo attive
            - generic [ref=e80]:
              - generic [ref=e82]: 
              - generic [ref=e83]: €1152
              - generic [ref=e84]: Fatturato confermato
          - generic [ref=e85]:
            - text: Occupazione settimanale
            - paragraph [ref=e86]: Usa questo grafico per capire dove i posti restano vuoti e decidere su quali settimane spingere una promo last-minute.
            - generic [ref=e87]:
              - application [ref=e90]:
                - generic [ref=e113]:
                  - generic [ref=e114]:
                    - generic [ref=e116]: Sett. 1
                    - generic [ref=e118]: Sett. 2
                    - generic [ref=e120]: Sett. 3
                    - generic [ref=e122]: Sett. 4
                    - generic [ref=e124]: Sett. 5
                    - generic [ref=e126]: Sett. 6
                  - generic [ref=e127]:
                    - generic [ref=e129]: 0%
                    - generic [ref=e131]: 25%
                    - generic [ref=e133]: 50%
                    - generic [ref=e135]: 75%
                    - generic [ref=e137]: 100%
              - generic [ref=e138]:
                - generic [ref=e139]: < 40% — consiglia last-minute
                - generic [ref=e141]: 40-70%
                - generic [ref=e143]: "> 70% — ok"
          - generic [ref=e145]:
            - generic [ref=e146]:
              - generic [ref=e147]: Prenotazioni recenti
              - table [ref=e148]:
                - rowgroup [ref=e149]:
                  - row "Bambino Attività Totale Stato" [ref=e150]:
                    - columnheader "Bambino" [ref=e151]
                    - columnheader "Attività" [ref=e152]
                    - columnheader "Totale" [ref=e153]
                    - columnheader "Stato" [ref=e154]
                - rowgroup [ref=e155]:
                  - row "Marco Ferretti Summer Camp Acquatico €592 Confermata" [ref=e156]:
                    - cell "Marco Ferretti" [ref=e157]
                    - cell "Summer Camp Acquatico" [ref=e158]
                    - cell "€592" [ref=e159]
                    - cell "Confermata" [ref=e160]
                  - row "Giulia Marchetti Summer Camp Acquatico €280 Confermata" [ref=e161]:
                    - cell "Giulia Marchetti" [ref=e162]
                    - cell "Summer Camp Acquatico" [ref=e163]
                    - cell "€280" [ref=e164]
                    - cell "Confermata" [ref=e165]
                  - row "Elisa Bruno Summer Camp Acquatico €280 Confermata" [ref=e166]:
                    - cell "Elisa Bruno" [ref=e167]
                    - cell "Summer Camp Acquatico" [ref=e168]
                    - cell "€280" [ref=e169]
                    - cell "Confermata" [ref=e170]
                  - row "Anna Lombardi Summer Camp Acquatico €280 In attesa" [ref=e171]:
                    - cell "Anna Lombardi" [ref=e172]
                    - cell "Summer Camp Acquatico" [ref=e173]
                    - cell "€280" [ref=e174]
                    - cell "In attesa" [ref=e175]
            - generic [ref=e176]:
              - generic [ref=e177]: Attività recente
              - generic [ref=e178]:
                - generic [ref=e179]:
                  - generic [ref=e181]: 
                  - generic [ref=e182]:
                    - generic [ref=e183]: Sett. 6 sotto il 40%
                    - generic [ref=e184]: 3 ore fa
                - generic [ref=e185]:
                  - generic [ref=e187]: 
                  - generic [ref=e188]:
                    - generic [ref=e189]: Promo "Venerdì scontato" attiva
                    - generic [ref=e190]: 2 giorni fa
                - generic [ref=e191]:
                  - generic [ref=e193]: 
                  - generic [ref=e194]:
                    - generic [ref=e195]: Promo "Ultimi posti settimana 2 — sconto last-minute" attiva
                    - generic [ref=e196]: 3 giorni fa
                - generic [ref=e197]:
                  - generic [ref=e199]: 
                  - generic [ref=e200]:
                    - generic [ref=e201]: Prenotazione — Anna Lombardi
                    - generic [ref=e202]: 54 settimane fa
                - generic [ref=e203]:
                  - generic [ref=e205]: 
                  - generic [ref=e206]:
                    - generic [ref=e207]: Prenotazione — Elisa Bruno
                    - generic [ref=e208]: 55 settimane fa
                - generic [ref=e209]:
                  - generic [ref=e211]: 
                  - generic [ref=e212]:
                    - generic [ref=e213]: Prenotazione — Giulia Marchetti
                    - generic [ref=e214]: 56 settimane fa
          - link " Servizi consigliati per il tuo centro Contatti selezionati da BuddyKids (catering e altro) " [ref=e215] [cursor=pointer]:
            - /url: /center/servizi-consigliati
            - generic [ref=e217]: 
            - generic [ref=e218]:
              - generic [ref=e219]: Servizi consigliati per il tuo centro
              - generic [ref=e220]: Contatti selezionati da BuddyKids (catering e altro)
            - generic [ref=e221]: 
  - button "🏫 Gestore centro " [ref=e223] [cursor=pointer]:
    - generic [ref=e224]: 🏫
    - text: Gestore centro
    - generic [ref=e225]: 
  - button "Open Next.js Dev Tools" [ref=e231] [cursor=pointer]:
    - img [ref=e232]
  - alert [ref=e235]
  - generic [ref=e236]: 0%
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