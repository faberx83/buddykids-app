-- Migrazione 12 — TRAMA ONE Build Sprint 3: persistenza dei giorni singoli
-- scelti dal genitore in una prenotazione "Giorni spot".
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, DOPO migration_11 (dipende da
-- public.activity_days, già esistente da Sprint 2, e da public.bookings,
-- già esistente da prima di TRAMA ONE — non serve altro prerequisito).
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO E DECISIONE (DEC-38, docs/trama-one/analysis/DECISION_LOG.md)
-- ════════════════════════════════════════════════════════════════
-- SPRINT_3_FEATURE_PRESERVATION_MATRIX.md ha verificato che oggi non esiste
-- alcuna tabella per registrare QUALI giorni di activity_days un genitore ha
-- prenotato — solo public.booking_weeks esiste (prenotazione a settimana
-- intera). Serve l'equivalente per Giorni spot.
--
-- Decisione: nuova tabella public.booking_days, additiva, che rispecchia
-- ESATTAMENTE lo stesso pattern di public.booking_weeks (stessa struttura,
-- stessa RLS) — coerente con DEC-15 (reuse-first: riusare un pattern già
-- validato invece di inventarne uno nuovo). Unica differenza voluta: una
-- colonna "price" che congela il prezzo del singolo giorno al momento della
-- prenotazione (calcolato lato client con lib/day-pricing.ts, verificabile
-- in seguito) — booking_weeks non ne ha bisogno perché il prezzo per
-- settimana è ricavabile da activities.price_per_week, ma il prezzo di un
-- giorno dipende anche dallo sconto specifico di quel giorno
-- (activity_days.discount_percent), che può cambiare nel tempo: senza
-- congelarlo, lo storico di una prenotazione passata risulterebbe
-- ricalcolato in modo scorretto se il Gestore modifica lo sconto in seguito.
--
-- Fuori scope di questa migrazione (deliberatamente): nessun decremento
-- automatico di activity_days.spots_left alla prenotazione — verificato che
-- lo stesso vale oggi per booking_weeks/activity_weeks.spots_left (nessun
-- trigger, nessuna decrementazione automatica in createBookingAction):
-- coerente con lo stato AS-IS, non una regressione introdotta qui. La
-- gestione capacità/fulfilment per giorno è esplicitamente Sprint 4
-- ("capacità per giorno" — SPRINT_GOVERNANCE.md).
--
-- ════════════════════════════════════════════════════════════════
-- Transazionalità: DDL sotto interamente in BEGIN/COMMIT.
-- ════════════════════════════════════════════════════════════════

begin;

create table if not exists public.booking_days (
  booking_id uuid references public.bookings(id) on delete cascade not null,
  activity_day_id uuid references public.activity_days(id) on delete cascade not null,
  price numeric(8, 2) not null default 0,
  primary key (booking_id, activity_day_id)
);

comment on table public.booking_days is
  'TRAMA ONE Build Sprint 3 (DEC-38): giorni singoli (Giorni spot) prenotati per una bookings — stesso pattern di booking_weeks, con in più "price" per congelare il prezzo del giorno al momento della prenotazione.';

comment on column public.booking_days.price is
  'Prezzo di QUESTO giorno al momento della prenotazione (calcolato con lib/day-pricing.ts, sconto del giorno già applicato) — congelato per non essere alterato da modifiche successive di activity_days.discount_percent.';

alter table public.booking_days enable row level security;

create policy "Booking days: visibili solo tramite la prenotazione del genitore"
  on public.booking_days for all
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_days.booking_id and b.parent_id = auth.uid()
    )
  );

create policy "Booking days: il centro vede i giorni delle proprie prenotazioni"
  on public.booking_days for select
  using (
    public.is_platform_admin() or exists (
      select 1 from public.bookings b
      join public.activities a on a.id = b.activity_id
      where b.id = booking_days.booking_id and a.center_id = public.current_center_id()
    )
  );

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

-- 1. Prerequisiti esistono (activity_days, bookings, is_platform_admin,
--    current_center_id):
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('activity_days', 'bookings');
-- -- atteso: 2 righe.
-- select routine_name from information_schema.routines
--   where routine_schema = 'public' and routine_name in ('is_platform_admin', 'current_center_id');
-- -- atteso: 2 righe.

-- 2. booking_days non esiste già (ambiente pulito):
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name = 'booking_days';
-- -- atteso: 0 righe.

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query alla
-- volta.
-- ════════════════════════════════════════════════════════════════

-- 3. Tabella creata con la struttura attesa:
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'booking_days'
--   order by ordinal_position;
-- -- atteso: booking_id (uuid, not null), activity_day_id (uuid, not null),
-- --          price (numeric, not null, default 0).

-- 4. RLS abilitata e le 2 policy presenti:
-- select relrowsecurity from pg_class where relname = 'booking_days';
-- -- atteso: true.
-- select policyname from pg_policies where tablename = 'booking_days';
-- -- atteso: 2 righe ("Booking days: visibili solo tramite la prenotazione
-- --          del genitore", "Booking days: il centro vede i giorni delle
-- --          proprie prenotazioni").

-- 5. Nessun impatto su tabelle esistenti — nessuna riga esistente in
--    bookings/booking_weeks/booking_kids/activity_days è toccata da questa
--    migrazione (solo CREATE TABLE additiva):
-- select count(*) from public.bookings;
-- select count(*) from public.activity_days;
-- -- atteso: stesso conteggio di prima dell'applicazione.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (eseguire come blocco separato — sicuro, rimuove SOLO la tabella
-- appena creata, nessun altro effetto)
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop table if exists public.booking_days;
-- commit;
--
-- NOTA: questo rollback elimina anche ogni riga eventualmente già scritta in
-- booking_days (giorni prenotati registrati nel frattempo) — le prenotazioni
-- in public.bookings NON vengono toccate (restano confermate, solo senza il
-- dettaglio giorno-per-giorno).
