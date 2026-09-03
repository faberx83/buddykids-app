-- Migrazione 36 — Promemoria di partenza (push reali, MVP beta).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase quando pronto ad attivare i
-- Promemoria reali (oggi solo anteprima locale, vedi PromemoriaClient.tsx).
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO (segnalazione Fabrizio 03/09/2026: "possiamo attivare i reminder
-- ora che ci sono le notifiche?")
-- ════════════════════════════════════════════════════════════════
-- L'infrastruttura push (migration_31_push_subscriptions.sql, GIÀ applicata
-- e già in uso reale per prenotazioni/inviti/gruppi — vedi lib/push/send.ts)
-- copre solo l'INVIO event-driven (in risposta a un'azione: prenotazione
-- accettata, invito, ecc.). I Promemoria di partenza sono diversi per
-- natura: devono scattare a un ORARIO, non in risposta a un evento — questo
-- richiede (a) uno stato persistito (questa migrazione) e (b) un trigger
-- temporale (Vercel Cron, vedi vercel.json + app/api/cron/travel-reminders/
-- route.ts), che prima di questa modifica non esisteva nel progetto.
--
-- SCOPE RIDOTTO PER LA BETA (confermato con Fabrizio): niente calcolo reale
-- del tempo di percorrenza (richiederebbe geocodifica + un servizio di
-- instradamento a pagamento, es. Google Directions/Mapbox — non presente
-- oggi, gli indirizzi salvati sono testo libero senza coordinate). "target_time"
-- è l'orario che il GENITORE imposta manualmente (es. "devo partire alle
-- 16:00"), non un orario calcolato — il resto dell'esperienza (toggle
-- attivo, allarme N minuti prima, indirizzo di partenza mostrato nel
-- messaggio) resta identico all'anteprima già mostrata.
--
-- ════════════════════════════════════════════════════════════════
-- TABELLA
-- ════════════════════════════════════════════════════════════════
create table if not exists public.travel_reminders (
  id uuid primary key default gen_random_uuid(),
  -- Un solo promemoria per genitore in questo MVP (non per bambino/attività
  -- specifica) — coerente con l'anteprima, che ha sempre mostrato UN solo
  -- blocco di impostazioni, non uno per figlio. Estendibile in futuro senza
  -- rompere nulla (basterebbe rimuovere lo unique e aggiungere una colonna
  -- di scoping, es. kid_id).
  parent_id uuid references public.profiles(id) on delete cascade not null unique,
  active boolean not null default false,
  -- Orario impostato MANUALMENTE dal genitore (mai calcolato) — vedi nota
  -- di scope sopra.
  target_time time not null default '16:00',
  alarm_minutes integer not null default 30 check (alarm_minutes in (15, 30, 60)),
  -- kind di lib/nextgen/address-kinds.ts ("casa"/"lavoro_genitore1"/
  -- "lavoro_genitore2"/"altro") — SOLO per personalizzare il testo del
  -- messaggio push ("parti da Casa"), MAI usato per calcolare l'orario
  -- (vedi nota di scope). Nullable: il genitore può non aver ancora
  -- compilato nessun indirizzo.
  origin_kind text,
  -- Evita di inviare due volte lo stesso promemoria nello stesso giorno se
  -- il cron gira più volte nella finestra utile (vedi route.ts) — non un
  -- log storico, solo l'ultima data di invio riuscito.
  last_sent_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_reminders_active_idx on public.travel_reminders (active) where active = true;

alter table public.travel_reminders enable row level security;

-- RLS: stesso principio di migration_31 (push_subscriptions) — il genitore
-- gestisce SOLO la propria riga. Il cron (app/api/cron/travel-reminders/
-- route.ts) usa il service role (bypassa RLS di proposito, stesso motivo
-- già documentato in migration_31: deve leggere righe di MOLTI genitori
-- diversi, non solo le proprie).
drop policy if exists "Travel reminders: il genitore gestisce il proprio" on public.travel_reminders;
create policy "Travel reminders: il genitore gestisce il proprio"
  on public.travel_reminders for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK (eseguire PRIMA di applicare, per conferma manuale)
-- ════════════════════════════════════════════════════════════════
-- select count(*) from public.travel_reminders; -- deve fallire con
--   "relation does not exist" — se invece restituisce un conteggio,
--   qualcuno ha già applicato questa migration: FERMARSI e verificare.

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK (eseguire DOPO aver applicato)
-- ════════════════════════════════════════════════════════════════
-- select count(*) from public.travel_reminders; -- deve restituire 0
-- select polname from pg_policies where tablename = 'travel_reminders'; -- 1 riga

-- ════════════════════════════════════════════════════════════════
-- OPERATIVO — DA CONFIGURARE SU VERCEL PRIMA CHE IL CRON FUNZIONI DAVVERO
-- ════════════════════════════════════════════════════════════════
-- 1. Variabile d'ambiente CRON_SECRET (stringa casuale a piacere) sul
--    progetto Vercel — deve combaciare con quella che Vercel invia
--    automaticamente come header "Authorization: Bearer $CRON_SECRET" alle
--    chiamate cron configurate in vercel.json (vedi commento lì).
-- 2. Piano Vercel: vercel.json qui configura il cron ogni 15 minuti
--    ("*/15 * * * *"). Il piano Hobby di Vercel limita i cron job a UNA
--    esecuzione al giorno — se il progetto è su Hobby, questa frequenza non
--    funzionerà come previsto e serve un piano Pro (o una frequenza più
--    bassa, con un ritardo maggiore nell'invio del promemoria). Verificare
--    il piano attuale prima di considerare questa funzione "attiva".

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- drop table if exists public.travel_reminders; -- rimuove tabella + policy + indice, nessuna FK entrante da altre tabelle

-- ════════════════════════════════════════════════════════════════
-- BACKWARD COMPATIBILITY
-- ════════════════════════════════════════════════════════════════
-- Additiva pura: nuova tabella, nessuna colonna aggiunta a tabelle
-- esistenti. Finché questa migration non è applicata: la pagina Promemoria
-- degrada automaticamente all'anteprima locale attuale (nessun salvataggio,
-- nessun invio) — vedi guardia esplicita in
-- app/actions/travel-reminders.ts e app/api/cron/travel-reminders/route.ts,
-- mai un crash, solo un no-op/errore esplicito gestito.
