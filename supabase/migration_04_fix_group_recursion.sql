-- Migrazione 04 — due correzioni:
-- 1) Errore "infinite recursion detected in policy for relation group_members"
--    che appare creando/leggendo i gruppi.
-- 2) Permessi mancanti: il Gestore centro non poteva ancora salvare le
--    modifiche al profilo del proprio centro (mancava la policy di update).
-- Esegui questo file UNA VOLTA nello SQL Editor di Supabase.

-- 1) Gruppi: bypassa la RLS con una funzione "security definer" per evitare
-- che la policy interroghi se stessa.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and parent_id = auth.uid()
  );
$$;

drop policy if exists "Group members: visibili solo ai membri del gruppo" on public.group_members;

create policy "Group members: visibili solo ai membri del gruppo"
  on public.group_members for select
  using (public.is_group_member(group_id));

-- 2) Centri: il gestore può aggiornare il proprio centro, l'Admin
-- piattaforma può crearne di nuovi e modificarli tutti.
drop policy if exists "Centers: il gestore aggiorna il proprio centro" on public.centers;
create policy "Centers: il gestore aggiorna il proprio centro"
  on public.centers for update
  using (id = public.current_center_id() or public.is_platform_admin())
  with check (id = public.current_center_id() or public.is_platform_admin());

drop policy if exists "Centers: l'admin piattaforma crea nuovi centri" on public.centers;
create policy "Centers: l'admin piattaforma crea nuovi centri"
  on public.centers for insert
  with check (public.is_platform_admin());
