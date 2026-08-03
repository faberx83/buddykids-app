-- Script — TRAMA ONE Production Hygiene: rimozione debris di test
-- identificato durante §19 del gate "Controlled Beta Experience,
-- Publication and Readiness Gate" (2026-08-03, sessione di stesura del
-- gate stesso — non un run automatico ricorrente).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, progetto eagsgfxunwyyxwwilldy,
-- SOLO dopo aver letto e confermato la SEZIONE 1 (PRE-CHECK) qui sotto —
-- i conteggi devono corrispondere a quelli riportati in
-- TRAMA_ONE_PRODUCTION_HYGIENE.md §2 prima di procedere alla SEZIONE 2.
--
-- Perimetro ESATTO di questa pulizia (nessun'altra riga viene toccata):
--   (A) 2 centri "orfani" creati durante run di test lo stesso giorno
--       (2026-08-03), 0 attività, 0 righe di audit onboarding:
--       - '[TEST] Centro Auto LEAD 1785752525740'   id 9e284123-cfac-424d-8fe9-e55d9d7a4d4f
--       - '[TEST] Centro Idempotenza 1785752529922' id e8fd53eb-2020-446f-93c7-1f695140149f
--   (B) 7 righe center_leads di test, tutte create lo stesso giorno
--       (2026-08-03, tra le 09:33 e le 10:22 UTC), prefisso
--       '[TEST] Centro Segnalato %'.
--
-- MAI TOCCARE (esplicitamente esclusi da questo script, per nome e per id):
--   - '[TEST] Centro BuddyKids' (id 40a64d60-3d45-4851-bac4-1761915ad92e) —
--     fixture reale e permanente, collegato all'account
--     TEST_CENTER_ADMIN_EMAIL, ha 2 attività e 14 righe di audit reali. Una
--     delle 7 righe center_leads da rimuovere ha claimed_center_id che punta
--     a QUESTO id (status='claimed') — rimuovere quella riga NON tocca il
--     centro stesso (FK center_leads.claimed_center_id -> ON DELETE SET
--     NULL sui centri, ma qui è il lead ad essere cancellato, non il
--     centro: nessun effetto collaterale sul centro).
--   - 'Test centro estivo' (id 3a240835-6412-402c-9c63-2c8cf0944fca) —
--     precede TRAMA ONE, ha 1 attività reale, ambiguo se sia debris o
--     contenuto demo intenzionale: NON incluso in questa pulizia, richiede
--     una decisione esplicita di Fabrizio (vedi
--     TRAMA_ONE_PRODUCTION_HYGIENE.md §4).
--
-- Effetto cascata atteso sui 2 centri rimossi (letto da
-- information_schema.referential_constraints, non assunto): ON DELETE
-- CASCADE su center_onboarding_state, center_onboarding_audit_log,
-- center_onboarding_checklist_completions, center_identity_verifications,
-- activities, activity_log, group_requests, invites,
-- activity_certifications (tutte a 0 righe per questi 2 id, verificato in
-- PRE-CHECK 1c sotto); ON DELETE SET NULL su profiles.center_id e
-- center_leads.claimed_center_id (nessuna riga con questi id verificato in
-- PRE-CHECK 1d/1e).


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 1 — PRE-CHECK (sola lettura — esegui e leggi PRIMA di procedere)
-- ════════════════════════════════════════════════════════════════

-- 1a. Riconferma i 2 centri target: deve restituire ESATTAMENTE 2 righe,
-- con questi 2 id, 0 attività, 0 audit. Se una qualunque di queste
-- condizioni non è più vera (es. n_activities > 0), FERMARSI e non
-- proseguire alla SEZIONE 2 senza rivedere il perimetro.
select
  c.id,
  c.name,
  c.created_at,
  (select count(*) from public.activities a where a.center_id = c.id) as n_activities,
  (select count(*) from public.center_onboarding_audit_log l where l.center_id = c.id) as n_audit_rows
from public.centers c
where c.id in ('9e284123-cfac-424d-8fe9-e55d9d7a4d4f', 'e8fd53eb-2020-446f-93c7-1f695140149f');

-- 1b. Riconferma le 7 righe center_leads target: deve restituire
-- ESATTAMENTE 7 righe, tutte con prefisso '[TEST] Centro Segnalato'.
select id, suggested_name, status, claimed_center_id, created_at
from public.center_leads
where suggested_name ilike '[TEST] Centro Segnalato%'
order by created_at;

-- 1c. Nessuna attività reale collegata ai 2 centri (ridondante con 1a, ma
-- come lista puntuale invece che conteggio — deve restituire 0 righe).
select * from public.activities
where center_id in ('9e284123-cfac-424d-8fe9-e55d9d7a4d4f', 'e8fd53eb-2020-446f-93c7-1f695140149f');

-- 1d. Nessun profilo reale collegato ai 2 centri (deve restituire 0 righe —
-- se invece un profilo reale ha center_id impostato su uno di questi 2 id,
-- FERMARSI: significherebbe che un centro presunto "orfano" ha in realtà un
-- account associato, da investigare prima di cancellare).
select id, email, role, center_id from public.profiles
where center_id in ('9e284123-cfac-424d-8fe9-e55d9d7a4d4f', 'e8fd53eb-2020-446f-93c7-1f695140149f');

-- 1e. Nessun'altra riga center_leads (oltre alle 7 già identificate in 1b)
-- punta a uno dei 2 centri come claimed_center_id (deve restituire 0 righe:
-- i 2 centri sono di tipo LEAD, non ancora "claimed" da nessuno).
select * from public.center_leads
where claimed_center_id in ('9e284123-cfac-424d-8fe9-e55d9d7a4d4f', 'e8fd53eb-2020-446f-93c7-1f695140149f');


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 2 — PULIZIA (blocco transazionale: tutto o niente)
-- ════════════════════════════════════════════════════════════════

begin;

-- 2a. Rimuove le 7 righe center_leads di test. Fatto PRIMA della rimozione
-- dei centri (ordine ininfluente per le FK qui coinvolte, ma tiene la
-- transazione leggibile in ordine "cosa dipende da cosa").
delete from public.center_leads
where suggested_name ilike '[TEST] Centro Segnalato%';

-- 2b. Rimuove i 2 centri orfani. CASCADE ripulisce automaticamente
-- center_onboarding_state / center_onboarding_audit_log /
-- center_onboarding_checklist_completions / center_identity_verifications
-- (tutte a 0 righe per questi id, PRE-CHECK 1a) — nessuna DELETE separata
-- necessaria per quelle tabelle.
delete from public.centers
where id in ('9e284123-cfac-424d-8fe9-e55d9d7a4d4f', 'e8fd53eb-2020-446f-93c7-1f695140149f');

commit;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 3 — POST-CHECK (sola lettura — esegui subito dopo il commit)
-- ════════════════════════════════════════════════════════════════

-- 3a. Deve restituire 0 righe (i 2 centri non esistono più).
select * from public.centers
where id in ('9e284123-cfac-424d-8fe9-e55d9d7a4d4f', 'e8fd53eb-2020-446f-93c7-1f695140149f');

-- 3b. Deve restituire 0 righe (le 7 segnalazioni di test non esistono più).
select * from public.center_leads
where suggested_name ilike '[TEST] Centro Segnalato%';

-- 3c. Conferma che i fixture legittimi NON sono stati toccati: deve
-- restituire esattamente 2 righe, con gli stessi conteggi di attività/audit
-- di prima ('[TEST] Centro BuddyKids': 2 attività/14 audit; 'Test centro
-- estivo': 1 attività/0 audit — invariati perché non toccati da questo
-- script).
select
  c.id,
  c.name,
  (select count(*) from public.activities a where a.center_id = c.id) as n_activities,
  (select count(*) from public.center_onboarding_audit_log l where l.center_id = c.id) as n_audit_rows
from public.centers c
where c.id in ('40a64d60-3d45-4851-bac4-1761915ad92e', '3a240835-6412-402c-9c63-2c8cf0944fca');


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 4 — ROLLBACK
-- ════════════════════════════════════════════════════════════════
--
-- Non esiste un rollback SQL per un DELETE già commesso (nessuna colonna
-- "deleted_at"/soft-delete su queste tabelle): l'unico ripristino possibile
-- è il Point-in-Time Recovery nativo di Supabase (pannello Database ->
-- Backups), da valutare SOLO se dopo il commit emergesse che una delle
-- assunzioni della SEZIONE 1 era sbagliata (es. un profilo reale aveva
-- effettivamente center_id su uno dei 2 centri, sfuggito al PRE-CHECK 1d).
-- Per questo motivo la SEZIONE 1 è la vera rete di sicurezza di questo
-- script: se anche un solo controllo restituisce un risultato inatteso,
-- FERMARSI prima della SEZIONE 2, non dopo.
