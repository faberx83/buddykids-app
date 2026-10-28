-- TRAMA — Migration 55: attivazione del centro, le due verifiche di TRAMA
-- STATO: PREPARATA, NON APPLICATA
--
-- Portale centri V2, fase 1 (claude/INIZIATIVA_partner_admin_v2.md §10,
-- decisioni di Fabrizio del 27/10/2026): attivazione in due passi
-- (il centro completa il profilo e lo invia; TRAMA verifica e approva), con
-- la timeline nel portale e la pagina Admin "Centri da attivare".
-- La verifica d'identità NON è più un documento caricato: è la spunta di
-- TRAMA "referente e telefono confermati" dopo la telefonata (decisione del
-- 27/10). Più la spunta "attività controllate".
--
-- Riuso: la macchina a stati di migration_09 resta com'è
-- (center_onboarding_state, center_claim_onboarding, center_submit_onboarding,
-- admin_review_center_onboarding per "chiedi una modifica" e "sospendi",
-- storico in center_onboarding_audit_log). Qui solo:
--   1. due coppie di colonne su center_onboarding_state (chi e quando ha
--      spuntato le due verifiche);
--   2. admin_set_activation_check(): spunta/toglie una verifica, con storico;
--   3. admin_approve_center_activation(): approva SOLO da "inviato"
--      (SUBMITTED) e SOLO con le due verifiche spuntate.
-- La vecchia admin_review_center_onboarding('approve') resta per la pagina
-- Admin di prima (TRAMA ONE → Onboarding), invariata.
--
-- Additiva: nessun dato cambia. Ripiego:
--   drop function if exists public.admin_approve_center_activation(uuid, text);
--   drop function if exists public.admin_set_activation_check(uuid, text, boolean);
--   alter table public.center_onboarding_state
--     drop column if exists referent_confirmed_at, drop column if exists referent_confirmed_by,
--     drop column if exists activities_checked_at, drop column if exists activities_checked_by;

alter table public.center_onboarding_state
  add column if not exists referent_confirmed_at timestamptz,
  add column if not exists referent_confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists activities_checked_at timestamptz,
  add column if not exists activities_checked_by uuid references public.profiles(id) on delete set null;

create or replace function public.admin_set_activation_check(p_center_id uuid, p_check text, p_value boolean)
returns public.center_onboarding_state
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_row public.center_onboarding_state;
  v_status text;
begin
  if not public.is_platform_admin() then
    raise exception 'admin_set_activation_check: riservato a platform_admin';
  end if;
  if p_check not in ('referent', 'activities') then
    raise exception 'admin_set_activation_check: verifica non valida %', p_check;
  end if;

  select status into v_status from public.center_onboarding_state where center_id = p_center_id;
  if v_status is null then
    raise exception 'admin_set_activation_check: il centro non è in attivazione';
  end if;

  if p_check = 'referent' then
    update public.center_onboarding_state
       set referent_confirmed_at = case when p_value then now() else null end,
           referent_confirmed_by = case when p_value then auth.uid() else null end
     where center_id = p_center_id
    returning * into v_row;
  else
    update public.center_onboarding_state
       set activities_checked_at = case when p_value then now() else null end,
           activities_checked_by = case when p_value then auth.uid() else null end
     where center_id = p_center_id
    returning * into v_row;
  end if;

  insert into public.center_onboarding_audit_log (center_id, from_status, to_status, actor_id, note)
  values (
    p_center_id, v_status, v_status, auth.uid(),
    case
      when p_check = 'referent' and p_value then 'Referente e telefono confermati'
      when p_check = 'referent' then 'Conferma del referente tolta'
      when p_value then 'Attività controllate'
      else 'Controllo delle attività tolto'
    end
  );

  return v_row;
end;
$$;

comment on function public.admin_set_activation_check(uuid, text, boolean) is
  'TRAMA 27/10/2026 — Admin spunta o toglie una verifica di attivazione (referent | activities). Solo platform_admin, con storico.';

create or replace function public.admin_approve_center_activation(p_center_id uuid, p_note text default null)
returns public.center_onboarding_state
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_row public.center_onboarding_state;
begin
  if not public.is_platform_admin() then
    raise exception 'admin_approve_center_activation: riservato a platform_admin';
  end if;

  select * into v_row from public.center_onboarding_state where center_id = p_center_id;
  if v_row.center_id is null or v_row.status <> 'SUBMITTED' then
    raise exception 'admin_approve_center_activation: si approva solo un profilo inviato (stato attuale: %)', coalesce(v_row.status, 'nessuno');
  end if;
  if v_row.referent_confirmed_at is null or v_row.activities_checked_at is null then
    raise exception 'admin_approve_center_activation: mancano le verifiche (referente e attività)';
  end if;

  update public.center_onboarding_state
     set status = 'APPROVED'
   where center_id = p_center_id
  returning * into v_row;

  insert into public.center_onboarding_audit_log (center_id, from_status, to_status, actor_id, note)
  values (p_center_id, 'SUBMITTED', 'APPROVED', auth.uid(), coalesce(nullif(trim(p_note), ''), 'Centro attivato'));

  return v_row;
end;
$$;

comment on function public.admin_approve_center_activation(uuid, text) is
  'TRAMA 27/10/2026 — Admin approva l''attivazione: solo da SUBMITTED e con le due verifiche spuntate. Solo platform_admin, con storico.';

revoke execute on function public.admin_set_activation_check(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_activation_check(uuid, text, boolean) to authenticated, service_role;
revoke execute on function public.admin_approve_center_activation(uuid, text) from public, anon;
grant execute on function public.admin_approve_center_activation(uuid, text) to authenticated, service_role;

-- Verifica (sola lettura):
--   select column_name from information_schema.columns
--    where table_name = 'center_onboarding_state' and column_name like '%confirmed%' or column_name like '%checked%';
