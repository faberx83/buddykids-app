-- Migrazione 18 — TRAMA ONE Build Sprint 6, backlog vincolante P1 "Capacity
-- a tripla fonte di verità" (SPRINT_GOVERNANCE.md, inserito in sede di
-- Evidence Patch 29/07 — vedi AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md §16.6).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase.
--
-- ════════════════════════════════════════════════════════════════
-- Cosa fa e perché
-- ════════════════════════════════════════════════════════════════
-- CORE_DOMAIN_SOURCE_OF_TRUTH.md §5 (Gate E) aveva già mappato il problema:
-- `activity_weeks.spots_left` viene decrementato in
-- app/actions/booking-response.ts SENZA un flag di idempotenza dedicato (a
-- differenza di `booking_days.capacity_decremented`, che invece esiste per
-- il caso giornaliero) — il controllo si basava solo su
-- `booking.partner_decision !== "accepted"` a monte. Costruendo il servizio
-- di capacità canonico richiesto da questo sprint (lib/capacity/service.ts)
-- è emerso un secondo problema concreto, non solo teorico: **cancelBookingAction
-- (app/actions/bookings.ts) non ha MAI rilasciato la capacità settimanale
-- decrementata all'accettazione** — un genitore o un centro che annulla una
-- prenotazione settimanale già accettata perde quel posto per sempre (mai
-- reincrementato), a differenza del caso giornaliero
-- (cancelBookingDayAction) che invece già rilascia correttamente
-- activity_days.spots_left leggendo booking_days.capacity_decremented.
--
-- Questa colonna additiva rende booking_weeks simmetrico a booking_days: un
-- flag esplicito di idempotenza per riga, che il nuovo servizio canonico usa
-- sia per decidere se decrementare (reserve) sia per decidere se rilasciare
-- (release) — chiudendo il bug di perdita di capacità silenziosa.
-- ════════════════════════════════════════════════════════════════

begin;

alter table public.booking_weeks
  add column if not exists capacity_decremented boolean not null default false;

commit;

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE, solo lettura, prima del blocco sopra.
-- ════════════════════════════════════════════════════════════════

-- 1. Confermare che la colonna non esiste già (atteso: 0 righe):
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='booking_weeks' and column_name='capacity_decremented';

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente.
-- ════════════════════════════════════════════════════════════════

-- 2. La colonna esiste con default false (atteso: 1 riga, column_default che contiene 'false'):
-- select column_name, column_default, is_nullable from information_schema.columns
--   where table_schema='public' and table_name='booking_weeks' and column_name='capacity_decremented';

-- 3. Backfill implicito: tutte le righe booking_weeks ESISTENTI partono da
--    `false` (default), NON da uno stato "già decrementato" — questo è
--    corretto per le righe storiche di prenotazioni "confirmed" pre-Sprint 4
--    (vedi migration_14, DEC-43): quella migrazione ha già sistemato
--    `partner_decision`, ma non ha mai toccato `activity_weeks.spots_left`
--    (perché create_booking_action non l'ha mai decrementata alla creazione,
--    solo la risposta esplicita del centro lo fa da Sprint 4). Impostare
--    `capacity_decremented=false` per le righe storiche è quindi CORRETTO,
--    non un bug: se in futuro qualcuno cancellasse una di quelle vecchie
--    prenotazioni booking_weeks, il servizio (vedendo capacity_decremented
--    false) correttamente NON rilascerà un posto mai stato decrementato.

-- 4. Test funzionale: accettare una prenotazione settimanale (Partner) ->
--    spots_left scende di 1, capacity_decremented diventa true sulla riga
--    booking_weeks. Annullare quella prenotazione (Genitore o Gestore) ->
--    spots_left torna al valore precedente, mai sopra activity_weeks.capacity.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — sicuro, additiva e priva di vincoli in ingresso.
-- ════════════════════════════════════════════════════════════════
-- begin;
-- alter table public.booking_weeks drop column if exists capacity_decremented;
-- commit;
