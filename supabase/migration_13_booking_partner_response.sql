-- Migrazione 13 — TRAMA ONE Build Sprint 4: risposta Partner alla
-- prenotazione (accetta/rifiuta/proposta alternativa), accettazione/rifiuto
-- per singolo giorno, notifiche (badge letta/non letta), tracciamento di chi
-- ha annullato.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, DOPO migration_12 (dipende da
-- public.bookings, già esistente, e da public.booking_days, migration_12,
-- Sprint 3) — nessun altro prerequisito.
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO E DECISIONE (DEC-42, docs/trama-one/analysis/DECISION_LOG.md;
-- vedi anche SPRINT_4_FEATURE_PRESERVATION_MATRIX.md, sezione "Decisione di
-- riuso")
-- ════════════════════════════════════════════════════════════════
-- La matrice di riconciliazione Sprint 4 ha verificato che oggi non esiste
-- alcun meccanismo di risposta Partner a una prenotazione: bookings.status
-- resta 'pending' per sempre (nessuna azione lato centro lo cambia mai), e
-- non esiste alcun concetto di accettazione/rifiuto per singolo giorno su
-- booking_days.
--
-- Decisione: WRAP, non REPLACE (DEC-15) — nessuna nuova tabella "Request" che
-- duplichi bookings/booking_days. Estensione additiva delle due tabelle
-- esistenti con le colonne minime necessarie, riusando ESATTAMENTE il
-- pattern read_by_parent/read_by_center già validato in activity_inquiries
-- (schema.sql) per le notifiche/badge, invece di inventarne uno nuovo.
--
-- Perché una colonna "partner_decision" separata da "status" (bookings) e
-- non un'estensione della check constraint di "status" stesso: "status"
-- oggi distingue pending/confirmed/cancelled a livello dell'INTERA
-- prenotazione ed è già letto/scritto da codice esistente (cancelBookingAction,
-- updateBookingWeeksAction, createBookingAction) con quella semantica esatta.
-- "partner_decision" è un asse ortogonale — la risposta del CENTRO alla
-- richiesta, che può essere 'proposed' (proposta alternativa, la prenotazione
-- resta pending finché il genitore non accetta) senza dover inventare un
-- quinto valore di "status" che romperebbe ogni punto del codice che oggi
-- fa `status in ('pending','confirmed','cancelled')`. "status" resta la
-- fonte di verità per l'intera prenotazione; "partner_decision" è il
-- dettaglio della risposta del centro, il codice di Sprint 4 farà avanzare
-- "status" a 'confirmed' quando la risposta del centro lo giustifica (WRAP,
-- non sostituzione del significato esistente).
--
-- Stessa logica per booking_days.partner_decision: accettazione/rifiuto per
-- singolo giorno (richiesto esplicitamente da SPRINT_GOVERNANCE.md, "Sprint
-- 4: accettazione completa/parziale, capacità per giorno"), colonna
-- additiva, nessuna riga esistente alterata (default 'pending').
--
-- "capacity_decremented" (booking_days) è un flag idempotenza, non una
-- colonna di stato prodotto: evita un doppio decremento di
-- activity_days.spots_left se l'azione server di accettazione viene
-- rieseguita (retry di rete, doppio click) — stesso principio del gate
-- "isRealDeployment" già usato altrove per evitare effetti collaterali
-- duplicati.
--
-- "cancelled_by" (bookings) è nuovo e serve al Task #347 (cancellazioni per
-- giorno): oggi cancelBookingAction non registra CHI ha annullato (sempre il
-- genitore, per costruzione, essendo un'azione solo genitore) — Sprint 4
-- introduce la cancellazione anche lato centro (rifiuto), quindi va
-- distinto esplicitamente. Nullable: resta null per ogni prenotazione mai
-- annullata, coerente con lo stato AS-IS.
--
-- Fuori scope di questa migrazione (deliberatamente): nessun trigger
-- automatico di decremento capacità qui (quello è logica applicativa nelle
-- Server Action del Task #344, non DDL) — questa migrazione crea solo le
-- colonne che quella logica leggerà/scriverà.
--
-- ════════════════════════════════════════════════════════════════
-- Transazionalità: DDL sotto interamente in BEGIN/COMMIT.
-- ════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────
-- BOOKINGS — colonne additive per la risposta Partner
-- ─────────────────────────────────────────────
alter table public.bookings
  add column if not exists partner_decision text not null default 'pending'
    check (partner_decision in ('pending', 'accepted', 'rejected', 'proposed')),
  add column if not exists partner_proposal_note text,
  add column if not exists partner_proposed_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists cancelled_by text check (cancelled_by in ('parent', 'center')),
  add column if not exists read_by_parent boolean not null default true,
  add column if not exists read_by_center boolean not null default false;

comment on column public.bookings.partner_decision is
  'TRAMA ONE Build Sprint 4 (DEC-42): risposta del centro alla prenotazione — ortogonale a "status" (che resta pending/confirmed/cancelled per l''intera prenotazione). "proposed" = il centro ha suggerito un''alternativa (partner_proposal_note), la prenotazione resta pending finché il genitore non decide.';
comment on column public.bookings.partner_proposal_note is
  'Testo libero della proposta alternativa del centro (es. altre settimane/giorni disponibili), valorizzato solo quando partner_decision = ''proposed''.';
comment on column public.bookings.responded_at is
  'Timestamp della risposta del centro (accept/reject/proposed) — null finché partner_decision resta ''pending''. Base per l''SLA engine prenotazioni (ACR-022).';
comment on column public.bookings.cancelled_by is
  'Chi ha portato "status" a ''cancelled'': ''parent'' (cancelBookingAction esistente) o ''center'' (nuovo rifiuto Sprint 4). Null per ogni prenotazione mai annullata.';
comment on column public.bookings.read_by_parent is
  'Stesso pattern di activity_inquiries.read_by_parent: riparte a false quando il centro risponde, così il genitore vede un badge "nuova risposta".';
comment on column public.bookings.read_by_center is
  'Stesso pattern di activity_inquiries.read_by_center: false per una prenotazione pending non ancora aperta/gestita dal centro.';

-- ─────────────────────────────────────────────
-- BOOKING_DAYS — accettazione/rifiuto per singolo giorno (Giorni spot)
-- ─────────────────────────────────────────────
alter table public.booking_days
  add column if not exists partner_decision text not null default 'pending'
    check (partner_decision in ('pending', 'accepted', 'rejected')),
  add column if not exists partner_note text,
  add column if not exists capacity_decremented boolean not null default false;

comment on column public.booking_days.partner_decision is
  'TRAMA ONE Build Sprint 4 (DEC-42): accettazione/rifiuto del centro per QUESTO singolo giorno (accettazione parziale) — indipendente da bookings.partner_decision, che copre prenotazioni a settimana intera.';
comment on column public.booking_days.capacity_decremented is
  'Flag idempotenza: true dopo che activity_days.spots_left è stato decrementato per questo giorno accettato — evita doppio decremento su retry/doppio click della Server Action di accettazione. Non è uno stato di prodotto, solo un guard tecnico.';

-- ─────────────────────────────────────────────
-- RLS — nuove policy di UPDATE per il centro (oggi il centro ha solo SELECT
-- su entrambe le tabelle: schema.sql riga 482-489 per bookings, migration_12
-- riga 68-76 per booking_days). Stesso pattern esatto delle policy di
-- update già esistenti per activity_inquiries (schema.sql riga 829-842).
-- Nessuna policy esistente modificata o rimossa.
-- ─────────────────────────────────────────────
create policy "Bookings: il centro risponde alle prenotazioni delle proprie attività"
  on public.bookings for update
  using (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = bookings.activity_id and a.center_id = public.current_center_id()
    )
  )
  with check (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = bookings.activity_id and a.center_id = public.current_center_id()
    )
  );

create policy "Booking days: il centro decide sui giorni delle proprie prenotazioni"
  on public.booking_days for update
  using (
    public.is_platform_admin() or exists (
      select 1 from public.bookings b
      join public.activities a on a.id = b.activity_id
      where b.id = booking_days.booking_id and a.center_id = public.current_center_id()
    )
  )
  with check (
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

-- 1. Prerequisiti esistono (bookings, booking_days, is_platform_admin,
--    current_center_id):
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('bookings', 'booking_days');
-- -- atteso: 2 righe.
-- select routine_name from information_schema.routines
--   where routine_schema = 'public' and routine_name in ('is_platform_admin', 'current_center_id');
-- -- atteso: 2 righe.

-- 2. Nessuna delle nuove colonne esiste già (ambiente pulito):
-- select table_name, column_name from information_schema.columns
--   where table_schema = 'public'
--   and (
--     (table_name = 'bookings' and column_name in (
--       'partner_decision', 'partner_proposal_note', 'partner_proposed_at',
--       'responded_at', 'cancelled_by', 'read_by_parent', 'read_by_center'
--     ))
--     or (table_name = 'booking_days' and column_name in (
--       'partner_decision', 'partner_note', 'capacity_decremented'
--     ))
--   );
-- -- atteso: 0 righe.

-- 3. Conteggio righe esistenti (da confrontare dopo il commit — deve restare
--    invariato, questa migrazione non tocca righe esistenti):
-- select count(*) from public.bookings;
-- select count(*) from public.booking_days;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query alla
-- volta.
-- ════════════════════════════════════════════════════════════════

-- 4. Colonne create con la struttura attesa:
-- select table_name, column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public'
--   and (
--     (table_name = 'bookings' and column_name in (
--       'partner_decision', 'partner_proposal_note', 'partner_proposed_at',
--       'responded_at', 'cancelled_by', 'read_by_parent', 'read_by_center'
--     ))
--     or (table_name = 'booking_days' and column_name in (
--       'partner_decision', 'partner_note', 'capacity_decremented'
--     ))
--   )
--   order by table_name, ordinal_position;
-- -- atteso: 10 righe totali (7 su bookings, 3 su booking_days).
-- -- partner_decision (bookings/booking_days), read_by_parent, read_by_center,
-- -- capacity_decremented: not null con default. Il resto: nullable, nessun
-- -- default (eccetto i default già indicati sopra).

-- 5. Ogni riga esistente ha ricevuto i default corretti (nessuna riga con
--    valori inattesi):
-- select partner_decision, count(*) from public.bookings group by partner_decision;
-- -- atteso: un'unica riga, partner_decision = 'pending', count = totale
-- -- righe esistenti in bookings (confrontare con il conteggio del PRE-CHECK
-- -- punto 3).
-- select partner_decision, count(*) from public.booking_days group by partner_decision;
-- -- atteso: un'unica riga, partner_decision = 'pending', count = totale
-- -- righe esistenti in booking_days.
-- select read_by_parent, read_by_center, count(*) from public.bookings group by 1, 2;
-- -- atteso: un'unica riga, true/false, stesso count del totale bookings.

-- 6. Nuove policy di UPDATE presenti (oltre alle policy esistenti, invariate):
-- select tablename, policyname, cmd from pg_policies
--   where tablename in ('bookings', 'booking_days') order by tablename, policyname;
-- -- atteso, in aggiunta alle policy già esistenti verificate in migration_12
-- -- e schema.sql: "Bookings: il centro risponde alle prenotazioni delle
-- -- proprie attività" (UPDATE), "Booking days: il centro decide sui giorni
-- -- delle proprie prenotazioni" (UPDATE).

-- 7. Nessun impatto sui conteggi esistenti (confrontare con il PRE-CHECK
--    punto 3 — devono coincidere esattamente):
-- select count(*) from public.bookings;
-- select count(*) from public.booking_days;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (eseguire come blocco separato — rimuove SOLO le colonne e le
-- policy appena aggiunte, nessun altro effetto; le tabelle bookings/
-- booking_days e le loro righe/policy preesistenti restano intatte)
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists "Bookings: il centro risponde alle prenotazioni delle proprie attività" on public.bookings;
-- drop policy if exists "Booking days: il centro decide sui giorni delle proprie prenotazioni" on public.booking_days;
-- alter table public.bookings
--   drop column if exists partner_decision,
--   drop column if exists partner_proposal_note,
--   drop column if exists partner_proposed_at,
--   drop column if exists responded_at,
--   drop column if exists cancelled_by,
--   drop column if exists read_by_parent,
--   drop column if exists read_by_center;
-- alter table public.booking_days
--   drop column if exists partner_decision,
--   drop column if exists partner_note,
--   drop column if exists capacity_decremented;
-- commit;
--
-- NOTA: questo rollback elimina anche ogni risposta Partner/accettazione per
-- giorno eventualmente già registrata nel frattempo — le prenotazioni in
-- public.bookings e i giorni in public.booking_days NON vengono toccati
-- (restano con status/righe invariati, solo senza il dettaglio di risposta
-- Partner).
