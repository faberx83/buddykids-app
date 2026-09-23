# TRAMA ONE — Beta/Release Gate — chiusura Sprint 5-6

Documento autosufficiente per chi non ha seguito la conversazione. È il gate finale richiesto dall'istruzione permanente di Fabrizio ("completa Sprint 5 e Sprint 6 in autonomia, fermati solo al gate finale Beta/Release"). A differenza di `AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md` (unico audit esterno formale, `TEST_SCOPE=all` dal vivo), questo è un checkpoint di continuità come `AUDIT_CHECKPOINT_SPRINT_0/1/2.md` — verifica statica più stato del repository — perché la governance (DEC-29/30) non richiede `TEST_SCOPE=all` ad ogni singolo sprint.

## 1. Executive Status

**Scope cumulativo di Sprint 5-6** (`SPRINT_GOVERNANCE.md`):
- **Sprint 5**: referral/CenterLead — suggerimento centro non iscritto (Parent-facing), coda Admin CenterLead + claim, reward/commission in shadow mode.
- **Sprint 6**: P1 Capacity service canonico (DEC-47), P1 feature flag override expiry (DEC-48), P2 email fire-and-forget (DEC-49), P2 walkthrough Partner TC-N414/N415 (DEC-50), Command Center Admin/E08 (DEC-51), eventi analytics con correlationId/E11 (DEC-52), feedback industrializzato/CR-050 (DEC-53, chiuso per riuso puro), hardening walkthrough (DEC-54).

**Risultato**: tutti gli elementi di scope di Sprint 5 e Sprint 6 risultano implementati, verificati staticamente e documentati (`SPRINT_5_FEATURE_PRESERVATION_MATRIX.md`, `DECISION_LOG.md` DEC-46..DEC-55, `TRANSITION_REGISTER.md`).

**Verifica statica eseguita per questo gate**: `tsc --noEmit` pulito sull'intero progetto. `eslint` pulito su tutti i file toccati in Sprint 6 (`lib/`, `app/actions/`, `app/one/`, `app/admin/one/`, `app/center/one/`); un tentativo di `eslint .` sull'intero repository è andato in timeout per limiti dell'ambiente di esecuzione (non per errori di lint) — non è la stessa cosa di un lint pulito su tutto il repository, vedi §8.1. L'intera suite di unit test "no browser" del repository (130 test, tutti i file `tests/**/*.spec.ts`) è verde su chromium e mobile-chrome. `BuddyKids_Test_Case.xlsx` ricalcolato senza errori.

**Verifica live sul database di produzione (sola lettura, MCP Supabase, progetto `eagsgfxunwyyxwwilldy`)**, eseguita specificamente per questo documento per non affermare lo stato delle migrazioni per sola memoria/documentazione pregressa — vedi §6 per il dettaglio: al momento di produrre questo documento, `migration_15` e `migration_16` risultavano applicate; `migration_17`, `migration_18`, `migration_19`, `migration_20` risultavano NON applicate.

**Aggiornamento (stesso giorno, post-produzione di questo documento)**: Fabrizio ha applicato manualmente `migration_17_center_leads.sql`, `migration_18_capacity_service.sql`, `migration_19_bookings_email_delivery_status.sql`, `migration_20_product_events.sql` (blocco principale di ciascun file — le sezioni PRE-CHECK/POST-CHECK/ROLLBACK sono commentate riga per riga con `--` e non vengono eseguite lanciando il file intero). Riverificato dal vivo subito dopo: `public.center_leads`, `public.product_events` presenti; `booking_weeks.capacity_decremented` presente; `bookings.email_delivery_status`/`email_delivery_attempted_at`/`email_delivery_error` presenti. **Tutte e 6 le migrazioni Sprint 5-6 (15-20) risultano ora applicate in produzione.** Vedi §6 per la tabella aggiornata.

**Perché non "READY" ma "READY FOR CONTINUATION"** (stato al momento della prima stesura di questo documento): nessun `TEST_SCOPE=all` dal vivo era stato eseguito da quando era stato superato l'Integration Gate di Sprint 4. Per costruzione di questa governance (DEC-29/30), questo non è un requisito di chiusura sprint — è un requisito di Fabrizio, da eseguire quando lo riterrà opportuno. Superato subito dopo — vedi aggiornamento sotto.

**Aggiornamento (stesso giorno, secondo ciclo — DEC-56): primo `TEST_SCOPE=all` dal vivo eseguito da Fabrizio con le migrazioni applicate.** Deploy pubblicato (commit `38fc778`), poi run completo: 484 test totali, **277 passed, 15 failed, 3 flaky, 150 skipped, 39 did not run**. Triaggio riga per riga contro `GATE_C_TRIAGE_20260728.md`/`PRE_EXISTING_TEST_FAILURE_BASELINE.md`:

- **Tutti i test UI-driven di scope Sprint 5-6 sono risultati verdi**: `TC-N607`/`TC-N608` (capacity), `TC-N609` (feature flag override, dopo fix — vedi sotto), `TC-N610` (email delivery), `TC-N611` (Command Center Admin), `TC-N612` (product events), `TC-N613` (walkthrough funnel), oltre a `TC-N600`..`TC-N606` (CenterLead, incluso `TC-N603` dopo fix) e all'intera regressione `tests/admin/*` richiesta da `SPRINT_GOVERNANCE.md` riga 137. **Nessuna riga di scope Sprint 5-6 è tra i 15 failed/3 flaky di questo run.**
- Il run ha inizialmente rivelato **2 bug** (non di scope Sprint 5-6 in senso stretto, ma nel codice CenterLead/feature-flag toccato dalle migrazioni appena applicate): `TC-N603` (bug reale — embed PostgREST ambiguo in `getAllCenterLeadsForAdmin()`, coda Admin sempre vuota) e `TC-N609` (bug del test — locator Playwright sbagliato, la UI reale era corretta). Root cause di entrambi confermata con evidenza diretta (query SQL di sola lettura + snapshot di accessibilità Playwright catturati al fallimento, non ipotesi), fix committati (`f075bc1`, `04d7563`), documentati in DEC-56. **Riconfermati PASSED nello stesso run `TEST_SCOPE=all` sopra** (nessun rerun isolato necessario: il run che include i fix è quello riportato qui).
- Dei restanti 15 failed + 3 flaky: **13 failed + le 3 flaky sono cross-matchati** contro `GATE_C_TRIAGE_20260728.md` come debito preesistente già documentato da settimane (latenza Vercel/Supabase sotto carico, timing di rendering, nessuno di scope Sprint 5-6) — vedi §8.3 per l'elenco puntuale. **2 failed (`TC-137`, `TC-182`) NON hanno alcun riscontro** né in `GATE_C_TRIAGE_20260728.md` né in `PRE_EXISTING_TEST_FAILURE_BASELINE.md`: sono nuovi o mai osservati prima con questo sintomo esatto. Non è stata affermata una diagnosi per questi due senza evidenza diretta (governance permanente) — restano un item aperto, vedi §11 e §13.

**Stato: `AUDIT STATUS: READY` per lo scope Sprint 5-6** (tutto il codice di scope verificato live, verde su tutta la linea) **+ 1 item di follow-up non bloccante** (`TC-137`/`TC-182`, fuori scope Sprint 5-6, da investigare separatamente) — vedi §13 per il piano di chiusura esatto e le fasi successive.

## 2. Repository State

- **Branch**: `main`.
- **HEAD di questo gate**: `5ad047b6c4b9a4c96a7d8d91548cd1348d2ddfae`, 2026-08-03 10:38:55 +0200 ("docs(sprint6): DEC-55 chiusura Sprint 6 (READY FOR CONTINUATION)").
- **Working tree**: pulito (verificato `git status --short` subito prima di scrivere questo documento).
- **Commit di Sprint 6** (in ordine cronologico, tutti su `main`): `fa6cf3d`, `8488121`, `786858e`, `c3467cb`, `1d0da29`, `a403ccf`, `964acd7`, `3f18b54`, `985c586`, `f446730`, `f7d4ff4`, `8aadada`, `c96c7d6`, `1e4109f`, `c05efed`, `138365b`, `5ad047b` — 17 commit, tutti granulari, un concern per commit (nessun `git add .`).
- **Commit di Sprint 5**: già registrati e chiusi in `SPRINT_5_FEATURE_PRESERVATION_MATRIX.md`/DEC-46, non ripetuti qui.

## 3. Scope

- **In scope di questo gate**: unione dello scope di Sprint 5 e Sprint 6 (vedi §1). Non ripete il dettaglio implementativo già coperto da `SPRINT_5_FEATURE_PRESERVATION_MATRIX.md` e dalle voci DEC-46..DEC-55 — questo documento aggiunge la vista consolidata di chiusura richiesta dal gate finale Beta/Release.
- **Esplicitamente fuori scope**: qualunque sprint futuro oltre Sprint 6 — nessuno è ancora stato pianificato al momento di scrivere questo documento.
- **Deviazioni**: nessuna rispetto allo scope tecnico dei 2 sprint. CR-050 è stata chiusa con zero righe di codice nuovo (riuso puro dell'infrastruttura `beta_feedback` già REUSE_AS_IS in `TRAMA_ONE_Impact_Assessment_v1.0.md`) — documentato in DEC-53, non è uno scope-cut ma una conferma che il lavoro necessario era già stato fatto prima di TRAMA ONE.

## 4. Feature Preservation

Confermato da `SPRINT_5_FEATURE_PRESERVATION_MATRIX.md` e dalle voci DEC-46..DEC-55: nessuna colonna esistente alterata o rimossa in nessuno dei due sprint, nessuna capability Legacy/NextGen dismessa, tutte le migrazioni introdotte in questo arco sono additive (`migration_17`...`migration_20`).

**Punti di attenzione specifici verificati per questo gate**:
- Il Command Center Admin (E08) è additivo alla pagina `/admin/one` preesistente (Sprint 1) — la sezione Walkthrough Sprint 1 resta visibile sotto le nuove code operative (verificato dal test TC-N611 aggiornato, che asserisce esplicitamente la compresenza).
- `persistProductEvent()` (E11) è un layer opt-in "affianca senza sostituire" sopra `logTelemetryEvent()` (Sprint 0, solo console) — quest'ultima resta invariata e continua a funzionare anche se `product_events` non esiste ancora nel database (fallback silenzioso, verificato in `lib/telemetry/events.ts`).
- `lib/analytics.ts`/`app/admin/analytics` (dashboard Legacy preesistente) restano completamente invariati — confermato in `FEATURE_PARITY_MATRIX.md` riga 22.

## 5. Architecture and Reuse

- **CR-050**: closure-by-reuse totale — nessuna nuova capability di business, solo formalizzazione documentale che l'infrastruttura esistente (`beta_feedback`, `/internal/beta-pipeline`, CTA flottante, `/admin/segnalazioni-beta`) soddisfa già il requisito (DEC-53).
- **E11**: whitelist eventi (`lib/telemetry/known-events.ts`) isolata in un file puro separato dal resto di `lib/telemetry/events.ts` (che ha `import "server-only"`) — pattern ormai consolidato in questo repository per rendere testabile direttamente da Playwright/Node la logica pura, senza passare dal bundler Next.js. Lo stesso pattern è già presente altrove nel repository (`lib/command-center/priority.ts` vs `lib/data/command-center.ts`, `lib/day-pricing.ts`, `lib/walkthrough/funnel.ts`).
- **Hardening walkthrough**: il funnel/drop-off (`lib/walkthrough/funnel.ts`) è calcolato dai dati Sprint 1 (`tutorial_progress`, sempre disponibili) e non da `product_events` (E11, migration non applicata) — scelta deliberata per non far dipendere una metrica di hardening da una migrazione non ancora eseguita. `product_events` è usato solo per il conteggio riavvii (`getWalkthroughRestartCount()`), l'unico dato che `tutorial_progress` non può strutturalmente fornire, in modalità best-effort (ritorna `null`/"N/D" se la tabella non esiste).

## 6. Database

Stato delle migrazioni Sprint 5-6, **verificato dal vivo in sola lettura sul progetto Supabase `eagsgfxunwyyxwwilldy`** (non per sola documentazione pregressa) immediatamente prima di scrivere questo documento:

| Migrazione | Introduce | Stato verificato dal vivo |
|---|---|---|
| `migration_15_identity_verification_storage.sql` | Bucket storage `buddykids-identity-verifications` + policy | **Applicata** — bucket presente in `storage.buckets` |
| `migration_16_activity_certifications.sql` | Tabella `public.activity_certifications` | **Applicata** — tabella presente, 1 riga |
| `migration_17_center_leads.sql` | Tabella `public.center_leads` | **Applicata** (da Fabrizio, post-produzione di questo documento) — tabella presente |
| `migration_18_capacity_service.sql` | Colonna `booking_weeks.capacity_decremented` | **Applicata** (da Fabrizio, post-produzione di questo documento) — colonna presente |
| `migration_19_bookings_email_delivery_status.sql` | 3 colonne di stato consegna email su `bookings` | **Applicata** (da Fabrizio, post-produzione di questo documento) — colonne presenti |
| `migration_20_product_events.sql` | Tabella `public.product_events` | **Applicata** (da Fabrizio, post-produzione di questo documento) — tabella presente |

Tutte e 6 le migrazioni Sprint 5-6 sono ora applicate in produzione, riverificato dal vivo in sola lettura. Nessuna è stata applicata da Claude, per costruzione della governance permanente: ognuna era un file SQL con intestazione "QUESTO FILE NON È STATO APPLICATO AL DATABASE" e sezioni PRE-CHECK/POST-CHECK/ROLLBACK separate (commentate riga per riga con `--`, quindi ininfluenti se il file viene lanciato per intero), eseguita manualmente da Fabrizio nel SQL Editor di Supabase.

**Impatto pratico ora che `migration_17`/`18`/`19`/`20` sono applicate**: CenterLead (Sprint 5), capacity service (DEC-47), stato consegna email (DEC-49) e product events (E11) sono ora pienamente operativi con dati reali, non più in modalità fallback. Resta da confermare solo tramite `TEST_SCOPE=all` dal vivo (§13) che il comportamento a runtime sia quello atteso.

## 7. Security and Privacy

- `product_events` (migration_20, non applicata): RLS già scritta nel file — insert per qualunque utente autenticato, select riservata a `is_platform_admin()`, coerente con il pattern già in uso per le altre tabelle TRAMA ONE.
- Nessuna nuova considerazione rispetto ai checkpoint precedenti per Sprint 5: nessun nuovo dato sensibile introdotto, `center_leads` non contiene dati più sensibili di quelli già gestiti da `activity_inquiries`.

## 8. Tests

### 8.1 Verifiche statiche

- `tsc --noEmit`: pulito sull'intero progetto.
- `eslint`: pulito su tutti i file toccati in Sprint 6 (`lib/`, `app/actions/`, `app/one/`, `app/admin/one/`, `app/center/one/`). Un tentativo di eseguire `eslint .` sull'intero repository in un'unica chiamata è andato in timeout per un limite tecnico dell'ambiente di esecuzione (45 secondi per chiamata, nessuna persistenza di processi in background tra chiamate separate) — non è un fallimento di lint, è un limite dello strumento. Non equivale a "l'intero repository è stato lintato in questo gate": lo scope lintato è quello toccato da Sprint 6, coerente con la pratica già adottata nei checkpoint precedenti.
- `BuddyKids_Test_Case.xlsx`: ricalcolato con `recalc.py`, 0 errori su tutte le formule.

### 8.2 Unit test "no browser" (eseguiti dal vivo da Claude)

`npx playwright test --grep "no browser"` sull'intero repository: **130 passed** (chromium + mobile-chrome), 0 failed. Copre tutta la logica pura del repository, non solo quella toccata in Sprint 6 — conferma nessuna regressione nei moduli puri preesistenti (`lib/day-pricing.ts`, `lib/command-center/priority.ts`, `lib/feature-flags/evaluate.ts`, ecc.) introdotta dalle modifiche di questo arco.

### 8.3 Test UI-driven (scritti da Claude, eseguiti dal vivo SOLO da Fabrizio — per costruzione della governance)

**Eseguiti da Fabrizio il 2026-08-03** (`TEST_SCOPE=all bash deploy.sh`, 484 test, chromium, post-deploy commit `38fc778`) — risultato PASSED per tutto lo scope Sprint 5-6:

| Test | Area | Esito |
|---|---|---|
| `TC-N600`..`TC-N606` | CenterLead (Sprint 5) | PASSED (`TC-N603` dopo fix DEC-56) |
| `TC-N607`/`TC-N608` | Capacity service (DEC-47) | PASSED |
| `TC-N609` | Feature flag override expiry (DEC-48) | PASSED (dopo fix locator, DEC-56) |
| `TC-N610` | Email delivery status (DEC-49) | PASSED |
| `TC-N611` | Command Center Admin (E08, DEC-51) | PASSED |
| `TC-N612` | Eventi analytics/product_events (E11, DEC-52) | PASSED |
| `TC-N613` | Hardening walkthrough, funnel/accessibilità (DEC-54) | PASSED |
| `tests/admin/*` (dashboard, analytics, certificazioni, gestione, nuovi pannelli, richieste gruppo) | Regressione richiesta da `SPRINT_GOVERNANCE.md` riga 137 | PASSED, tutti |

Nessuna riga di scope Sprint 5-6 compare tra i 15 failed/3 flaky del run — vedi §1 per il dettaglio dei due bug trovati e risolti (DEC-56) e per i 2 failed non di scope (`TC-137`/`TC-182`) tuttora aperti come follow-up.

Claude non ha eseguito nessuno di questi run dal vivo, per costruzione della governance permanente (Fabrizio è l'unico ad eseguire Playwright dal vivo/`TEST_SCOPE=all`) — Claude ha letto gli artefatti prodotti dal run (log di output, `error-context.md`, query SQL di sola lettura) per diagnosticare i 2 bug e proporre i fix.

## 9. Modifiche di codice associate a questo documento

Aggiornamento post-prima-stesura: il primo `TEST_SCOPE=all` dal vivo (Fabrizio, DEC-56) ha rivelato 2 bug nel codice CenterLead/feature-flag, entrambi risolti con modifiche mirate:

- `lib/data/center-leads.ts` — disambiguazione embed PostgREST (`profiles!suggested_by`), fix bug reale (coda Admin CenterLead sempre vuota). Commit `f075bc1`.
- `tests/one/feature-flags.spec.ts` — fix locator Playwright (bug del test, non del prodotto). Commit `04d7563`.
- `docs/trama-one/analysis/DECISION_LOG.md` — DEC-56 (diagnosi + fix) e riconferma post-rerun. Commit `38fc778`, `b846c24`.

Nessuna migrazione toccata da questi fix. Nessun'altra modifica di codice associata a questo documento oltre a queste — resta comunque, per il resto, un gate di verifica e consolidamento, coerente con `AUDIT_CHECKPOINT_SPRINT_0/1/2.md`.

## 10. Commits and Files

Vedi §2 per l'elenco commit di Sprint 6. Riepilogo file principali toccati in questo arco (Sprint 5 già coperto da `SPRINT_5_FEATURE_PRESERVATION_MATRIX.md`, non ripetuto):

- `supabase/migration_17_center_leads.sql`, `migration_18_capacity_service.sql`, `migration_19_bookings_email_delivery_status.sql`, `migration_20_product_events.sql` — tutte applicate da Fabrizio (vedi §6).
- `lib/telemetry/known-events.ts` (nuovo), `lib/telemetry/events.ts` (riscritto), `lib/walkthrough/funnel.ts` (nuovo), `lib/walkthrough/data.ts` (esteso).
- `app/one/layout.tsx`, `app/center/one/layout.tsx`, `app/admin/one/layout.tsx`, `lib/feature-flags/resolve.ts`, `app/actions/walkthrough.ts` — wiring `persistProductEvent()`.
- `app/admin/one/page.tsx`, `app/one/WalkthroughCard.tsx` — Command Center + hardening walkthrough.
- `tests/one/product-events.spec.ts`, `tests/one/walkthrough-funnel.spec.ts` (nuovi), `tests/one/command-center.spec.ts` (aggiornato per TC-N611).
- `docs/trama-one/analysis/DECISION_LOG.md` (DEC-52..DEC-56), `docs/trama-one/analysis/FEATURE_PARITY_MATRIX.md` (righe 21-23), `docs/trama-one/TRANSITION_REGISTER.md`, `BuddyKids_Test_Case.xlsx` (righe TC-N612, TC-N613).
- **Commit di remediation post-gate (DEC-56, dopo la prima stesura di questo documento)**: `f075bc1` (fix `lib/data/center-leads.ts`), `04d7563` (fix `tests/one/feature-flags.spec.ts`), `38fc778` (DEC-56), `b846c24` (riconferma DEC-56).

## 11. Risks

| Rischio | Impatto | Mitigazione attuale |
|---|---|---|
| ~~Nessun `TEST_SCOPE=all` dal vivo dall'Integration Gate di Sprint 4~~ | — | **Risolto**: eseguito da Fabrizio, tutto lo scope Sprint 5-6 verde (vedi §1, §8.3) |
| **`TC-137`/`TC-182` falliti nel run del 2026-08-03, senza riscontro in nessun documento di triage esistente** (`GATE_C_TRIAGE_20260728.md`, `PRE_EXISTING_TEST_FAILURE_BASELINE.md`) | Non di scope Sprint 5-6 (`tests/genitori/profilo.spec.ts` TC-137 "richiedere cancellazione", `tests/genitori/prenotazione.spec.ts` TC-182 "raggruppa per settimana/figlio/attività", entrambo timeout — sintomo compatibile con latenza login/rete sotto carico, MA non confermato con evidenza diretta) | Nessuna diagnosi affermata senza prove (governance permanente). Item aperto, non bloccante per la chiusura di Sprint 5-6 (codice non toccato da questo arco) — richiede un rerun mirato/isolato (§13) per capire se è transitorio o un bug reale prima di poterlo classificare |
| `eslint .` non eseguito sull'intero repository in un'unica passata in questo gate | Porzioni di codice non toccate da Sprint 5-6 non ri-verificate in questo documento | Rischio basso: quelle porzioni non sono state modificate in questo arco, restano allo stato verificato nei checkpoint precedenti |
| CR-050 chiusa per riuso puro | Nessuno — è una conferma di completezza pregressa, non un rischio nuovo | DEC-53 documenta esplicitamente il ragionamento |

## 12. Rollback

Nessuna azione irreversibile eseguita da Claude in questo arco. Rollback disponibile a due livelli:
- **Codice**: ogni commit di Sprint 6 è granulare e singolarmente revertibile (`git revert <sha>`), nessuna dipendenza tra sprint diversi che impedisca un rollback parziale.
- **Database**: ciascuna delle 4 migrazioni ora applicate (`17`-`20`) ha una sezione ROLLBACK dedicata nel proprio file SQL, disponibile se Fabrizio dovesse aver bisogno di tornare indietro.

## 13. Piano di chiusura e fasi successive

**Chiusura Sprint 5-6 (fatto)**:

1. ~~Applicare le migrazioni~~ — fatto (§6, verificato dal vivo).
2. ~~Deploy del codice di Sprint 5-6~~ — fatto (commit `38fc778` e successivi).
3. ~~Eseguire `TEST_SCOPE=all` dal vivo~~ — fatto (§1, §8.3): tutto lo scope Sprint 5-6 verde, inclusi i 2 bug trovati e risolti in corsa (DEC-56, riconfermati PASSED).
4. **Nessun'altra azione di sviluppo è richiesta per dichiarare Sprint 5-6 chiusi dal lato codice** — lo scope tecnico di questo arco è integralmente implementato, verificato dal vivo e senza regressioni.

**Controlli che restano da fare (Fabrizio, in ordine di priorità)**:

1. **Investigare `TC-137`/`TC-182`** (§11): rilanciare i due test isolati (`npx playwright test tests/genitori/profilo.spec.ts --grep "TC-137"` e `tests/genitori/prenotazione.spec.ts --grep "TC-182"`, con `.env.test` sourced + `TEST_BASE_URL`) per capire se sono transitori (probabile, dato il pattern timeout-su-login già visto altrove per carico Vercel/Supabase) o un bug reale — nessuno dei due tocca codice di Sprint 5-6, quindi non blocca la chiusura di questo gate, ma va classificato prima di considerarlo "debito noto".
2. **Decidere se aggiornare la baseline**: se `TC-137`/`TC-182` si confermano transitori, aggiungerli a `GATE_C_TRIAGE_20260728.md`/`PRE_EXISTING_TEST_FAILURE_BASELINE.md` per non doverli re-investigare al prossimo run.
3. **Verifica finale opzionale**: `INCLUDE_MOBILE=1` (mobile-chrome, saltato di default su `TEST_SCOPE=all`) prima di un annuncio pubblico di rilascio, se lo si ritiene opportuno per questo Beta/Release.

**Fasi successive (nessuno sprint futuro ancora pianificato, §3)**:

1. Con Sprint 5-6 chiuso, il prossimo passo naturale è decidere lo scope del prossimo sprint/ciclo — nessuna decisione è stata presa finora, resta a Fabrizio definire priorità (nuove epic, hardening ulteriore, o pausa di stabilizzazione).
2. Se l'obiettivo è un rilascio Beta pubblico: verificare i punti ancora "shadow mode"/manuali noti (reward/commission CenterLead, §1 di `SPRINT_5_FEATURE_PRESERVATION_MATRIX.md`) sono accettabili per il pubblico target, o vanno completati prima.
3. Se emergono nuovi bug da `TC-137`/`TC-182` o da un futuro `TEST_SCOPE=all`, il pattern di remediation usato in DEC-56 (diagnosi con evidenza diretta — query SQL sola lettura + `error-context.md` — prima di ipotizzare un fix) resta la procedura di riferimento.

## 14. Audit Conclusion

**`AUDIT STATUS: READY`** (chiusura piena dello scope Sprint 5-6, con 1 item di follow-up non bloccante fuori scope)

Stessa convenzione di chiusura interna già usata per Sprint 1/2/3/4/5 (DEC-29/30), estesa in questo gate con un secondo ciclo: dopo la verifica statica e gli unit test "no browser" (invarianti rispetto alla prima stesura), Fabrizio ha eseguito il primo `TEST_SCOPE=all` dal vivo con le migrazioni applicate. Risultato: **tutto lo scope tecnico di Sprint 5 e Sprint 6 è verde**, inclusi i 2 bug emersi durante questo stesso run e risolti in corsa (DEC-56) — nessuna regressione introdotta, nessun test di scope Sprint 5-6 ancora rosso. Il run ha anche rivelato 15 failed/3 flaky totali: 13 failed + 3 flaky sono debito preesistente già documentato (`GATE_C_TRIAGE_20260728.md`, non di scope Sprint 5-6), 2 failed (`TC-137`, `TC-182`) sono nuovi/non ancora classificati e restano un item aperto non bloccante (§11, §13).

Questo è il punto di arresto designato dell'istruzione permanente che ha autorizzato l'intero arco Sprint 5-6 in autonomia. Nessuna ulteriore progressione autonoma di sprint avverrà oltre questo documento senza nuovo input di Fabrizio — le fasi successive (§13) restano una decisione sua.
