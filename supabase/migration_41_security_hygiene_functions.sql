-- Migrazione 41 — Igiene sicurezza funzioni (Go-live · Compliance & Blocchi).
--
-- STATO: PREPARATA, NON APPLICATA. La applica Fabrizio, da shell:
--   APPLY_SQL="supabase/migration_41_security_hygiene_functions.sql" SQL_ONLY=1 bash deploy.sh
--
-- Cosa fa (nessuna tabella, nessun dato, nessuna policy toccati):
--   1) fissa il search_path delle 26 funzioni segnalate dal Security Advisor
--      ("Function Search Path Mutable");
--   2) toglie EXECUTE ad anon (e a PUBLIC, da cui anon lo eredita) sulle
--      funzioni che il codice chiama SOLO da utente loggato, e sulle due
--      funzioni trigger, che nessuno deve chiamare via /rest/v1/rpc.
--
-- Cosa NON fa, di proposito (analisi del 09/10/2026):
--   - NON revoca gli helper usati nelle policy RLS con ruolo "public"
--     (is_platform_admin, current_center_id, "current_role", is_family_member,
--     is_family_admin, is_group_member, is_community_member,
--     is_community_admin, get_family_member_ids). Le policy le valutano anche
--     per anon (es. activity_certifications approvate, lettura pubblica):
--     senza EXECUTE le letture anonime fallirebbero con
--     "permission denied for function". Restano segnalate dall'advisor come
--     WARN accettati: sono SECURITY DEFINER read-only e rispondono solo
--     sull'utente corrente (auth.uid()).
--   - NON revoca le funzioni pubbliche per scelta, basate su token o codice:
--     get_shared_plan, get_shared_plan_meta, get_invite_preview,
--     get_beta_invite_preview, is_current_published_legal_document.
--
-- Verifiche fatte prima di scriverla (sola lettura, 09/10/2026):
--   - nessuna delle 26 funzioni usa oggetti di altri schema senza prefisso
--     (niente pgcrypto/uuid-ossp/unaccent), quindi "public, extensions,
--     pg_temp" non cambia il comportamento (è il search_path del ruolo
--     postgres, più pg_temp in coda come raccomandato);
--   - tutte le chiamate rpc() alle funzioni revocate ad anon avvengono dopo
--     auth.getUser() con "if (!user) return" (app/actions/groups.ts,
--     app/actions/onboarding.ts, app/booking/[id]/actions.ts,
--     lib/data/groups.ts, lib/data/coordination-signal.ts, lib/data/family.ts);
--   - le funzioni trigger non richiedono EXECUTE al momento dello scatto del
--     trigger (solo alla CREATE TRIGGER): signup e onboarding continuano a
--     funzionare.
--
-- Transazione unica (deploy.sh usa --single-transaction): se un nome non
-- torna, il blocco fallisce e non cambia nulla.

-- ════════════════════════════════════════════════════════════════
-- 1) search_path fisso sulle 26 funzioni dell'advisor
-- ════════════════════════════════════════════════════════════════
do $$
declare
  fn regprocedure;
  touched int := 0;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'current_role', 'current_center_id', 'is_platform_admin',
        'is_group_member', 'redeem_invite_discount', 'get_invite_preview',
        'is_community_member', 'is_community_admin', 'get_shared_plan',
        'is_family_member', 'is_family_admin', 'get_family_member_ids',
        'get_family_members', 'set_feature_flag_overrides_updated_at',
        'set_beta_cohort_memberships_updated_at',
        'set_center_onboarding_state_updated_at',
        'set_center_onboarding_checklist_updated_at',
        'set_center_identity_verifications_updated_at',
        'set_tutorial_progress_updated_at', 'get_shared_plan_meta',
        'list_public_groups', 'list_my_group_invites', 'accept_group_invite',
        'decline_group_invite', 'set_beta_invite_codes_updated_at',
        'external_planner_items_set_updated_at'
      )
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', fn);
    touched := touched + 1;
  end loop;

  if touched <> 26 then
    raise exception 'Attese 26 funzioni per il search_path, trovate %', touched;
  end if;
end
$$;

-- ════════════════════════════════════════════════════════════════
-- 2a) RPC solo per utenti loggati: via anon e PUBLIC, resta authenticated
-- ════════════════════════════════════════════════════════════════
do $$
declare
  fn regprocedure;
  touched int := 0;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'accept_group_invite', 'decline_group_invite', 'redeem_invite_discount',
        'center_claim_onboarding', 'center_submit_onboarding',
        'admin_review_center_onboarding', 'list_my_group_invites',
        'get_family_members', 'list_public_groups'
      )
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
    touched := touched + 1;
  end loop;

  if touched <> 9 then
    raise exception 'Attese 9 RPC da riservare agli utenti loggati, trovate %', touched;
  end if;
end
$$;

-- ════════════════════════════════════════════════════════════════
-- 2b) Funzioni trigger: nessuno le chiama via API
-- ════════════════════════════════════════════════════════════════
do $$
declare
  fn regprocedure;
  touched int := 0;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user', 'init_center_onboarding_lead')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    touched := touched + 1;
  end loop;

  if touched <> 2 then
    raise exception 'Attese 2 funzioni trigger, trovate %', touched;
  end if;
end
$$;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK (sola lettura, da eseguire dopo l'apply)
-- ════════════════════════════════════════════════════════════════
-- Nessuna funzione public senza search_path (atteso: 0 righe):
-- select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prokind = 'f' and p.proconfig is null;
--
-- anon non può più chiamare le RPC riservate (atteso: tutte false):
-- select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_exec
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('accept_group_invite','decline_group_invite',
--     'redeem_invite_discount','center_claim_onboarding','center_submit_onboarding',
--     'admin_review_center_onboarding','list_my_group_invites','get_family_members',
--     'list_public_groups','handle_new_user','init_center_onboarding_lead');
--
-- Gli helper RLS restano chiamabili da anon (atteso: tutte true):
-- select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_exec
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('is_platform_admin','current_center_id',
--     'is_group_member','get_family_member_ids');
--
-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (solo se necessario)
-- ════════════════════════════════════════════════════════════════
-- Per ogni funzione dei punti 2a/2b:
--   grant execute on function public.<nome>(<argomenti>) to public, anon, authenticated;
-- Per ogni funzione del punto 1:
--   alter function public.<nome>(<argomenti>) reset search_path;
