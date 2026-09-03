-- Migrazione 35 — Check-in/presenze per prenotazioni "Giorni spot"
-- (segnalazione Fabrizio 03/09/2026, verbatim: "puoi verificare che il
-- checkin funzioni? perchè non la vedo da un po' la notifica..e
-- teoricamente questa settimana ci sono prenotazioni attiva su 'Centro
-- estivo prova candidatura' per il bambino 'Lino'").
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase PRIMA che il check-in in Home possa
-- funzionare per una prenotazione "Giorni spot" (booking_days). FINCHÉ NON
-- VIENE APPLICATA: lib/data/checkin.ts (vedi commento lì) continua a
-- ignorare le prenotazioni a giorni esattamente come oggi — nessuna
-- regressione, il check-in per le prenotazioni a settimana intera resta
-- identico. app/actions/checkin.ts fallisce in modo esplicito (errore
-- Postgres restituito all'utente, non un crash) se invocato per una
-- prenotazione a giorni prima che questa migrazione sia applicata.
--
-- ════════════════════════════════════════════════════════════════
-- ROOT CAUSE (verificato via query dirette, non per assunzione)
-- ════════════════════════════════════════════════════════════════
-- getTodayCheckinsForParent() (lib/data/checkin.ts) legge SOLO
-- bookings.booking_weeks — non booking_days — quindi una prenotazione
-- "Giorni spot" non produce mai una card di check-in, anche con un giorno
-- accettato che cade proprio oggi. Verificato sui dati reali: booking
-- 6dd3af89 (Lino, attività "Prova FP" 352ab541-254a-42ce-b2aa-ad2ac3c79036,
-- booking_mode "mixed") ha un booking_day per il 2026-09-03 con
-- partner_decision='accepted', status='confirmed' — dovrebbe generare un
-- check-in in Home e non lo fa.
--
-- Il motivo per cui questo NON è risolvibile solo lato codice: la tabella
-- public.attendance_records ha week_id "not null references
-- activity_weeks(id)" — un vincolo strutturale che presuppone SEMPRE una
-- settimana. Per questa stessa attività ("Prova FP") non esiste NESSUNA
-- riga activity_weeks che copra il 2026-09-03 (verificato: 0 righe) — un
-- riuso "furbo" di una settimana esistente come contenitore non è
-- possibile, perché per un'attività "mixed"/"day_only" potrebbe non
-- esisterne mai una che copra un giorno spot specifico. Serve una colonna
-- alternativa che referenzi activity_days invece di activity_weeks.
--
-- ════════════════════════════════════════════════════════════════
-- COSA FA QUESTA MIGRAZIONE (additiva, nessuna riga esistente toccata)
-- ════════════════════════════════════════════════════════════════
-- 1. week_id diventa nullable (era "not null").
-- 2. Nuova colonna activity_day_id, nullable, FK -> activity_days(id).
-- 3. CHECK constraint: ogni riga ha ESATTAMENTE UNO tra week_id e
--    activity_day_id valorizzato (mai entrambi, mai nessuno dei due) — un
--    record di presenza è sempre o "di una settimana" o "di un giorno
--    spot", mai ambiguo.
-- 4. Nuova colonna GENERATA "occurrence_id" = coalesce(week_id,
--    activity_day_id) — un solo valore non-null per riga (garantito dal
--    CHECK sopra), su cui poggia un NUOVO vincolo unique aggiuntivo
--    (kid_id, occurrence_id, date), usato SOLO per i check-in "a giorno"
--    (week_id null). Scelta deliberata invece di due indici unici PARZIALI:
--    un ON CONFLICT semplice lato applicativo (supabase-js
--    .upsert({onConflict:"..."})) genera SQL "ON CONFLICT (colonne)" SENZA
--    alcuna clausola WHERE — Postgres può usarlo come arbitro solo contro
--    un vincolo/indice unico che non abbia un predicato parziale.
--
--    IMPORTANTE — il vecchio vincolo "attendance_records_kid_id_week_id_
--    date_key" (kid_id, week_id, date) NON viene toccato/rimosso: resta
--    l'arbitro di ON CONFLICT per i check-in "a settimana", esattamente
--    come oggi. Se venisse rimosso, app/actions/checkin.ts smetterebbe di
--    funzionare per QUALUNQUE check-in (anche quelli a settimana intera,
--    già funzionanti) nella finestra fra il deploy del codice e
--    l'applicazione di questa migrazione — un rischio inutile, dato che
--    coesistere con il nuovo vincolo non costa nulla (righe con week_id
--    valorizzato continuano a rispettarli entrambi senza conflitto, dato
--    che occurrence_id vi coincide sempre con week_id).
--
-- Nessuna modifica alle RLS esistenti: entrambe le policy su
-- attendance_records sono già scritte su kid_id/activity_id, mai su
-- week_id — restano valide invariate per righe con week_id null.
--
-- ════════════════════════════════════════════════════════════════
-- Transazionalità: DDL sotto interamente in BEGIN/COMMIT.
-- ════════════════════════════════════════════════════════════════

begin;

alter table public.attendance_records
  alter column week_id drop not null;

alter table public.attendance_records
  add column if not exists activity_day_id uuid references public.activity_days(id) on delete cascade;

comment on column public.attendance_records.activity_day_id is
  'Migrazione 35: presente SOLO per un record di presenza generato da una prenotazione "Giorni spot" (booking_days), in alternativa a week_id (mai entrambi valorizzati — vedi CHECK attendance_records_week_or_day_check). Null per tutti i record storici a settimana intera.';

alter table public.attendance_records
  drop constraint if exists attendance_records_week_or_day_check;

alter table public.attendance_records
  add constraint attendance_records_week_or_day_check
    check (
      (week_id is not null and activity_day_id is null)
      or (week_id is null and activity_day_id is not null)
    );

-- NOTA: il vecchio vincolo unique (kid_id, week_id, date) NON viene
-- toccato — vedi spiegazione sopra ("IMPORTANTE").

alter table public.attendance_records
  add column if not exists occurrence_id uuid generated always as (coalesce(week_id, activity_day_id)) stored;

comment on column public.attendance_records.occurrence_id is
  'Migrazione 35: colonna generata (coalesce(week_id, activity_day_id)) — un solo identificativo di "occorrenza" indipendentemente dal fatto che sia una settimana o un giorno spot, usata come target unico di ON CONFLICT invece di duplicare la logica applicativa nei due casi.';

alter table public.attendance_records
  add constraint attendance_records_kid_occurrence_date_key
    unique (kid_id, occurrence_id, date);

create index if not exists idx_attendance_activity_day on public.attendance_records (activity_id, activity_day_id);

commit;

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE, solo lettura, PRIMA del blocco
-- begin;/commit; sopra.
-- ════════════════════════════════════════════════════════════════

-- 1. Vincolo/colonna attuali (atteso: week_id NOT NULL, nessuna
--    activity_day_id/occurrence_id):
-- select column_name, is_nullable from information_schema.columns
--   where table_schema='public' and table_name='attendance_records'
--   and column_name in ('week_id','activity_day_id','occurrence_id');

-- 2. Nome esatto del vincolo unique esistente (atteso:
--    "attendance_records_kid_id_week_id_date_key" — confermato via query
--    diretta il 03/09/2026, riportato qui a scopo di ri-verifica prima di
--    eseguire su un ambiente diverso):
-- select conname from pg_constraint
--   where conrelid = 'public.attendance_records'::regclass and contype = 'u';

-- 3. Postgres 12+ richiesto per le colonne generate STORED (Supabase è
--    tipicamente su PG15+, ma confermare prima di eseguire su un progetto
--    diverso):
-- select version();

-- 4. Conteggio righe esistenti (da confrontare dopo il commit — invariato):
-- select count(*) from public.attendance_records;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il commit, separatamente, una query alla volta.
-- ════════════════════════════════════════════════════════════════

-- 5. week_id ora nullable, activity_day_id/occurrence_id presenti:
-- select column_name, is_nullable from information_schema.columns
--   where table_schema='public' and table_name='attendance_records'
--   and column_name in ('week_id','activity_day_id','occurrence_id');
-- -- atteso: week_id/activity_day_id nullable YES, occurrence_id NO (una
-- -- colonna generata è "not null" solo se lo sono i suoi input insieme al
-- -- CHECK — qui può restare nullable per sicurezza, non è un problema).

-- 6. CHECK e UNIQUE constraint presenti:
-- select conname, pg_get_constraintdef(oid) as def from pg_constraint
--   where conrelid = 'public.attendance_records'::regclass and contype in ('c','u')
--   and conname in ('attendance_records_week_or_day_check','attendance_records_kid_occurrence_date_key');

-- 7. Nessuna riga esistente alterata, tutte ancora con week_id valorizzato
--    e occurrence_id calcolato automaticamente uguale a week_id (nessun
--    backfill manuale, la colonna generata lo fa da sola):
-- select count(*) from public.attendance_records;
-- -- atteso: uguale al PRE-CHECK punto 4.
-- select count(*) from public.attendance_records where week_id is null;
-- -- atteso: 0 (finché il codice applicativo non scrive il primo record
-- -- a giorno).
-- select count(*) from public.attendance_records where occurrence_id is distinct from week_id;
-- -- atteso: 0 (per ogni riga storica, occurrence_id deve combaciare
-- -- esattamente con week_id).

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (blocco separato — fallisce ESPLICITAMENTE se esistono già
-- record con activity_day_id valorizzato, per non perderli in modo
-- silenzioso: in quel caso vanno gestiti manualmente prima, es. cancellati
-- o mappati a una week_id se ne viene creata una a posteriori)
-- ════════════════════════════════════════════════════════════════
-- begin;
-- do $$
-- begin
--   if exists (select 1 from public.attendance_records where activity_day_id is not null) then
--     raise exception 'Rollback bloccato: esistono record attendance_records con activity_day_id valorizzato. Gestirli manualmente prima di rifare il rollback.';
--   end if;
-- end $$;
-- alter table public.attendance_records drop constraint if exists attendance_records_kid_occurrence_date_key;
-- alter table public.attendance_records drop column if exists occurrence_id;
-- alter table public.attendance_records drop constraint if exists attendance_records_week_or_day_check;
-- alter table public.attendance_records drop column if exists activity_day_id;
-- alter table public.attendance_records alter column week_id set not null;
-- -- Il vecchio vincolo unique (kid_id, week_id, date) non è mai stato
-- -- toccato da questa migrazione (vedi "IMPORTANTE" sopra) — nessun
-- -- ripristino necessario qui.
-- commit;
