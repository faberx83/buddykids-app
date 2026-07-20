-- Migrazione 07 — TRAMA ONE Build Sprint 0: Feature Flag Engine (foundation).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Creato come parte del
-- piano approvato (docs/trama-one/analysis/TRAMA_ONE_Impact_Assessment_v1.0.md,
-- Addendum tecnico finale, Final Plan Correction, Pre-Migration Hardening).
-- Va eseguito manualmente da Fabrizio nello SQL Editor di Supabase, DOPO
-- supabase/schema.sql, su qualunque ambiente (esistente o nuovo) che non
-- abbia già queste tabelle. Procedura passo-passo:
-- docs/trama-one/analysis/SPRINT_0_ACTIVATION_RUNBOOK.md
--
-- NOTA SULLA CONVENZIONE DEL REPOSITORY (verificata prima di creare questo
-- file, come richiesto): supabase/schema.sql in questo repository NON è un
-- semplice "schema iniziale" — nel tempo il contenuto di alcune migrazioni
-- standalone è stato "ripiegato" (folded in) direttamente nelle definizioni
-- CREATE TABLE di schema.sql (es. la riga 1198 di schema.sql lo dichiara
-- esplicitamente per migration_06; la tabella beta_feedback di Sprint 8 è
-- presente in schema.sql come CREATE TABLE diretto, senza un file
-- migration_07_beta_feedback.sql corrispondente — il file standalone
-- originale, sprint8_beta_pipeline_migration.sql, non esiste più nel
-- repository). Non è invece chiaro, e non è stato verificato con certezza
-- in questa sessione, se il contenuto di migration_02...migration_06 e di
-- migration_gruppi_avanzati.sql sia STRUTTURALMENTE già incluso in
-- schema.sql per un nuovo ambiente.
--
-- DECISIONE NECESSARIA (non presa autonomamente, come richiesto): questa
-- migrazione 07 e la migrazione 08 restano FILE STANDALONE, NON ripiegate
-- in schema.sql (questo file non modifica schema.sql). Un eventuale fold-in
-- futuro è una decisione che spetta a Fabrizio. Vedi
-- docs/trama-one/analysis/SPRINT_0_TECH_NOTES.md, sezione "Bootstrap schema".
--
-- Dipendenze: tabella public.profiles (per created_by/updated_by) già
-- presente in schema.sql.
-- Compatibilità Legacy/Next Gen: totale. Nessuna tabella, colonna, vista o
-- policy esistente viene letta, modificata o referenziata da questo file.
--
-- Transazionalità: tutte le istruzioni DDL sotto (CREATE TABLE, CREATE
-- INDEX, CREATE FUNCTION, CREATE TRIGGER, ALTER TABLE ENABLE RLS, CREATE
-- POLICY) sono DDL Postgres transazionali — nessuna richiede CONCURRENTLY o
-- altro comportamento incompatibile con una transazione. Applicate tutte
-- dentro BEGIN/COMMIT: o vengono applicate TUTTE, o (in caso di errore)
-- NESSUNA — nessuno stato parziale possibile.

begin;

create table if not exists public.feature_flag_overrides (
  id            uuid primary key default gen_random_uuid(),
  flag_name     text not null,
  scope_type    text not null check (scope_type in ('global','environment','user','role','tenant','cohort')),
  scope_value   text,
  enabled       boolean not null default false,
  expires_at    timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint feature_flag_scope_value_consistency check (
    (scope_type = 'global' and scope_value is null) or
    (scope_type <> 'global' and scope_value is not null)
  )
);

comment on table public.feature_flag_overrides is
  'TRAMA ONE — override runtime del Feature Flag Engine. Lettura/scrittura riservate a platform_admin (vedi policy sotto). Il resolver applicativo (lib/feature-flags/resolve.ts) legge questa tabella tramite client service_role, bypassando le RLS di proposito: non è quindi da questa tabella che passa la lettura per utenti normali, ma dal resolver server-only.';

-- Unicità deterministica: un solo override per flag+scope+valore. TRE indici
-- distinti, coerenti con la normalizzazione applicata in
-- lib/feature-flags/evaluate.ts (Pre-Migration Hardening, punto 5):
--  1. 'global' — scope_value è sempre NULL (vedi CHECK sopra), nessuna
--     normalizzazione necessaria.
--  2. 'user' — scope_value è uno userId (UUID): confronto ESATTO, MAI
--     normalizzato (lower/trim altererebbe semanticamente un UUID).
--  3. tutti gli altri scope (environment/role/tenant/cohort) — normalizzati
--     con lower(trim(scope_value)), esattamente come fa
--     scopeMatchesContext() in evaluate.ts: due valori che differiscono solo
--     per maiuscole/minuscole o spazi ai bordi sono trattati come lo stesso
--     scope sia qui (unicità) sia lì (confronto in fase di risoluzione).
create unique index if not exists idx_feature_flag_overrides_unique_global
  on public.feature_flag_overrides (flag_name, scope_type)
  where scope_type = 'global';

create unique index if not exists idx_feature_flag_overrides_unique_user
  on public.feature_flag_overrides (flag_name, scope_value)
  where scope_type = 'user';

create unique index if not exists idx_feature_flag_overrides_unique_scoped
  on public.feature_flag_overrides (flag_name, scope_type, lower(trim(scope_value)))
  where scope_type not in ('global', 'user');

create index if not exists idx_feature_flag_overrides_lookup
  on public.feature_flag_overrides (flag_name, scope_type, scope_value);

-- updated_at gestito da un trigger scoped SOLO a questa tabella
-- (funzione e trigger esplicitamente qualificati con schema "public.").
-- Il repository non ha oggi una funzione trigger condivisa per updated_at
-- (schema.sql usa "default now()" senza trigger su nessuna tabella
-- esistente): questa funzione è nuova e non introduce una convenzione
-- globale, resta locale a feature_flag_overrides.
create or replace function public.set_feature_flag_overrides_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_feature_flag_overrides_updated_at on public.feature_flag_overrides;
create trigger trg_feature_flag_overrides_updated_at
  before update on public.feature_flag_overrides
  for each row execute function public.set_feature_flag_overrides_updated_at();

alter table public.feature_flag_overrides enable row level security;

drop policy if exists feature_flag_overrides_select_admin on public.feature_flag_overrides;
create policy feature_flag_overrides_select_admin
  on public.feature_flag_overrides for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));

drop policy if exists feature_flag_overrides_insert_admin on public.feature_flag_overrides;
create policy feature_flag_overrides_insert_admin
  on public.feature_flag_overrides for insert
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));

drop policy if exists feature_flag_overrides_update_admin on public.feature_flag_overrides;
create policy feature_flag_overrides_update_admin
  on public.feature_flag_overrides for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));

drop policy if exists feature_flag_overrides_delete_admin on public.feature_flag_overrides;
create policy feature_flag_overrides_delete_admin
  on public.feature_flag_overrides for delete
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): sono blocchi di riferimento (esempio d'uso, verifica,
-- rollback), non parte della migrazione automatica. Nessuno di questi va
-- eseguito insieme al blocco DDL — sono eseguiti a parte, manualmente,
-- quando serve.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- Validazione "il flag esiste nel registry" — NON esprimibile come CHECK
-- SQL: il registry vive in lib/feature-flags/registry.ts (TypeScript), non
-- nel database. Chiunque scriva su questa tabella via script/SQL deve
-- verificare a mano che flag_name coincida con una chiave di
-- FEATURE_FLAG_REGISTRY prima dell'INSERT — un valore non presente nel
-- registry non causa errori, ma evaluate() lo ignorerà sempre (nessun
-- default a cui applicarlo), quindi la riga sarebbe innocua ma inutile.
-- ────────────────────────────────────────────────────────────────

-- ESEMPIO D'USO (da eseguire manualmente, sostituendo l'UUID reale) — per la
-- procedura completa vedi SPRINT_0_ACTIVATION_RUNBOOK.md:
--
-- insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, created_by)
-- values ('TRAMA_ONE_ENABLED', 'user', '00000000-0000-0000-0000-000000000000', true, auth.uid());

-- VERIFICA POST-APPLICAZIONE (eseguire DOPO il COMMIT sopra, separatamente):
-- select relrowsecurity from pg_class where relname = 'feature_flag_overrides'; -- deve dare true
-- select * from public.feature_flag_overrides; -- da un ruolo non-platform_admin deve dare 0 righe
-- insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled)
--   values ('TRAMA_ONE_ENABLED', 'global', null, true); -- prima riga: ok
-- insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled)
--   values ('TRAMA_ONE_ENABLED', 'global', null, false); -- seconda riga: deve fallire (unique index globale)
-- insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled)
--   values ('TRAMA_ONE_ENABLED', 'environment', 'Production', true); -- prima riga: ok
-- insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled)
--   values ('TRAMA_ONE_ENABLED', 'environment', ' production ', false); -- seconda riga: deve fallire (stesso valore normalizzato)

-- ROLLBACK (eseguire come blocco separato — sicuro, nessuna query esistente
-- referenzia questa tabella, nessuna modifica a schema.sql da annullare):
-- begin;
-- drop trigger if exists trg_feature_flag_overrides_updated_at on public.feature_flag_overrides;
-- drop function if exists public.set_feature_flag_overrides_updated_at();
-- drop table if exists public.feature_flag_overrides;
-- commit;
