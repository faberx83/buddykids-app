-- Script una tantum — arruolare l'account di test
-- faberx83+partnernew@gmail.com (847bc128-7725-42cb-9dd2-6012360df9a7) nella
-- Controlled Beta Cohort, per fargli vedere lo Spotlight/tour Partner.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase (progetto eagsgfxunwyyxwwilldy).
--
-- ════════════════════════════════════════════════════════════════
-- Root cause (Fabrizio, 05/08: "mi sono candidato e ho accesso come
-- faberx83+partnernew ma non mi parte il tutorial..dovrebbe essere di
-- default per un nuovo utente")
-- ════════════════════════════════════════════════════════════════
-- Non è un bug del tour in sé: lo Spotlight Partner (app/center/layout.tsx)
-- viene montato SOLO se il feature flag TRAMA_ONE_ENABLED risolve a true per
-- quell'utente (resolveFeatureFlag -> getWalkthroughProgress). Se il flag è
-- false, PartnerSpotlight.tsx riceve progress=null e ritorna null in
-- silenzio: nessun errore visibile, il tour semplicemente non appare — è il
-- comportamento SCELTO per la Controlled Beta (DEC-57: TRAMA ONE è sempre
-- opt-in per singolo account arruolato in beta_cohort_memberships, MAI
-- on-by-default per tutti i nuovi utenti — vedi anche
-- script_controlled_beta_flag_cohort.sql e script_controlled_beta_expand_cohort.sql,
-- quest'ultimo un template esplicitamente lasciato vuoto perché "nessuna
-- aggiunta di centri/famiglie pilota reali, per ora").
--
-- Il nuovo account 847bc128-7725-42cb-9dd2-6012360df9a7 non è mai stato
-- inserito in beta_cohort_memberships (verificato: nessuno script del repo
-- lo cita) — per questo il tour non parte, indipendentemente dal fatto che
-- sia "nuovo" o promosso da un profilo preesistente: varrebbe lo stesso per
-- QUALSIASI account non arruolato.
--
-- Questo script applica lo stesso meccanismo già in uso per i 2 account di
-- test (+test-genitore/+test-gestore, DEC-57) al tuo account di test
-- Partner, così puoi vedere il tour subito. NON abilita TRAMA ONE per tutti
-- i futuri candidati/gestori reali — quella resta una decisione di business
-- separata (arruolamento pilota, sezione 9 del programma TRAMA ONE), da
-- prendere quando deciderai di aprire la beta a centri veri.

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — sola lettura, eseguire PRIMA
-- ════════════════════════════════════════════════════════════════

-- 1. Conferma che l'override di coorte esiste e non è scaduto (scade
--    2026-10-02, DEC-57):
-- select id, scope_type, scope_value, enabled, expires_at
-- from public.feature_flag_overrides
-- where flag_name = 'TRAMA_ONE_ENABLED' and scope_type = 'cohort' and scope_value = 'trama-one-controlled-beta';

-- 2. Conferma che questo account non è già arruolato (atteso: 0 righe):
-- select user_id, active, expires_at from public.beta_cohort_memberships
-- where cohort_key = 'trama-one-controlled-beta' and user_id = '847bc128-7725-42cb-9dd2-6012360df9a7';

-- 3. Conferma ruolo/centro corretti (atteso: role='center_admin', center_id valorizzato):
-- select id, email, role, center_id from public.profiles
-- where id = '847bc128-7725-42cb-9dd2-6012360df9a7';

-- ════════════════════════════════════════════════════════════════
-- ARRUOLAMENTO
-- ════════════════════════════════════════════════════════════════

begin;

insert into public.beta_cohort_memberships (user_id, cohort_key, active, expires_at)
values ('847bc128-7725-42cb-9dd2-6012360df9a7', 'trama-one-controlled-beta', true, now() + interval '60 days')
on conflict (user_id, cohort_key)
do update set active = true, expires_at = excluded.expires_at;

commit;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il commit
-- ════════════════════════════════════════════════════════════════

-- select bcm.user_id, p.email, p.role, bcm.active, bcm.expires_at
-- from public.beta_cohort_memberships bcm
-- join public.profiles p on p.id = bcm.user_id
-- where bcm.user_id = '847bc128-7725-42cb-9dd2-6012360df9a7';
--
-- Poi nell'app: refresh della pagina Partner -> il tour Spotlight deve
-- partire automaticamente (nessun re-login necessario).

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- update public.beta_cohort_memberships
-- set active = false
-- where cohort_key = 'trama-one-controlled-beta' and user_id = '847bc128-7725-42cb-9dd2-6012360df9a7';
