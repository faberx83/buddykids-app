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

## Rerun 28/07 (secondo full run, TEST_SCOPE=all diretto) — nuovi elementi

Confermato stabile rispetto al run precedente (stesso identico set di falliti,
Cluster G residuo invariato): TC-176/TC-160/TC-204/TC-208/TC-069/TC-N64/TC-N66
restano risolti, nessuna regressione sui fix già applicati. Novità:

### TC-508 — riaperto: la teoria "si autoripara" (Cluster F) è falsificata dai dati

Cluster F aveva concluso "nessuna azione necessaria, la fixture si ricrea da
sola ad ogni run". **Verificato via query di sola lettura che non è così**: la
prenotazione marcatore (`total_amount=0.01`) è tuttora `status='confirmed'`,
`created_at` **27/07 08:20** — cioè la stessa identica riga vista nel controllo
di Cluster F, mai cancellata/ricreata nonostante almeno due run completi
successivi (28/07). Ho anche verificato che oggi tutte le entità del guard
(`parent`, `gestore.center_id`, `seedActivity`, `testKid`, "Settimana 2")
esistono correttamente — quindi non è un problema strutturale dei dati.

**Causa non ancora isolata con certezza**: ogni lookup Supabase nello script
scartava silenziosamente l'oggetto `error` (solo `data` destrutturato), quindi
un fallimento di rete/permessi sarebbe stato indistinguibile da un "non
trovato" legittimo, senza traccia nei log — e la delete incondizionata delle
prenotazioni del genitore (che dovrebbe comunque rimuovere quella riga del
27/07 a prescindere dal resto) non sembra essere stata eseguita nei run
successivi. Aggiunto log esplicito per ogni lookup/delete coinvolta (commit
`35ccbd5`) — **il prossimo `bash test-deploy.sh` dirà la causa esatta** invece
di doverla ipotizzare. Riclassificato **DATA PRECONDITION, causa in verifica**
(non più HARNESS/nessuna-azione come concluso in Cluster F).

### TC-273 — nuovo, TEST OBSOLETO risolto

Mai comparso nei run precedenti; flaky su mobile-chrome in questo run. Causa
trovata per lettura statica del codice: il test cercava un link
`a[href^="/activity/"]` aspettandosi che una riga Timeline coperta aprisse la
scheda marketing dell'attività — ma il **Task #357** (già completato,
`PlannerClient.tsx` righe 696-724) ha deliberatamente cambiato quel
comportamento: il click su una settimana coperta porta ora a
`/prenotazioni?bookingId=...` (mostra la prenotazione già fatta con
stato/azioni), non più alla scheda marketing. Il test non è mai stato
aggiornato dopo quella modifica: il selettore generico non trovava più alcun
link `/activity/` nella Timeline e in alcuni run agganciava per caso un link
`/activity/` non correlato più in basso in pagina (sezione "Consigliate") —
da cui la flakiness. **Classificazione: TEST OBSOLETO.** Fix applicato: test
scopato a `[id^="week-row-"] a[href^="/prenotazioni?bookingId="]`, asserzione
URL aggiornata. Commit `fc33b28`, tsc/eslint puliti.

### TC-163 — nuovo/intermittente, non ancora risolto

Compare failed su chromium e flaky su mobile-chrome in questo run, mai visto
prima. Il test fa un giro end-to-end con due login reali sequenziali (genitore
poi gestore, context browser separati) sullo stesso worker — non rientra nel
problema di concorrenza già noto di Gate B (quello riguarda login
CONCORRENTI su worker diversi), ma resta comunque un doppio login reale su
account condivisi, con margini di latenza. Nessuna causa applicativa trovata
per lettura statica (`richieste.spec.ts`, `ContactCenterButton.tsx`,
`lib/data/inquiries.ts`): il locator è già scopato al messaggio con timestamp
univoco, non è un problema di dati accumulati. **Ipotesi più probabile:
HARNESS/timing** (stessa famiglia dei fallimenti da latenza Auth già
documentati in Gate B), da confermare con un rerun live mirato
(`TEST_SCOPE=all bash test-deploy.sh -- tests/gestore/richieste.spec.ts` o
simile) prima di decidere se serve un fix (es. `expect.timeout` più alto solo
per questo test, o `retries` dedicati).

## Chiusura Cluster G residuo (28/07, seconda parte)

Triage per lettura statica (codice + confronto test/componente) di tutto
l'elenco residuo del Cluster G. Riepilogo:

**Bug reali nel TEST (HARNESS), corretti:**
- **TC-N80** — `getByText("Le tue Community").locator("..")` risaliva di un
  solo livello DOM, che in `PlannerGroupsView.tsx` è il div che contiene
  ANCHE il link "Vedi tutte"/"Crea o entra" (stesso testo, href
  `/nextgen/community` senza id) — le card Community vere vivono in un div
  fratello sotto. Il test cliccava sempre "Vedi tutte", mai una card.
  Scopato all'href reale (`a[href^="/nextgen/community/"]`). Commit `a9da29d`.
- **TC-N296** — xpath `ancestor::div[contains(@class,'cursor-pointer')]`
  cercava un antenato più in alto con quella classe, ma il chip "Servizi"
  (`SearchDiscoveryClient.tsx`) è esso stesso quel div (nessuno span di
  incapsulamento) — l'asse `ancestor::` esclude il nodo di contesto: 0
  risultati, locator vuoto, timeout. Rimosso l'xpath. Commit `bcaa670`.
- **TC-166** — su mobile-chrome la nav Gestore vive dietro un cassetto
  (drawer) renderizzato in DOM solo a `drawerOpen=true`
  (`DashboardLayout.tsx`); il test cercava il link senza aprire il drawer
  prima. Aggiunta apertura condizionale dell'hamburger. Commit `30efd44`.
- **TC-N300** — confermava una card "in coda per la pipeline" ma asseriva
  `toHaveCount(0)` sul bottone per NOME su tutta la pagina: con più
  segnalazioni ancora in coda, restano bottoni identici sulle altre card e
  l'assert falliva anche a comportamento corretto. Scopato alla card
  specifica. Commit `aec77b1`.

**TEST OBSOLETO, corretti (contraddicevano un redesign successivo già
completato):**
- **TC-N24** — cercava "Settimana 12"/"13" visibili al solo caricamento,
  ma dalla Timeline-per-mese pieghevole (Sprint 2) quel testo esiste solo a
  mese aperto. Aggiunta apertura di tutti i mesi. Commit `975e920`.
- **TC-N14** — asseriva "Budget impegnato sempre visibile" in
  Organizzazione, ma **TC-263** (Sprint correttivo, richiesta esplicita di
  Fabrizio) verifica l'esatto contrario: rimossa da lì, vive solo nel tab
  Budget. I due test erano in contraddizione diretta. Aggiornato TC-N14 per
  aprire il tab Budget. Commit `d5b56e3`.

**Verificati senza trovare alcun bug (codice e test coerenti tra loro),
classificazione invariata "da confermare al prossimo rerun live":**
TC-N98/N99 (copertura per bambino/evidenziazione riga — stato iniziale
pulito, nessuna persistenza sospetta), TC-N73/N76/N77 (Famiglia — guardie
di skip corrette, selettori verificati), TC-N108/N112/N114 (Profilo — hub
card, sotto-pagine e back-nav già allineati al redesign Sprint 7, sembrano
già risolti da un commit precedente a questa sessione), TC-075/TC-200
(Attività/Certificazione — nav highlight e flusso invio verificati, nessuna
ambiguità trovata), TC-127 (Inviti — email univoca per run, nessuna
ambiguità).

**Non risolvibili da soli (richiedono un rerun live mirato):**
- **TC-163/TC-178** (Richieste, entrambi i lati) — pattern identico: due
  login reali sequenziali (genitore poi gestore) nello stesso test. Non
  rientra nel problema di concorrenza già noto di Gate B (quello è su
  worker diversi), ma resta un doppio login reale su account condivisi.
  Nessuna causa applicativa trovata per lettura statica. Ipotesi più
  probabile: HARNESS/timing.

**Non ancora affrontato in questo giro:** "did not run" (Obiettivo 4) —
richiede ispezione diretta di `playwright-report/results.json` da un rerun
live, non deducibile da sola lettura del codice.

**Nota collaterale (non nell'elenco originale, stessa causa di TC-N24):**
**TC-N13** ("mostra la timeline completa delle 13 settimane") assume
"Settimana 1"/"Settimana 13" visibili al solo caricamento pagina, ma solo
UN mese è espanso di default (quello della settimana prioritaria) — quasi
certamente soffre dello stesso problema di TC-N24 già corretto sopra. Non
era nell'elenco dei falliti riportato da Fabrizio in questo run (forse
già falliva altrove senza essere notato, o il mese di default copre per
coincidenza una delle due). Da tenere d'occhio al prossimo rerun; non
corretto qui per restare scoped all'elenco Cluster G originale.

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

## Seconda ondata (28/07, sera) — primo run full-suite riuscito dopo fix chiave API

Root cause diverso da tutto quanto sopra: `SUPABASE_SERVICE_ROLE_KEY` in `.env.test` era scaduta/invalida sulla macchina di Fabrizio. `cleanup-test-data.mjs` falliva silenziosamente su OGNI lookup ("Invalid API key") ma terminava comunque con exit 0 (solo `data` veniva distrutturato dalle risposte Supabase, non `error` — bug di logging aggiunto e poi corretto in `cleanup-test-data.mjs`, commit `35ccbd5`), stampando un riepilogo finale con contatori a zero/fixture non ricreate. Questo significa che **diverse conclusioni "no bug/HARNESS" di questo documento erano basate su run con cleanup di fatto NON eseguito** — i dati di test non venivano mai resettati tra un run e l'altro.

Fabrizio ha rigenerato la chiave dal dashboard Supabase e rilanciato `TEST_SCOPE=all bash test-deploy.sh`: cleanup riuscito end-to-end (bookings, groups, invites, extraKids, extraActivities, testCentersDeleted ripuliti con contatori reali; fixture Registro presenze/check-in/TC-508 ricreate). Risultato suite: **58 failed, 6 flaky, 324 skipped, 38 did not run, 456 passed (48.6m)** — il primo numero davvero attendibile di questo sprint interlocutorio.

Di questo nuovo elenco, analizzati e corretti in questo giro:

- **TC-508** — ancora falliva nonostante la fixture fosse correttamente ricreata (`partnerResponseFixtureReset: true`). Causa reale: con il cleanup ora funzionante esistono STABILMENTE 2 righe per la stessa attività di test (fixture Registro presenze già accettata + fixture "Da rispondere" appena creata). `getBookingsForCenter` (`lib/data/center-bookings.ts:169`) ordina per `created_at` DESC, quindi la riga più recente (il marcatore pending) è la PRIMA nel DOM — `.last()` prendeva sempre la più vecchia, già accettata, senza bottone "Accetta" → timeout. **HARNESS**, non bug applicativo. Fix: filtro aggiuntivo su "Da rispondere" invece di affidarsi all'ordine. Commit `0894782`.
- **TC-263 / TC-N14** ("Budget impegnato") — la card è stata rinominata nel redesign Sprint 5.1 (`PlannerBudgetView.tsx`) in "Budget estate"/"Budget pianificato"; la scritta "Budget impegnato" non esiste più da nessuna parte nel codice (verificato via grep, zero occorrenze fuori dai test e dai commenti). **TEST OBSOLETO**: entrambi asserivano ancora il testo vecchio anche dopo aver aperto il tab giusto. Fix: aggiornati a "Budget estate". Commit `554559f`.
- **TC-N60 / TC-N65** ("Chi fa cosa?", assegnazione Partner/Nonno) — strict-mode violation: il pannello "Applica a tutta la settimana" (quick-select bulk, sempre visibile quando c'è una settimana selezionata) e il popup di assegnazione della singola cella mostrano entrambi le stesse `RESPONSIBLE_OPTIONS` ("Partner", "Nonno", ecc.) contemporaneamente — 2 bottoni con lo stesso nome accessibile. **HARNESS** (TC-N70, che testa apposta il quick-select bulk, già usava correttamente `.first()`; questi due no). Fix: `.last()` per prendere il popup per-cella. Commit `bd423c7`.

Non ancora investigati in questo giro (nuovi rispetto a Cluster G, o mai confermati via live run riuscito): TC-N88 (link "Prenotazioni" ambiguo, sospetto stesso pattern Cluster A), TC-026 (persistenza preferito — controllato staticamente `DetailClient.tsx`, nessuna sovrapposizione evidente col bottone cuore, servirebbe uno screenshot dal report Playwright per capire cosa intercetta il click su mobile-chrome), TC-187 (stesso pattern drawer-mobile di TC-166, ma in un file diverso — verosimilmente stesso fix, da applicare), l'intero cluster `tests/one/*.spec.ts` (TC-N407/408/409/414/415, onboarding/walkthrough TRAMA ONE), e la riconferma dal vivo di TC-N300/TC-075/TC-127/TC-200/TC-N73/76/TC-N108/112/114 (per questi ultimi le conclusioni "nessun bug" di questo documento erano basate su run con cleanup rotto — vanno riconfermate, non scartate).

**Raccomandazione:** rilanciare `TEST_SCOPE=all bash test-deploy.sh` dopo i 3 fix di questo giro per restringere l'elenco ai soli item non ancora spiegati, prima di investire altro tempo di analisi statica su di essi.

## Terza ondata (28/07, sera, run successivo) — verifica dei 3 fix + nuovi item

Fabrizio ha rilanciato subito dopo i 3 fix della seconda ondata. Risultato: **55 failed, 4 flaky, 324 skipped, 38 did not run, 461 passed (39.2m)** — 3 in meno rispetto a prima (58→55), coerente con TC-263/TC-N14 (contati come 1 nel conteggio "failed" totale ma 2 test) ormai verdi. Analizzati e corretti in questo giro aggiuntivo:

- **TC-508** — ancora in strict-mode violation, ora con **3** righe "Da rispondere" (non più 2): il filtro aggiunto nella seconda ondata disambigua correttamente dalla riga già accettata, ma non basta. Causa reale trovata: `getBookingsForCenter` mostra le prenotazioni di **tutti** i genitori sulle attività del centro, non solo del genitore di test — altri flussi di test (creazione prenotazione reale in `prenotazione.spec.ts`, o run precedenti falliti a metà prima che questo bug fosse capito) lasciano prenotazioni "pending" accumulate sulla stessa attività da account diversi, mai ripulite perché `cleanup-test-data.mjs` cancellava solo per `parent_id` del genitore di test. **DATA PRECONDITION.** Fix: la cancellazione iniziale delle prenotazioni ora copre anche `activity_id = seedActivity.id` indipendentemente dal genitore ("[TEST] Attività BuddyKids" è interamente sintetica, mai una prenotazione reale). Commit `efea04d`.
- **TC-N88** — strict-mode violation su "Prenotazioni": la Home mostra anche "Gestisci tutte le prenotazioni →" (card riepilogo), che matcha per substring il nome cercato. **HARNESS.** Fix: `{exact: true}` per isolare il link della bottom nav. Commit `c60ce58`.
- **TC-026** — click sul preferito bloccato su mobile-chrome ("intercepts pointer events", 30s di retry falliti nel trace). Causa: il toggle globale LEGACY/NEXTGEN (`VersionToggle.tsx`, fixed top-4 right-4, z-50) si sovrappone al bottone preferito della scheda attività (top-[18px] right-[18px], z-10) sullo stesso angolo su viewport stretti, vincendo per z-index. **APPLICATION BUG confermato.** Fix: escluso `/activity` dalle pagine dove il toggle è visibile (stesso principio già in uso per `/center`, `/admin`, `/auth`, `/share`). Commit `f7f1dbe`.
- **TC-187** — stesso pattern HARNESS di TC-166 (drawer mobile) ma in `attendance.spec.ts` invece di `report-presenze.spec.ts`: il link "Registro presenze" cercato dal test genitore/gestore a due context vive dietro il cassetto hamburger su mobile. Fix: apri il drawer se il bottone hamburger è presente, stesso pattern di TC-166. Commit `e0ebe21`.

**Nuovi item emersi in questo run, NON ancora investigati** (nessuna evidenza raccolta, servono verifica live o lettura codice dedicata prima di ipotizzare un fix): TC-101 (Settimana count 14 vs 13 attese — controllare se legato a TC-N24/N13 già noti o distinto), TC-070 ("Navetta" ComingSoon non trovato), TC-N56/N57 (Indirizzi: "Casa" non trovato, "Indirizzo salvato!" non trovato — possibile regressione reale nel flusso Indirizzi), TC-N73/N76 (link "Famiglia" timeout, "Copiato!" non trovato), TC-N10 (Posizione in Ricerca), TC-N19 (Codice check-in in Home), TC-N25 (Consigliati per voi — 1 solo bambino distinto invece di >1), TC-178 (due context, `browserContext.close` — timing/HARNESS sospetto), TC-144/TC-293 (flaky, timeout login — infrastruttura/rete, non applicativo), TC-N284 (flaky, stesso test in entrambi i progetti), l'intero cluster `tests/one/*.spec.ts` (TC-N407/408/409/414/415, onboarding/walkthrough TRAMA ONE — non toccato in nessuna delle 3 ondate di oggi).

**Raccomandazione:** rilanciare `TEST_SCOPE=all bash test-deploy.sh` con questi ultimi 3 fix per confermare la chiusura di TC-508/TC-N88/TC-026/TC-187, poi concentrare il prossimo giro di analisi sul cluster Indirizzi (TC-N56/57, sembra una regressione reale non un problema di test) e sul cluster `tests/one/*` (mai investigato oggi).

## Quarta ondata (29/07) — validazione ottimizzazioni + conferma cluster aperti

Fabrizio ha incollato l'output di due esecuzioni consecutive di `TEST_SCOPE=all bash test-deploy.sh`. La prima corrisponde numero per numero (190 failed, 25 flaky, 284 skipped, 54 did not run, 329 passed, 15.5h, 882 test) alla run già analizzata in precedenza in questa stessa giornata — quasi certamente un doppio incollato accidentale (scrollback/clipboard), non una nuova esecuzione. La seconda è invece la prima run realmente nuova dopo i due commit di ottimizzazione (`1987478` skip mobile-chrome su `TEST_SCOPE=all`, `48d55e9` video disattivato).

**Ottimizzazioni confermate efficaci**: la seconda run stampa esplicitamente `TEST_SCOPE=all: solo progetto 'chromium'`, esegue 441 test (contro 882, mobile-chrome escluso come previsto) e termina in **26.2 minuti** (contro 15.5 ore) — **46 failed, 4 flaky, 152 skipped, 17 did not run, 222 passed**. Nessun allegato video in nessun fallimento. Entrambe le ottimizzazioni funzionano come da commit.

**Rumore di rete ancora presente, ma molto più contenuto**: anche nella seconda run compare un blocco consecutivo di fallimenti con `net::ERR_INTERNET_DISCONNECTED`/`net::ERR_ADDRESS_UNREACHABLE`/`browserType.launch: Timeout 180000ms exceeded` (cluster Famiglia/Community/Mappa: TC-N62/63/64/66/67/68/69/73/74/75/76/77/78/79/101/102/109/114/115/116/117) — sintomo di una disconnessione di rete avvenuta a metà run, non 53 bug distinti. Questi vanno esclusi dal conteggio "reale" finché non si rifà un run su connessione stabile per tutta la durata.

**Confermati per la quarta volta consecutiva (stessi identici sintomi, nessuna interferenza di rete su questi — sono assertion failure applicative, non errori di rete)**, quindi da trattare ora come priorità concreta, non più solo "da investigare":
- TC-101 (Settimana 14 vs 13 attese, `genitori/home-planner.spec.ts`)
- TC-070 ("Navetta" ComingSoon non trovato, `genitori/profilo.spec.ts`)
- TC-075 (nav "Attività" senza classe evidenziazione, `gestore/attivita.spec.ts`)
- TC-200 (conferma Certificazione non trovata, `gestore/attivita.spec.ts`)
- TC-127 ("Crea un account" non trovato dopo invito, `gestore/invites.spec.ts`)
- TC-508 (`booking-row` "Da rispondere" risolve ancora a 2 elementi — il fix `efea04d` della terza ondata non ha chiuso il problema, serve un quinto giro di analisi su questo)
- TC-N56/N57/N59/N61 (Indirizzi/"Chi fa cosa?": "Casa", "Indirizzo salvato!", bottone "Nessuno assegnato" non trovati)
- l'intero cluster `tests/one/*.spec.ts` (TC-N407/408/409/414/415, onboarding-remediation e walkthrough-partner — mai investigato in nessuna delle ondate precedenti, ora con 4 conferme di fila)

**Nuovi candidati emersi in questa run** (non ancora distinguibili da rumore di rete residuo, ma senza errori `ERR_*` associati — quindi probabili assertion failure reali):
- TC-N13 (`planner.spec.ts`, "Settimana 13" non trovata — verosimilmente stessa causa di TC-N24 già corretto, timeline a mesi ripiegabili: da verificare se il fix di TC-N24 copre anche questo test o se serve applicarlo qui a parte)
- TC-N112/TC-N88/TC-N108/TC-N10 (`profile-6.spec.ts`/`planner.spec.ts`/`search.spec.ts`: href "Famiglia"/"Preferiti" e testo "Usa la mia posizione" non trovati — TC-N88 era già stato corretto per un problema diverso di `{exact:true}` in terza ondata, quindi qui è probabilmente una causa distinta)
- TC-N300 (flaky, "In coda per la pipeline" non trovato — già corretto in seconda parte Cluster G con scoping alla card specifica, commit `aec77b1`; se ricompare flaky serve capire se il fix regge sotto un timing diverso)

**Raccomandazione**: dato che TC-508 e il cluster `tests/one/*` sono ormai confermati stabilmente per la quarta volta senza alcuna interferenza di rete, sono la priorità concreta per il prossimo giro di investigazione (codice), prima di Gate F. Consigliato inoltre un run su connessione stabile (cablata, se possibile) per eliminare del tutto il rumore `ERR_INTERNET_DISCONNECTED` residuo e ottenere un segnale pulito sugli ultimi item ancora incerti.

## Quinta ondata (29/07) — root cause trovate per TC-508, TC-N56, TC-N414/415

Investigazione codice mirata sui tre item di priorità concreta della quarta ondata. Tre root cause distinte trovate e corrette, tutte con lo stesso pattern di fondo: **stato condiviso mutato da un test e mai ripristinato**, aggravato da `fullyParallel: true` che non garantisce l'ordine tra test dello stesso file in assenza di serializzazione esplicita.

- **TC-508 — root cause trovata (commit `72d6cd1`).** Il fix della terza ondata (`efea04d`, DELETE anche per `activity_id`) risolveva l'accumulo TRA run, ma non l'accumulo DENTRO lo stesso run: `tests/genitori/prenotazione.spec.ts` (TC-111/TC-112) completa prenotazioni reali sulla stessa `[TEST] Attività BuddyKids`, e con `workers: 2` può girare in parallelo a `gestore/prenotazioni.spec.ts` su un worker diverso — quella prenotazione nasce `partner_decision='pending'` ("Da rispondere") e resta tale finché nessuno la accetta/rifiuta: una seconda riga legittima, non dato sporco. Il marcatore seed (STEP 8) è l'unica prenotazione con `total_amount = 0.01`: il test ora filtra anche su `"€0.01"` per isolarlo sempre, indipendentemente da quante altre prenotazioni "Da rispondere" esistano in quel momento sulla stessa attività.
- **TC-N56 — root cause trovata (commit `4b5426b` + `4ddd554`).** `IndirizziClient.tsx#AddressCard` mostra `saved.label || ADDRESS_KIND_LABELS[kind]` come titolo — TC-N284 (stesso file) assegna un nome personalizzato ("Casa della nonna") all'indirizzo `kind="casa"` e non lo ripristina mai; `cleanup-test-data.mjs` non toccava `parent_addresses`. Risultato: dopo la PRIMA esecuzione riuscita di TC-N284 (in una qualunque run passata), il testo letterale "Casa" spariva per sempre e TC-N56 falliva in ogni run successiva, non in modo intermittente. Corretto in due parti: (1) `cleanup-test-data.mjs` ora resetta `label = null` per gli indirizzi del genitore di test ad ogni run; (2) `family-planner-5-3.spec.ts` serializzato (`mode: "serial"`), perché senza reset esplicito dell'ordine `fullyParallel:true` non garantisce che TC-N56 legga l'etichetta PRIMA che TC-N284 la rinomini, anche nella stessa run in cui il cleanup l'ha appena ripristinata.
- **TC-N414/TC-N415 — stesso pattern, root cause trovata (commit `4b5426b` + `f37217e`).** TC-N415 avvia per davvero il primo step del walkthrough "Pubblica la tua prima attività" (persistenza reale su `tutorial_progress`, non solo `useState` locale) e non lo resetta; TC-N414 (stesso file, eseguito prima per definizione ma non per garanzia d'ordine) si aspetta lo stato iniziale "not_started" (bottone "Inizia"). Stessa doppia correzione: reset di `tutorial_progress` per l'utente gestore di test in `cleanup-test-data.mjs`, più `walkthrough-partner.spec.ts` serializzato per eliminare la corsa residua dentro la stessa run.
- **TC-N409 — nessun bug di codice trovato, verosimilmente rumore di rete di questa run.** L'upsert idempotente di `cleanup-test-data.mjs` (righe ~271-276) forza già `status: "SUBMITTED"` con `onConflict: "center_id"` ad ogni run, e nessun altro test tocca la riga `center_onboarding_state` del centro seed in parallelo (TC-N407/N408 creano centri NUOVI, non toccano quello seed). Il gating del bottone "Richiedi modifiche" in `AdminOnboardingReviewClient.tsx` dipende solo da `status === "SUBMITTED"`, nessun'altra condizione. Non essendoci un meccanismo di corruzione permanente analogo agli altri due, il fallimento di questa run è più compatibile con il blocco di rumore `ERR_INTERNET_DISCONNECTED` già segnalato nella stessa finestra temporale del run — da riconfermare al prossimo rerun pulito prima di investigare oltre.

**Verifica statica**: `tsc --noEmit` ed `eslint` puliti su tutti e 4 i file toccati. Nessun test eseguito dal vivo in questa sessione (fuori mandato) — **da confermare al prossimo `TEST_SCOPE=all bash test-deploy.sh`**.

**Raccomandazione**: rilanciare la suite per confermare la chiusura di TC-508/TC-N56/TC-N414/TC-N415 e osservare se TC-N409 torna verde su una run senza interruzioni di rete. Se TC-N409 fallisce ancora SENZA alcun `ERR_*` associato, allora è un vero bug non ancora identificato e merita un giro di investigazione dedicato con `error-context.md`.

## Sesta ondata (29/07) — prima run pulita (nessun rumore di rete): 22 failed/227 passed (17.8m)

Fabrizio ha rilanciato `TEST_SCOPE=all bash test-deploy.sh` dopo i fix della quinta ondata. Risultato: **22 failed, 162 skipped, 30 did not run, 227 passed (17.8m)** — **nessun** `ERR_INTERNET_DISCONNECTED`/`ERR_ADDRESS_UNREACHABLE` in tutto l'elenco dei falliti: il segnale più pulito ottenuto finora in questo sprint.

**Confermati chiusi**: TC-N56, TC-N414, TC-N415 non compaiono più nell'elenco dei falliti — i fix di cleanup-test-data.mjs (reset label/tutorial_progress) + serializzazione dei due file reggono.

**TC-508 — ancora fallito, ma con un sintomo NUOVO**: non più "resolved to 2 elements" (l'ambiguità è risolta), ma `row.getByText("Accettata")` mai visibile dopo il click su "Accetta". Causa: `patchBooking()` (`PrenotazioniClient.tsx#respond`) aggiorna subito lo stato locale a `partnerDecision: "accepted"` — il badge "Da rispondere" sparisce dalla riga, e il locator `row` usato per l'assert finale era ancora filtrato anche su quel testo, quindi smetteva di matchare qualunque elemento non appena lo stato cambiava (bug del TEST, non dell'app: assert basato su un locator che dipende da uno stato che l'azione stessa appena eseguita ha cambiato). **Fix**: il locator `row` ora dipende solo dall'identificatore stabile (attività + `€0.01`), valido prima e dopo l'azione; "Da rispondere" resta verificato a parte, solo prima del click. Commit `9a38729`.

**TC-N57 — root cause trovata via query di sola lettura (Supabase MCP)**: verificato che l'account di test ha ormai un indirizzo salvato per `casa`/`lavoro_genitore1`/`lavoro_genitore2` (accumulato da run passati — `cleanup-test-data.mjs` resetta solo il `label`, non l'indirizzo stesso). L'unico slot ancora in modalità modifica è quindi sempre `altro`, il cui nome è obbligatorio (`setAddressAction`). Il test compilava solo il campo indirizzo, mai il nome: su `altro` il salvataggio falliva silenziosamente con un errore inline, mai il toast "Indirizzo salvato!" — non un bug applicativo. Fix: compila anche il campo "Nome" quando presente. Commit `60b2494`.

**Nuova serializzazione preventiva**: `family-planner-5-5.spec.ts` (TC-N73/74/75/76/77/114-117) leggeva/scriveva tutto lo stesso stato reale di appartenenza famiglia dell'account di test SENZA `describe.configure({mode:"serial"})`, nonostante precondizioni d'ordine esplicite nei commenti mai applicate — stesso principio di TC-508/TC-N56. Serializzato preventivamente (commit `206e48b`); TC-N73/76 erano nell'elenco dei falliti di questa run e sono buoni candidati per essere risolti dalla serializzazione — **da confermare al prossimo rerun**.

**Non ancora investigati in questo giro** (elenco residuo, nessuna nuova ipotesi rispetto alle ondate precedenti): TC-101, TC-070, TC-075, TC-200, TC-127, TC-178 (HARNESS/timing sospetto, già noto), TC-N19, TC-N25, TC-N13, TC-N88, TC-N108, TC-N112, TC-N114, TC-N10, TC-N407, TC-N408, TC-N409. Nota su TC-N88/N108/N112/N114: erano stati verificati "nessun bug, codice e test coerenti" in una ondata precedente (quando probabilmente giravano su un run con meno contesa) — la ricomparsa ORA, in un run finalmente senza rumore di rete, suggerisce che la causa più probabile sia latenza/contesa lato Vercel/Supabase sotto carico (tanti test/worker concorrenti sulla stessa app in produzione) piuttosto che un bug applicativo deterministico — ma non è stato ancora confermato con evidenza diretta (serve `error-context.md` o uno sguardo al trace di uno di questi fallimenti).

**Raccomandazione**: rilanciare per confermare la chiusura di TC-508/TC-N57/TC-N73/TC-N76, poi investire il prossimo giro sull'elenco residuo — a partire da TC-101/TC-N13 (probabilmente stessa causa, "Settimana 13" vs count 14) dato che sono i più circoscritti.

## Settima ondata (29/07) — chiusura dei 5 fallimenti ricorrenti su tutte e sei le ondate precedenti

Fabrizio ha rilanciato dopo la sesta ondata: **20 failed, 3 flaky, 226 passed (16.8m)**, poi ha chiesto esplicitamente di chiudere definitivamente il ciclo "fix parziale → rerun → repeat" sui 5 fallimenti mai spiegati fin dalla prima ondata — **cerchiamo di chiudere ed andare avanti**. Investigati tutti e cinque, usando gli `error-context.md`/hex dump dei run reali già salvati in `test-results/` invece di ipotesi, più una query di sola lettura (Supabase MCP) per TC-200. Tutti e cinque avevano una causa precisa e diversa dalle altre — nessuno era davvero "misterioso", solo mai investigato a fondo.

**TC-101 — HARNESS, locator page-wide troppo ampio.** Il locator `text=/Settimana \d+/` non era scoperto alla lista delle 13 righe del Planner: intercettava ANCHE la card di check-in in cima alla Home ("Questa settimana · Settimana 9", `CheckinPrompt.tsx`), sempre visibile sopra i tab Planner/Per bambino quando c'è un'attività in corso oggi — da qui il 14 invece di 13, mai un bug della griglia stagionale (`SEASON_TOTAL_WEEKS=13`, mai duplicata, verificato in `lib/season-weeks.ts` e `lib/data/planner.ts`). Fix: `data-testid="planner-week-list"` sul container delle 13 righe (`components/PlannerView.tsx`) + scoping esplicito nel test. Commit `65bebc0`.

**TC-070 — APPLICATION BUG reale in `MenuItem.tsx`.** Il testo `{main}` (es. "Navetta") era un nodo di testo semplice, fratello dello `<span>` di `ComingSoonBadge` ("Presto"), nello STESSO div — per le righe `comingSoon` (Navetta, Metodi di pagamento, Ricevute e fatture) il testo posseduto dal div diventava "NavettaPresto" concatenato: nessun elemento nel DOM aveva MAI il testo esatto "Navetta", quindi `getByText(label, {exact:true})` non trovava nulla, in ogni singola ondata. Fix: wrappato `{main}` nel proprio `<span>` — nessun cambio visivo, isola solo il testo per l'exact-match/accessibility tree. Commit `02ab56b`.

**TC-075 — HARNESS, icona non-whitespace rompeva l'ancora regex.** Verificato via hex dump di `error-context.md` (`ef 80 ac` = U+F02C, Private Use Area, glifo del font `ti-list-details`): Chrome include il glifo dell'icona nel nome accessibile calcolato del link nav, PRIMA del vero spazio e dell'etichetta (" Dashboard") — un carattere non-whitespace che `\s*` non può consumare, quindi `getByRole('link', {name: /^\s*Attività$/})` non ha mai potuto matchare nulla in nessuna ondata. Nessun bug applicativo: la classe attiva era già corretta. Fix: selettore su `nav a[href="/center/activities"]`, robusto e indipendente da icona/nome accessibile. Commit `005de60`.

**TC-200 — BLOCKER/DATA PRECONDITION, tabella mai applicata in produzione.** L'`error-context.md` mostrava letteralmente l'errore Supabase sotto il form: *"Could not find the table 'public.activity_certifications' in the schema cache"*. Verificato via query di sola lettura (Supabase MCP, read-only) sul progetto live: `select table_name from information_schema.tables where table_name='activity_certifications'` → **0 righe**. La tabella esiste SOLO nel riferimento `supabase/schema.sql` (task #169) ma non è mai stata consegnata come migrazione a sé stante da eseguire, a differenza di tutte le tabelle post-baseline (migration_02+) — probabilmente saltata quando la feature fu scritta direttamente in schema.sql. Bucket storage e helper RLS riusati (`current_center_id`/`is_platform_admin`) sono già presenti in produzione (verificato) — manca solo questa tabella. Nessun bug applicativo: `submitCertificationAction` fallisce correttamente e mostra l'errore reale. **Creata `supabase/migration_16_activity_certifications.sql`** (copia esatta da schema.sql, con pre-check/post-check/rollback) — **NON APPLICATA**: da eseguire manualmente da Fabrizio in Supabase SQL Editor prima del prossimo rerun, altrimenti TC-200 continuerà a fallire. Commit `03e6dce`.

**TC-127 — APPLICATION BUG reale, regressione dal REBRAND TRAMA Sprint 2.** Dall'introduzione di `TramaLoginHeader` (task #180, header animato fili→wordmark→tagline) il tenant famiglia (`/auth/login`, quello usato da genitori) mostra SOLO logo + wordmark + tagline fissa ("Organizing childhood. Together.") — l'heading dinamico `{heading}` ("Accedi a TRAMA"/"Crea un account TRAMA"/"Recupera la password", ancora presente e invariato nel ramo Partner/Admin della stessa `LoginForm.tsx`) non è mai stato riportato quando l'header fu animato. Non solo un problema di test: un genitore reale che passa a "Registrati" o arriva da un link d'invito non aveva alcuna conferma testuale della modalità. Fix: riaggiunta la riga `{heading}` dopo `TramaLoginHeader`, stessa animazione fade-up, senza toccare `data-testid="trama-login-header"` (già scopato da `tests/genitori/login.spec.ts`). Commit `69e2e24`.

**Tutti e cinque confermati chiusi con causa precisa; nessuno resta "da investigare".** Il pattern comune: quattro erano bug del test/harness (locator troppo ampi o fragili su icone/testo concatenato — mai un problema del genere "misterioso", solo mai guardato l'`error-context.md`/hex dump reale), uno era un vero bug applicativo di UX (TC-127) e uno un vero blocker di dato mancante in produzione (TC-200, richiede azione di Fabrizio). Nessuna nuova query o azione di scrittura sul database è stata eseguita — solo SELECT di sola lettura via Supabase MCP, come da governance.

**Residuo non toccato in questa ondata** (nessuna nuova ipotesi): TC-178/TC-163 (HARNESS/timing, richieste.spec.ts due-context), TC-N19, TC-N25, TC-N10, TC-N13, TC-N88, TC-N108, TC-N112, TC-N114 (nav/timeout, sospetta latenza Vercel/Supabase sotto carico concorrente, non confermata con evidenza diretta), TC-N407, TC-N408, TC-N409 (cluster `tests/one/*`).

**Prossimo passo**: Fabrizio esegue `migration_16_activity_certifications.sql` in Supabase SQL Editor, poi rilancia `TEST_SCOPE=all bash test-deploy.sh` per confermare la chiusura di TC-101/TC-070/TC-075/TC-200/TC-127 e valutare quanto resta del cluster residuo prima di passare a Gate F.

## Ottava ondata (29/07) — conferma dei 5 fix su deploy reale + causa radice TC-N407/408/409

Fabrizio ha applicato `migration_16` ed eseguito `TEST_SCOPE=all bash test-deploy.sh`: risultato **20 failed/2 flaky/226 passed**, con TC-101/TC-070/TC-127 ancora falliti IDENTICI a prima (stesso sintomo byte-per-byte) mentre TC-075 era sparito. Diagnosi: `test-deploy.sh` testa contro l'URL già deployato e NON deploya codice nuovo — un fix su file `.tsx`/`.ts` (TC-101/070/127, tutti fix applicativi) non ha alcun effetto finché non viene eseguito un `deploy.sh` reale, mentre un fix solo sul file di test (TC-075, `.spec.ts`) è effettivo subito perché Playwright legge i test dal filesystem locale, non dal deploy. **Lezione da ricordare**: dopo un fix applicativo, la sequenza corretta è `bash deploy.sh` (che poi auto-lancia `TEST_SCOPE=critical`), non `test-deploy.sh` da solo.

Fabrizio ha poi eseguito `bash deploy.sh` (push + build + deploy + realign alias, poi auto-run `TEST_SCOPE=critical`): **3 failed, 1 flaky, 76 passed**. **Confermati chiusi con evidenza da deploy reale**: TC-101, TC-070, TC-075, TC-127 (tutti e quattro passano). **TC-200 — confermato chiuso**: la migration_16 ha creato la tabella, e il fix del locator di cleanup (`.last()` → `.first()`, vedi sotto) ha risolto il secondo bug che la tabella ora esistente ha reso raggiungibile per la prima volta.

**TC-200 — secondo bug scoperto DOPO che migration_16 ha reso la tabella esistente**: una volta che il form di richiesta certificazione ha smesso di fallire subito (tabella presente), il test ha raggiunto per la prima volta lo step di cleanup finale (`tests/gestore/attivita.spec.ts`), rivelando un bug di locator mai raggiungibile prima: `page.locator("div").filter({hasText: label}).last()` risolveva al DIV PIÙ INTERNO (il semplice contenitore `<div>{cert.label}</div>` dentro `min-w-0/flex-1`), che non contiene il bottone "Ritira la richiesta" — sibling nella struttura reale di `ActivityEditForm.tsx`, non discendente. In ordine documento (pre-order), `.first()` di un locator "div contiene X" risolve sempre al div PIÙ ESTERNO (la card/riga), `.last()` al più interno — un'inversione facile da confondere. Fix: `.last()` → `.first()`. Commit `8c8273d`, insieme all'estensione di `cleanup-test-data.mjs` per pulire le 2 righe "pending" orfane accumulate dai retry falliti (`certificationsReset`, confermato `2` nel log del run di deploy).

**Tutti e 5 i fallimenti ricorrenti originali (TC-101/070/075/200/127) sono ora chiusi con evidenza da un run contro il deploy realmente aggiornato**, non solo verifica statica.

**TC-N407/TC-N408/TC-N409 — causa radice trovata: BLOCKER/DATA PRECONDITION, non un bug di codice.** Il run `deploy.sh` ha mostrato questi tre come unici falliti oltre al flaky TC-026. `TC-N409` ha loggato esplicitamente `navigated to "https://buddykids-app.vercel.app/admin"` invece di `/admin/one/onboarding` — un redirect, non un timeout di rete. `app/admin/one/layout.tsx` fa `redirect("/admin")` quando `resolveFeatureFlag({flagName:"TRAMA_ONE_ENABLED", ...})` ritorna `false` (righe 58-67). Verificato via query di sola lettura (Supabase MCP) su `feature_flag_overrides`:

```
flag_name          | scope_type | scope_value | enabled | expires_at                    | is_expired
TRAMA_ONE_ENABLED  | global     | null        | true    | 2026-07-22 11:41:57.238372+00 | true
```

È l'UNICA riga presente per questo flag — nessun altro override attivo (nessuno per ruolo/coorte/tenant/utente). `evaluateFlag()` (`lib/feature-flags/evaluate.ts`, righe 111-113) esclude esplicitamente gli override scaduti da quelli applicabili, quindi da quando questa riga è scaduta (22/07, sette giorni fa) **`TRAMA_ONE_ENABLED` risolve a `false` per chiunque** (nessun override valido → `defaultValue: false` del registry, `lib/feature-flags/registry.ts` riga 41) — non solo nei test, in PRODUZIONE per qualunque utente reale che provi ad accedere a `/one`, `/center/one`, `/admin/one`. Il trigger `migration_10` (auto-LEAD) risulta correttamente installato e attivo (`tgenabled: 'O'`, verificato via query) — non è la causa: i centri di test creati da TC-N407/TC-N408 in un run precedente non sono più in tabella `centers` (0 righe `[TEST] Centro Auto LEAD/Idempotenza` al momento della verifica) perché il blocco cleanup all'inizio di `cleanup-test-data.mjs` (righe 311-333, già esistente da un'ondata precedente) li elimina a inizio di ogni run — comportamento corretto, non collegato alla causa radice.

Questo È il task #336 (ancora pending, "Abilitare TRAMA ONE via override + rigenerare sitemap") — non è mai stato chiuso in modo permanente: l'override globale fu impostato con una scadenza (probabilmente pensata per un pilot a tempo) ed è scaduta senza che nessuno se ne accorgesse, perché nulla nel sistema segnala una scadenza di feature flag in avvicinamento/passata.

**Nessuna scrittura SQL eseguita da me** (solo SELECT di sola lettura, come da governance). SQL pronto per Fabrizio, da eseguire manualmente in Supabase SQL Editor:

```sql
-- PRE-CHECK (sola lettura, facoltativo)
select flag_name, scope_type, enabled, expires_at
from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED';
-- atteso ORA: 1 riga, scope_type='global', enabled=true, expires_at nel passato.

-- FIX — rimuove la scadenza, rende l'override permanente (raccomandato se il
-- pilot è ormai da considerarsi la modalità stabile, non più un test a tempo):
update public.feature_flag_overrides
set expires_at = null, updated_at = now()
where flag_name = 'TRAMA_ONE_ENABLED'
  and scope_type = 'global'
  and scope_value is null;

-- OPPURE, se preferisci restare su un pilot a tempo invece di renderlo
-- permanente, estendi la scadenza invece di azzerarla (esegui SOLO questa,
-- non entrambe):
-- update public.feature_flag_overrides
-- set expires_at = now() + interval '30 days', updated_at = now()
-- where flag_name = 'TRAMA_ONE_ENABLED' and scope_type = 'global' and scope_value is null;

-- POST-CHECK (sola lettura)
select flag_name, scope_type, enabled, expires_at
from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED';
-- atteso: expires_at = null (permanente) oppure una nuova data futura.
```

**Raccomandazione**: questa è un'azione a priorità più alta del solito rerun di triage — finché non viene eseguita, TRAMA ONE resta silenziosamente spento in produzione per tutti, non solo per i tre test falliti. Dopo il fix, rilanciare `TEST_SCOPE=all bash test-deploy.sh` per confermare TC-N407/408/409 e verificare se lo stesso meccanismo spiega anche parte del cluster residuo TC-N19/25/10/13/88/108/112/114 — verificato in questa sessione che questi ultimi sono TUTTI in `tests/nextgen/*` (non `tests/one/*`, non gated dal flag), quindi restano un cluster distinto e non spiegato da questa causa: l'ipotesi "latenza Vercel/Supabase sotto carico" resta da confermare o smentire a parte.

## Nona ondata (29/07) — conferma post-fix flag + effetto collaterale atteso sugli smoke test + 1 nuovo HARNESS

Fabrizio ha eseguito l'UPDATE preparato (verificato via query di sola lettura: `expires_at = null`, override permanente e valido) e rilanciato `TEST_SCOPE=all bash test-deploy.sh`: **20 failed, 3 flaky, 228 passed (18.7m)**.

**TC-N407/TC-N408 — confermati chiusi.** Non compaiono più tra i falliti: la causa radice (flag scaduto) era corretta al 100%.

**TC-N409 — avanzato oltre il redirect, nuovo (secondo) bug scoperto: HARNESS, strict mode violation.** Ora che il flag lascia passare il test fino in fondo, `getByText("Integrazioni richieste")` (substring, non exact) risolveva a 2 elementi: il badge di stato vero e proprio e una riga di log/nota "In verifica → Integrazioni richieste" che lo contiene come sottostringa — mai raggiungibile prima perché il test falliva sempre prima, sul redirect. Fix: `{exact: true}` isola solo il badge. Commit `08e66e5`. Stesso pattern di tutti gli altri bug "di secondo livello" di questo sprint (TC-200, TC-N56/N414/415): un fix ne scopre un altro più a valle, mai un segno che il fix precedente fosse sbagliato.

**Effetto collaterale ATTESO, non un regressione**: rendere il flag permanente ha rotto 5 smoke test (`tests/one/smoke.spec.ts`, TC-N302/303/304/401/402) che verificavano esplicitamente il comportamento di fallback quando il flag è DISATTIVATO (premessa ormai falsa, dato che ora è sempre attivo). Riscritti per verificare lo stato attuale (shell raggiungibile, nessun redirect) invece dello stato superato; TC-N306 (già scritto per lo scenario flag=true, prima skippato in attesa di un override dedicato) non richiede più lo skip. Commit `7671691`. **Da confermare al prossimo rerun** (nessuna esecuzione live di questi 6 test in questa sessione, fuori mandato — solo `tsc`/`eslint` puliti).

**Residuo invariato, nessuna nuova ipotesi**: TC-173, TC-134, TC-178, TC-N57, TC-N73, TC-N19, TC-N25, TC-N13, TC-N88, TC-N108, TC-N112, TC-N10, TC-N114 — tutti già presenti nelle ondate precedenti (nessuno introdotto da questo giro), nessuno in `tests/one/*`, quindi non toccati dal fix del flag. TC-026/TC-132/TC-N414 flaky (non falliti in modo consistente) — TC-N414/415 sono nel file già serializzato (`mode:"serial"`, quinta ondata), quindi la flakiness osservata qui è compatibile con rumore residuo piuttosto che una regressione della serializzazione; da riconfermare, non da correggere alla cieca.

**Stato dei 5 fallimenti originali del mandato ("cerchiamo di chiudere ed andare avanti") + il cluster `tests/one/*` collegato**: tutti e otto (TC-101/070/075/200/127 + TC-N407/408/409) hanno ora una causa precisa, un fix applicato e conferma da un run reale (tranne TC-N409, il cui SECONDO bug è appena stato corretto e attende il prossimo rerun per la conferma finale). Il cluster residuo che resta genuinamente da investigare per Gate F è quello sospettato di latenza Vercel/Supabase (`tests/nextgen/*`), invariato da questa sessione.

## Decima ondata (29/07) — ULTIMO run di questo ciclo (per direttiva esplicita di Fabrizio), chiusura Gate C

Fabrizio: "che sia l'ultima, altrimenti non usciamo da questo loop" — rilanciato un'ultima volta `TEST_SCOPE=all bash test-deploy.sh`: **16 failed, 2 flaky, 237 passed (16.3m)**. Da qui in avanti si passa a Gate F indipendentemente dal residuo, salvo blocker reali (nessuno trovato).

**Confermati chiusi definitivamente**: TC-N302/303/304/306/401/402 (i 6 smoke test riscritti) non compaiono più tra i falliti. TC-N407/408 restano chiusi.

**TC-N409 — TERZO bug, stesso pattern HARNESS, corretto senza nuovo rerun**: `getByText("In verifica")` (riga 119, subito dopo il fix della riga 117) risolveva a 4-6 elementi — badge di stato PIÙ righe di audit log con freccia che contengono "In verifica" come sottostringa ("In verifica → Integrazioni richieste", "Attivazione avviata → In verifica", ecc.), mai raggiunte finché non è stata risolta la riga precedente. Fix: `{exact:true}`, commit `e5e1a9a`. `tsc`/`eslint` puliti. Non richiesto un altro rerun per governance esplicita di Fabrizio — il fix resta da confermare al prossimo run naturale (es. in Gate F o in un futuro sprint), non blocca la chiusura del gate.

**Residuo, NESSUNO bloccante — classificato e congelato per Gate F**:
- **Non toccati da questa sessione, invariati da più ondate** (sospetta latenza Vercel/Supabase, nessuna nuova evidenza): TC-N19, TC-N25, TC-N13, TC-N88, TC-N108, TC-N112, TC-N114, TC-N10, TC-N57, TC-N73, TC-178.
- **Nuovi in questo run, non ancora spiegati** (TC-112, TC-159 in `prenotazione.spec.ts`: timeout su `/search`; TC-147 in `profilo.spec.ts`: checkbox non persistita dopo reload) — compatibili con lo stesso sospetto di latenza/contesa Vercel-Supabase sotto carico concorrente (stesso file/pattern di TC-132/TC-134, già flaky in run precedenti), non confermati con evidenza diretta.
- **TC-N414 (flaky) / TC-N415 (fallito)** in `walkthrough-partner.spec.ts`: fallito in modo simile per la seconda run consecutiva (prima flaky+fallito, ora flaky+fallito di nuovo) nonostante la serializzazione già applicata (quinta ondata). Il fatto che si ripeta con lo stesso pattern in due run consecutive lo rende il candidato più solido per essere un bug reale di persistenza (non rumore), ma NON è un blocker per nessun flusso core (booking/auth/pagamenti/presenze) — resta un item da investigare a parte, fuori da questo ciclo di triage per esplicita richiesta di chiusura.

**Nessun blocker trovato**: nessuno dei 16 falliti/2 flaky tocca login, prenotazione core (le prenotazioni reali TC-111/TC-112 booking flow di base passano — TC-112/159 falliscono solo sulla RICERCA dell'attività, non sul booking in sé), pagamenti, o RLS/sicurezza. **Si procede a Gate F.**

## Undicesima ondata (Build Sprint 6) — root cause reale di TC-N414/N415 trovata con evidenza diretta (DEC-50)

Item lasciato esplicitamente aperto dalla decima ondata ("resta un item da investigare a parte, fuori da questo ciclo di triage"), rientrato come backlog vincolante P2 di Sprint 6 (`SPRINT_GOVERNANCE.md` riga 152: "investigare `tutorial_progress`/`app/actions` del walkthrough con evidenza diretta, non ipotesi").

**Root cause trovata per lettura diretta del codice** (nessuna esecuzione live, come richiesto — evidenza = il codice stesso, non un nuovo run): `app/one/WalkthroughCard.tsx::handleStart/handleComplete/handleSkip` aggiornavano lo stato locale React (`setStepStatus`/`nextStepAfter`, che cambia subito il testo del bottone da "Inizia" a "Continua") **PRIMA** di attendere il completamento della Server Action corrispondente (`startWalkthroughStepAction`/ecc., che scrive davvero su `tutorial_progress`). `.click()` di Playwright si risolve non appena l'evento DOM è stato dispatchato, senza attendere che la Promise ritornata dall'handler `onClick` sia risolta — quindi `expect(page.getByRole("button",{name:"Continua"})).toBeVisible()` in TC-N415 passava sulla base del solo aggiornamento OTTIMISTICO locale, ben prima che l'upsert arrivasse davvero a Supabase. Il successivo `page.reload()` (fonte di verità = Server Component + DB) poteva quindi leggere lo stato non ancora persistito e mostrare di nuovo "Inizia" — un fallimento intermittente dipendente dalla sola latenza della singola richiesta di rete al momento del test, non dall'ordine tra TC-N414/TC-N415 (già garantito dalla serializzazione applicata in quinta ondata, che per questo non aveva mai chiuso il problema). Bug reale anche per un utente vero, non solo un artefatto di test: con rete lenta o un errore silente della action, l'interfaccia avrebbe mostrato un progresso mai davvero salvato.

**Fix** (`app/one/WalkthroughCard.tsx`): i tre handler ora attendono il risultato della action e aggiornano lo stato locale solo se non c'è errore (altrimenti loggano l'errore con `console.error`, stesso principio già applicato in DEC-49 per l'email fire-and-forget). Corretta anche, nello stesso giro, un'inconsistenza minore in `app/actions/walkthrough.ts`: ogni action revalidava solo `/one` (portale Parent), mai `/center/one` (Partner, motore riusato da Sprint 2) né `/admin/one` — non la causa di questo bug (le route `/one*` usano già `cookies()`, quindi Next.js le rende dinamiche di default indipendentemente da `revalidatePath`), ma un'inconsistenza reale per un motore pensato per essere generico multi-tenant.

**Verifica statica**: `tsc --noEmit` ed `eslint` puliti su entrambi i file toccati. Nessuna esecuzione live in questa sessione (fuori mandato) — **da confermare al prossimo `TEST_SCOPE=all bash test-deploy.sh`**: atteso che TC-N414/TC-N415 non compaiano più tra i falliti/flaky, dato che il fix elimina esattamente la finestra di race descritta sopra (il bottone ora riflette "Continua" solo dopo che la persistenza è confermata, prima ancora che `page.reload()` venga eseguito).

Vedi DEC-50 (`DECISION_LOG.md`) per il dettaglio completo della decisione.
