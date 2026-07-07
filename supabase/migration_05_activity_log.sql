-- Migrazione 05 — registro delle modifiche fatte dai Gestori centro (per i
-- KPI lato Admin piattaforma: quante modifiche, quanto spesso toccano i
-- prezzi, ecc.). Esegui questo file UNA VOLTA nello SQL Editor di Supabase.

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  center_id uuid references public.centers(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "Activity log: il gestore vede/scrive il log del proprio centro" on public.activity_log;
create policy "Activity log: il gestore vede/scrive il log del proprio centro"
  on public.activity_log for all
  using (center_id = public.current_center_id() or public.is_platform_admin())
  with check (center_id = public.current_center_id() or public.is_platform_admin());

create index if not exists idx_activity_log_center on public.activity_log(center_id);
create index if not exists idx_activity_log_actor on public.activity_log(actor_id);
create index if not exists idx_activity_log_created on public.activity_log(created_at desc);
