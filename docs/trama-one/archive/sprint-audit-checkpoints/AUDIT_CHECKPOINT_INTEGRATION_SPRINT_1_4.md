# TRAMA ONE — Integration Gate — Build Sprint 1-4

Documento autosufficiente per chi non ha seguito la conversazione. Richiesto da `DECISION_LOG.md` DEC-30: "il primo audit esterno obbligatorio successivo a questa decisione è `AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md`, a chiusura di Sprint 4, con `TEST_SCOPE=all` eseguita/richiesta e confrontata con la baseline dei fallimenti preesistenti". A differenza di `AUDIT_CHECKPOINT_SPRINT_0/1/2.md` (checkpoint interni di continuità), questo è l'unico audit esterno formale previsto per l'intero arco Sprint 1-4.

## 1. Executive Status

**Scope cumulativo di Sprint 1-4** (`SPRINT_GOVERNANCE.md`): Sprint 1 (Partner onboarding, Admin Review, Walkthrough foundation), Sprint 2 (Catalogo/prezzo/capacità, Giorni spot Partner, Walkthrough attività), Sprint 3 (Parent discovery e selezione giorni), Sprint 4 (Partner response, Booking, Planner Sync).

**Risultato dell'implementazione**: tutti gli elementi di scope dei 4 sprint risultano implementati, verificati staticamente (`tsc`/`eslint`/`next build`) e documentati sprint per sprint (`SPRINT_1/2/3/4_FEATURE_PRESERVATION_MATRIX.md`, `DECISION_LOG.md` DEC-01..DEC-45).

**Risultato del gate di test reale (novità di questo documento)**: **NON posso dichiarare "AUDIT STATUS: READY"**. Il 27/07/2026 Fabrizio ha eseguito per la prima volta la suite Playwright completa (`TEST_SCOPE=all`) contro il deploy di produzione — il primo run di questo tipo dall'inizio di TRAMA ONE, perché la governance (DEC-29) aveva sospeso l'obbligo di eseguirla ad ogni sprint, rimandandola proprio a questo gate. Esito: **137 failed, 301 skipped, 70 did not run, 374 passed (44.1 minuti)**, su un totale di 882 test.

Ho analizzato il log completo (`logs/deploy-20260727-152424.log`, 7398 righe) riga per riga. Il quadro onesto è:

| Categoria | Conteggio | Significato |
|---|---|---|
| Debito tecnico pre-esistente, confermato | 14 | 7 sintomi × 2 browser — vedi `PRE_EXISTING_TEST_FAILURE_BASELINE.md` §2, aggiornato con dati reali oggi |
| Gap noto/non bloccante già documentato | 12 | DEC-33 (TC-N409, 2×) + DEC-34 (conflitto account di test, 5 TC × 2 = 10) |
| Probabile flakiness infrastrutturale (login timeout sotto carico), da riverificare isolatamente | 14 | Nessun documento li copre; ipotesi tecnica, non certezza |
| **Potenziali BLOCKER reali, non spiegati da nessun documento** | **97** | Per la regola esplicita della baseline stessa ("fuori dalle aree note = BLOCKER fino a prova contraria"), vanno trattati come tali finché non triagiati singolarmente |
| **Test mai eseguiti ("did not run"), causa non determinabile** | **70** | L'artefatto che avrebbe permesso di identificarli esattamente (`playwright-report/results.json`) è stato sovrascritto da un run successivo prima che questa analisi potesse leggerlo |

**Perché non "READY"**: il principio guida ribadito in ogni documento di questo progetto è "mai dichiarare una prova che non esiste" (vedi `PRE_EXISTING_TEST_FAILURE_BASELINE.md` §1, `DECISION_LOG.md` più volte). Dichiarare l'Integration Gate superato con 97 fallimenti non spiegati e 70 test di esito ignoto violerebbe direttamente questo principio, anche se **nessuno di questi fallimenti può essere una regressione introdotta dal codice TRAMA ONE** (Sprint 0-4 non hanno mai toccato `app/nextgen/*`, `app/auth/*`, la navigazione Legacy Gestore/Admin — verificato per costruzione, DEC-02) — il punto non è "chi ha causato il fallimento", è che oggi non è possibile affermare con evidenza reale che questi 97+70 siano innocui.

**Stato: `AUDIT STATUS: CONDITIONAL`** — vedi §13 per il piano di chiusura esatto.

## 2. Repository State

- **Branch**: `main`.
- **Range di questo audit**: dal commit baseline pre-TRAMA ONE `5a36f9d` all'ultimo commit disponibile in questa sessione, `919977e` (upload verifica identità, Task #361/gap DEC-22).
- **Commit rilevanti per la chiusura di Sprint 4** (già in `SPRINT_4_FEATURE_PRESERVATION_MATRIX.md`): `2259c2a` (Feature Preservation Matrix), `528a394` (risposta Partner completa), `51caabd` (fix TC-508), `9e67670` (backfill DEC-43), `56be01e` (redesign Inbox), `0420f87`/`57d42e1` (fix Timeline awaiting), `850fc63` (click settimana coperta → prenotazione reale, Task #357).
- **Commit successivi alla chiusura tecnica di Sprint 4, aggiunti durante la preparazione di questo stesso Integration Gate**: `0c9b031` (aggiornamento Feature Parity Matrix/Transition Register), `06e97fc` (email Partner per giorno), `919977e` (upload verifica identità). Questi tre commit chiudono gap P0 dell'MVP scoperti durante il check di coerenza del 27/07 — non fanno parte dello scope originale di Sprint 4, ma sono stati implementati prima di questo gate perché riguardano capability marcate bloccanti nell'MVP.
- **Working tree**: pulito subito dopo ogni commit di questo batch (verificato `git status --short` dopo ciascuno).
- **Push/deploy**: il deploy che ha prodotto il run di test analizzato in questo documento è antecedente ai 3 commit sopra (email/identità sono commit di codice non ancora deployati/testati dal vivo al momento di scrivere questo documento) — vedi §13, punto 3.

## 3. Scope

- **In scope di questo audit**: unione dello scope di Sprint 1, 2, 3, 4 (vedi Executive Status). Non ripete il dettaglio implementativo già coperto dai 4 `SPRINT_N_FEATURE_PRESERVATION_MATRIX.md` — questo documento aggiunge SOLO ciò che il Master Prompt/DEC-30 richiede in più: il confronto con un run reale completo.
- **Esplicitamente fuori scope**: Sprint 5 (CenterLead/referral) e Sprint 6 (Command Center Admin/analytics/hardening), non ancora iniziati — nessuna valutazione qui li riguarda.
- **Deviazioni**: nessuna rispetto allo scope tecnico dei 4 sprint. La deviazione rispetto al PROCESSO di audit è che l'esito non è "READY" come i checkpoint precedenti — vedi §1.

## 4. Feature Preservation

Confermato dai 4 `SPRINT_N_FEATURE_PRESERVATION_MATRIX.md` individuali (non riproposto qui integralmente): nessuna colonna esistente alterata/rimossa in nessuno sprint, nessuna capability Legacy/NextGen dismessa, tutte le migrazioni additive (`migration_09`...`migration_15`, quest'ultima non ancora applicata da Fabrizio).

**Verifica aggiuntiva richiesta da questo gate**: la suite `TEST_SCOPE=all` include, per la prima volta insieme, i test Legacy/NextGen preesistenti E i nuovi test TRAMA ONE (`tests/one/*`). Il fatto che i fallimenti nell'area NextGen (79 su 137, vedi §8) siano dislocati in file MAI toccati da nessun commit TRAMA ONE (verificato per ciascun file elencato in §8 con `git log --follow` implicito nella cronologia sprint) è coerente con "nessuna regressione introdotta da TRAMA ONE" — ma **non è la stessa cosa di "questi fallimenti sono innocui"**: potrebbero essere debito preesistente mai scoperto prima (perché la suite completa non era mai stata eseguita fino ad oggi) o fragilità dei test stessi. Questa distinzione è il cuore della classificazione in §8.

## 5. Architecture and Reuse

Invariato rispetto ai 4 `SPRINT_N_FEATURE_PRESERVATION_MATRIX.md`. Nessuna nuova capability di business introdotta da questo documento: è un gate di verifica, non uno sprint di sviluppo. Le uniche modifiche di codice associate a questo documento sono strumentali (§9: archiviazione report Playwright).

## 6. Database

Nessuna migrazione introdotta da questo audit. Stato delle migrazioni Sprint 1-4 (`migration_09`...`migration_14`): tutte applicate in produzione da Fabrizio (confermato nei rispettivi checkpoint sprint). `migration_15_identity_verification_storage.sql` (gap P0 MVP, non parte dello scope originale Sprint 1-4) **non ancora applicata** — bucket storage per upload verifica identità, in attesa che Fabrizio la esegua.

## 7. Security and Privacy

Nessuna nuova considerazione rispetto ai 4 checkpoint sprint. Non pertinente a questo gate (nessun nuovo dato sensibile, nessuna nuova policy).

## 8. Tests — cuore di questo documento

### 8.1 Verifiche statiche (invariato, cumulativo sui 4 sprint + i 3 commit di chiusura gap)

| Categoria | Esito |
|---|---|
| `npx tsc --noEmit` | Pulito su tutti i commit di Sprint 1-4 e sui 3 commit di chiusura gap successivi |
| `npx eslint` | Pulito sui file toccati in ogni commit, nessun nuovo warning |
| `npx next build` | Pulito, tutte le route `/one/*` confermate `ƒ Dynamic` |

### 8.2 Suite browser completa (`TEST_SCOPE=all`) — PRIMA esecuzione dall'inizio di TRAMA ONE

Eseguita da Fabrizio il 27/07/2026 contro `https://buddykids-app.vercel.app`. Log completo: `logs/deploy-20260727-152424.log` (44.1 minuti, 882 test totali).

**Risultato**: 137 failed, 301 skipped, 70 did not run, 374 passed.

**Metodo di analisi**: estrazione di tutti i 137 blocchi di fallimento dal log (verificato: 137 righe uniche, nessun duplicato/retry — `playwright.config.ts` ha `retries: 0` in questo ambiente), raggruppamento per file/pattern d'errore, confronto riga per riga con `PRE_EXISTING_TEST_FAILURE_BASELINE.md` e `DECISION_LOG.md`.

**Classificazione dei 137 fallimenti**:

**(a) Debito tecnico pre-esistente confermato — 14** (vedi `PRE_EXISTING_TEST_FAILURE_BASELINE.md` §2 per il dettaglio TC-per-TC): login header/splash duplicato (TC-204 ×2), login sfondo (TC-208 ×2), nav "Gestione" Gestore (TC-119 ×2), badge NextGen (TC-N01/N02/N03 ×2 = 6), logo TRAMA duplicato (TC-N89 ×2). Nota: l'area "Admin dashboard" ipotizzata nella baseline originale **non si è riprodotta** in questo run — rimossa dal conteggio corrente, la stima storica di "7 fallimenti totali" era comunque sottostimata (non contava i 2 browser).

**(b) Gap noto/non bloccante, già documentato — 12**: conflitto account di test DEC-34 (TC-N302/303/304/401/402, 5 TC × 2 browser = 10) + precondizione SQL manuale DEC-33 (TC-N409 ×2).

**(c1) Probabile flakiness infrastrutturale, NON classificabile con certezza — 14**: un cluster di fallimenti scorrelati tra loro per area (`gestore/account.spec.ts`, `genitori/prenotazione.spec.ts`, 12 test NextGen diversi) condivide la STESSA identica traccia d'errore:
```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
waiting for navigation until "load"
at loginAs (tests/fixtures/roles.ts:73:14)
```
cioè il login stesso (`loginAs()`, comune a tutta la suite) non completa entro 30 secondi. Non è verosimile che siano 14 bug applicativi indipendenti in aree scorrelate: è tecnicamente più plausibile un problema di latenza/carico su Supabase Auth durante un run di 44 minuti con centinaia di login concorrenti sugli stessi 3 account fissi. **Non classificato come pre-esistente né come gap noto** perché nessun documento lo copre esplicitamente — resta un'ipotesi tecnica, non un fatto verificato.

**(c2) Potenziali BLOCKER reali, non spiegati da nessun documento — 97**: distribuiti su `tests/nextgen/*` (la maggioranza — Family Planner 5.1-5.7, Profilo Sprint 6, Search, Community, Tap-feedback, Planner Organizzazione), `tests/gestore/*` (invites, richieste, attivita, profilo-centro, report-presenze, prenotazioni), `tests/genitori/*` (attivita, cerca, home-planner, profilo, home), più 2 fallimenti isolati in `tests/one/walkthrough-partner.spec.ts` (TC-N414/N415, con un'ipotesi specifica: probabile stato del Walkthrough già avanzato da un'esecuzione precedente dello stesso test contro lo stesso account reale, per via della persistenza reale introdotta apposta da DEC-35 — non verificabile con certezza dal solo log). Elenco completo dei 137 (con questa classificazione riga per riga) conservato nella cronologia di questa sessione; non riprodotto qui per intero per leggibilità del documento, disponibile su richiesta.

**Perché (c2) non viene ridotto per assunzione**: nessuno di questi 97 test è in un'area toccata da codice TRAMA ONE (verificato). Questo però prova solo "non è una regressione introdotta da questo progetto", non prova "è innocuo per il lancio" — potrebbe trattarsi di debito NextGen/Legacy mai scoperto prima (la suite completa non era mai stata eseguita), oppure di test fragili. La baseline stessa impone di non derubricarli senza verifica.

### 8.3 Anomalia: 70 test "did not run"

Il totale 137+301+374+70 = 882 quadra con il numero di test della suite, ma 70 non hanno mai prodotto un verdetto pass/fail/skip. Nessun messaggio di crash/OOM/timeout globale trovato nel log testuale. **Non è stato possibile identificare quali test esatti siano coinvolti**: l'unico artefatto che l'avrebbe permesso (`playwright-report/results.json`, generato dal run) è stato sovrascritto da un run successivo più piccolo prima che questa analisi potesse leggerlo (confermato: il file oggi presente nel repository corrisponde a un run di soli 2 test, non ai 882 del run analizzato). Corretto per il futuro con DEC-45 (archiviazione automatica del report, vedi §9), ma per QUESTO run specifico il dato è perso in modo permanente.

## 9. Modifiche di codice associate a questo documento

A differenza degli sprint precedenti, questo audit ha prodotto una modifica tecnica minima e strumentale, non una nuova capability:

- **`test-deploy.sh`**: aggiunta archiviazione automatica di `playwright-report/` in `playwright-report-archive/<timestamp>/` subito dopo ogni run, prima che il run successivo lo sovrascriva (DEC-45). Nessun impatto su deploy/build/test stessi — solo preservazione di un artefatto che oggi si perde silenziosamente.
- **`.gitignore`**: aggiunta `playwright-report-archive` (stesso trattamento di `logs/`/`playwright-report/`, mai committata).

## 10. Commits and Files

**Documentazione prodotta/aggiornata da questo Integration Gate**: `docs/trama-one/analysis/PRE_EXISTING_TEST_FAILURE_BASELINE.md` (aggiornato con dati reali), `docs/trama-one/analysis/DECISION_LOG.md` (DEC-44, DEC-45), questo file.

**Evidence Patch (29/07/2026, sera, §16)**: aggiornamento di questo stesso file (revisione conclusione a READY WITH CONDITIONS) e di `docs/trama-one/analysis/SPRINT_GOVERNANCE.md` (backlog vincolante Sprint 6, §16.6) — nessun file applicativo toccato.

**Codice modificato**: `test-deploy.sh`, `.gitignore`.

**File intenzionalmente non modificati**: nessun file applicativo di Sprint 1-4 toccato da questo gate — è un audit, non uno sprint di sviluppo.

## 11. Risks

- **Rischio Alto, aperto**: 97 fallimenti non classificati (c2) — potenziali blocker reali per il lancio, mai investigati singolarmente. Nessuna evidenza che siano causati da TRAMA ONE, ma nessuna evidenza che siano innocui.
- **Rischio Alto, aperto**: 70 test "did not run" di identità sconosciuta — potrebbero contenere ulteriori fallimenti non ancora scoperti. L'evidenza per identificarli con certezza è persa per questo run specifico.
- **Rischio Medio, aperto**: 14 fallimenti (c1) attribuiti a probabile flakiness di login sotto carico — ipotesi tecnica ragionevole ma non verificata con un run isolato mirato.
- **Rischio Basso, chiuso per il futuro**: perdita dell'artefatto `playwright-report/results.json` tra un run e il successivo — chiuso da DEC-45 (archiviazione automatica), ma il run del 27/07 resta senza quel dettaglio.
- **Rischio Basso, informativo**: la baseline storica "7 fallimenti pre-esistenti" era sottostimata (14 confermati, considerando i 2 browser) — non è un peggioramento, è una correzione di stima, ora con dati reali invece di una previsione qualitativa.

## 12. Rollback

Non applicabile in senso stretto: questo documento non introduce funzionalità da annullare. L'unica modifica di codice (`test-deploy.sh`, archiviazione report) è reversibile rimuovendo il blocco aggiunto, senza alcun impatto su dati o funzionalità applicative.

## 13. Piano di chiusura — cosa manca prima di "READY"

L'Integration Gate resta **CONDITIONAL** finché non sono completati questi passi, in ordine di priorità:

1. **Ri-eseguire `TEST_SCOPE=all`** con l'archiviazione del report ora attiva (DEC-45), per avere finalmente l'elenco esatto dei "did not run" e confermare se i 97 (c2) si ripetono identici, cambiano, o si riducono. Azione di Fabrizio (nessun run Playwright è mai eseguito da Claude).
2. **Investigare isolatamente il cluster (c1)** — 14 test con timeout su `loginAs()` — rilanciando solo quei file/test singolarmente per confermare o smentire l'ipotesi di flakiness da carico, prima di escluderli definitivamente dal conteggio blocker.
3. **Triage puntuale dei 97 (c2)** — non è ragionevole né onesto richiedere di correggerli tutti prima di procedere: la priorità è distinguere, test per test, quelli che sono debito Legacy/NextGen già esistente ma mai scoperto (da aggiungere alla baseline come nuove aree, con lo stesso trattamento delle 5 aree già note) da quelli che sono davvero bug attuali da correggere. Questo triage richiede l'HTML report dettagliato (`npx playwright show-report` sull'archivio del prossimo run), non solo il log testuale.
4. **Applicare `migration_15_identity_verification_storage.sql`** (gap P0 MVP separato da questo gate, ma comunque in sospeso) prima che l'upload del documento di verifica identità funzioni in produzione.

**Nessuno di questi 4 punti richiede nuovo codice applicativo**: sono verifica, triage e un'applicazione di migrazione già pronta. Non blocca l'avvio di Sprint 5/6 in parallelo (nessuna dipendenza tecnica tra questo gate e il lavoro di CenterLead/referral o Command Center), ma **blocca la dichiarazione formale "Sprint 1-4 chiusi con successo"** richiesta da DEC-30, per lo stesso principio di onestà che governa l'intero progetto.

## 14. Audit Conclusion (stato originale, 27/07 — superato da §15)

**AUDIT STATUS: CONDITIONAL — non READY.**

Tutto lo scope tecnico di Build Sprint 1-4 è implementato, verificato staticamente e documentato sprint per sprint. Il primo run reale della suite completa (mai eseguito prima d'ora, per decisione di governance) ha però rivelato una quantità di fallimenti (97) e di esiti sconosciuti (70) che nessun documento esistente permette di derubricare come innocui. Questo NON significa che Sprint 1-4 contengano regressioni: nessuno dei fallimenti non spiegati ricade in codice toccato da TRAMA ONE. Significa che, ad oggi, l'affermazione "l'Integration Gate è superato" non è supportata da prove sufficienti — e questo documento, seguendo lo stesso principio di onestà applicato in ogni checkpoint precedente di questo progetto, non la fa comunque.

## 15. Gate F — Chiusura finale (29/07/2026)

Il piano di chiusura al §13 aveva 4 punti. Stato di ciascuno, a oggi:

1. **Ri-eseguire `TEST_SCOPE=all` con l'archiviazione attiva** — fatto, ripetutamente (Gate C, sette run successivi tra 28/07 e 29/07, ognuno archiviato in `playwright-report-archive/`). L'ultimo run (decima ondata, 29/07 16:15, "che sia l'ultimo" per direttiva esplicita di Fabrizio): **16 failed, 2 flaky, 237 passed, 147 skipped, 39 did not run (16.3m)** — sceso da 137 failed/70 did not run/374 passed del run originale del 27/07. La causa dei "did not run" non è più un'incognita: sono skip legittimi/dipendenti da precondizioni non soddisfatte in quel run specifico (es. account già in uno stato che salta un ramo del test), non fallimenti nascosti — confermato dal fatto che il totale did not run è sceso in modo coerente con l'aumento dei passed a ogni ondata di fix, mai in modo anomalo.
2. **Investigare isolatamente il cluster (c1) — 14 timeout su `loginAs()`** — Gate B (`docs/trama-one/analysis/GATE_C_TRIAGE_20260728.md`, harness fix) ha chiuso la causa: fix minimi al harness (fixtures/roles, parallelismo). Non più un cluster distinto nei run successivi.
3. **Triage puntuale dei 97 (c2)** — questo È stato il lavoro di Gate C, in dieci ondate successive documentate integralmente in `GATE_C_TRIAGE_20260728.md`. Ogni fallimento è stato ricondotto a una causa precisa: selettori HARNESS troppo ampi o fragili (la maggioranza), dati di test accumulati mai ripuliti (esteso `cleanup-test-data.mjs` più volte), test obsoleti rispetto a UI evoluta, un blocker di dato reale (tabella `activity_certifications` mai migrata — risolto con `migration_16`), un blocker di configurazione reale (override `TRAMA_ONE_ENABLED` scaduto, disattivava silenziosamente TRAMA ONE in produzione per tutti — risolto da Fabrizio), e un numero limitato di veri bug applicativi (TC-070 `MenuItem.tsx`, TC-127 `LoginForm.tsx`, TC-N64/N66) tutti corretti con commit dedicati. Il residuo dei 16 failed/2 flaky dell'ultimo run è interamente classificato (vedi "Decima ondata" in `GATE_C_TRIAGE_20260728.md`): nessuno tocca login, prenotazione core, pagamenti o sicurezza/RLS; il sottoinsieme più solido (TC-N414/415, walkthrough Partner) è un candidato a bug reale di persistenza ma isolato a una singola feature Sprint 2 non core, non un blocker.
4. **Applicare `migration_15_identity_verification_storage.sql`** — fatto (Gate A, task #365), confermato deployato e funzionante.

**Tutti e 4 i punti del piano di chiusura sono completati.** Il gate cumulativo Gate A→F (procedura migrazione → harness → triage → scope critical → mappa dominio → chiusura) ha portato la suite da 137 failed/70 did not run/374 passed (27/07) a 16 failed/2 flaky/237 passed/39 did not run (29/07), con classificazione esplicita e motivata di ogni singolo item residuo — nessuno lasciato "misterioso" o non spiegato, in linea col principio di onestà di questo progetto.

**AUDIT STATUS: READY** — con debito noto e tracciato, non bloccante (stato del 29/07, mattina — **rivisto da §16**, vedi sotto):
- 4 rischi Beta già segnalati in `CORE_DOMAIN_SOURCE_OF_TRUTH.md` (Gate E): Capacity a tripla fonte di verità (rischio MEDIO, nessun bug oggi), stato onboarding implicito per centri legacy (BASSO), naming Request/Inquiries (BASSO), notifiche email fire-and-forget (BASSO).
- Residuo Playwright non bloccante: cluster sospetto di latenza Vercel/Supabase sotto carico concorrente (`tests/nextgen/*`, mai confermato con evidenza diretta) + TC-N414/415 (walkthrough Partner, Sprint 2, non core) — entrambi da tenere monitorati in run futuri, nessuno dei due impedisce l'uso in produzione delle funzionalità Sprint 1-4.

Questo aggiorna e sostituisce la conclusione CONDITIONAL del §14. **Nota (29/07, sera): questa conclusione READY era prematura sul perimetro effettivamente testato — vedi §16 per la revisione onesta a READY WITH CONDITIONS.**

## 16. Evidence Patch (29/07/2026, sera) — chiarimenti puntuali richiesti da Fabrizio dopo §15

Fabrizio ha approvato la sostanza della chiusura Gate F ma ha richiesto un'evidence patch mirata su 7 punti precisi, non un nuovo sprint di stabilizzazione né un permesso di ri-triage. Di seguito le risposte, punto per punto, con solo evidenza verificata (nessuna inferenza numerica non supportata).

### 16.1 Discrepanza 882 vs 441 — perimetro chiarito

I due numeri **non sono confrontabili**: sono perimetri diversi, non un risultato migliore/peggiore.

- **882** (run originale, 27/07, `logs/deploy-20260727-152424.log`): "Running 882 tests using 4 workers" — 441 test × **2 project** (`chromium` + `mobile-chrome`, confermato: l'indice 441 nel log segna esattamente il confine chromium→mobile-chrome).
- **441** (tutti i run dal 29/07 mattina in poi, incluso il run "decima ondata" di §15): stesso identico set di 441 test, ma su **1 solo project** (`chromium`). Confermato confrontando la lista `config.projects` negli archivi di `playwright-report-archive/` prima e dopo le 09:47 del 29/07: il comando `TEST_SCOPE=all` (e `TEST_SCOPE=critical`) è passato a chromium-only di default a partire dal task #387 (29/07), richiede `INCLUDE_MOBILE=1` per includere di nuovo `mobile-chrome`.
- **Nessun run separato su mobile-chrome esiste dopo il fix del flag**: l'ultimo run che ha incluso `mobile-chrome` è `playwright-report-archive/20260729-094746/`, precedente al fix dell'override scaduto e alla maggior parte dei fix Gate C — quindi **stale**, non rappresentativo dello stato attuale. In quel run, mobile-chrome mostrava 118 unexpected contro i 72 di chromium nello stesso run — un tasso di fallimento sistematicamente più alto, mai triagiato nemmeno allora.
- **Non ripeto l'intera suite**: per la direttiva esplicita di Fabrizio ("non rilanciare tutta la suite a meno che non ci sia davvero nessuna evidenza sull'altro browser"), e poiché è vero che manca evidenza fresca su mobile-chrome, la richiesta minima e sufficiente è **una sola esecuzione mirata**: `INCLUDE_MOBILE=1 TEST_SCOPE=critical bash test-deploy.sh` — chromium e mobile-chrome sui soli 18 journey critici, non gli 882/441 test completi. Questo comando è **da eseguire da Fabrizio**, non da me.

### 16.2 `TEST_SCOPE=critical` — documentazione esplicita

Unico run archiviato con questo scope: `playwright-report-archive/20260729-151428/`.

- **Comando eseguito**: `TEST_SCOPE=critical bash test-deploy.sh` (chromium-only, default pre-`INCLUDE_MOBILE`).
- **Browser/project**: solo `chromium`.
- **Conteggi**: 132 test totali — 76 expected (passed), 52 skipped, 3 unexpected (failed), 1 flaky.
- **Commit testato**: precedente al fix dell'override `TRAMA_ONE_ENABLED` (i 3 unexpected di quel run sono, con alta probabilità, proprio TC-N407/408/409 nella loro forma pre-fix — coerente con la causa radice poi risolta lo stesso giorno) — **quindi questo run è stale rispetto a HEAD attuale**, non utilizzabile come prova di stato corrente.
- **Ambiente**: `https://buddykids-app.vercel.app`.
- **Condizione posta da Fabrizio per procedere** ("critical journeys verdi su tutti i browser supportati, zero fallimenti su onboarding/catalogo/giorni spot/richiesta/risposta Partner/Booking/Planner Sync/capacità/RLS"): **non pienamente verificabile con l'evidenza disponibile oggi** — nessun run `TEST_SCOPE=critical` esiste successivo al fix del flag e ai fix Gate C su ENTRAMBI i browser contemporaneamente. Il run "decima ondata" (`TEST_SCOPE=all`, chromium-only) copre sì i journey critici post-fix, ma solo su chromium. Su mobile-chrome, l'ultima evidenza è stale e mai triagiata.
- **Azione richiesta**: lo stesso comando indicato in §16.1 chiude anche questo punto.

### 16.3 I 39 "did not run" — identificazione precisa da `results.json`

Fonte: `playwright-report-archive/20260729-161559/results.json` (run "decima ondata"), analizzato programmaticamente (non per inferenza numerica): ogni test con status finale `skipped`, **zero annotazioni** (né `type:'fixme'` né `type:'skip'` con motivo) e `workerIndex: -1` su tutti i tentativi — segno che il test è stato pianificato ma mai assegnato a un worker, perché un test precedente nello STESSO file ha mandato in crash/hang il worker/browser, e tutti i test successivi nel file sono stati abbandonati dall'orchestratore.

| File | N. test abbandonati | Test che ha causato il crash | File è in `CRITICAL_TEST_FILES`? | Impatto su journey critici |
|---|---|---|---|---|
| `tests/genitori/prenotazione.spec.ts` | 12 | TC-159 | **Sì** | Nessuno: TC-108/109/110/111/112 (creazione prenotazione, il journey critico vero e proprio) sono posizionati PRIMA di TC-159 nel file e sono tutti passati prima del crash. I 12 abbandonati sono tutti test non-critici di "Le mie prenotazioni" (dashboard/filtri). |
| `tests/genitori/profilo.spec.ts` | 5 | TC-147/area TC-134 | No | Nessuno (file non critico). |
| `tests/gestore/richieste.spec.ts` | 2 | TC-178 | No | Nessuno (file non critico). |
| `tests/nextgen/family-planner-5-3.spec.ts` | 12 | TC-N57 | No | Nessuno (file non critico). |
| `tests/nextgen/family-planner-5-5.spec.ts` | 8 | TC-N73 | No | Nessuno (file non critico). |
| **Totale** | **39** | — | — | — |

**Conferma esplicita richiesta da Fabrizio**: nessun journey critico è stato lasciato senza un esito in questo run, per i "did not run" propriamente detti. L'unica eccezione — distinta e già tracciata separatamente, NON un "did not run" — è TC-N409, che in questo stesso run ha prodotto un FALLIMENTO reale (non un'astensione), poi corretto con il commit `e5e1a9a` ma **non ancora riverificato da un run live successivo**: resta l'unico gap concreto sui journey critici, ed è chiuso dallo stesso comando richiesto in §16.1/16.2.

Non è stato "corretto" nulla dei 39: sono skip legittimi nel senso tecnico (conseguenza di un crash a monte nello stesso file, non un bug nei test abbandonati stessi), coerentemente con l'istruzione di Fabrizio di non "aggiustare" skip legittimi.

### 16.4 Stato repository/produzione

- **HEAD attuale**: `e266373`, branch `main`, working tree pulito (`git status --short` vuoto).
- **Commit deployato in produzione**: `8c8273d` (confermato da `logs/deploy-20260729-145549.log`, `e6bee1d..8c8273d main -> main`).
- **Commit su cui è girato l'ultimo test reale ("decima ondata")**: `8c8273d` (nessun commit applicativo tra il deploy e quel run).
- **Diff tra deployato (`8c8273d`) e HEAD (`e266373`)**: `git diff --stat 8c8273d..e266373 -- app/ lib/ components/ supabase/` → **vuoto, zero righe**. L'unico diff riguarda `tests/one/onboarding-remediation.spec.ts`, `tests/one/smoke.spec.ts` e 2 file di documentazione (`GATE_C_TRIAGE_20260728.md`, questo stesso file). **Conclusione**: il comportamento dell'app live è invariato e coerente con tutto ciò che è stato testato/documentato; solo asserzioni di test e documentazione sono evolute dopo l'ultimo deploy — non serve un nuovo deploy prima del prossimo run di verifica.
- **Elenco sintetico commit Gate A→F** (non esaustivo di ogni micro-commit, solo i marcatori di gate): Gate A `migration_15` + task #365 (identity verification storage); Gate B harness fixes (`fixtures/roles.ts`, parallelismo); Gate C dieci ondate di triage (`GATE_C_TRIAGE_20260728.md`), inclusi `03e6dce` (migration_16), i fix flag/override, `08e66e5`/`7671691`/`e5e1a9a` (TC-N409 + rewrite smoke test); Gate D scope critical chromium-only default; Gate E `CORE_DOMAIN_SOURCE_OF_TRUTH.md` (mappa 10 domini); Gate F `e266373` (chiusura §15 + questo evidence patch).
- **Ambiente**: `https://buddykids-app.vercel.app`.

### 16.5 Registrazione `migration_16`

- **File**: `supabase/migration_16_activity_certifications.sql`.
- **SHA-256**: `1931027b640523254b6fa66ab37082872a602cbdbbb0c5494c4f769c90c60713`.
- **Commit**: `03e6dce`.
- **Oggetti creati**: tabella `activity_certifications` (certificazioni attività, gap emerso durante Gate C triage).
- **RLS/policy**: RLS abilitata, 5 policy presenti (verificato via query read-only diretta a Supabase, progetto `eagsgfxunwyyxwwilldy`).
- **Data/ambiente di applicazione**: applicata in produzione da Fabrizio durante Gate C (29/07).
- **Post-check**: query read-only di verifica eseguita oggi — `table_exists: true, rls_enabled: true, policy_count: 5, row_count: 1`. Tabella esiste, RLS attiva, almeno una riga reale presente.
- **Esito**: **migration_16 è confermata applicata e funzionante in produzione.** Nessuna azione di rollback necessaria.

### 16.6 Backlog Sprint 6 — 4 item vincolanti inseriti

Inseriti verbatim in `docs/trama-one/analysis/SPRINT_GOVERNANCE.md`, nuova sottosezione "Backlog vincolante di Sprint 6" sotto la sezione Sprint 6 esistente: P1 Capacity a tripla fonte di verità (servizio canonico, invarianti, reservation/release, test); P1 feature flag override expiry (visibilità Admin, alert, telemetria, prevenzione fallback silenzioso); P2 notifiche email fire-and-forget (stato di consegna, logging, retry minimo); P2 TC-N414/N415 persistenza Walkthrough Partner. Commit separato da questo file (vedi §10 aggiornato, prossimo commit).

### 16.7 Conclusione rivista — AUDIT STATUS: READY WITH CONDITIONS

Applicando i criteri espliciti posti da Fabrizio per mantenere "READY" (perimetro chiarito ✅; suite critical verde su TUTTI i browser supportati ⚠️ non verificabile — manca evidenza fresca su mobile-chrome; i 39 did-not-run identificati ✅; nessun journey critico senza esito ✅ con l'eccezione tracciata di TC-N409; HEAD e deploy allineati ✅; migration_16 applicata e verificata ✅): **non tutte le condizioni sono soddisfatte**. Mancano esattamente due evidenze, entrambe chiuse dallo stesso singolo comando:

**`INCLUDE_MOBILE=1 TEST_SCOPE=critical bash test-deploy.sh`** — da eseguire da Fabrizio (nessun run Playwright è mai eseguito da Claude). Questo run: (a) fornirebbe la prima evidenza fresca sui journey critici su `mobile-chrome` dopo tutti i fix Gate C; (b) riverificherebbe il fix `e5e1a9a` di TC-N409 su chromium, l'unico fix di questo intero ciclo mai confermato da un run live.

**AUDIT STATUS: READY WITH CONDITIONS.** Non READY incondizionato, per lo stesso principio di onestà di questo progetto: dichiarare "verde su tutti i browser supportati" senza avere quell'evidenza violerebbe la condizione posta esplicitamente da Fabrizio stesso. Le condizioni sono 2, precise, non bloccanti per l'avvio di Sprint 5 (nessuna dipendenza tecnica: CenterLead/referral non tocca capacità/flag/onboarding), e tracciate qui per la chiusura definitiva quando il run sopra sarà disponibile.
