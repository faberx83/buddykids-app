# OD-02 — Procedura di test live post-deploy

**Scopo**: chiudere OD-02 (stato 2 → 3, CLOSED) verificando in produzione i 3 scenari non testabili in sandbox (Test B/G/H richiesti da Fabrizio). Da eseguire dopo il prossimo deploy che include il commit `16b0527`.

**Prerequisito**: deploy completato, commit `16b0527` (o successivo che lo include) confermato live su Vercel.

---

## Test 1 — Persistenza (TC-N634, Test B)

1. Login come Partner, aprire un'attività → Calendario disponibilità.
2. Selezionare 2-3 giorni (checkbox multi-select).
3. Aprire il pannello bulk, sezione "Giornata particolare": scegliere "Imposta", inserire un'etichetta (es. "Festa estate") e un'emoji.
4. **Non** spuntare "Includi" su nessun altro campo (apertura/capacità/sconto/last-minute).
5. Applicare e salvare.
6. Ricaricare la pagina (F5).
7. **Verifica attesa**: i giorni selezionati mostrano la Giornata particolare impostata; capacità/sconto/last-minute restano invariati rispetto a prima del salvataggio.
8. Aprire il pannello a giorno singolo su uno di quei giorni → la Giornata particolare deve comparire identica.

## Test 2 — Regressione giorno singolo (TC-N635, Test G)

1. Sullo stesso calendario, aprire un giorno singolo (fuori dal bulk).
2. Modificare capacità e sconto normalmente, salvare.
3. **Verifica attesa**: comportamento identico a prima del fix — nessuna differenza percepibile nel pannello a giorno singolo.

## Test 3 — Mobile 390×844 (TC-N636, Test H)

1. Aprire il Calendario disponibilità su viewport mobile (390×844, es. DevTools o dispositivo reale).
2. Attivare la selezione multipla, aprire il pannello bulk.
3. **Verifica attesa**: nessun overflow orizzontale, controllo Giornata particolare raggiungibile e utilizzabile, nessuna sovrapposizione con gli altri campi.

---

## Esito

- Se tutti e 3 i test passano → aggiornare `TRAMA_OPEN_DECISIONS_AND_GAPS.md`: OD-02 → **CLOSED**; valutare se `PT-MVP-08` può passare da `BUILT` a `LIVE` (richiede anche: commit incluso nella release candidate — già vero — e verifica live completata, che questi 3 test forniscono).
- Se un test fallisce → riportare il comportamento osservato; OD-02 resta `IMPLEMENTED — AWAITING LIVE TEST` e si apre un nuovo fix mirato, non una regressione del gate.

Non eseguire azioni di scrittura sul database per questa verifica: è un test funzionale via UI, nessuna query SQL diretta necessaria.
