-- Script (SOLA LETTURA) — TRAMA ONE Production Hygiene (§19 del gate
-- "Controlled Beta Experience, Publication and Readiness Gate").
--
-- QUESTO FILE NON APPLICA NULLA AL DATABASE: ogni query è un SELECT. Va
-- eseguito manualmente da Fabrizio nello SQL Editor di Supabase, progetto
-- eagsgfxunwyyxwwilldy, quando serve un controllo di igiene sui dati di
-- produzione (proposto: stessa cadenza settimanale del monitoraggio §18,
-- CONTROLLED_BETA_OPERATING_MODEL.md §3).
--
-- Origine: le stesse query sono state eseguite in sola lettura via Supabase
-- MCP il 2026-08-03 durante la stesura di questo gate (§19), una per una
-- (mai più statement insieme nella stessa chiamata — vedi DEC-64/DEC-63 per
-- il motivo: uno strumento di query può restituire solo l'ultimo risultato
-- di una chiamata multi-statement, quindi ogni SEZIONE qui sotto va anche
-- eseguita/letta separatamente, non incollata tutta insieme in un solo Run).
-- Risultato di quella sessione: 2 centri di test orfani e 7 righe
-- center_leads di test, tutti creati lo stesso giorno — vedi
-- TRAMA_ONE_PRODUCTION_HYGIENE.md per l'analisi completa e
-- script_production_hygiene_cleanup.sql per la pulizia proposta (separata,
-- anch'essa non applicata).


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 1 — Feature flag / coorte (sanity check rispetto a DEC-57)
-- ════════════════════════════════════════════════════════════════

-- 1a. Deve restituire ESATTAMENTE 3 righe per TRAMA_ONE_ENABLED: cohort
-- (enabled=true, expires_at=2026-10-02), global storico (enabled=false,
-- scaduto) e role=platform_admin (enabled=true, expires_at=null). Una
-- quarta riga, o valori diversi da questi, indicano una modifica non
-- documentata da investigare prima di procedere con qualunque altra cosa.
select id, scope_type, scope_value, enabled, expires_at, created_at
from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED'
order by scope_type;

-- 1b. Override scaduti (expires_at nel passato) ma ancora enabled=true, per
-- QUALUNQUE flag — non solo TRAMA_ONE_ENABLED: un override che dovrebbe
-- essere spento ma non lo è per un bug del job di scadenza (o perché il job
-- non gira) è un problema di igiene indipendente da questo gate.
select id, flag_name, scope_type, scope_value, enabled, expires_at
from public.feature_flag_overrides
where enabled = true and expires_at is not null and expires_at < now()
order by expires_at;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 2 — Beta cohort memberships (sanity check)
-- ════════════════════════════════════════════════════════════════

-- 2a. Deve restituire ESATTAMENTE le membership attese per la coorte
-- (2 account di test finché non viene espansa, DEC-57/§18) — nessuna riga
-- con user_id non risolvibile in public.profiles (join per verificarlo).
select bcm.user_id, p.email, p.role, bcm.active, bcm.expires_at, bcm.created_at
from public.beta_cohort_memberships bcm
left join public.profiles p on p.id = bcm.user_id
where bcm.cohort_key = 'trama-one-controlled-beta'
order by bcm.created_at;

-- 2b. Membership orfane: user_id che non esiste (più) in profiles — non
-- dovrebbe mai accadere (FK), ma un controllo esplicito non costa nulla.
select bcm.*
from public.beta_cohort_memberships bcm
left join public.profiles p on p.id = bcm.user_id
where p.id is null;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 3 — Centri di test / debris ("[TEST]" o "test" nel nome)
-- ════════════════════════════════════════════════════════════════

-- 3a. Ogni centro con "test" nel nome, quante attività reali ha, quante
-- righe di audit onboarding ha, quando è stato creato. Un centro con 0
-- attività e 0 audit creato oggi (o comunque molto recentemente) è quasi
-- certamente debris di un run di test automatico, non un fixture
-- intenzionale. Confrontare SEMPRE con la lista dei fixture noti e
-- legittimi in TRAMA_ONE_PRODUCTION_HYGIENE.md §2 prima di considerare una
-- riga "sicura da rimuovere" — non tutto ciò che contiene "test" nel nome è
-- debris (es. "[TEST] Centro BuddyKids" è un fixture reale, permanente, con
-- attività e storia).
select
  c.id,
  c.name,
  c.created_at,
  (select count(*) from public.activities a where a.center_id = c.id) as n_activities,
  (select count(*) from public.center_onboarding_audit_log l where l.center_id = c.id) as n_audit_rows
from public.centers c
where c.name ilike '%test%'
order by c.created_at;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 4 — Center leads di test
-- ════════════════════════════════════════════════════════════════

-- 4a. Ogni center_lead con "[TEST]" nel nome suggerito — stessa logica
-- della SEZIONE 3: un volume anomalo di righe create nella stessa manciata
-- di minuti/ore è il segnale di un run di test, non di segnalazioni reali.
select id, suggested_name, status, claimed_center_id, created_at
from public.center_leads
where suggested_name ilike '[TEST]%'
order by created_at;

-- 4b. Distribuzione per giorno di creazione di TUTTI i center_leads (non
-- solo quelli con "[TEST]" nel nome) — utile per vedere se il volume di un
-- singolo giorno è anomalo rispetto agli altri, anche per righe che non
-- hanno il prefisso "[TEST]" ma sono comunque debris (es. rinominate).
select date_trunc('day', created_at) as giorno, count(*) as n_leads
from public.center_leads
group by 1
order by 1 desc;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 5 — Profili reali (deve restituire un numero piccolo e noto)
-- ════════════════════════════════════════════════════════════════

-- 5a. Conteggio totale profili per ruolo — un modo rapido per accorgersi se
-- un run di test ha creato utenti reali invece di riusare i 2 account di
-- test dedicati (faberx83+test-genitore@, faberx83+test-gestore@).
select role, count(*) as n
from public.profiles
group by role
order by role;

-- 5b. Elenco puntuale di tutti i profili (atteso: pochissime righe, tutte
-- riconoscibili — vedi TRAMA_ONE_PRODUCTION_HYGIENE.md §1 per l'elenco noto
-- alla data di questo audit).
select id, email, role, center_id, created_at
from public.profiles
order by created_at;
