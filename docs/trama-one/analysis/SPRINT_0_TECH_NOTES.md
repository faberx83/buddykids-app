# TRAMA ONE Build Sprint 0 — Note tecniche di implementazione

Documento tecnico di supporto ai file già approvati in questa cartella (`TRAMA_ONE_Impact_Assessment_v1.0.md`, `ASSUMPTION_LOG.md`, `DECISION_LOG.md`, `FEATURE_PARITY_MATRIX.md`, `SPRINT_GOVERNANCE.md`), che restano non modificati. Registra le decisioni tecniche prese durante l'implementazione effettiva di Sprint 0 e le questioni aperte emerse.

## 1. Bootstrap schema — decisione necessaria (non presa autonomamente)

Verificato prima di creare `migration_07`/`migration_08`, come richiesto dal comando di avvio sprint:

- `migration_07`/`migration_08` non erano numeri già usati (confermato, `ls supabase/` prima della creazione).
- **`supabase/schema.sql` non è un semplice schema iniziale**: è tenuto come schema cumulativo nel tempo. Prova diretta: la riga 1198 di `schema.sql` contiene il commento `-- MIGRATION 06 (folded in) — ...`, e la tabella `beta_feedback` (introdotta in Sprint storico 8) è presente in `schema.sql` come `create table if not exists` diretto — il file standalone originale che l'aveva introdotta (`sprint8_beta_pipeline_migration.sql`, citato in un commento a fine `schema.sql`) non esiste più nel repository. Inoltre colonne aggiunte da `migration_02_home_search.sql` tramite `alter table ... add column` (es. `centers.gradient`, `activities.img_gradient`/`days`/`hours`) risultano **già presenti direttamente nelle `create table` di `schema.sql`**, non aggiunte via ALTER separato.
- Questo suggerisce fortemente che la convenzione reale del repository sia: le funzionalità via via consolidate vengono ripiegate direttamente nelle definizioni di `schema.sql`, che resta l'unico script necessario per un nuovo ambiente (coerente con `README.md` riga 40: "esegui il contenuto di `supabase/schema.sql`", senza menzionare l'esecuzione dei `migration_NN` per un nuovo ambiente).
- **Non è stato verificato con certezza** se questo valga per *tutti* i migration_NN esistenti (02-06 + gruppi_avanzati) o solo per alcuni.
- **Decisione presa in questo sprint**: `migration_07` e `migration_08` restano **file standalone**, non ripiegati in `schema.sql`. Questo è deliberatamente conservativo: non tocca `schema.sql` (vietato esplicitamente dal comando di avvio sprint) e rende esplicito, tramite un lungo commento in testa a ciascun file di migrazione, che la decisione di un eventuale fold-in futuro spetta a Fabrizio.
- **Conseguenza pratica per un nuovo ambiente oggi**: chi esegue solo `schema.sql` su un progetto Supabase nuovo NON avrà `feature_flag_overrides` né `beta_cohort_memberships` — dovrà eseguire anche `migration_07_feature_flags_foundation.sql` e `migration_08_beta_cohort_memberships.sql` in sequenza dopo `schema.sql`. Questo va comunicato esplicitamente in qualunque futura istruzione di bootstrap (vedi §20 del report finale di sprint).

## 2. correlationId — scelta di non persistere in un cookie

`lib/telemetry/correlation.ts` genera un correlationId nuovo ad ogni richiesta ai layout `/one`, usato solo per correlare i log emessi durante quella stessa richiesta (accesso alla route, risoluzione flag, eventuale errore). Non viene scritto in un cookie perché: (a) Next.js non permette di scrivere cookie da un Server Component durante il render — solo da Server Action o Route Handler; (b) `proxy.ts`, l'unico punto che intercetta ogni richiesta prima del layout, resta esplicitamente non modificato in questo sprint. La propagazione cross-richiesta (correlationId di sessione, utile per un vero sistema di analytics) è quindi rinviata a Build Sprint 6 (E11) — registrato come nota in `lib/telemetry/correlation.ts` stesso e in `TRANSITION_REGISTER.md`.

## 3. Fallback `/one` — scelta di route fisse (non consapevoli di `bk_version`)

I tre layout `/one` fanno fallback sempre alla radice del portale (`/` per Parent, `/center` per Partner, `/admin` per Admin), non alla variante Legacy/NextGen indicata dal cookie `bk_version`. Scelta deliberata per minimizzare il rischio di loop di redirect (analizzato e scartato in fase di piano: un fallback "consapevole" per Partner/Admin avrebbe richiesto verificare l'interazione con la riscrittura generica di `proxy.ts` verso `/center`/`/admin`, non completamente verificabile senza un ambiente Vercel reale). Le tre route di fallback sono verificate per costruzione prive di loop: nessuna di esse ha bisogno di ulteriore riscrittura da parte di `proxy.ts` (vedi commenti nei singoli file `app/one/layout.tsx`, `app/center/one/layout.tsx`, `app/admin/one/layout.tsx`).

## 4. Procedura di assegnazione coorte beta (Sprint 0, nessuna UI)

Per assegnare un utente a una coorte beta in questo sprint, unica via ammessa: SQL diretto nello SQL Editor di Supabase (o script amministrativo equivalente), come `platform_admin`:

```sql
insert into public.beta_cohort_memberships (user_id, cohort_key, active, created_by)
values ('<uuid-utente>', 'beta-wave-1', true, auth.uid());
```

Per disattivare: `update public.beta_cohort_memberships set active = false where user_id = '<uuid>' and cohort_key = 'beta-wave-1';` — non c'è delete previsto come procedura standard (si preferisce `active=false` per mantenere lo storico), ma il rollback della tabella intera resta disponibile (vedi file di migrazione).

## 5. Procedura di attivazione flag per un singolo utente/coorte (Sprint 0, nessuna UI)

```sql
-- Per un singolo utente:
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, created_by)
values ('TRAMA_ONE_ENABLED', 'user', '<uuid-utente>', true, auth.uid());

-- Per un'intera coorte (richiede che l'utente sia anche in beta_cohort_memberships con la stessa cohort_key):
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, created_by)
values ('TRAMA_ONE_ENABLED', 'cohort', 'beta-wave-1', true, auth.uid());
```

Entrambe le tabelle vanno prima applicate (vedi §20 del report finale) — nessuna di queste istruzioni funziona finché `migration_07`/`migration_08` non sono state eseguite manualmente da Fabrizio.

## 6. Perché `evaluate.ts` e `resolve.ts` sono due file separati

Richiesto esplicitamente nel Final Plan Correction (punto 3): `evaluate.ts` è logica pura (nessun I/O), testabile senza mock di Supabase — è quello che `tests/one/feature-flags.spec.ts` esercita direttamente. `resolve.ts` fa solo I/O (override, membership, contesto, logging) e delega ogni decisione a `evaluate.ts`. Questo separa "cosa decide il flag" (testabile, deterministico) da "dove prendiamo i dati per decidere" (dipendente da Supabase, non testabile in questo sandbox).

## 7. Limiti noti, non risolti in questo sprint

- La validazione "il flag esiste nel registry prima dell'INSERT" non è a livello database (impossibile, il registry è TypeScript) — resta una disciplina operativa documentata nei commenti dei file di migrazione, non un vincolo enforced.
- Nessun test automatico verifica che `resolve.ts`/`membership.ts` restino effettivamente non importabili da un Client Component: la garanzia viene dal pacchetto `server-only` (fallimento in build), verificabile solo con una build reale (`npm run build`), non con un test dedicato in questo sprint.
- Gli scenari "flag=true" e "resolver error" in `tests/one/smoke.spec.ts` sono presenti ma skippati con istruzioni esplicite: richiedono uno stato specifico in tabella (rispettivamente un override attivo e una condizione di errore DB) che non è predisponibile in modo sicuro da questo sandbox.
