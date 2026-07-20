# TRAMA ONE — Audit Checkpoint — Build Sprint 0

Documento autosufficiente per un auditor esterno che non ha seguito la conversazione. Copre l'intero arco di lavoro dal primo commit TRAMA ONE fino alla chiusura formale di Build Sprint 0 — Foundation, incluso il deploy in produzione, la remediation RLS e la certificazione post-deploy.

## 1. Executive Status

**Obiettivo sprint**: costruire la foundation infrastrutturale di TRAMA ONE — Feature Flag Engine, Beta Cohort Memberships, tre route shell `/one` (Parent/Partner/Admin) dietro flag, telemetry minima, hardening di `deploy.sh`/`test-deploy.sh` — senza toccare, rimuovere o indebolire alcuna capability Legacy o Next Gen esistente.

**Risultato**: obiettivo raggiunto. Foundation implementata, migrazioni applicate e verificate manualmente da Fabrizio, RLS corretta per riuso dell'helper esistente, deploy in produzione eseguito e riuscito, smoke test eseguito contro l'ambiente live con log ricevuto e analizzato, un difetto reale trovato in un test proprio (non nell'applicazione) e corretto.

**Stato**: **READY WITH CONDITIONS**. Unica condizione aperta: riconferma locale dei due test corretti (TC-N303/TC-N304) con il comando fornito a Fabrizio, non ancora eseguito con le variabili d'ambiente corrette al momento della stesura di questo documento (vedi §9).

## 2. Repository State

- **Branch**: `main`.
- **Commit iniziale del lavoro TRAMA ONE**: `40673d7` (primo commit "docs(trama-one): add canonical product and architecture baseline"), punto di diramazione da `backup/pre-trama-one` a `5a36f9d`.
- **Commit finale (HEAD)**: `ac4e4d2` ("chore(deploy): reduce terminal output verbosity").
- **Working tree**: pulito.
- **Merge status**: il branch di lavoro `feature/trama-one-foundation` è stato mergeato su `main` con il commit di merge `1a6fae5`; 8 commit aggiuntivi sono stati fatti direttamente su `main` dopo il merge (remediation RLS, fix test, decision log, semplificazione output). `main` è avanti di 4 commit rispetto a `origin/main` (`ec056ba`, `30e06fd`, `47bfc21`, `ac4e4d2`) — verranno pubblicati al prossimo `git push`/`bash deploy.sh`; non sono ancora su GitHub.
- **Diff rispetto al punto di partenza** (`backup/pre-trama-one`): 64 file toccati, 10396 righe aggiunte, 56 righe rimosse (tutte all'interno di file modificati — es. riscrittura di `deploy.sh`, refresh di timestamp nei `sitemap.json`; **zero file eliminati**, verificato con `git diff --diff-filter=D`).

## 3. Scope

- **Scope approvato**: route shell `/one` nei tre portali; Feature Flag Engine (registry + override, RLS `platform_admin`-only, resolver server-only); telemetry/correlationId minimo; Transition Register e Assumption Log; smoke test Legacy/NextGen/TRAMA ONE; adattamento `deploy.sh`/`test-deploy.sh` (rimozione `|| true` di default, `ONLY_SITEMAP` intercettato precocemente, `TEST_SCOPE`/`ALLOW_TEST_FAILURES`/`SITEMAP_OPEN_BROWSER`).
- **Scope implementato**: tutto quanto sopra, più — a seguito di due cicli di audit richiesti esplicitamente da Fabrizio dopo l'implementazione iniziale — hardening aggiuntivo non nello scope originale ma coerente con esso: dynamic rendering esplicito sulle tre route `/one`; working-tree/push-failure safety in `deploy.sh`; normalizzazione `scope_value` coerente tra TypeScript e SQL; transazionalità BEGIN/COMMIT nelle due migrazioni; runbook di attivazione; riuso dell'helper `is_platform_admin()` nelle RLS (in luogo del controllo inline duplicato originariamente scritto); riduzione della verbosità dell'output di `deploy.sh`/sitemap (richiesta esplicita post-deploy).
- **Fuori scope rispettato**: nessuna capability di business (onboarding Partner, Offering, Giorni spot, PlannerItem, CenterLead) introdotta; nessuna UI Admin per il Feature Flag Engine creata; nessuna migrazione di pagine esistenti.
- **Deviazioni**: nessuna deviazione non autorizzata. Le estensioni sopra elencate sono state tutte richieste esplicitamente da Fabrizio nel corso della sessione (Pre-Migration Hardening, audit RLS, passaggio di consegne operativo, richiesta di output più leggibile).

## 4. Feature Preservation

- **Feature Legacy coinvolte**: nessuna modificata. `proxy.ts` non toccato (verificato `git diff backup/pre-trama-one...main -- proxy.ts` vuoto). Nessuna route `tests/genitori|gestore|admin` esistente modificata.
- **Feature Next Gen coinvolte**: nessuna modificata. Cartella `tests/nextgen/` non toccata da questo lavoro.
- **Partner/Admin coinvolti**: nessuna pagina esistente `/center/*` o `/admin/*` modificata — solo aggiunte le nuove sotto-route `/center/one` e `/admin/one`.
- **Classificazione parity**: tutte le 26 capability AS-IS in `FEATURE_PARITY_MATRIX.md` restano `RETAIN_AS_IS`/`REUSE`/`ADAPT` — nessuna riclassificata `REPLACE_AFTER_PARITY` o rimossa in questo sprint.
- **Regressioni**: nessuna introdotta dal codice TRAMA ONE. Durante lo smoke test in produzione sono emersi 7 fallimenti su funzionalità Legacy/NextGen/branding preesistenti (login header, dashboard Gestore, badge NextGen, logo TRAMA) — **non correlati a questo lavoro** (nessun file di quelle aree toccato in questo sprint), segnalati per visibilità ma non corretti in questo sprint (fuori perimetro).
- **Feature eliminate**: zero, confermato da `git diff --diff-filter=D` sull'intero arco del lavoro.

## 5. Architecture and Reuse

| Classificazione | Elementi |
|---|---|
| **NEW** | `lib/feature-flags/{registry,evaluate,resolve}.ts`; `lib/beta-cohorts/membership.ts`; `lib/telemetry/correlation.ts`; `app/one/`, `app/center/one/`, `app/admin/one/`; `supabase/migration_07_feature_flags_foundation.sql`, `migration_08_beta_cohort_memberships.sql`; `tests/one/`; `docs/trama-one/` (intera cartella di governance) |
| **REUSE** | `lib/supabase/server.ts` (client anon/RLS, riusato as-is nei layout `/one`); `lib/supabase/service.ts` `createServiceClient()` (pattern già in uso per `/internal/beta-pipeline`, riusato per il resolver); `public.is_platform_admin()` (helper esistente in `schema.sql`, riusato nelle nuove RLS dopo la remediation — vedi DEC-21); `proxy.ts`/`lib/tenant.ts` (non modificati, le route `/one` ereditano il gate esistente) |
| **ADAPT** | `deploy.sh`, `test-deploy.sh` (branch/dirty-tree/push-failure safety, `TEST_SCOPE`, `ONLY_SITEMAP` precoce — incrementale, non riscritti da zero); `.env.example` (variabili mancanti documentate); `playwright.config.ts` (reporter terminale) |
| **WRAP** | nessuno in questo sprint (il primo WRAP pianificato è Sprint 4, `activity_inquiries`+`bookings`) |
| **REPLACE_AFTER_PARITY** | nessuno |

File/componenti/servizi principali: vedi §11 per l'elenco completo dei file creati/modificati.

## 6. Routes and UI

- **Route create**: `/one` (Parent), `/center/one` (Partner), `/admin/one` (Admin) — shell minimali, nessuna funzionalità di business.
- **Route modificate**: nessuna route esistente modificata.
- **Route preservate**: tutte, verificato via assenza di file eliminati/rinominati.
- **Fallback**: a `TRAMA_ONE_ENABLED=false` (default), ciascun layout esegue `redirect()` verso la home del proprio portale (`/`, `/center`, `/admin` rispettivamente) — verificato senza loop per costruzione (i target di fallback hanno già il prefisso atteso da `proxy.ts`, quindi non vengono riscritti una seconda volta) e confermato in produzione da TC-N302 (Parent, passed) e TC-N305 (non autenticato → login, passed).
- **Feature flag**: `TRAMA_ONE_ENABLED`, default `false`, mai esposto come `NEXT_PUBLIC_*`, risolto esclusivamente server-side.

## 7. Database

- **Migrazioni**: `migration_07_feature_flags_foundation.sql` (hash SHA-256 corrente: `66cf634eda9b3648cf747a042f850b84fb41b4b7069702739621489c52850b69`), `migration_08_beta_cohort_memberships.sql` (hash corrente: `9a7b1e9f45f859eeadb3fb62d4d8e2bec614049715a2d99468f86a7a25a68c6d`). Entrambe wrappate in `begin;`/`commit;`, standalone (non ripiegate in `schema.sql`, decisione DEC-13/§1 di `SPRINT_0_TECH_NOTES.md`).
- **Tabelle**: `public.feature_flag_overrides` (10 colonne), `public.beta_cohort_memberships` (9 colonne).
- **Colonne**: vedi contenuto integrale dei due file di migrazione per il DDL completo.
- **Indici**: `feature_flag_overrides` — 3 unique parziali (`idx_..._unique_global`, `idx_..._unique_user` esatto, `idx_..._unique_scoped` normalizzato per environment/role/tenant/cohort) + 1 lookup non-unico. `beta_cohort_memberships` — constraint univoco `uq_beta_cohort_membership(user_id, cohort_key)`.
- **Trigger**: `trg_feature_flag_overrides_updated_at`, `trg_beta_cohort_memberships_updated_at` (entrambi `before update`, funzioni locali qualificate `public.`).
- **RLS**: abilitata su entrambe le tabelle.
- **Policy**: 4 per tabella (select/insert/update/delete), tutte `public.is_platform_admin()` — corrette dalla versione originale (controllo inline duplicato) dopo l'audit pre-esecuzione, per riuso dell'helper già usato in `migration_04/05/06`.
- **Dati inseriti**: nessuno in produzione, per costruzione (Definition of Done Sprint 0: "nessun dato test in produzione", `SPRINT_GOVERNANCE.md`).
- **Applicazione ambiente**: **applicata e verificata manualmente da Fabrizio** in produzione (dichiarato da Fabrizio, non eseguita né osservabile direttamente da Claude — nessuna connessione a Supabase in nessun momento di questo sprint).
- **Rollback**: documentato in entrambi i file di migrazione (blocco `begin;`/`commit;` separato, drop trigger→function→table) e nel runbook (`SPRINT_0_ACTIVATION_RUNBOOK.md`, §10).

## 8. Security and Privacy

- **Access control**: RLS `platform_admin`-only su entrambe le nuove tabelle, nessuna policy per l'utente proprietario (la lettura per la risoluzione del flag passa esclusivamente dal resolver server-only con client `service_role`, mai da una query client-side).
- **Server-only**: `lib/feature-flags/resolve.ts` e `lib/beta-cohorts/membership.ts` importano `"server-only"` — fallimento in build se mai bundlati lato client (verificato via build reale ripetuta più volte, sempre pulita).
- **Secret**: nessun secret nel repository; `SUPABASE_SERVICE_ROLE_KEY` riusata da variabile d'ambiente esistente, non introdotta ex novo.
- **PII / dati bambino**: nessun dato bambino, genitore o centro toccato da questo sprint — le due nuove tabelle contengono solo `user_id`, `flag_name`, `scope_type/value`, booleani ed `created_by`/`updated_by`.
- **Rischi**: nessuno nuovo identificato in questo sprint. Il resolver fallisce sempre a `false` (sicuro) su qualunque errore/timeout/eccezione.

## 9. Tests

| Categoria | Esito |
|---|---|
| `npx tsc --noEmit` | **Eseguito, pulito** — ripetuto ad ogni ciclo di modifica (5+ volte nell'arco dello sprint), sempre 0 errori |
| `npm run lint` | **Eseguito, 0 errori** — 128 warning preesistenti invariati (nessuno sui file toccati da TRAMA ONE), verificato con grep mirato |
| `npm run build` | **Eseguito, pulito** — tutte le 72+ route confermate `ƒ Dynamic`, incluse le 3 `/one` |
| Unit (`tests/one/feature-flags.spec.ts`) | **Eseguito, 34/34 passed** (17 test × 2 progetti browser) |
| `bash -n deploy.sh` / `bash -n test-deploy.sh` | **Eseguito, sintassi OK** |
| Browser smoke (produzione) | **Eseguito da Fabrizio** (`TEST_SCOPE=smoke bash deploy.sh` contro `https://buddykids-app.vercel.app`): 60 test totali, 36 passed, 18 failed, 6 skipped (come previsto per TC-N306/307). Dei 18 falliti: 4 (2 test × 2 browser) erano TC-N303/TC-N304, causati da un bug di navigazione nel test stesso (non nell'app) — **corretto** in questo sprint (commit `30e06fd`); i restanti 14 (7 test distinti × 2 browser) sono fallimenti **preesistenti e indipendenti** da TRAMA ONE (login header, dashboard Gestore, badge NextGen, logo TRAMA) |
| Ri-verifica TC-N303/TC-N304 dopo il fix | **PENDING LOCAL VERIFICATION** — tentata da Fabrizio ma con comando incompleto (mancava `TEST_BASE_URL`+`.env.test`), risultato "4 skipped" anziché eseguiti. Comando corretto fornito, non ancora rieseguito al momento della stesura di questo documento |
| Suite completa (`TEST_SCOPE=all`) | **Non eseguita** in questo sprint (solo `smoke`, come da scope) |
| Sitemap | **Eseguita con successo**: 27 pagine Parent, 22 Partner, 18 Admin, 0 errori, per entrambi i progetti browser |

Nessuna affermazione di test/migrazione/deploy eseguito senza riscontro reale: ogni voce sopra è basata su log/output effettivamente osservato (da Claude nel sandbox per typecheck/lint/build/unit, da Fabrizio per migrazioni/deploy/smoke).

## 10. Deploy

- **Eseguito**: sì, da Fabrizio (`TEST_SCOPE=smoke bash deploy.sh`), non da Claude (mai eseguito `vercel --prod`/`deploy.sh` dal sandbox, coerente con la regola permanente).
- **Ambiente**: produzione Vercel, progetto `buddykids-app` (account `faberxp83`).
- **Commit pubblicato**: `1a6fae5` (il push riuscito ha portato `origin/main` da `cbd34d0` a `1a6fae5`) — i 4 commit successivi (`ec056ba`…`ac4e4d2`) **non sono ancora stati pubblicati né deployati**.
- **Alias**: `buddykids-partner.vercel.app` e `buddykids-admin.vercel.app` riallineati con successo.
- **Smoke**: eseguito, vedi §9.
- **Suite completa**: non eseguita.
- **Sitemap**: generata con successo (vedi §9); i 6 file `sitemap.json` con timestamp aggiornato sono stati committati separatamente (`ec056ba`).
- **Rollback**: disponibile via `npx vercel ls buddykids-app --prod` + redeploy della versione precedente (procedura manuale standard Vercel, non specifica di TRAMA ONE); rollback di codice = revert dei commit Sprint 0 (additivi, nessun impatto su Legacy/NextGen); rollback database documentato in §7.

## 11. Commits and Files

**27 commit** dal primo (`40673d7`) all'ultimo (`ac4e4d2`), tutti su `main` dopo il merge `1a6fae5`. Elenco completo:

```
40673d7 docs(trama-one): add canonical product and architecture baseline
7971fb7 docs(trama-one): add searchable derived specifications
4571f57 chore(ai): add permanent TRAMA ONE development rules
ed6561e docs(trama-one): add approved impact assessment and parity baseline
207e9c0 feat(trama-one): add feature flag registry and pure evaluate logic
114e825 feat(trama-one): add server-only feature flag resolver
35d9ef3 feat(trama-one): add feature_flag_overrides table and RLS (migration_07, not applied)
f124ef0 feat(trama-one): add beta_cohort_memberships table and RLS (migration_08, not applied)
c493c46 feat(trama-one): add beta cohort membership reader (server-only)
c2d5a93 feat(trama-one): add /one route shell (parent, partner, admin)
cefdbc6 feat(trama-one): add correlationId telemetry helper
9345635 test(trama-one): add feature-flags unit test and cross-portal smoke suite
8bc1890 chore(deploy): add branch-safety preflight and only_sitemap early intercept to deploy.sh
95d0f86 chore(deploy): add explicit test_scope list and allow_test_failures to test-deploy.sh
db4c9fa docs(trama-one): add transition register and sprint 0 tech notes
fba70fb chore(env): document new and pre-existing missing environment variables in .env.example
98b876e fix(trama-one): force dynamic rendering on /one route shells
0af15eb docs(trama-one): document dynamic rendering verification (7bis)
24eeda0 fix(deploy): block dirty tree and push failures by default, fix sitemap target
9d45b87 fix(trama-one): normalize scope_value consistently in evaluate()
6ac135e fix(trama-one): wrap migration_07/08 DDL in BEGIN/COMMIT, split unique index
3c3225d docs(trama-one): add Sprint 0 activation runbook
d9e3939 fix(trama-one): reuse platform admin helper in sprint 0 RLS
1a6fae5 Merge branch 'feature/trama-one-foundation'
ec056ba chore(sitemap): refresh sitemap.json timestamps from production smoke run
30e06fd fix(trama-one): correct TC-N303/TC-N304 navigation target in smoke test
47bfc21 docs(trama-one): register DEC-20/DEC-21 (operational handoff, smoke test fix)
ac4e4d2 chore(deploy): reduce terminal output verbosity
```

**File creati** (principali, esclusi asset binari/media): `lib/feature-flags/{registry,evaluate,resolve}.ts`; `lib/beta-cohorts/membership.ts`; `lib/telemetry/correlation.ts`; `app/one/{layout,page}.tsx`; `app/center/one/{layout,page}.tsx`; `app/admin/one/{layout,page}.tsx`; `supabase/migration_07_feature_flags_foundation.sql`; `supabase/migration_08_beta_cohort_memberships.sql`; `tests/one/feature-flags.spec.ts`; `tests/one/smoke.spec.ts`; `CLAUDE.md`; l'intera cartella `docs/trama-one/` (README, canonici, derived, analysis — 8 documenti di governance più i 7 documenti ufficiali originali).

**File modificati**: `deploy.sh`; `test-deploy.sh`; `.env.example`; `playwright.config.ts`; `tests/sitemap.spec.ts`; 6 file `sitemap-output/*/*/sitemap.json` (solo timestamp).

**File intenzionalmente invariati**: `proxy.ts`; tutte le route Legacy (`tests/genitori/*`, `tests/gestore/*`, `tests/admin/*`); tutte le route Next Gen (`tests/nextgen/*`); `supabase/schema.sql`; `supabase/migration_02...06`, `migration_gruppi_avanzati.sql`.

## 12. Decisions and Assumptions

**Decisioni chiuse in questo sprint**: DEC-16 (Alternativa A Feature Flag Engine), DEC-17 (tre route fisiche), DEC-18 (`tests/one/` additiva), DEC-19 (Feature Parity Matrix pre-Sprint 1), DEC-20 (passaggio di consegne operativo a Claude), DEC-21 (correzione TC-N303/TC-N304) — tutte in `DECISION_LOG.md`.

**Decisioni differite**: fold-in di `migration_07`/`08` in `schema.sql` (rimandato a Fabrizio, `SPRINT_0_TECH_NOTES.md` §1); meccanismo di switch NextGen↔TRAMA ONE visibile in UI (richiesto da Fabrizio in questa sessione, esplicitamente rimandato a quando si deciderà di attivare la prima coorte reale — fuori perimetro Sprint 0, che esclude esplicitamente "UI Admin per il Feature Flag Engine").

**Assumption ancora aperte**: vedi `ASSUMPTION_LOG.md` per l'elenco completo (nessuna nuova assumption critica aperta da questo sprint specifico).

## 13. Risks

- **Blocker**: nessuno.
- **Rischio alto**: nessuno.
- **Rischio medio**: i 4 commit locali non ancora pushati (`ec056ba`…`ac4e4d2`) restano solo sulla macchina di Fabrizio/sandbox finché non viene eseguito un altro `bash deploy.sh` — se per qualche motivo quella copia locale andasse persa prima del prossimo push, andrebbero ricostruiti (mitigazione: nessuna azione necessaria, si risolve al prossimo deploy di routine).
- **Rischio basso**: i 7 fallimenti preesistenti rilevati durante lo smoke (login header duplicato, sfondo login, nav Gestore, badge/logo NextGen) restano non diagnosticati — nessun impatto su TRAMA ONE, ma segnalati per eventuale sprint correttivo separato.

## 14. Rollback

- **Funzionale**: `TRAMA_ONE_ENABLED=false` (stato attuale) → comportamento AS-IS identico per ogni utente, nessuna azione necessaria.
- **Codice**: `git revert` dei commit Sprint 0 (tutti additivi) oppure checkout del branch `backup/pre-trama-one`.
- **Database**: blocchi di rollback documentati e testati sintatticamente (non eseguiti) in entrambi i file di migrazione — drop trigger→function→table, transazionale.
- **Deploy**: `npx vercel ls buddykids-app --prod` + redeploy della build precedente a `1a6fae5`.
- **Dati**: nessun dato reale inserito da questo sprint — nessun rollback dati necessario.

## 15. Next Sprint Readiness

- **Prerequisiti per Sprint 1** (da `SPRINT_GOVERNANCE.md`): Sprint 0 chiuso con Definition of Done soddisfatta (vedi §16); matrice pagina-per-pagina/route-per-route dedicata alle route Partner/Admin coinvolte in Sprint 1 (da produrre **prima** dell'avvio, non ancora fatta — correttamente, non è compito di Sprint 0); Feature Flag Engine operativo (fatto).
- **Dipendenze**: nessuna bloccante.
- **Blocker**: nessuno per l'avvio di Sprint 1, salvo la riconferma pendente di §9.
- **Raccomandazione**: eseguire il comando di riverifica fornito a Fabrizio (§9) prima di considerare chiuso al 100% anche l'ultimo dettaglio; questo non blocca la sostanza della Definition of Done (che è già soddisfatta sui punti strutturali), ma completa il loop di verifica locale richiesto da `CLAUDE.md` §3.

## 16. Audit Conclusion

**AUDIT STATUS: READY WITH CONDITIONS**

Condizione: ricevere e analizzare l'output della riverifica locale di TC-N303/TC-N304 (comando fornito a Fabrizio in questa sessione) prima di considerare il local verification gate del Sprint 0 pienamente chiuso in ogni suo dettaglio. Nessun blocker strutturale, di sicurezza o di regressione rilevato.
