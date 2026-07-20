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
-- Dipendenze: tabella public.profiles già presente in schema.sql.
-- Compatibilità Legacy/Next Gen: totale, nessuna tabella/colonna esistente toccata.
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
drop policy if exists beta_cohort_memberships_select_admin on public.beta_cohort_memberships;
create policy beta_cohort_memberships_select_admin
  on public.beta_cohort_memberships for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));

drop policy if exists beta_cohort_memberships_insert_admin on public.beta_cohort_memberships;
create policy beta_cohort_memberships_insert_admin
  on public.beta_cohort_memberships for insert
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));

drop policy if exists beta_cohort_memberships_update_admin on public.beta_cohort_memberships;
create policy beta_cohort_memberships_update_admin
  on public.beta_cohort_memberships for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));

drop policy if exists beta_cohort_memberships_delete_admin on public.beta_cohort_memberships;
create policy beta_cohort_memberships_delete_admin
  on public.beta_cohort_memberships for delete
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): blocchi di riferimento (esempio d'uso, verifica, rollback), non
-- parte della migrazione automatica. Eseguiti a parte, manualmente, quando
-- serve — mai insieme al blocco DDL.
-- ════════════════════════════════════════════════════════════════

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
