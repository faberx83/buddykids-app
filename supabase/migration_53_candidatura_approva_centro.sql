-- TRAMA — Migration 53: approvare la candidatura rende il centro attivo (una sola approvazione)
-- STATO: PREPARATA, NON APPLICATA
--
-- Fabrizio, 27/10/2026 (prova del percorso di candidatura, avviso nel
-- portale centri "Profilo centro: Candidatura non ancora avviata — Finché il
-- profilo non è Approvato, la tua attività non è visibile alle famiglie"),
-- scelta: "Una sola" approvazione per i centri del pilota.
--
-- Perché: ogni centro nuovo nasce LEAD in center_onboarding_state (trigger
-- di migration_10). Per arrivare ad APPROVED serviva un secondo percorso
-- (profilo + verifica d'identità → invio → seconda approvazione Admin, solo
-- da SUBMITTED), la cui procedura guidata vede solo la coorte TRAMA ONE: un
-- centro vero restava LEAD per sempre, con un avviso che dice il falso (il
-- catalogo delle famiglie non legge questo stato: le attività sono visibili).
-- Ora "Approva e crea centro" (Admin → Segnalazioni centri) è l'approvazione:
-- il riscontro lo fa Fabrizio con la telefonata; la verifica d'identità torna
-- dopo il pilota (Assumption Log, claude/INIZIATIVA_partner_admin_v2.md).
--
-- Cosa fa (additiva, nessuna funzione esistente cambiata):
--   1. nuova funzione admin_approve_center_from_candidacy(centro, nota):
--      solo platform_admin; da LEAD / CLAIMED / SUBMITTED / CHANGES_REQUESTED
--      ad APPROVED (crea la riga se manca); SUSPENDED resta sospeso;
--      scrive lo storico (center_onboarding_audit_log) come le altre;
--   2. sistema i centri già creati da una candidatura approvata e fermi a
--      LEAD/CLAIMED (oggi: "Centro di Prova" e "Centro prova candidatura").
--
-- Ripiego: drop function if exists public.admin_approve_center_from_candidacy(uuid, text);
-- (lo stato dei centri sistemati si rimette da Admin → TRAMA ONE → Onboarding
-- con "Sospendi", oppure: update public.center_onboarding_state set status = 'LEAD'
--   where center_id in (…);)

create or replace function public.admin_approve_center_from_candidacy(p_center_id uuid, p_note text default null)
returns public.center_onboarding_state
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_row public.center_onboarding_state;
  v_current_status text;
begin
  if not public.is_platform_admin() then
    raise exception 'admin_approve_center_from_candidacy: riservato a platform_admin';
  end if;

  select status into v_current_status from public.center_onboarding_state where center_id = p_center_id;

  if v_current_status = 'APPROVED' then
    select * into v_row from public.center_onboarding_state where center_id = p_center_id;
    return v_row;
  end if;
  if v_current_status = 'SUSPENDED' then
    raise exception 'admin_approve_center_from_candidacy: centro sospeso, si riattiva da Admin → TRAMA ONE → Onboarding';
  end if;

  insert into public.center_onboarding_state (center_id, status)
  values (p_center_id, 'APPROVED')
  on conflict (center_id) do update set status = 'APPROVED'
  returning * into v_row;

  insert into public.center_onboarding_audit_log (center_id, from_status, to_status, actor_id, note)
  values (p_center_id, v_current_status, 'APPROVED', auth.uid(),
          coalesce(nullif(trim(p_note), ''), 'Candidatura approvata (Admin → Segnalazioni centri)'));

  return v_row;
end;
$$;

comment on function public.admin_approve_center_from_candidacy(uuid, text) is
  'TRAMA — 27/10/2026: approvare la candidatura di un centro lo rende APPROVED (una sola approvazione per i centri del pilota). Solo platform_admin, storico in center_onboarding_audit_log. Non riattiva un centro SUSPENDED.';

revoke execute on function public.admin_approve_center_from_candidacy(uuid, text) from public, anon;
grant execute on function public.admin_approve_center_from_candidacy(uuid, text) to authenticated, service_role;

-- 2. Centri già creati da una candidatura approvata, fermi all'inizio.
with fermi as (
  select s.center_id, s.status
  from public.center_onboarding_state s
  where s.status in ('LEAD', 'CLAIMED')
    and exists (
      select 1 from public.center_leads l
      where l.lead_type = 'self_candidacy'
        and l.status = 'claimed'
        and l.claimed_center_id = s.center_id
    )
), aggiornati as (
  update public.center_onboarding_state s
     set status = 'APPROVED'
    from fermi f
   where s.center_id = f.center_id
  returning s.center_id, f.status as from_status
)
insert into public.center_onboarding_audit_log (center_id, from_status, to_status, actor_id, note)
select center_id, from_status, 'APPROVED', null, 'Candidatura già approvata: una sola approvazione (migration_53)'
from aggiornati;

-- Verifica (sola lettura):
--   select c.name, s.status from public.centers c
--   join public.center_onboarding_state s on s.center_id = c.id
--   order by c.created_at desc limit 5;
