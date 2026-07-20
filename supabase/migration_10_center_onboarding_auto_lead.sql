-- Migrazione 10 — TRAMA ONE Sprint 1 Audit Remediation: inizializzazione
-- automatica dello stato LEAD per i centri realmente nuovi.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, DOPO migration_09_center_onboarding.sql
-- (già applicata in produzione). Non modifica migration_09.
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO E PROBLEMA CORRETTO
-- ════════════════════════════════════════════════════════════════
-- migration_09 introduce center_onboarding_state con la convenzione "riga
-- assente = APPROVED", corretta e voluta per i centri PRE-ESISTENTI (creati
-- prima di questa migrazione): protegge l'AS-IS, nessun centro già attivo
-- deve rifare l'onboarding, nessun backfill.
--
-- Verificato però che questa stessa convenzione si applica INDISTINTAMENTE
-- anche ai centri creati DOPO Sprint 1, perché nessun meccanismo inseriva
-- automaticamente una riga LEAD alla creazione di un nuovo centro (DEC-25,
-- docs/trama-one/analysis/DECISION_LOG.md). Conseguenza: un centro
-- genuinamente nuovo risultava implicitamente "Approvato" e non poteva mai
-- raggiungere via UI il percorso di attivazione (nessun bottone "Avvia
-- l'attivazione del centro" mai mostrato). Nel test manuale di Sprint 1 è
-- stato necessario un INSERT diretto della riga LEAD per verificare il
-- flusso end-to-end.
--
-- Questa migrazione chiude il gap SOLO per i centri nuovi, senza toccare né
-- migration_09 né alcuna riga esistente.
--
-- ════════════════════════════════════════════════════════════════
-- ANALISI DEI PUNTI DI INSERIMENTO IN public.centers (luglio 2026, statica)
-- ════════════════════════════════════════════════════════════════
-- 1. app/actions/admin.ts -> createCenterAndAssignAction() — Server Action,
--    UNICO punto applicativo a runtime, riservato a platform_admin (RLS su
--    "centers"). Nessun altro Server Action, API route o funzione Supabase
--    nel repository inserisce righe in public.centers (verificato via
--    ricerca testuale su tutto app/actions/*, app/api/*, app/internal/*).
-- 2. supabase/seed.sql — script di bootstrap ambiente, INSERT SQL diretto,
--    bypassa completamente l'applicazione.
-- 3. supabase/seed-test-data.sql — fixture di test, INSERT SQL diretto,
--    bypassa completamente l'applicazione.
-- 4. Inserimenti manuali via Supabase SQL Editor (es. import/migrazione dati
--    da fonti esterne) — non tracciabili staticamente, ma un canale reale e
--    già usato in questo progetto.
--
-- Conclusione: NON esiste un unico punto applicativo obbligatorio per ogni
-- inserimento in public.centers — due dei quattro canali individuati sono
-- script SQL che bypassano interamente il livello applicativo, e nuovi
-- canali (import bulk, integrazioni future) potrebbero aggiungersi. Per
-- questo si sceglie un TRIGGER A LIVELLO DATABASE (AFTER INSERT su
-- public.centers), che garantisce la regola indipendentemente dal client,
-- coerente con l'indicazione ricevuta ("preferisci un trigger se esistono
-- più percorsi di creazione, alcuni non passano da un unico servizio
-- applicativo, potrebbero aggiungersene di nuovi in futuro").
--
-- ════════════════════════════════════════════════════════════════
-- Transazionalità: DDL sotto interamente in BEGIN/COMMIT, nessuna richiede
-- CONCURRENTLY. O applicata tutta, o (in caso di errore) nessuna parte.
-- ════════════════════════════════════════════════════════════════

begin;

-- Funzione trigger: crea una riga LEAD in center_onboarding_state per ogni
-- nuovo centro. SECURITY DEFINER necessario perché center_onboarding_state
-- non ha (per costruzione, migration_09) alcuna policy RLS di INSERT lato
-- client — solo le funzioni SECURITY DEFINER possono scrivervi. search_path
-- esplicito e ristretto per sicurezza (stessa convenzione delle 3 funzioni
-- di migration_09). ON CONFLICT DO NOTHING: idempotente, mai duplicati, mai
-- sovrascrive uno stato già esistente (anche in caso di retry o di doppio
-- trigger da corse concorrenti).
create or replace function public.init_center_onboarding_lead()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.center_onboarding_state (center_id, status)
  values (new.id, 'LEAD')
  on conflict (center_id) do nothing;
  return new;
end;
$$;

comment on function public.init_center_onboarding_lead() is
  'TRAMA ONE Sprint 1 Remediation — trigger AFTER INSERT su public.centers: crea automaticamente una riga LEAD in center_onboarding_state per ogni centro nuovo, indipendentemente dal client che lo ha creato (Server Action, seed script, SQL Editor, futuri canali). ON CONFLICT DO NOTHING: idempotente, nessun duplicato, mai sovrascrive uno stato esistente. Non tocca mai i centri creati prima della sua attivazione (nessun trigger retroattivo, nessun backfill).';

drop trigger if exists trg_init_center_onboarding_lead on public.centers;
create trigger trg_init_center_onboarding_lead
  after insert on public.centers
  for each row execute function public.init_center_onboarding_lead();

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, post-check, rollback. Mai eseguiti insieme al blocco
-- DDL.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA di applicare il
-- blocco begin;/commit; sopra. Solo lettura.
-- ════════════════════════════════════════════════════════════════

-- 1. Esistenza di public.centers e public.center_onboarding_state:
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('centers', 'center_onboarding_state');
-- -- atteso: 2 righe.

-- 2. Vincolo unique su center_onboarding_state.center_id (necessario per
--    ON CONFLICT DO NOTHING):
-- select conname from pg_constraint
--   where conrelid = 'public.center_onboarding_state'::regclass and contype = 'u';
-- -- atteso: uq_center_onboarding_state_center presente.

-- 3. Nessuna funzione o trigger con lo stesso nome già esistente:
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname = 'init_center_onboarding_lead';
-- select tgname from pg_trigger where tgname = 'trg_init_center_onboarding_lead';
-- -- atteso su ambiente pulito: 0 righe per entrambe.

-- 4. Numero di centri preesistenti (per confermare, dopo l'applicazione, che
--    NESSUNO di questi riceve una riga LEAD retroattiva):
-- select count(*) from public.centers;

-- 5. Numero di righe onboarding già presenti (deve restare IDENTICO subito
--    dopo il commit — nessun backfill):
-- select count(*) from public.center_onboarding_state;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query alla
-- volta.
-- ════════════════════════════════════════════════════════════════

-- 6. Trigger e funzione presenti:
-- select tgname, tgrelid::regclass, tgenabled from pg_trigger
--   where tgname = 'trg_init_center_onboarding_lead';
-- select proname, prosecdef from pg_proc where proname = 'init_center_onboarding_lead';
-- -- atteso: 1 riga ciascuna, prosecdef = true.

-- 7. Nessun backfill sui centri esistenti — il conteggio di
--    center_onboarding_state subito dopo il commit deve essere IDENTICO al
--    conteggio del pre-check punto 5:
-- select count(*) from public.center_onboarding_state;

-- 8. Test con un nuovo centro riconoscibile (nome con prefisso [TEST]):
-- insert into public.centers (slug, name, city)
--   values ('test-auto-lead-centro', '[TEST] Centro Auto LEAD', 'Milano')
--   returning id;
-- select center_id, status from public.center_onboarding_state
--   where center_id = '<id restituito sopra>';
-- -- atteso: 1 riga, status = 'LEAD'.

-- 9. Idempotenza / nessun duplicato anche in caso di retry manuale sullo
--    stesso center_id:
-- insert into public.center_onboarding_state (center_id, status)
--   values ('<id centro test dal punto 8>', 'LEAD')
--   on conflict (center_id) do nothing;
-- select count(*) from public.center_onboarding_state
--   where center_id = '<id centro test dal punto 8>';
-- -- atteso: 1 (non 2).

-- 10. Cleanup del centro di test creato al punto 8 (facoltativo, solo se non
--     serve per un test successivo end-to-end):
-- delete from public.center_onboarding_audit_log where center_id = '<id centro test dal punto 8>';
-- delete from public.center_onboarding_state where center_id = '<id centro test dal punto 8>';
-- delete from public.centers where id = '<id centro test dal punto 8>';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (eseguire come blocco separato — sicuro, rimuove SOLO il
-- meccanismo automatico, ordine corretto: prima il trigger, poi la
-- funzione)
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop trigger if exists trg_init_center_onboarding_lead on public.centers;
-- drop function if exists public.init_center_onboarding_lead();
-- commit;
--
-- NOTA: questo rollback rimuove solo il trigger e la funzione. NON cancella
-- le righe center_onboarding_state già create (per centri nuovi realmente
-- attivati nel frattempo) né tocca in alcun modo migration_09. La
-- cancellazione di dati onboarding reali già creati richiede un'istruzione
-- esplicita e separata, mai eseguita per default insieme a questo rollback.
