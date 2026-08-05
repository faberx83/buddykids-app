-- Script una tantum — sblocco immediato del profilo di test
-- faberx83+partnernew@gmail.com, bloccato dal bug RLS descritto in
-- migration_22_profiles_admin_write_rls_fix.sql.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase. Serve a sbloccarti SUBITO, senza
-- aspettare il prossimo deploy col codice aggiornato — la migrazione 22
-- resta comunque necessaria per correggere il problema alla radice per
-- TUTTI i futuri utenti, questo script sistema solo la riga già rotta.
--
-- Eseguito da service_role/postgres owner nello SQL Editor: bypassa RLS
-- (non passa dal client applicativo), quindi funziona indipendentemente
-- dalla migrazione 22.

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — eseguire PRIMA, per confermare lo stato attuale rotto
-- ════════════════════════════════════════════════════════════════
-- select id, email, role, center_id
--   from public.profiles
--   where lower(email) = 'faberx83+partnernew@gmail.com';
-- Atteso: role='parent', center_id=null (il bug: la candidatura è approvata
-- ma la promozione non è mai stata scritta).

-- select id, status, claimed_center_id, claimed_at
--   from public.center_leads
--   where lower(candidate_email) = 'faberx83+partnernew@gmail.com';
-- Atteso: status='claimed', claimed_center_id='f572aa29-c070-46e0-bd98-5c3ce6dd25ed'.

-- ════════════════════════════════════════════════════════════════
-- FIX — la scrittura vera e propria
-- ════════════════════════════════════════════════════════════════
update public.profiles
set role = 'center_admin',
    center_id = 'f572aa29-c070-46e0-bd98-5c3ce6dd25ed'
where id = '847bc128-7725-42cb-9dd2-6012360df9a7';

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO, per confermare la scrittura
-- ════════════════════════════════════════════════════════════════
-- select id, email, role, center_id
--   from public.profiles
--   where id = '847bc128-7725-42cb-9dd2-6012360df9a7';
-- Atteso: role='center_admin', center_id='f572aa29-c070-46e0-bd98-5c3ce6dd25ed'.
--
-- Poi nell'app: refresh della pagina Partner (nessun re-login necessario —
-- il ruolo è letto fresco dal DB a ogni richiesta, non è nel JWT) deve
-- portare al portale Partner invece che alla home genitori.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (per tornare allo stato rotto precedente, se mai necessario)
-- ════════════════════════════════════════════════════════════════
-- update public.profiles
-- set role = 'parent', center_id = null
-- where id = '847bc128-7725-42cb-9dd2-6012360df9a7';
