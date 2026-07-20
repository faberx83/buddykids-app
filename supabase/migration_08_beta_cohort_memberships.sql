-- Migrazione 08 — TRAMA ONE Build Sprint 0: Beta Cohort Memberships.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, DOPO supabase/schema.sql (e
-- indipendentemente da migration_07_feature_flags_foundation.sql: le due
-- tabelle non dipendono l'una dall'altra, solo da public.profiles).
-- Procedura passo-passo: docs/trama-one/analysis/SPRINT_0_ACTIVATION_RUNBOOK.md
--
-- Sostituisce la proposta precedente "profiles.beta_cohort" (colonna),
-- scartata: una colonna su profiles sarebbe stata soggetta alle RLS già
-- esistenti su quella tabella, che potrebbero consentire all'utente di
-- aggiornare il proprio record e quindi autoassegnarsi una coorte beta.
-- Una tabella dedicata con RLS platform_admin-only elimina questo rischio
-- alla radice.
--
-- Stessa nota sulla convenzione di bootstrap dello schema documentata in
-- migration_07_feature_flags_foundation.sql: file standalone, non ripiegato
-- in schema.sql, decisione di eventuale fold-in rimandata a Fabrizio. Questo
-- file NON modifica schema.sql.
--
-- Dipendenze: tabella public.profiles e funzione public.is_platform_admin()
-- (security definer, stable, nessun parametro), entrambe già presenti in
-- schema.sql.
-- Compatibilità Legacy/Next Gen: totale, nessuna tabella/colonna esistente
-- toccata (public.is_platform_admin() viene solo chiamata in sola lettura,
-- mai ridefinita).
--
-- Transazionalità: tutte le istruzioni DDL sotto (CREATE TABLE, COMMENT,
-- CREATE FUNCTION, CREATE TRIGGER, ALTER TABLE ENABLE RLS, CREATE POLICY)
-- sono DDL Postgres transazionali — nessuna richiede CONCURRENTLY. Applicate
-- tutte dentro BEGIN/COMMIT: o vengono applicate TUTTE, o (in caso di
-- errore) NESSUNA — nessuno stato parziale possibile.

begin;

create table if not exists public.beta_cohort_memberships (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  cohort_key    text not null,
  active        boolean not null default true,
  expires_at    timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_beta_cohort_membership unique (user_id, cohort_key)
);

comment on table public.beta_cohort_memberships is
  'TRAMA ONE — appartenenza a coorti beta. Lettura/scrittura riservate a platform_admin. Nessun utente normale può leggere o modificare la propria appartenenza: la lettura per la risoluzione dei feature flag passa esclusivamente da lib/beta-cohorts/membership.ts (server-only, client service_role). Assegnazione in Sprint 0 SOLO via SQL/script amministrativo controllato — nessuna UI Admin.';

-- on delete cascade: se un profilo viene eliminato, le sue membership
-- decadono con lui, nessuna riga orfana.

-- Funzione e trigger esplicitamente qualificati con schema "public.", locali
-- a questa tabella (stessa convenzione di migration_07, nessuna funzione
-- trigger condivisa esistente nel repository per updated_at).
create or replace function public.set_beta_cohort_memberships_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_beta_cohort_memberships_updated_at on public.beta_cohort_memberships;
create trigger trg_beta_cohort_memberships_updated_at
  before update on public.beta_cohort_memberships
  for each row execute function public.set_beta_cohort_memberships_updated_at();

alter table public.beta_cohort_memberships enable row level security;

-- Nessuna policy per l'utente proprietario, di proposito: la lettura della
-- propria appartenenza a una coorte non deve mai passare da una query
-- diretta client-side, solo dal resolver server-only.
--
-- Reuse-first (RLS Reuse Remediation): le 4 policy sotto usano l'helper
-- public.is_platform_admin() già definito in schema.sql (security definer,
-- stable, nessun parametro) e già usato con lo stesso identico significato
-- in migration_04/05/06, invece di duplicare inline
-- "exists (select 1 from public.profiles where profiles.id = auth.uid()
-- and profiles.role = 'platform_admin')". Stessa verifica di equivalenza
-- semantica documentata in migration_07_feature_flags_foundation.sql.
drop policy if exists beta_cohort_memberships_select_admin on public.beta_cohort_memberships;
create policy beta_cohort_memberships_select_admin
  on public.beta_cohort_memberships for select
  using (public.is_platform_admin());

drop policy if exists beta_cohort_memberships_insert_admin on public.beta_cohort_memberships;
create policy beta_cohort_memberships_insert_admin
  on public.beta_cohort_memberships for insert
  with check (public.is_platform_admin());

drop policy if exists beta_cohort_memberships_update_admin on public.beta_cohort_memberships;
create policy beta_cohort_memberships_update_admin
  on public.beta_cohort_memberships for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists beta_cohort_memberships_delete_admin on public.beta_cohort_memberships;
create policy beta_cohort_memberships_delete_admin
  on public.beta_cohort_memberships for delete
  using (public.is_platform_admin());

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): blocchi di riferimento (esempio d'uso, verifica, rollback), non
-- parte della migrazione automatica. Eseguiti a parte, manualmente, quando
-- serve — mai insieme al blocco DDL.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA di applicare il
-- blocco begin;/commit; sopra. Solo lettura, nessuna di queste query
-- modifica alcunché. Se una riga "eventuale esistenza" restituisce righe
-- inattese, FERMARSI (vedi condizioni STOP in
-- docs/trama-one/analysis/SPRINT_0_ACTIVATION_RUNBOOK.md) e non procedere
-- senza aver capito perché l'oggetto esiste già.
-- ════════════════════════════════════════════════════════════════

-- 1. Esistenza di public.profiles (dipendenza obbligatoria):
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name = 'profiles';
-- -- atteso: 1 riga. Se 0 righe: schema.sql non è stato applicato, STOP.

-- 2. Esistenza e proprietà di public.is_platform_admin() (usata dalle 4
--    policy sotto invece di duplicare il controllo inline):
-- select p.proname, p.prosecdef as security_definer, p.provolatile,
--        pg_get_function_result(p.oid) as return_type,
--        pg_get_function_arguments(p.oid) as arguments
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'is_platform_admin';
-- -- atteso: 1 riga, security_definer = true, provolatile = 's' (stable),
-- -- return_type = boolean, arguments = '' (nessun parametro).
-- -- Se 0 righe: l'helper non esiste nell'ambiente target, STOP (le policy
-- -- sotto falliscono in creazione senza questa funzione).

-- 3. Eventuale esistenza della tabella beta_cohort_memberships:
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name = 'beta_cohort_memberships';
-- -- atteso su un ambiente pulito: 0 righe. Se 1 riga: la tabella esiste
-- -- già (applicazione precedente parziale o manuale) — verificarne la
-- -- definizione prima di procedere, il "create table if not exists" non
-- -- la ricrea né la altera.

-- 4. Eventuale esistenza del constraint univoco:
-- select conname from pg_constraint
--   where conrelid = 'public.beta_cohort_memberships'::regclass and conname = 'uq_beta_cohort_membership';
-- -- atteso su un ambiente pulito: 0 righe (fallisce comunque se la tabella
-- -- non esiste ancora — eseguire solo dopo aver confermato il punto 3).

-- 5. Eventuale esistenza della funzione trigger:
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'set_beta_cohort_memberships_updated_at';
-- -- atteso su un ambiente pulito: 0 righe.

-- 6. Eventuale esistenza delle policy:
-- select policyname from pg_policies
--   where schemaname = 'public' and tablename = 'beta_cohort_memberships';
-- -- atteso su un ambiente pulito: 0 righe.

-- ESEMPIO D'USO per assegnare un utente di test alla coorte beta pilota
-- (da eseguire manualmente, sostituendo l'UUID reale) — per la procedura
-- completa vedi SPRINT_0_ACTIVATION_RUNBOOK.md:
--
-- insert into public.beta_cohort_memberships (user_id, cohort_key, active, created_by)
-- values ('00000000-0000-0000-0000-000000000000', 'beta-wave-1', true, auth.uid());

-- VERIFICA POST-APPLICAZIONE (eseguire DOPO il COMMIT sopra, separatamente):
-- select relrowsecurity from pg_class where relname = 'beta_cohort_memberships'; -- deve dare true
-- select * from public.beta_cohort_memberships; -- da un ruolo non-platform_admin deve dare 0 righe
-- insert into public.beta_cohort_memberships (user_id, cohort_key) values ('<uuid>', 'beta-wave-1'); -- prima riga: ok
-- insert into public.beta_cohort_memberships (user_id, cohort_key) values ('<uuid>', 'beta-wave-1'); -- seconda riga identica: deve fallire per uq_beta_cohort_membership

-- ROLLBACK (eseguire come blocco separato — sicuro, nessuna query esistente
-- referenzia questa tabella, nessuna modifica a schema.sql da annullare):
-- begin;
-- drop trigger if exists trg_beta_cohort_memberships_updated_at on public.beta_cohort_memberships;
-- drop function if exists public.set_beta_cohort_memberships_updated_at();
-- drop table if exists public.beta_cohort_memberships;
-- commit;
