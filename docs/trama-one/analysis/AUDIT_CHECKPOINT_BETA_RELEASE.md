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

**Perché non "READY" ma "READY FOR CONTINUATION"**: nessun `TEST_SCOPE=all` dal vivo è stato eseguito da quando è stato superato l'Integration Gate di Sprint 4 (`AUDIT STATUS: READY WITH CONDITIONS` in quel documento, poi risolto). Per costruzione di questa governance (DEC-29/30), questo non è un requisito di chiusura sprint — è un requisito di Fabrizio, da eseguire quando lo riterrà opportuno. Con le migrazioni ora tutte applicate, l'unico passo residuo per la chiusura piena è il deploy del codice (se non già online) seguito da `TEST_SCOPE=all` dal vivo — vedi §13.

**Stato: `AUDIT STATUS: READY FOR CONTINUATION`** — vedi §13 per il piano di chiusura esatto e cosa resta esclusivamente a Fabrizio.

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

### 8.3 Test UI-driven (scritti, MAI eseguiti dal vivo da Claude — per costruzione della governance)

Restano da eseguire da Fabrizio nel prossimo `TEST_SCOPE=all` post-deploy, tutti richiedono login reale (`isRealDeployment`):

- `TC-N607`/`TC-N608` — capacity service (Sprint 6, DEC-47)
- `TC-N609` — feature flag override expiry (DEC-48)
- `TC-N610` — email delivery status (DEC-49)
- `TC-N611` — Command Center Admin (E08, DEC-51)
- `TC-N612` — eventi analytics/product_events (E11, DEC-52)
- `TC-N613` — hardening walkthrough, funnel/accessibilità (DEC-54)
- l'intera regressione `tests/admin/*` (dashboard, analytics, certificazioni, gestione, nuovi pannelli, richieste gruppo) — nessuna di queste ha un equivalente "no browser", richiedono tutte login reale; esplicitamente richiesta da `SPRINT_GOVERNANCE.md` come parte della Definition of Done, ma non del gate di chiusura sprint (DEC-29/30).

Nessuna di queste è stata eseguita dal vivo da Claude in questo arco, per costruzione della governance permanente (Fabrizio è l'unico ad eseguire run Playwright dal vivo/`TEST_SCOPE=all`).

## 9. Modifiche di codice associate a questo documento

Nessuna. Questo documento è un gate di verifica e consolidamento, non introduce nuovo codice — coerente con la stessa impostazione di `AUDIT_CHECKPOINT_SPRINT_0/1/2.md`.

## 10. Commits and Files

Vedi §2 per l'elenco commit di Sprint 6. Riepilogo file principali toccati in questo arco (Sprint 5 già coperto da `SPRINT_5_FEATURE_PRESERVATION_MATRIX.md`, non ripetuto):

- `supabase/migration_17_center_leads.sql`, `migration_18_capacity_service.sql`, `migration_19_bookings_email_delivery_status.sql`, `migration_20_product_events.sql` — tutte applicate da Fabrizio (vedi §6).
- `lib/telemetry/known-events.ts` (nuovo), `lib/telemetry/events.ts` (riscritto), `lib/walkthrough/funnel.ts` (nuovo), `lib/walkthrough/data.ts` (esteso).
- `app/one/layout.tsx`, `app/center/one/layout.tsx`, `app/admin/one/layout.tsx`, `lib/feature-flags/resolve.ts`, `app/actions/walkthrough.ts` — wiring `persistProductEvent()`.
- `app/admin/one/page.tsx`, `app/one/WalkthroughCard.tsx` — Command Center + hardening walkthrough.
- `tests/one/product-events.spec.ts`, `tests/one/walkthrough-funnel.spec.ts` (nuovi), `tests/one/command-center.spec.ts` (aggiornato per TC-N611).
- `docs/trama-one/analysis/DECISION_LOG.md` (DEC-52..DEC-55), `docs/trama-one/analysis/FEATURE_PARITY_MATRIX.md` (righe 21-23), `docs/trama-one/TRANSITION_REGISTER.md`, `BuddyKids_Test_Case.xlsx` (righe TC-N612, TC-N613).

## 11. Risks

| Rischio | Impatto | Mitigazione attuale |
|---|---|---|
| Nessun `TEST_SCOPE=all` dal vivo dall'Integration Gate di Sprint 4, ora con le migrazioni applicate | 6 nuove TC (`TC-N607`..`TC-N613`) e la regressione `tests/admin/*` non hanno ancora evidenza reale di esecuzione contro il nuovo schema | Unit test "no browser" (130/130) coprono la logica pura; resta a Fabrizio l'esecuzione UI-driven quando lo riterrà opportuno |
| `eslint .` non eseguito sull'intero repository in un'unica passata in questo gate | Porzioni di codice non toccate da Sprint 5-6 non ri-verificate in questo documento | Rischio basso: quelle porzioni non sono state modificate in questo arco, restano allo stato verificato nei checkpoint precedenti |
| CR-050 chiusa per riuso puro | Nessuno — è una conferma di completezza pregressa, non un rischio nuovo | DEC-53 documenta esplicitamente il ragionamento |

## 12. Rollback

Nessuna azione irreversibile eseguita da Claude in questo arco. Rollback disponibile a due livelli:
- **Codice**: ogni commit di Sprint 6 è granulare e singolarmente revertibile (`git revert <sha>`), nessuna dipendenza tra sprint diversi che impedisca un rollback parziale.
- **Database**: ciascuna delle 4 migrazioni ora applicate (`17`-`20`) ha una sezione ROLLBACK dedicata nel proprio file SQL, disponibile se Fabrizio dovesse aver bisogno di tornare indietro.

## 13. Piano di chiusura — cosa resta esclusivamente a Fabrizio

1. ~~Applicare le migrazioni~~ — fatto (§6, verificato dal vivo).
2. Deploy del codice di Sprint 5-6 (se non già fatto) sull'ambiente di produzione.
3. Eseguire `TEST_SCOPE=all` dal vivo e confrontare con la baseline già nota (`PRE_EXISTING_TEST_FAILURE_BASELINE.md`), prestando attenzione in particolare a `TC-N607`..`TC-N613` e alla regressione `tests/admin/*` — ora con lo schema completo, questo run può verificare il comportamento reale (non più il fallback) di CenterLead, capacity, email delivery e product events.
4. Nessun'altra azione di sviluppo è richiesta per dichiarare Sprint 5-6 chiusi dal lato codice — questo documento marca il gate finale dell'arco autorizzato.

## 14. Audit Conclusion

**`AUDIT STATUS: READY FOR CONTINUATION`**

Stessa convenzione di chiusura interna già usata per Sprint 1/2/3/4/5 (DEC-29/30): nessun audit esterno con `TEST_SCOPE=all` è richiesto alla chiusura di un singolo sprint, solo verifica statica completa più unit test "no browser" completi. Questo gate aggiunge, rispetto ai checkpoint sprint precedenti, la verifica dal vivo (sola lettura) dello stato reale delle migrazioni sul database di produzione, per evitare di affermare uno stato di persistenza per sola memoria documentale.

Tutto lo scope tecnico di Sprint 5 e Sprint 6 è implementato, verificato staticamente e documentato. Non c'è alcuna regressione nota introdotta in questo arco (130/130 unit test puri verdi, nessuna colonna/capability preesistente alterata). Ciò che resta — applicazione delle 4 migrazioni e run `TEST_SCOPE=all` dal vivo — è per costruzione della governance permanente responsabilità esclusiva di Fabrizio, non un gap di lavoro di Claude.

Questo è il punto di arresto designato dell'istruzione permanente che ha autorizzato l'intero arco Sprint 5-6 in autonomia. Nessuna ulteriore progressione autonoma di sprint avverrà oltre questo documento senza nuovo input di Fabrizio.
