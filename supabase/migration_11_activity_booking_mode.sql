-- Migrazione 11 — TRAMA ONE Build Sprint 2: modalità di prenotazione e
-- minimo giorni per le attività ("Giorni spot").
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, DOPO migration_10 (indipendente da
-- quella — tocca solo public.activities, non centers/onboarding).
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO E DECISIONE (DEC-32, docs/trama-one/analysis/DECISION_LOG.md)
-- ════════════════════════════════════════════════════════════════
-- Riconciliazione AS-IS per Build Sprint 2 (SPRINT_2_FEATURE_PRESERVATION_
-- MATRIX.md) ha verificato che la capability "Giorni spot" richiesta dallo
-- scope Sprint 2 esiste già quasi per intero in Legacy/NextGen:
-- disponibilità settimanale (activity_weeks), disponibilità giorno-per-
-- giorno/capacità/sconto/last-minute (activity_days), scrittura Partner
-- (saveActivityDaysAction), lettura Parent (getActivityDays), servizi,
-- regole di cancellazione (centers.cancellation_window_days).
--
-- Decisione Offering (DEC-05): ADAPT, nessuna nuova entità — duplicare uno
-- schema già funzionante violerebbe DEC-15 (reuse-first) senza beneficio.
--
-- Le uniche due lacune reali trovate:
--   1. Nessuna colonna distingue se un'attività è prenotabile solo a
--      settimana, solo a giorno, o entrambe (oggi implicitamente "mista"
--      per ogni attività con righe in activity_days).
--   2. Nessun vincolo di minimo giorni per una prenotazione a Giorni spot.
--
-- Questa migrazione le chiude con 2 SOLE colonne additive su
-- public.activities. Nessuna colonna esistente è alterata o rimossa,
-- nessun'altra tabella è toccata, nessun backfill di dati necessario: i
-- default preservano esattamente il comportamento AS-IS per ogni attività
-- già esistente.
--
-- ════════════════════════════════════════════════════════════════
-- Transazionalità: DDL sotto interamente in BEGIN/COMMIT, nessuna richiede
-- CONCURRENTLY. O applicata tutta, o (in caso di errore) nessuna parte.
-- ════════════════════════════════════════════════════════════════

begin;

-- booking_mode: default 'mixed' = comportamento oggi implicito per tutte le
-- attività con righe in activity_days (nessuna attività esistente cambia
-- comportamento). Check vincolante ai soli 3 valori ammessi.
alter table public.activities
  add column if not exists booking_mode text not null default 'mixed'
    check (booking_mode in ('week_only', 'day_only', 'mixed'));

comment on column public.activities.booking_mode is
  'TRAMA ONE Build Sprint 2 (DEC-32): modalità di prenotazione ammesse — week_only (solo activity_weeks), day_only (solo activity_days/Giorni spot), mixed (entrambe, default e comportamento AS-IS invariato per ogni attività preesistente).';

-- min_days_per_booking: nullable, nessun minimo se assente — comportamento
-- AS-IS invariato (oggi ogni giorno aperto è prenotabile singolarmente).
alter table public.activities
  add column if not exists min_days_per_booking integer;

comment on column public.activities.min_days_per_booking is
  'TRAMA ONE Build Sprint 2 (DEC-32): minimo di giorni consecutivi richiesti per una prenotazione a Giorni spot. NULL = nessun minimo (comportamento AS-IS invariato).';

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

-- 1. Esistenza di public.activities:
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name = 'activities';
-- -- atteso: 1 riga.

-- 2. Nessuna delle 2 colonne già presente (ambiente pulito):
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'activities'
--   and column_name in ('booking_mode', 'min_days_per_booking');
-- -- atteso: 0 righe.

-- 3. Numero di attività esistenti (per confermare, dopo l'applicazione, che
--    NESSUNA cambia comportamento — tutte devono risultare 'mixed'):
-- select count(*) from public.activities;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query alla
-- volta.
-- ════════════════════════════════════════════════════════════════

-- 4. Colonne presenti coi default attesi:
-- select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'activities'
--   and column_name in ('booking_mode', 'min_days_per_booking');
-- -- atteso: booking_mode (text, default 'mixed', not null),
-- --          min_days_per_booking (integer, default null, nullable).

-- 5. Nessun backfill/alterazione inattesa — ogni attività esistente deve
--    risultare 'mixed' e min_days_per_booking NULL (stesso conteggio del
--    pre-check punto 3):
-- select booking_mode, count(*) from public.activities group by booking_mode;
-- -- atteso: una sola riga, booking_mode = 'mixed', count = totale attività.
-- select count(*) from public.activities where min_days_per_booking is not null;
-- -- atteso: 0.

-- 6. Vincolo check attivo (verifica che un valore non ammesso sia respinto —
--    ESEGUIRE SOLO IN AMBIENTE DI TEST, mai in produzione su righe reali):
-- update public.activities set booking_mode = 'invalid_value'
--   where id = '<uuid di test>';
-- -- atteso: errore di violazione check constraint, nessuna riga modificata.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (eseguire come blocco separato — sicuro, rimuove SOLO le 2
-- colonne aggiunte, nessun altro effetto)
-- ════════════════════════════════════════════════════════════════
-- begin;
-- alter table public.activities drop column if exists booking_mode;
-- alter table public.activities drop column if exists min_days_per_booking;
-- commit;
--
-- NOTA: questo rollback rimuove le 2 colonne e ogni valore eventualmente
-- impostato su di esse (es. da un wizard Partner che avesse già iniziato a
-- usarle). Non tocca alcun'altra colonna/tabella di public.activities.
