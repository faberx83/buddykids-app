# Gate C — Triage cluster, run 28/07/2026 (post Gate B/D)

Rerun mirato di Fabrizio contro il deploy reale (`buddykids-app.vercel.app`), eseguito però con `npx playwright test <cartella>` DIRETTO invece di `bash test-deploy.sh` — differenza importante, vedi nota in fondo. Risultati: `tests/one/onboarding-remediation.spec.ts` 1 failed/1 skipped/4 passed; `tests/gestore` 11 failed/1 flaky/18 skipped/9 did not run/15 passed; `tests/genitori` 7 failed/78 skipped/16 did not run/42 passed; `tests/nextgen` 34 failed/36 skipped/81 passed.

Non tratto questi 53 fallimenti come 53 bug indipendenti (vincolo esplicito del mandato). Raggruppo per causa radice.

## Cluster A — HARNESS: selettori ambigui (strict mode violation)

Sintomo: `resolved to N elements`. Il locator (`getByText`/`getByRole` senza `.first()` o `{exact:true}`) matcha più elementi perché il testo/ruolo compare legittimamente più volte in pagina (nav + contenuto, card CTA + bottom nav, heading + link). **Non è un bug applicativo**, è un test scritto con un selettore troppo permissivo — stesso pattern già corretto in TC-N407 (vedi commento in `onboarding-remediation.spec.ts`).

Occorrenze: TC-138 ("Il mio centro" conta comunque 1, ma la logica adiacente suggerisce stesso pattern), TC-072 ("Prenotazioni" nav+stat), TC-199 ("Accessibilità" heading+label), TC-N35/N36 (bottone "Mi interessa"/"Interessato" ripetuto per ogni proposta community, serve `.first()`), TC-169 ("Tipo attività" chip+label), TC-N50 ("Mese" bottone toggle+frecce prev/next), TC-N54 ("Settimana" bottone toggle+ogni titolo card settimana), TC-N98 (bottone aria-expanded rimasto 1 invece di 0 — probabile secondo pannello espanso da uno stato precedente non pulito), TC-N105 ("Profilo" heading+nav link), TC-N293 (link "Planner" duplicato CTA+bottom nav), TC-N296 (selettore xpath fragile).

**Classificazione: HARNESS.** Fix: aggiungere `.first()`/`{exact:true}`/scoping più stretto (es. `page.getByRole("main").getByText(...)`). Meccanico, basso rischio, non tocca codice applicativo. Non ancora fatto in questa sessione — è il lavoro a più alto rapporto valore/costo per il prossimo giro.

## Cluster B — DATA PRECONDITION: dati di test accumulati tra run

Sintomo: elementi duplicati per accumulo (non per selettore) o elemento atteso assente perché lo stato è già stato consumato da un run precedente.

- TC-123 (Inviti): "Contatto Uno" risolve a 13-14 elementi — contatti caricati da run precedenti mai ripuliti. `cleanup-test-data.mjs` non copre la tabella inviti/contatti.
- TC-508 (Prenotazioni risposta Partner): timeout su riga "Da rispondere" — molto probabile che il seed booking di test sia già stato accettato da un run precedente (nessun reset).
- TC-139 (Registro presenze): "[TEST] Bimbo Prova" risolve a 2 (label + riga "Assenti: ...") — variante del Cluster A ma innescata da uno stato dati specifico (bambino assente accumula in due punti della UI).
- TC-200 (Certificazione): richiesta creata ma non trovata in pagina — probabile stessa causa (coda già popolata da run precedenti, elemento fuori dalla viewport/paginazione).
- TC-163/178 (Richieste): timing legato a stato "letto/non letto" di un thread persistente tra run.

**Classificazione: DATA PRECONDITION.** Fix: estendere `cleanup-test-data.mjs` per pulire anche inviti di test, prenotazioni di test tornate a stato iniziale, certificazioni di test — stesso principio già applicato per i centri onboarding orfani in Gate B. Non ancora fatto.

## Cluster C — TEST OBSOLETO: UI evoluta, test non aggiornato

Sintomo: elemento cercato semplicemente assente, non ambiguo — la pagina è cambiata da quando il test è stato scritto.

- TC-119: "Gestione" (raggruppamento nav) non trovato — la nav Gestore è stata ristrutturata in sprint successivi senza aggiornare questo test.
- Cluster `profile-6.spec.ts` (TC-N112/114/108): link "Famiglia"/"Impostazioni"/"Preferiti" con href attesi diversi da quelli reali — Profilo NEXTGEN riorganizzato in sprint successivi (Logistica/Famiglia dentro Profilo, Sprint 7).
- TC-153: classe colore chip attesa (`bg-aqua` ecc.) non trovata, il chip è `bg-white` — probabile che il test selezioni il chip "nessuna selezione" invece di quello del bambino.
- TC-204/208 (Login): testo duplicato tra overlay splash e contenuto reale; sfondo bianco atteso ma `rgba(0,0,0,0)` — il test non tiene conto dell'app-splash-overlay introdotto dopo.
- TC-N24: "Settimana 12"/"Settimana 13" non trovate — verificare se dipende dalla stagione corrente (oggi 28/07, la stagione ha 13 settimane da giugno: settimana 13 dovrebbe esistere; da approfondire se è un vero regressione o un problema di viewport/scroll).

**Classificazione: TEST OBSOLETO** (in maggioranza). Fix: aggiornare i test ai testi/href correnti — richiede uno sguardo diretto alla UI attuale pagina per pagina, non meccanico come il Cluster A.

## Cluster D — Da investigare come possibile regressione reale

- TC-N43/44: bottoni "Organizzazione"/"Mappa"/"Budget"/"Gruppi" del Planner non trovati affatto (non ambigui, assenti) — se la UI reale ha ancora questi tab con questi nomi esatti, è un regressione; se sono stati rinominati in uno sprint successivo, è Cluster C. **Non ancora determinato — priorità alta per prossimo giro, tocca la journey Planner (critica, #15 Gate D).**
- TC-N59/61 ("Nessuno assegnato" — Chi fa cosa) e TC-N66 (Mappa distanza) — stesso dubbio, journey "Planner Sync"/Mappa.
- TC-160 ("Indietro" bottone dettaglio attività) — questa è una regressione già corretta in passato (bug #22); se è ricomparsa merita priorità P1.

**Classificazione: DA VERIFICARE.** Nessuna fix applicata — richiede uno screenshot/trace reale (già disponibili in `test-results/*/test-failed-1.png`, generati da questo run) prima di decidere HARNESS/OBSOLETO/BUG.

## TC-N409 — ancora fallita, causa nota e diversa dai cluster sopra

Il comando è stato lanciato con `npx playwright test ... ` DIRETTO, non con `bash test-deploy.sh`. `cleanup-test-data.mjs` (che imposta automaticamente la precondizione SUBMITTED, Gate B) viene invocato SOLO da `test-deploy.sh` riga 98 — bypassato lanciando playwright a mano. Non è un regressione del fix di Gate B, è semplicemente non stato eseguito il passo che lo attiva.

**Comando corretto per riverificare**: `bash test-deploy.sh` con `TEST_SCOPE=critical` (ora disponibile, Gate D) o mirato a un singolo file via una piccola modifica futura — per ora, il modo corretto di rieseguire singoli file mantenendo il cleanup automatico è lanciare comunque `test-deploy.sh` (che esegue l'intera suite/TEST_SCOPE) piuttosto che `npx playwright test` a mano.

## "did not run" — evidenza per Obiettivo 4

`tests/gestore`: 9 did not run. `tests/genitori`: 16 did not run. `tests/nextgen`: 0. Pattern coerente con test in `describe` non-serial dove un fallimento in un `beforeEach`/test precedente nello stesso worker consuma il tempo/stato e Playwright salta i successivi test dipendenti dello stesso file quando il worker viene riavviato dopo troppi retry — non un fenomeno casuale, correlato 1:1 con i file che hanno anche fallimenti (gestore e genitori ne hanno, nextgen in questo run non ne ha nonostante 34 falliti, quindi il collegamento non è "ogni fallimento causa un did-not-run" ma probabile interruzione di worker su fallimenti in serie/hook). Da approfondire con `--reporter=json` e ispezione diretta, non ancora fatto.

## Raccomandazione per il prossimo giro

1. Fix meccanico Cluster A (selettori) — basso rischio, alto numero di test recuperati.
2. Estendere `cleanup-test-data.mjs` per Cluster B (inviti, prenotazioni test, certificazioni).
3. Verificare con screenshot Cluster D prima di toccare codice applicativo — priorità Planner (journey critica).
4. Rieseguire SEMPRE via `bash test-deploy.sh`, mai `npx playwright test` a mano, per non perdere il cleanup automatico.
