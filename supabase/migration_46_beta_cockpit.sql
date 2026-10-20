-- Migrazione 46 — Admin Beta Cockpit (impostazioni, decision log, triage
-- feedback a 5 stati con tag, giorni con app aperta).
--
-- STATO: PREPARATA, NON APPLICATA
-- La applica Fabrizio con `bash deploy.sh` (conferma scritta APPLICA).
-- Approvata il 20/10/2026 nella chat "TRAMA ADMIN" (pre-apply review in
-- docs/trama-one/claude/INIZIATIVA_admin_beta_cockpit.md).
--
-- Additiva e idempotente, una transazione. Nessun dato nuovo sulle famiglie:
--  - beta_cockpit_settings: una riga di impostazioni (solo Admin);
--  - beta_decisions: note del founder (osservazione → decisione → azione);
--  - beta_feedback: due stati in più (da_capire, non_ora) e admin_tags;
--  - admin_beta_open_days(): legge auth.refresh_tokens (già esistente) e
--    restituisce solo utente + giorno, solo a un platform_admin.
-- Il codice funziona anche prima di questa migrazione (valori di default,
-- decision log nascosto, ritorno calcolato solo dalle azioni).
--
-- ROLLBACK (solo se necessario):
--   begin;
--   drop function if exists public.admin_beta_open_days(uuid[], timestamptz);
--   update public.beta_feedback set status = 'in_gestione' where status = 'da_capire';
--   update public.beta_feedback set status = 'risolto' where status = 'non_ora';
--   alter table public.beta_feedback drop constraint if exists beta_feedback_status_check;
--   alter table public.beta_feedback add constraint beta_feedback_status_check
--     check (status in ('nuovo','in_gestione','risolto'));
--   alter table public.beta_feedback drop column if exists admin_tags;
--   drop table if exists public.beta_decisions;
--   drop table if exists public.beta_cockpit_settings;
--   commit;
--
-- POST-CHECK:
--   select report_frequency, report_weekday, beta_start_date from public.beta_cockpit_settings; -- 1 riga
--   select count(*) from public.beta_decisions;                                                  -- 0
--   select count(*) from public.beta_feedback where admin_tags is null;                          -- 0
--   select proname from pg_proc where proname = 'admin_beta_open_days';                          -- 1 riga

begin;

-- ── Impostazioni del cockpit (una sola riga, id = 1) ──────────────────────
create table if not exists public.beta_cockpit_settings (
  id smallint primary key default 1 check (id = 1),
  report_frequency text not null default 'weekly' check (report_frequency in ('manual', 'daily', 'weekly')),
  -- 1 = lunedì … 7 = domenica. Default venerdì: la beta parte venerdì 20/11.
  report_weekday smallint not null default 5 check (report_weekday between 1 and 7),
  report_time time not null default '09:00',
  report_timezone text not null default 'Europe/Rome' check (report_timezone = 'Europe/Rome'),
  beta_start_date date not null default '2026-11-18',
  -- Soglie leggibili (giorni/ore); chiavi mancanti = default nel codice
  -- (lib/beta-cockpit/definitions.ts#DEFAULT_THRESHOLDS).
  thresholds jsonb not null default '{}'::jsonb,
  -- Account esclusi dai conteggi (founder, prove), oltre a quelli esclusi
  -- in automatico (platform_admin, gestori, coorte internal-preview).
  excluded_user_ids uuid[] not null default '{}',
  -- Survey beta: { "survey_1": { "enabled": true, "afterDays": 3 }, ... }
  survey_config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.beta_cockpit_settings (id) values (1) on conflict (id) do nothing;

alter table public.beta_cockpit_settings enable row level security;

drop policy if exists "Beta cockpit settings: solo admin legge" on public.beta_cockpit_settings;
create policy "Beta cockpit settings: solo admin legge"
  on public.beta_cockpit_settings for select
  using (public.is_platform_admin());

drop policy if exists "Beta cockpit settings: solo admin aggiorna" on public.beta_cockpit_settings;
create policy "Beta cockpit settings: solo admin aggiorna"
  on public.beta_cockpit_settings for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ── Decision log ──────────────────────────────────────────────────────────
create table if not exists public.beta_decisions (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  observation text not null check (char_length(observation) between 1 and 1000),
  hypothesis text check (hypothesis is null or char_length(hypothesis) <= 1000),
  decision text check (decision is null or char_length(decision) <= 1000),
  action text check (action is null or char_length(action) <= 500),
  owner text check (owner is null or char_length(owner) <= 80),
  due_date date,
  status text not null default 'aperta' check (status in ('aperta', 'fatta', 'annullata')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists idx_beta_decisions_period on public.beta_decisions (period_start, period_end);

alter table public.beta_decisions enable row level security;

drop policy if exists "Beta decisions: solo admin" on public.beta_decisions;
create policy "Beta decisions: solo admin"
  on public.beta_decisions for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ── Feedback: 5 stati e tag ───────────────────────────────────────────────
-- Nuovo = nuovo · Da capire = da_capire · Da fare = in_gestione ·
-- Fatto = risolto · Non ora = non_ora. Le righe esistenti non cambiano.
alter table public.beta_feedback drop constraint if exists beta_feedback_status_check;
alter table public.beta_feedback add constraint beta_feedback_status_check
  check (status in ('nuovo', 'da_capire', 'in_gestione', 'risolto', 'non_ora'));

alter table public.beta_feedback add column if not exists admin_tags text[] not null default '{}';

-- ── Giorni con app aperta (sola lettura, solo admin) ──────────────────────
-- auth.refresh_tokens ha una riga a ogni rinnovo della sessione: è il solo
-- segno di "ha aperto l'app" per chi legge senza modificare nulla. La
-- funzione restituisce solo (utente, giorno in Europe/Rome), mai token,
-- orari, IP o dispositivi; a chi non è platform_admin restituisce zero righe.
create or replace function public.admin_beta_open_days(p_user_ids uuid[], p_since timestamptz)
returns table (user_id uuid, day date)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id::uuid, (r.created_at at time zone 'Europe/Rome')::date
  from auth.refresh_tokens r
  where public.is_platform_admin()
    and r.created_at >= p_since
    and r.user_id in (select unnest(p_user_ids)::text)
  group by 1, 2;
$$;

revoke all on function public.admin_beta_open_days(uuid[], timestamptz) from public, anon;
grant execute on function public.admin_beta_open_days(uuid[], timestamptz) to authenticated;

commit;
