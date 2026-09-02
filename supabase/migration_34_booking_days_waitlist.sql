-- Migrazione 34 — Lista d'attesa per "Giorni spot" pieni + seleziona-tutto
-- multi-giorno in accettazione (segnalazione beta di un genitore,
-- /center/prenotazioni, 01/09/2026, verbatim: "Nella accettazione delle
-- richieste di prenotazione bisogna prevedere anche il seleziona tutto su
-- più giorni. Domanda: come si verifica se ho ancora disponibilità in quei
-- giorni? Da considerare anche ipotesi di messa in lista d'attesa").
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase PRIMA che il bottone "Accetta i
-- giorni selezionati" in /center/prenotazioni possa mettere in lista
-- d'attesa un giorno pieno invece di fallire silenziosamente. FINCHÉ NON
-- VIENE APPLICATA: app/actions/booking-response.ts (vedi commento lì)
-- rileva l'assenza del valore 'waitlisted' e degrada in modo sicuro — un
-- giorno pieno resta "In attesa" con un messaggio esplicito invece di
-- essere accettato oltre capacità o di far fallire l'intera richiesta.
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO
-- ════════════════════════════════════════════════════════════════
-- Bug reale trovato durante l'analisi di questa segnalazione (indipendente
-- dalla feature, corretto nello stesso giro): respondToBookingDayAction
-- (app/actions/booking-response.ts) scriveva partner_decision='accepted' SU
-- booking_days PRIMA di verificare se reserveDayCapacity riusciva
-- davvero — se activity_days.spots_left era già a 0, il giorno risultava
-- "Accettato" in UI e il genitore riceveva l'email di conferma, ma
-- nessun posto era stato realmente riservato (overbooking silenzioso,
-- mai capacity_decremented=true su quella riga). Il codice ora verifica
-- la capacità PRIMA di scrivere la decisione finale — questa migrazione
-- aggiunge lo stato che permette di offrire un'alternativa (lista
-- d'attesa) invece di limitarsi a rifiutare quando il giorno è pieno.
--
-- Decisione (REUSE > ADAPT, coerente con DEC-15/DEC-42 già applicato in
-- migration_13): NESSUNA nuova tabella "waitlist" — un quinto valore
-- ADDITIVO sulla stessa colonna booking_days.partner_decision già esistente
-- (pending/accepted/rejected → + waitlisted), più una colonna timestamp per
-- ordinare la promozione (FIFO: chi è in lista da più tempo va promosso
-- per primo quando si libera un posto). Nessuna riga esistente toccata
-- (nessun default cambiato, nessuna riga esistente può già avere questo
-- valore).
--
-- Promozione: MANUALE in questa prima versione (bottone "Promuovi" nella
-- Inbox prenotazioni quando un giorno è in lista d'attesa — il centro
-- riprova la riserva di un posto quando pensa che se ne sia liberato uno,
-- es. dopo una cancellazione). Una promozione AUTOMATICA in tempo reale
-- (trigger su cancelBookingDayAction che promuove da solo il primo in coda)
-- è un ambito più delicato (notifiche al genitore, race condition su più
-- giorni in coda contemporaneamente) — lasciata esplicitamente fuori da
-- questa migrazione, la colonna waitlisted_at è già pronta a supportarla in
-- un secondo momento senza ulteriori modifiche allo schema.
--
-- ════════════════════════════════════════════════════════════════
-- Transazionalità: DDL sotto interamente in BEGIN/COMMIT.
-- ════════════════════════════════════════════════════════════════

begin;

alter table public.booking_days
  drop constraint if exists booking_days_partner_decision_check;

alter table public.booking_days
  add constraint booking_days_partner_decision_check
    check (partner_decision in ('pending', 'accepted', 'rejected', 'waitlisted'));

alter table public.booking_days
  add column if not exists waitlisted_at timestamptz;

comment on column public.booking_days.waitlisted_at is
  'Migrazione 34: timestamp di quando questo giorno è stato messo in lista d''attesa (activity_days.spots_left era a 0 al momento del tentativo di accettazione) — null se il giorno non è mai stato in lista d''attesa. Usato per ordinare la promozione manuale (il più vecchio in coda va promosso per primo).';

commit;

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE, solo lettura, PRIMA del blocco
-- begin;/commit; sopra.
-- ════════════════════════════════════════════════════════════════

-- 1. Vincolo attuale (atteso: solo pending/accepted/rejected):
-- select conname, pg_get_constraintdef(oid) as def from pg_constraint
--   where conrelid = 'public.booking_days'::regclass and contype = 'c';

-- 2. Nessuna riga ha già un valore fuori dai tre attuali (deve dare 0 righe,
--    altrimenti indica dati anomali da investigare PRIMA di procedere):
-- select partner_decision, count(*) from public.booking_days
--   where partner_decision not in ('pending','accepted','rejected')
--   group by partner_decision;

-- 3. Conteggio righe esistenti (da confrontare dopo il commit — invariato):
-- select count(*) from public.booking_days;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il commit, separatamente, una query alla volta.
-- ════════════════════════════════════════════════════════════════

-- 4. Nuovo vincolo presente con i 4 valori attesi:
-- select conname, pg_get_constraintdef(oid) as def from pg_constraint
--   where conrelid = 'public.booking_days'::regclass and contype = 'c';
-- -- atteso: CHECK (partner_decision = ANY (ARRAY['pending','accepted','rejected','waitlisted']))

-- 5. Colonna waitlisted_at creata, nullable, nessun default:
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'booking_days'
--   and column_name = 'waitlisted_at';
-- -- atteso: 1 riga, timestamp with time zone, is_nullable = YES, column_default = null.

-- 6. Nessuna riga esistente alterata:
-- select count(*) from public.booking_days;
-- -- atteso: uguale al PRE-CHECK punto 3.
-- select partner_decision, count(*) from public.booking_days group by partner_decision;
-- -- atteso: nessuna riga con partner_decision='waitlisted' finché il codice
-- -- applicativo non ne scrive una (questa migrazione non tocca righe
-- -- esistenti).

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (blocco separato — rimuove SOLO il valore 'waitlisted' e la
-- colonna waitlisted_at; fallisce ESPLICITAMENTE se esistono già righe con
-- partner_decision='waitlisted', per non perdere dati in modo silenzioso —
-- in quel caso deciderle manualmente prima, es. riportarle a 'pending')
-- ════════════════════════════════════════════════════════════════
-- begin;
-- do $$
-- begin
--   if exists (select 1 from public.booking_days where partner_decision = 'waitlisted') then
--     raise exception 'Rollback bloccato: esistono righe booking_days con partner_decision=''waitlisted''. Decidile manualmente (es. UPDATE a ''pending'') prima di rifare il rollback.';
--   end if;
-- end $$;
-- alter table public.booking_days drop constraint if exists booking_days_partner_decision_check;
-- alter table public.booking_days
--   add constraint booking_days_partner_decision_check
--     check (partner_decision in ('pending', 'accepted', 'rejected'));
-- alter table public.booking_days drop column if exists waitlisted_at;
-- commit;
