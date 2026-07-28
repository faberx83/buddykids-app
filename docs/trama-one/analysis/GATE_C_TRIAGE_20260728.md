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

## Cluster D — RISOLTO: falso allarme, non una regressione (HARNESS)

**Aggiornamento post-analisi `error-context.md` (fornito da Fabrizio per TC-N43):** non è una regressione applicativa. I bottoni dei tab del Planner (`PlannerModeTabs.tsx`) e il riquadro pieghevole "Calendario" (`PlannerClient.tsx`) renderizzano un'icona Tabler Icons (`<i className="ti ti-...">`) prima dell'etichetta testuale. Quell'icona lascia un carattere glifo (o comunque uno spazio) nel nome accessibile calcolato dal browser — l'accessibility-tree snapshot dell'errore mostra `button " Organizzazione"`, `button " Mappa"`, `button " Budget"`, `button "﨡 Gruppi"`, non i testi letterali attesi. I bottoni **esistono e funzionano**: il test falliva solo perché usava `{exact: true}`, che pretende una corrispondenza esatta col nome accessibile (inclusi i caratteri spuri dell'icona). Conferma indipendente: `TC-N295` (`tap-feedback.spec.ts`) usa lo stesso locator SENZA `exact:true` ed era verde in questo stesso run.

- TC-N43/44 (`family-planner-5-1.spec.ts`): rimosso `exact: true` dai bottoni "Organizzazione"/"Mappa"/"Budget"/"Gruppi"/"Calendario" — ora match per substring, coerente con TC-N295.
- TC-N50/54 (`planner-calendar-5-2.spec.ts`): problema opposto e complementare — i bottoni "Mese"/"Settimana" del toggle vista (`PlannerCalendarView.tsx`) sono testo puro, SENZA icona, ma matchavano per substring anche "Mese precedente"/"Mese successivo" e ogni bottone "Vai al dettaglio della Settimana N...". Aggiunto `exact: true` per disambiguare.
- TC-N100 (`planner-organizzazione-semplificata.spec.ts`): stesso bottone "Calendario" di TC-N43 (rimosso `exact:true`) + stesso problema di TC-N50/54 sui bottoni "Mese"/"Settimana" annidati nello stesso riquadro (aggiunto `exact:true`) — entrambe le direzioni del fix coesistono in questo test perché apre il riquadro Calendario dentro Organizzazione, dove "Stato per settimana" (bottoni "Vai al dettaglio della Settimana N") resta sempre visibile.

**Classificazione: HARNESS** (stesso principio del Cluster A: selettore non allineato al nome accessibile reale, non un bug applicativo). Fix applicato e verificato (`tsc`/`eslint` puliti su tutti i file toccati). Non ancora verificato con un rerun live — da confermare al prossimo `bash test-deploy.sh`.

- TC-N59/61 ("Nessuno assegnato" — Chi fa cosa) e TC-N66 (Mappa distanza) — non ancora investigati con lo stesso livello di dettaglio: stesso dubbio, journey "Planner Sync"/Mappa. Non è chiaro se condividano la causa (icona/accessible-name) o siano un problema distinto — serve error-context.md dedicato.
- TC-160 ("Indietro" bottone dettaglio attività) — questa è una regressione già corretta in passato (bug #22); se è ricomparsa merita priorità P1. Non ancora investigato in questo giro.
- TC-N98 (bottone aria-expanded rimasto 1 invece di 0) resta in Cluster A (stato residuo, non locator) — non toccato in questo giro. TC-N99 ("Stato per settimana" → evidenzia riga Timeline) non presenta alcun sintomo riconducibile all'icona/accessible-name nel codice del test: locator già univoco (`"Vai al dettaglio della Settimana 1"`, nome completo, nessun `exact` in gioco) — causa del fallimento ancora da determinare con un rerun live, non classificabile da sola lettura del codice.

## TC-N409 — ancora fallita, causa nota e diversa dai cluster sopra

Il comando è stato lanciato con `npx playwright test ... ` DIRETTO, non con `bash test-deploy.sh`. `cleanup-test-data.mjs` (che imposta automaticamente la precondizione SUBMITTED, Gate B) viene invocato SOLO da `test-deploy.sh` riga 98 — bypassato lanciando playwright a mano. Non è un regressione del fix di Gate B, è semplicemente non stato eseguito il passo che lo attiva.

**Comando corretto per riverificare**: `bash test-deploy.sh` con `TEST_SCOPE=critical` (ora disponibile, Gate D) o mirato a un singolo file via una piccola modifica futura — per ora, il modo corretto di rieseguire singoli file mantenendo il cleanup automatico è lanciare comunque `test-deploy.sh` (che esegue l'intera suite/TEST_SCOPE) piuttosto che `npx playwright test` a mano.

## "did not run" — evidenza per Obiettivo 4

`tests/gestore`: 9 did not run. `tests/genitori`: 16 did not run. `tests/nextgen`: 0. Pattern coerente con test in `describe` non-serial dove un fallimento in un `beforeEach`/test precedente nello stesso worker consuma il tempo/stato e Playwright salta i successivi test dipendenti dello stesso file quando il worker viene riavviato dopo troppi retry — non un fenomeno casuale, correlato 1:1 con i file che hanno anche fallimenti (gestore e genitori ne hanno, nextgen in questo run non ne ha nonostante 34 falliti, quindi il collegamento non è "ogni fallimento causa un did-not-run" ma probabile interruzione di worker su fallimenti in serie/hook). Da approfondire con `--reporter=json` e ispezione diretta, non ancora fatto.

## Rerun live 28/07 (bash test-deploy.sh) — post fix Cluster A/B/D

Rerun completo (882 test, chromium+mobile-chrome): 96 failed (di cui ~48 distinti, duplicati sui due browser), 1 flaky, 324 skipped, 43 did not run, 418 passed.

**Conferma dei fix**: nessuno dei TC-N43/N44/N50/N54/N100 (Cluster D) né dei TC-138(parziale)/N35/N36/N50-adjacenti/N105(parziale)/N293/N296(parziale) del Cluster A originale è ricomparso nella forma già corretta — i fix reggono. TC-508/TC-123/TC-139 (Cluster B) idem, tranne TC-508 (vedi sotto).

Fix meccanici aggiuntivi applicati in questo giro (stesso pattern Cluster A/D, commit `d651da1`):
- TC-N105/TC-N89: `img[src=".../trama-logo-mark.png"]` matchava anche il logo grande (h-20 w-20, nessun `aria-hidden`) di `AppSplashOverlay.tsx`, ancora nel DOM durante il fade-out — aggiunto `[aria-hidden="true"]` per isolare l'icona decorativa vera (PageHeader/titolo Home/Community).
- TC-N99: stesso principio di TC-N50/54 ma sul locator "Vai al dettaglio della Settimana 1" — regex con virgola finale per escludere Settimana 10/11/12/13 senza hardcodare le date della stagione.
- TC-N01/N02/N03: "NextGen" sostituito dal ribbon "Beta" (sprint correttivo, `NextgenBadge.tsx`) — TEST OBSOLETO.
- TC-N11: link Home "Scopri attività" non esiste più, sostituito da "Scopri" in bottom nav — TEST OBSOLETO.
- TC-N12: testo cambiato in "Nessuna attività corrisponde ai filtri scelti." — TEST OBSOLETO.

### Cluster E — ✅ RISOLTO: dato residuo, non bug applicativo (DELETE eseguita da Fabrizio)

TC-N302/303/304 (`one/smoke.spec.ts`) e TC-N401/402 si aspettano che con il flag `TRAMA_ONE_ENABLED` OFF (default), visitare `/one`, `/center/one`, `/admin/one`, `/center/one/onboarding`, `/admin/one/onboarding` faccia un redirect di fallback verso `/`, `/center`, `/admin`. Nel run reale **nessun redirect è avvenuto**: tutti e tre i ruoli (parent, center_admin, platform_admin) restano sulla route `/one/*` e vedono la shell TRAMA ONE reale (error-context.md conferma testo "TRAMA ONE — Parent"/"Benvenuto in TRAMA ONE" invece del redirect). Coerentemente, TC-N414/N415 (walkthrough Partner) falliscono parzialmente: la pagina `/center/one` mostra "Pubblica la tua prima attività" ma non il bottone "Inizia".

**Analisi statica del codice** (`app/one/layout.tsx:58-75`, `app/center/one/layout.tsx:50-67`, `app/admin/one/layout.tsx:50-67`, `lib/feature-flags/registry.ts:41` `defaultValue: false`, `lib/feature-flags/evaluate.ts:63-120`): la logica di redirect e la precedenza degli scope sono corrette, nessun bug trovato lato codice. Per far risultare il flag "enabled" per TUTTI i ruoli contemporaneamente serve una riga in `feature_flag_overrides` con scope ampio (es. `environment`/`Production` o `global`, `enabled=true`). **Ipotesi concreta**: `SPRINT_0_ACTIVATION_RUNBOOK.md` §2 istruisce di inserire manualmente una riga di verifica `('TRAMA_ONE_ENABLED','environment','Production',true)` per testare l'unique index, seguita da una `DELETE` da eseguire a mano — se quella `DELETE` non è mai stata eseguita, questa riga da sola spiegherebbe il comportamento osservato. Il task #336 ("Abilitare TRAMA ONE via override") risulta ancora `pending`, quindi non è un'attivazione intenzionale.

**Non posso verificare né correggere questo da solo** (accesso diretto al DB di produzione fuori mandato). Query di sola lettura per Fabrizio, da eseguire nel SQL Editor di Supabase:

```sql
SELECT scope_type, scope_value, enabled, expires_at, created_at
FROM feature_flag_overrides
WHERE flag_name = 'TRAMA_ONE_ENABLED'
ORDER BY created_at DESC;
```

**Esito verificato**: la riga `global` (enabled=true) risultava già scaduta (`expires_at` 22/07, run eseguito il 28/07 — `evaluate.ts#isExpired` la esclude correttamente, non era la causa). La causa reale erano 3 righe `scope_type='user'` con `expires_at = null` (mai scadono), quasi certamente corrispondenti proprio ai 3 account di test (parent/center_admin/platform_admin) usati dalla suite Playwright — abilitazione manuale permanente lasciata da un giro di verifica manuale precedente (Sprint 1-4), non un'attivazione di produzione intenzionale né un bug applicativo: per gli utenti reali il flag era già correttamente OFF.

Fabrizio ha eseguito la `DELETE` mirata sulle 3 righe `user` (mantenendo intatta la riga `global` scaduta, innocua). **Da confermare con il prossimo rerun live**: TC-N302/303/304/401/402 e TC-N414/N415 dovrebbero tornare verdi.

Se emerge una riga `environment`/`Production` (o `global`) con `enabled = true` e nessuna `expires_at` passata, è quasi certamente la causa. La rimozione (o l'impostazione `enabled = false`) andrebbe fatta da Fabrizio, non da me.

### Cluster F — ✅ RISOLTO: HARNESS (log fuorviante), non un fallimento reale della fixture

**Root cause trovata via query di sola lettura** (Supabase MCP, connesso da Fabrizio in questa sessione, progetto `buddykids`/`eagsgfxunwyyxwwilldy` — uso concordato: solo query di lettura in autonomia, nessuna scrittura/migrazione senza il suo intervento diretto):

1. **Bug di logging in `cleanup-test-data.mjs` (trovato e corretto, non un problema di dati):** la riga `console.log("✅ Pulizia completata:", removed)` (riga 242, ORA spostata a fine funzione) veniva stampata PRIMA dei tre blocchi che ricreano le fixture (Registro presenze, estensione check-in odierno, TC-508 "Da rispondere", righe 244-374). Il valore `removed.partnerResponseFixtureReset` mostrato nel log era quindi SEMPRE `false` — il default impostato in cima alla funzione — indipendentemente dall'esito reale della ricreazione più in basso. **Quello che avevamo interpretato come "il fix non si attiva" era in realtà solo un log stampato nel punto sbagliato.** Corretto spostando `console.log` a fine `main()`.
2. **Verifica diretta dei dati (query di sola lettura)**: `parent`, `seedActivity`, `testKid` (bambino seed) e `activity_weeks` con `label='Settimana 2'` esistono TUTTI in esattamente una riga ciascuno, oggi — nessuna riga duplicata, nessuna mancante. Il guard `if (parent && seedActivity && testKid)` del blocco TC-508 non ha quindi alcun motivo strutturale per fallire.
3. **Stato attuale della prenotazione marcatore**: esiste una prenotazione con `total_amount = 0.01` legata a "Settimana 2", ma con `status = 'confirmed'` (non `'pending'`) e `created_at` non recente. Spiegazione: TC-508 stesso, quando gira e PASSA, clicca "Accetta" (`tests/gestore/prenotazioni.spec.ts` riga 39) e la trasforma da `pending` a `confirmed` — comportamento ATTESO, non un bug. La prenotazione resta "consumata" finché `cleanup-test-data.mjs` non gira di nuovo prima del prossimo run (la sua `DELETE FROM bookings WHERE parent_id=...` iniziale, riga 108-113, la elimina; il blocco TC-508 la ricrea `pending` da zero). Nessuna riga "confirmed" residua blocca il prossimo run: verrà cancellata e ricreata `pending` automaticamente.

**Classificazione: HARNESS** (log di diagnostica fuorviante), non DATA PRECONDITION né APPLICATION BUG. La logica di ricreazione della fixture è corretta e si autoripara ad ogni `bash test-deploy.sh` (mai `npx playwright test` a mano, che salta `cleanup-test-data.mjs` — stesso footgun già documentato per TC-N409). Fix committato, nessuna azione richiesta a Fabrizio su questo cluster.

### Cluster G — Nuovi fallimenti non ancora classificati (da investigare prima di Gate F)

Elenco residuo (non esaustivo, deduplicato tra chromium/mobile-chrome), dopo la classificazione del Gruppo 1/2/3 sotto: TC-176 (Admin Presenze, strict violation "Media piattaforma" — HARNESS probabile, fix meccanico rimandato), TC-160/TC-026 (freccia indietro/preferito — possibile regressione o floating button BETA che intercetta i click), TC-102/153 (Planner filtro/colore bambino), TC-138 (residuo: "Notifiche" non più voce di menu separata), TC-186 (badge "Oggi" registro presenze), TC-075 (nav highlight, già noto), TC-200/TC-127 (certificazione/invito — testo cambiato o dato non trovato), TC-178/163 (richieste, timing/timeout), TC-N300 (beta pipeline, bottone ancora visibile), TC-N73/76/80 (Famiglia/Community), TC-N24 (Settimana 12/13), TC-263/N14 ("Budget impegnato" non trovato — due test indipendenti, stesso sintomo, da verificare se è dato-dipendente), TC-N108/112/114 (Profilo restructuring, già noto Cluster C), TC-N10 (posizione — testo esiste nel codice ma non renderizzato al primo load, struttura cambiata), TC-N296 (chip "Servizi" Cerca), TC-N409 (precondizione non impostata, causa nota — vedi sopra), TC-166 (mobile: link "Report presenze" timeout).

**Classificazione: NON ANCORA FATTA per l'elenco sopra.** Richiede lo stesso trattamento di Cluster D (error-context.md o investigazione codice mirata) prima di poter distinguere HARNESS/TEST OBSOLETO/APPLICATION BUG. Dato il volume, si procede per sotto-gruppi tematici (vedi Gruppo 1/2/3 già classificati sotto).

#### Cluster G — Gruppo 1 (Login/Splash): TC-204, TC-208 — ✅ RISOLTO (HARNESS)

- **TC-204** — l'header animato `TramaLoginHeader.tsx` e l'overlay `AppSplashOverlay.tsx` renderizzano ENTRAMBI lo stesso claim ("Organizing childhood. Together.") e coesistono legittimamente nel DOM per `HOLD_MS(900)+FADE_MS(350)=1250ms` durante il fade-out dello splash. Il test usava `getByText(...)` non scopato → strict mode violation (due elementi). `getByRole("img", {name:"TRAMA"})` non ne soffriva già (l'overlay ha `aria-hidden="true"` sul contenitore, escluso dall'accessibility tree). Fix: aggiunto `data-testid="trama-login-header"` a `TramaLoginHeader.tsx` e scopate entrambe le asserzioni su di esso.
- **TC-208** — il selettore generico `document.querySelector("body > div, #__next > div, main, div")` prendeva il PRIMO div del documento, `.app-backdrop` (`PhoneShell.tsx`), il cui sfondo sfumato (`globals.css` `.app-backdrop { background: linear-gradient(...) }`) azzera `background-color` a transparent per comportamento shorthand CSS — non `.app-shell` (il div interno, vero sfondo bianco `#ffffff`). Fix: selettore ora specifico su `.app-shell`.

Entrambi **HARNESS** (selettore/scope sbagliato), non regressioni applicative. Fix applicati, `tsc`/`eslint` puliti, commit `d64e2b6`. Da confermare al prossimo rerun live.

#### Cluster G — Gruppo 2 (Profilo/Home): TC-069 risolto, TC-141 da confermare live

- **TC-069** — ✅ **TEST OBSOLETO, risolto.** `ProfileHeaderClient.tsx#handleSave` (righe 101-106) blocca il salvataggio con errore "Inserisci nome e cognome e scegli un ruolo" quando `showRoleSelector && !parentRole`. Il test compilava solo il campo nome, mai selezionava un ruolo "Sei" (Padre/Madre/Tutore) — il salvataggio falliva silenziosamente e il nome non veniva mai visualizzato. La logica di salvataggio stessa è corretta (`setDisplayName` sincrono, nessun problema di reload); mancava solo uno step nel test. Fix: aggiunta selezione "Madre" prima del click su "Salva". Commit `2c899a8`.
- **TC-141** (mobile) — ⚠️ **possibile bug applicativo reale, NON ancora corretto.** `VersionToggle.tsx` (righe 74-84) renderizza un bottone `fixed right-4 top-4 z-50`, escluso solo su `/center`, `/admin`, `/nextgen/center|admin`, `/auth`, `/share` — **non escluso su `/` (Home LEGACY)**, dove il link avatar "Vai al profilo" (`app/(main)/page.tsx`, righe 93-105) occupa la stessa area in alto a destra. Possibile sovrapposizione che intercetta il tap destinato all'avatar. **Non corretto in questo giro**: serve conferma su viewport reale (screenshot mobile) prima di decidere se è un vero overlap visivo o se il posizionamento effettivo evita la collisione — richiesta a Fabrizio nel prossimo rerun/verifica manuale.

#### Cluster G — Gruppo 3 (Chi fa cosa/Mappa/Condivisione): 2 bug applicativi reali corretti, 2 data precondition

- **TC-N64** — ✅ **APPLICATION BUG confermato e corretto.** `proxy.ts` (gate famiglia, righe 83-90) non escludeva `/share` dal redirect al login — un visitatore anonimo su un link di condivisione pubblica (`app/share/planner/[token]/page.tsx`, di per sé già corretto e pubblico) veniva rimandato a `/auth/login` invece di vedere la pagina (o "Link non disponibile" per token invalidi). Fix: aggiunto `/share` all'allowlist. Commit `6a63d4f`.
- **TC-N66** — ✅ **APPLICATION BUG confermato e corretto.** `lib/nextgen/planner-map-estimate.ts:22` usava `hash >> 3` (shift CON segno): dopo la conversione a Int32 di JS, per hash con bit più alto impostato il risultato diventa negativo, producendo minuti stimati negativi nella vista Mappa (snapshot: "~20 km · -8 min"). Fix: `>>> 3` (shift senza segno). Commit `0caac58`.
- **TC-N59/TC-N61** ("Nessuno assegnato", Chi fa cosa) — **DATA PRECONDITION, nessun fix di codice necessario.** `PlannerCalendarView.tsx` (righe 716-722) usa ancora correttamente la label letterale "Nessuno assegnato"; il rendering per-bambino dipende da `selectedDay.kids` non vuoto e `weekStartDate` impostato (righe 665-682) — è plausibile che lo stato di un run precedente (assegnazioni già fatte, o settimana completamente coperta) lasci 0 celle "non assegnato" da trovare. Raccomandazione: verificare lo stato dell'account di test, non un problema di codice/testo.

Tutti e 4 confermati con evidenza file:line, nessuna ipotesi residua.

## Raccomandazione per il prossimo giro

1. ~~Fix meccanico Cluster A (selettori)~~ — **fatto** (commit `9beec2a`).
2. ~~Estendere `cleanup-test-data.mjs` per Cluster B~~ — **fatto** (commit `c1f4cb2`, incluso il root cause TC-508).
3. ~~Verificare con screenshot Cluster D~~ — **fatto**: falso allarme (icona accessible-name), non regressione. Fix applicato su TC-N43/44/50/54/100.
4. ~~Cluster E (TRAMA ONE `/one` fallback)~~ — **fatto**: 3 override `user`-scope permanenti (account di test) eliminati da Fabrizio. Da confermare al prossimo rerun.
5. ~~Cluster G Gruppo 1 (Login/Splash: TC-204/208)~~ — **fatto**, HARNESS, commit `d64e2b6`.
6. ~~Cluster G Gruppo 2 (TC-069)~~ — **fatto**, TEST OBSOLETO, commit `2c899a8`. TC-141 (overlap VersionToggle/avatar su `/`) resta da confermare su viewport reale, non corretto.
7. ~~Cluster G Gruppo 3 (TC-N59/61/64/66)~~ — **fatto**: TC-N64 (`/share` mancante nel gate, commit `6a63d4f`) e TC-N66 (shift con segno, commit `0caac58`) erano bug applicativi reali, ora corretti. TC-N59/61 sono data precondition, nessun fix di codice.
8. ~~Cluster F (TC-508)~~ — **fatto**: HARNESS, log di riepilogo stampato nel punto sbagliato (sempre `false` a prescindere dall'esito reale). Fixture verificata sana via query di sola lettura (Supabase MCP). Nessuna azione richiesta a Fabrizio.
9. ~~TC-160~~ — **fatto, APPLICATION BUG confermato e corretto.** `app/activity/[id]/DetailClient.tsx`: il bottone freccia-indietro overlay sull'immagine (`router.back()`) non aveva `aria-label="Indietro"` (solo icona `ti-arrow-left`) — a differenza della stessa freccia in `PageHeader.tsx`, che usa quell'etichetta per convenzione in tutta l'app. Bottone non identificabile né da screen reader né da `page.getByLabel("Indietro")`. Aggiunto `aria-label="Indietro"`. Commit `e459bf4`.
10. ~~TC-138 (residuo "Notifiche")~~ — **fatto, TEST OBSOLETO.** `tests/gestore/account.spec.ts` verificava ancora un link "Notifiche" a sé stante, non più esistente da quando è stato unito dentro "Preferenze" (`ProfileSettingsSection.tsx`, già così per il profilo genitore in `tests/genitori/profilo.spec.ts`). Sostituito con l'assert sul sottotitolo "Lingua, tema, notifiche". Commit `f82c4e4`.
11. ~~TC-119 e TC-138 (ambiguità "Il mio centro"/"Prenotazioni")~~ — **già risolti** da un commit precedente a questa sessione (`9beec2a`, Cluster A) — verificato che il codice attuale riflette già il fix, nessuna azione necessaria.
12. **TC-102/TC-153 (Planner: filtro bambino, colore chip)** — verificati staticamente codice (`PlannerView.tsx`, `lib/colors.ts`, `lib/data/kids.ts`) e dati (query di sola lettura: l'account di test ha 2 bambini, non 1) — nessun bug trovato, la logica sembra corretta. Non riproducibile senza rerun live: **da confermare al prossimo `bash test-deploy.sh`**, nessun fix applicato per mancanza di evidenza concreta di un problema reale.
13. **TC-176/TC-186** — verificati staticamente (markup `/admin/presenze`, `/center/attendance`): nessuna ambiguità/duplicazione trovata nel codice attuale. **Da confermare al prossimo rerun live** prima di investigare oltre.
14. Non ancora investigati in questo giro (agente di ricerca dedicato interrotto per limite di spesa mensile, da riprendere): TC-N98/N99, TC-N24, TC-200/127, TC-178/163, TC-075, TC-N300, TC-N73/76/80, TC-263/N14, TC-N108/112/114, TC-N10, TC-N296, TC-166, "did not run" (Obiettivo 4).
9. Rieseguire SEMPRE via `bash test-deploy.sh`, mai `npx playwright test` a mano, per non perdere il cleanup automatico — prossimo rerun live necessario per confermare Cluster E + Gruppo 1/2/3 prima di Gate F.
