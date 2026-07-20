# TRAMA ONE Build Sprint 0 — Runbook di attivazione

Documento SOLO documentale: nessuna istruzione SQL qui dentro è stata eseguita da Claude. Ogni comando va eseguito manualmente da Fabrizio, nello SQL Editor di Supabase (o `psql`), nell'ambiente che sceglie (staging o produzione). Nessuna credenziale reale è presente in questo file — ogni valore da sostituire è marcato con `<PLACEHOLDER>`.

Prerequisiti impliciti: `supabase/schema.sql` già applicato all'ambiente target (vedi `docs/trama-one/analysis/SPRINT_0_TECH_NOTES.md`, §1, per la nota sulla convenzione di bootstrap dello schema).

---

## 1. Applicare migration_07 (Feature Flag Engine)

1. Aprire lo SQL Editor di Supabase per l'ambiente target.
2. Aprire il file `supabase/migration_07_feature_flags_foundation.sql` del repository.
3. Copiare ed eseguire **solo il blocco compreso tra `begin;` e `commit;`** (il file contiene anche esempi/verifica/rollback come commenti SQL sotto quel blocco — non vanno eseguiti insieme, sono riferimento).
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

1. Stesso SQL Editor, stesso ambiente.
2. Aprire `supabase/migration_08_beta_cohort_memberships.sql`.
3. Copiare ed eseguire **solo il blocco compreso tra `begin;` e `commit;`**.
4. Indipendente da migration_07 (nessuna dipendenza reciproca tra le due tabelle, solo da `public.profiles`) — può essere applicata prima, dopo, o in una sessione separata.

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
