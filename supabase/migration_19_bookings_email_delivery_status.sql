-- Migrazione 19 — TRAMA ONE Build Sprint 6, backlog vincolante P2 "email
-- fire-and-forget" (SPRINT_GOVERNANCE.md riga 151, Gap P0 #360 /
-- CORE_DOMAIN_SOURCE_OF_TRUTH.md §8).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase.
--
-- ════════════════════════════════════════════════════════════════
-- Cosa fa e perché
-- ════════════════════════════════════════════════════════════════
-- Le email al genitore quando il centro accetta/rifiuta/propone
-- un'alternativa su una prenotazione (app/actions/booking-response.ts,
-- notifyParentOfBookingResponse — introdotta in Build Sprint 4, DEC-42) sono
-- sempre state "fire-and-forget": lib/email.ts::sendEmail() veniva chiamata
-- dentro un try/catch che ignora silenziosamente qualunque errore, senza
-- loggare nulla e senza persistere alcuno stato. Se Resend risponde con un
-- errore (chiave non valida, dominio non verificato, rate limit, timeout di
-- rete) non c'è modo di saperlo dal database — il genitore semplicemente non
-- riceve l'email e nessuno se ne accorge finché non lo segnala.
--
-- Questo era già stato segnalato come debito esplicito (rischio BASSO, non
-- bloccante) in CORE_DOMAIN_SOURCE_OF_TRUTH.md §8 e §Gate E, con l'azione
-- concreta rimandata a Sprint 6: "stato di consegna minimo (tabella o
-- colonna email_delivery_status), logging esplicito su fallimento, retry
-- minimo".
--
-- Il retry minimo (un secondo tentativo automatico) e il logging esplicito
-- sono già stati implementati in lib/email.ts (nessuna migrazione
-- necessaria per quella parte). Questa migrazione aggiunge SOLO le 3
-- colonne additive su `bookings` per persistere l'ESITO FINALE (dopo gli
-- eventuali retry) dell'ultimo tentativo di invio della notifica di
-- risposta Partner, così che sia ispezionabile da SQL senza dover cercare
-- nei log applicativi:
--   - email_delivery_status: 'sent' | 'failed' | 'not_configured' |
--     'no_recipient' (RESEND_API_KEY non configurata o email genitore
--     mancante — non è un fallimento, è il comportamento already-documented
--     "invio disattivato" di lib/email.ts)
--   - email_delivery_error: messaggio d'errore testuale se status='failed'
--     (l'ultimo errore restituito da Resend/rete dopo il retry), altrimenti
--     null
--   - email_delivery_attempted_at: timestamp dell'ultimo tentativo (utile
--     per distinguere "mai tentato" da "tentato con successo prima")
--
-- Scope volutamente minimo (P2, non bloccante): una singola colonna di
-- stato per booking che riflette l'ULTIMO tentativo di notifica email
-- (respondToBookingAction o respondToBookingDayAction), non uno storico
-- completo di ogni invio — coerente con "stato di consegna MINIMO" richiesto
-- dal backlog, non un sistema di outbox/queue.
-- ════════════════════════════════════════════════════════════════

begin;

alter table public.bookings
  add column if not exists email_delivery_status text,
  add column if not exists email_delivery_error text,
  add column if not exists email_delivery_attempted_at timestamptz;

comment on column public.bookings.email_delivery_status is
  'Esito ultimo tentativo di notifica email al genitore (risposta Partner): sent | failed | not_configured | no_recipient. Vedi migration_19, DEC-49.';
comment on column public.bookings.email_delivery_error is
  'Messaggio di errore testuale se email_delivery_status = failed (dopo il retry automatico), altrimenti null.';
comment on column public.bookings.email_delivery_attempted_at is
  'Timestamp dell''ultimo tentativo di invio (indipendentemente dall''esito).';

commit;

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE, solo lettura, prima del blocco sopra.
-- Verifica che le colonne non esistano già (idempotenza attesa: se esistono
-- già, gli `add column if not exists` sopra sono no-op sicuri).
-- ════════════════════════════════════════════════════════════════
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'bookings'
--   and column_name in ('email_delivery_status', 'email_delivery_error', 'email_delivery_attempted_at');

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — verifica che le 3 colonne siano state create correttamente.
-- ════════════════════════════════════════════════════════════════
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'bookings'
--   and column_name in ('email_delivery_status', 'email_delivery_error', 'email_delivery_attempted_at')
-- order by column_name;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — da eseguire manualmente solo se necessario tornare indietro.
-- ════════════════════════════════════════════════════════════════
-- begin;
-- alter table public.bookings
--   drop column if exists email_delivery_status,
--   drop column if exists email_delivery_error,
--   drop column if exists email_delivery_attempted_at;
-- commit;
