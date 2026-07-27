-- Migrazione 14 — TRAMA ONE Build Sprint 4 (correttivo): backfill di
-- partner_decision per le prenotazioni GIA' CONFERMATE prima che questo
-- meccanismo esistesse.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, DOPO migration_13 (dipende dalle
-- colonne partner_decision/responded_at/read_by_center su bookings e
-- partner_decision/capacity_decremented su booking_days).
--
-- ════════════════════════════════════════════════════════════════
-- BUG segnalato da Fabrizio (screenshot Inbox Partner, post-deploy Sprint 4)
-- ════════════════════════════════════════════════════════════════
-- migration_13 ha aggiunto partner_decision con default 'pending' a TUTTE le
-- righe esistenti di bookings/booking_days (comportamento noto e verificato
-- nel proprio POST-CHECK, punto 5 — non un side-effect nascosto, ma le sue
-- conseguenze lato prodotto non erano state anticipate). Risultato pratico:
-- ogni prenotazione fatta PRIMA che esistesse la funzionalità di risposta
-- Partner (cioè letteralmente ogni prenotazione reale mai fatta sulla
-- piattaforma, dato che createBookingAction in app/booking/[id]/actions.ts
-- imposta status: "confirmed" incondizionatamente e non è mai esistito un
-- flusso che scriva status: "pending") appare ora nella Inbox del centro
-- come "Da rispondere", anche se è già confermata/pagata da tempo.
-- Rischio concreto: un gestore che clicca "Rifiuta" su una di queste righe
-- annullerebbe una prenotazione reale già onorata (respondToBookingAction
-- porta status a "cancelled").
--
-- Decisione (DEC-43, docs/trama-one/analysis/DECISION_LOG.md): le
-- prenotazioni che erano già "confirmed" al momento in cui questa
-- migrazione viene eseguita vanno trattate come già accettate dal centro
-- (riflette la realtà: sono state onorate sotto il flusso implicito
-- pre-Sprint-4). Non tocca in alcun modo bookings.status, booking_kids,
-- booking_weeks o le prenotazioni ancora "pending"/"cancelled" — solo
-- l'asse "risposta Partner", ortogonale allo stato della prenotazione
-- (stessa distinzione già documentata in migration_13/DEC-42).
--
-- Capacità (activity_days.spots_left / activity_weeks.spots_left): NON
-- toccata da questo backfill. createBookingAction non ha mai decrementato
-- la capacità al momento della prenotazione (lo fa solo, da Sprint 4 in
-- poi, respondToBookingAction/respondToBookingDayAction quando il centro
-- accetta esplicitamente) — quindi per queste prenotazioni storiche la
-- capacità non è mai stata decrementata e non deve esserlo ora: il backfill
-- si limita a marcare "già accettato", senza rieseguire la logica di
-- decremento. booking_days.capacity_decremented resta false per queste
-- righe (coerente con la realtà: non è mai stato decrementato nulla per
-- loro).
--
-- Idempotente: il filtro "partner_decision = 'pending'" garantisce che
-- rilanciare questo script non tocchi righe già backfillate o già
-- gestite manualmente da un centro nel frattempo.
-- ════════════════════════════════════════════════════════════════

begin;

-- BOOKINGS — prenotazioni a settimana intera già confermate prima che
-- esistesse la risposta Partner: trattate come già accettate.
update public.bookings
set
  partner_decision = 'accepted',
  responded_at = created_at,
  read_by_center = true
where status = 'confirmed'
  and partner_decision = 'pending';

-- BOOKING_DAYS — stesso backfill per l'accettazione/rifiuto per singolo
-- giorno (Giorni spot): un giorno di una prenotazione già "confirmed" era
-- già di fatto accettato sotto il vecchio flusso.
update public.booking_days bd
set partner_decision = 'accepted'
from public.bookings b
where b.id = bd.booking_id
  and b.status = 'confirmed'
  and bd.partner_decision = 'pending';

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, post-check, rollback. Mai eseguiti insieme al blocco
-- update sopra.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA del blocco
-- begin;/commit; sopra. Solo lettura.
-- ════════════════════════════════════════════════════════════════

-- 1. migration_13 è già applicata (le colonne esistono):
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'bookings'
--   and column_name in ('partner_decision', 'responded_at', 'read_by_center');
-- -- atteso: 3 righe.

-- 2. Quante righe verranno toccate (annotare questi due numeri, servono
--    per il confronto nel POST-CHECK):
-- select count(*) from public.bookings where status = 'confirmed' and partner_decision = 'pending';
-- select count(*) from public.booking_days bd join public.bookings b on b.id = bd.booking_id
--   where b.status = 'confirmed' and bd.partner_decision = 'pending';

-- 3. Nessuna prenotazione "pending"/"cancelled" verrà toccata (deve
--    restare 0 — il filtro sopra usa status = 'confirmed' esplicitamente):
-- select count(*) from public.bookings where status != 'confirmed' and partner_decision = 'pending' and responded_at is null;
-- -- questo conteggio PRIMA e DOPO l'update deve essere identico (sono le
-- -- prenotazioni realmente in attesa di risposta, es. lo STEP 8 di test).

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query
-- alla volta.
-- ════════════════════════════════════════════════════════════════

-- 4. Nessuna prenotazione "confirmed" è rimasta con partner_decision
--    'pending' (deve dare 0 righe):
-- select count(*) from public.bookings where status = 'confirmed' and partner_decision = 'pending';

-- 5. Le prenotazioni "confirmed" backfillate hanno responded_at = created_at
--    e read_by_center = true:
-- select count(*) from public.bookings
--   where status = 'confirmed' and partner_decision = 'accepted' and responded_at = created_at and read_by_center = true;
-- -- atteso: coincide col conteggio del PRE-CHECK punto 2 (prima query).

-- 6. Le prenotazioni realmente ancora in attesa (status != 'confirmed',
--    es. lo STEP 8 di test) NON sono state toccate — deve coincidere col
--    PRE-CHECK punto 3:
-- select count(*) from public.bookings where status != 'confirmed' and partner_decision = 'pending' and responded_at is null;

-- 7. booking_days: stesso controllo lato giorni:
-- select count(*) from public.booking_days bd join public.bookings b on b.id = bd.booking_id
--   where b.status = 'confirmed' and bd.partner_decision = 'pending';
-- -- atteso: 0.

-- 8. Nessun impatto su capacità (spots_left invariato — confrontare con un
--    valore annotato prima di eseguire, se disponibile):
-- select sum(spots_left) from public.activity_days;
-- select sum(spots_left) from public.activity_weeks;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — NON è possibile un rollback esatto (un UPDATE non conserva i
-- valori precedenti come farebbe un DDL reversibile). Se questo backfill
-- va annullato, l'unica via sicura è ripristinare partner_decision a
-- 'pending' per le righe toccate, riconoscibili come quelle con
-- responded_at = created_at esatto (segnale del backfill, non di una
-- risposta reale del centro battuta un istante dopo la creazione):
-- ════════════════════════════════════════════════════════════════
-- begin;
-- update public.bookings
--   set partner_decision = 'pending', responded_at = null, read_by_center = false
--   where status = 'confirmed' and partner_decision = 'accepted' and responded_at = created_at;
-- update public.booking_days bd
--   set partner_decision = 'pending'
--   from public.bookings b
--   where b.id = bd.booking_id and b.status = 'confirmed' and b.partner_decision = 'pending';
-- -- ATTENZIONE: se un centro ha nel frattempo risposto DAVVERO a una di
-- -- queste prenotazioni (possibile solo se responded_at = created_at per
-- -- coincidenza, estremamente improbabile ma non impossibile), questo
-- -- rollback la riporterebbe erroneamente a "Da rispondere". Verificare
-- -- manualmente le righe coinvolte prima di eseguire, non lanciare alla
-- -- cieca.
-- commit;
