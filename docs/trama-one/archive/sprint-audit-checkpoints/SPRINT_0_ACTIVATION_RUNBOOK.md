# TRAMA ONE Build Sprint 0 — Runbook di attivazione

Documento SOLO documentale: nessuna istruzione SQL qui dentro è stata eseguita da Claude. Ogni comando va eseguito manualmente da Fabrizio, nello SQL Editor di Supabase (o `psql`), nell'ambiente che sceglie (staging o produzione). Nessuna credenziale reale è presente in questo file — ogni valore da sostituire è marcato con `<PLACEHOLDER>`.

Prerequisiti impliciti: `supabase/schema.sql` già applicato all'ambiente target (vedi `docs/trama-one/analysis/SPRINT_0_TECH_NOTES.md`, §1, per la nota sulla convenzione di bootstrap dello schema).

---

## 0. Decisione di governance registrata (RLS Reuse Remediation)

**Le nuove policy RLS devono riutilizzare `public.is_platform_admin()` invece di duplicare controlli inline, quando la semantica richiesta coincide.**

Contesto: un audit pre-esecuzione (TRAMA ONE SPRINT 0 — MIGRATION 07 PRE-EXECUTION AUDIT) ha rilevato che le policy RLS originarie di `migration_07`/`migration_08` duplicavano inline il controllo `exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin')` invece di riusare l'helper `public.is_platform_admin()` già definito in `schema.sql` (security definer, stable, nessun parametro) e già usato con lo stesso identico significato in `migration_04`, `migration_05`, `migration_06`. Verificata l'equivalenza semantica esatta prima della correzione (stesso comportamento, incluso il caso "nessun profilo per l'utente corrente"). Entrambi i file sono stati corretti di conseguenza — questa decisione resta vincolante per qualunque nuova policy RLS futura con la stessa esigenza (controllo "utente corrente è platform_admin").

## 1. Applicare migration_07 (Feature Flag Engine)

### 1.0 Pre-check (obbligatorio, prima di aprire lo SQL Editor)

Eseguire, in sola lettura, le 6 query della sezione `PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE` presente nel file `supabase/migration_07_feature_flags_foundation.sql` (subito dopo il `commit;` del blocco DDL). Riepilogo:

| # | Verifica | Risultato atteso su ambiente pulito |
|---|---|---|
| 1 | `public.profiles` esiste | 1 riga |
| 2 | `public.is_platform_admin()` esiste, security definer, stable, nessun parametro, ritorna boolean | 1 riga con quelle proprietà |
| 3 | `feature_flag_overrides` non esiste già | 0 righe |
| 4 | Nessun indice residuo su `feature_flag_overrides` | 0 righe |
| 5 | `set_feature_flag_overrides_updated_at()` non esiste già | 0 righe |
| 6 | Nessuna policy residua su `feature_flag_overrides` | 0 righe |

### Condizioni STOP

Non procedere con l'applicazione se: il punto 1 o il punto 2 del pre-check restituiscono 0 righe (dipendenze mancanti — l'ambiente non ha `schema.sql` applicato o è più vecchio di quanto documentato); uno dei punti 3-6 restituisce righe inattese senza una spiegazione nota (possibile applicazione parziale precedente non documentata — verificarne la definizione esatta prima di continuare); non si è certi di quale ambiente Supabase è selezionato nello SQL Editor; l'hash del file che si sta per incollare non coincide con quello confermato al punto 1.2 sotto.

### Condizioni GO

Procedere solo se: tutti i punti 1-6 del pre-check danno il risultato atteso (oppure un risultato diverso ma pienamente compreso e considerato sicuro); l'ambiente Supabase è stato confermato esplicitamente (punto 1.1); l'hash del file è stato confermato (punto 1.2).

### 1.1 Conferma dell'ambiente Supabase

Prima di incollare qualunque SQL, verificare nell'interfaccia di Supabase (in alto, selettore progetto) che il progetto/ambiente selezionato sia quello effettivamente voluto (staging o produzione) — nessuna delle query di questo runbook contiene un controllo automatico dell'ambiente. Annotare qui il nome del progetto Supabase su cui si sta per operare prima di procedere.

### 1.2 Conferma dell'hash del file da eseguire

Prima di copiare il contenuto, calcolare l'hash del file locale e confrontarlo con quello riportato di seguito (valido per il commit che ha introdotto questa versione — vedi Report finale della sessione "RLS reuse remediation" per il commit esatto):

```
sha256sum supabase/migration_07_feature_flags_foundation.sql
```

Hash atteso: `66cf634eda9b3648cf747a042f850b84fb41b4b7069702739621489c52850b69`

Se l'hash calcolato non coincide, STOP — il file locale non è la versione revisionata e approvata.

### 1.3 Applicazione

1. Aprire lo SQL Editor di Supabase per l'ambiente confermato al punto 1.1.
2. Aprire il file `supabase/migration_07_feature_flags_foundation.sql` del repository.
3. Copiare ed eseguire **solo il blocco compreso tra `begin;` e `commit;`** (il file contiene anche pre-check/esempi/verifica/rollback come commenti SQL fuori da quel blocco — non vanno eseguiti insieme, sono riferimento).
4. Se l'esecuzione fallisce a metà, Postgres annulla automaticamente l'intera transazione (nessuno stato parziale) — correggere l'errore e rieseguire l'intero blocco `begin;`...`commit;` da capo.

## 2. Verificare migration_07

Eseguire, uno alla volta, le query commentate nella sezione "VERIFICA POST-APPLICAZIONE" del file (dopo il `commit;`):

```sql
select relrowsecurity from pg_class where relname = 'feature_flag_overrides';
-- atteso: true (RLS abilitata)
```

```sql
select indexname from pg_indexes where tablename = 'feature_flag_overrides';
-- attesi: idx_feature_flag_overrides_unique_global,
--         idx_feature_flag_overrides_unique_user,
--         idx_feature_flag_overrides_unique_scoped,
--         idx_feature_flag_overrides_lookup
-- (oltre alla primary key)
```

Test funzionale di unicità (righe di prova, poi eliminarle):

```sql
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled)
  values ('TRAMA_ONE_ENABLED', 'environment', 'Production', true);
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled)
  values ('TRAMA_ONE_ENABLED', 'environment', ' production ', false);
-- la seconda INSERT deve fallire con violazione dell'unique index
-- idx_feature_flag_overrides_unique_scoped (stesso valore normalizzato)

delete from public.feature_flag_overrides where flag_name = 'TRAMA_ONE_ENABLED' and scope_type = 'environment';
```

## 3. Applicare migration_08 (Beta Cohort Memberships)

### 3.0 Pre-check (obbligatorio, prima di aprire lo SQL Editor)

Eseguire, in sola lettura, le 6 query della sezione `PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE` presente nel file `supabase/migration_08_beta_cohort_memberships.sql`. Riepilogo:

| # | Verifica | Risultato atteso su ambiente pulito |
|---|---|---|
| 1 | `public.profiles` esiste | 1 riga |
| 2 | `public.is_platform_admin()` esiste, security definer, stable, nessun parametro, ritorna boolean | 1 riga con quelle proprietà |
| 3 | `beta_cohort_memberships` non esiste già | 0 righe |
| 4 | Constraint `uq_beta_cohort_membership` non esiste già | 0 righe |
| 5 | `set_beta_cohort_memberships_updated_at()` non esiste già | 0 righe |
| 6 | Nessuna policy residua su `beta_cohort_memberships` | 0 righe |

### Condizioni STOP

Stesse condizioni STOP del punto 1 (dipendenze mancanti, righe inattese non spiegate, ambiente non confermato, hash non confermato).

### Condizioni GO

Stesse condizioni GO del punto 1, riferite a questo file.

### 3.1 Conferma dell'ambiente Supabase

Stessa verifica del punto 1.1 — riconfermare il progetto selezionato anche se si applica migration_08 nella stessa sessione di migration_07 (nessuna assunzione di continuità tra i due passi).

### 3.2 Conferma dell'hash del file da eseguire

```
sha256sum supabase/migration_08_beta_cohort_memberships.sql
```

Hash atteso: `9a7b1e9f45f859eeadb3fb62d4d8e2bec614049715a2d99468f86a7a25a68c6d`

Se l'hash calcolato non coincide, STOP.

### 3.3 Applicazione

1. Stesso SQL Editor, ambiente confermato al punto 3.1.
2. Aprire `supabase/migration_08_beta_cohort_memberships.sql`.
3. Copiare ed eseguire **solo il blocco compreso tra `begin;` e `commit;`**.
4. Indipendente da migration_07 (nessuna dipendenza reciproca tra le due tabelle, solo da `public.profiles` e `public.is_platform_admin()`) — può essere applicata prima, dopo, o in una sessione separata.

## 4. Verificare migration_08

```sql
select relrowsecurity from pg_class where relname = 'beta_cohort_memberships';
-- atteso: true
```

```sql
insert into public.beta_cohort_memberships (user_id, cohort_key)
  values ('<PLACEHOLDER_UUID_UTENTE_TEST>', 'beta-wave-1');
insert into public.beta_cohort_memberships (user_id, cohort_key)
  values ('<PLACEHOLDER_UUID_UTENTE_TEST>', 'beta-wave-1');
-- la seconda INSERT deve fallire per uq_beta_cohort_membership (duplicato)

delete from public.beta_cohort_memberships where cohort_key = 'beta-wave-1' and user_id = '<PLACEHOLDER_UUID_UTENTE_TEST>';
```

## 5. Trovare lo user_id dei tre account di test (Parent/Partner/Admin)

```sql
select id, email, role
from public.profiles
where email in ('<PLACEHOLDER_EMAIL_PARENT_TEST>', '<PLACEHOLDER_EMAIL_PARTNER_TEST>', '<PLACEHOLDER_EMAIL_ADMIN_TEST>');
```

Annotare i tre valori di `id` restituiti (UUID) — servono ai passi successivi. Se gli account di test non esistono ancora, crearli seguendo la procedura di signup normale dell'app (non è nello scope di questo runbook automatizzarlo).

## 6. Assegnare una coorte di test a un utente

```sql
insert into public.beta_cohort_memberships (user_id, cohort_key, active, created_by)
values ('<PLACEHOLDER_UUID_UTENTE>', 'beta-wave-1', true, auth.uid());
```

Ripetere per ciascuno dei tre account di test, se si vuole verificare tutti e tre i portali.

## 7. Creare l'override TRAMA_ONE_ENABLED per quella coorte

```sql
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, created_by)
values ('TRAMA_ONE_ENABLED', 'cohort', 'beta-wave-1', true, auth.uid());
```

Effetto: qualunque utente con una riga `active=true` in `beta_cohort_memberships` per `cohort_key = 'beta-wave-1'` vedrà la shell `/one` (o `/center/one`, `/admin/one` a seconda del ruolo) invece del fallback. Vedi `lib/feature-flags/evaluate.ts` per la precedenza esatta (user > role > cohort > tenant > environment > global).

Per attivare invece per un singolo utente specifico, senza coorte:

```sql
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, created_by)
values ('TRAMA_ONE_ENABLED', 'user', '<PLACEHOLDER_UUID_UTENTE>', true, auth.uid());
```

## 8. Disattivare immediatamente il flag (kill switch)

Opzione A — disattivare l'override esistente invece di eliminarlo (mantiene lo storico):

```sql
update public.feature_flag_overrides
set enabled = false
where flag_name = 'TRAMA_ONE_ENABLED' and scope_type = 'cohort' and scope_value = 'beta-wave-1';
```

Opzione B — disattivazione globale immediata, indipendentemente da qualunque override attivo (un override `global, enabled=false` ha comunque precedenza più bassa di `user`/`role`/`cohort`/`tenant` — se esistono override più specifici attivi, questi restano validi; per un kill switch totale usare l'Opzione C):

```sql
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, created_by)
values ('TRAMA_ONE_ENABLED', 'global', null, false, auth.uid())
on conflict (flag_name, scope_type) where scope_type = 'global'
do update set enabled = false, updated_by = auth.uid();
```

Opzione C — kill switch totale, elimina ogni override attivo per il flag (nessuna eccezione possibile):

```sql
delete from public.feature_flag_overrides where flag_name = 'TRAMA_ONE_ENABLED';
```

Dopo una qualunque delle tre opzioni, il default del registry (`false`, definito in `lib/feature-flags/registry.ts`) torna ad applicarsi ovunque non ci sia più un override attivo.

## 9. Rimuovere membership e override di test

```sql
delete from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED' and scope_type = 'cohort' and scope_value = 'beta-wave-1';

delete from public.beta_cohort_memberships
where cohort_key = 'beta-wave-1' and user_id in ('<PLACEHOLDER_UUID_UTENTE_1>', '<PLACEHOLDER_UUID_UTENTE_2>', '<PLACEHOLDER_UUID_UTENTE_3>');
```

## 10. Rollback completo (rimuove entrambe le tabelle)

Da eseguire solo se si decide di annullare integralmente Sprint 0 lato database. Sicuro: nessuna query Legacy/Next Gen esistente referenzia queste tabelle (verificato in fase di implementazione).

```sql
begin;
drop trigger if exists trg_feature_flag_overrides_updated_at on public.feature_flag_overrides;
drop function if exists public.set_feature_flag_overrides_updated_at();
drop table if exists public.feature_flag_overrides;
commit;
```

```sql
begin;
drop trigger if exists trg_beta_cohort_memberships_updated_at on public.beta_cohort_memberships;
drop function if exists public.set_beta_cohort_memberships_updated_at();
drop table if exists public.beta_cohort_memberships;
commit;
```

Le due tabelle sono indipendenti: si può fare rollback di una sola, o di entrambe, in qualunque ordine.

---

## Nota finale

Nessuno di questi comandi ha effetto sull'applicazione finché `TRAMA_ONE_ENABLED` non risulta `true` per lo specifico utente/ruolo/coorte/tenant/ambiente che sta effettuando la richiesta: in assenza di override, il default resta `false` per chiunque (vedi `lib/feature-flags/registry.ts`). Applicare le migrazioni da sole (passi 1-4) non attiva nulla.
