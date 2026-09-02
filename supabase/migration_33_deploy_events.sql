-- Migrazione 33 — Deploy events (notifica ok/ko nell'app Admin).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase PRIMA di usare il nuovo endpoint
-- /internal/deploy-notify (app/internal/deploy-notify/route.ts) e prima che
-- il banner in app/admin/layout.tsx mostri qualcosa (senza questa
-- migrazione l'endpoint risponde 500 "tabella inesistente" e il banner
-- semplicemente non appare — nessun impatto sul resto dell'Admin).
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO
-- ════════════════════════════════════════════════════════════════
-- Richiesta di Fabrizio: sapere, dentro l'app Admin, se l'ultimo
-- "bash deploy.sh" è andato a buon fine o no, senza dover controllare il
-- terminale. deploy.sh già logga tutto in locale (logs/deploy-*.log) ma non
-- comunica mai l'esito a nessun sistema esterno.
--
-- ════════════════════════════════════════════════════════════════
-- TABELLA
-- ════════════════════════════════════════════════════════════════
-- Un semplice log di eventi, non uno stato: ogni esecuzione di deploy.sh
-- scrive UNA riga a fine corsa (successo o fallimento), mai un update. Il
-- banner Admin legge solo la riga più recente.
create table if not exists public.deploy_events (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('ok', 'ko')),
  branch text,
  commit_sha text,
  test_scope text,
  test_result text,
  -- Dettaglio libero (es. ultime righe di errore) — MAI dati sensibili:
  -- deploy.sh gira su una macchina di sviluppo, non deve mai includere
  -- token/secret nel messaggio (vedi commento nello script).
  message text,
  created_at timestamptz not null default now()
);

alter table public.deploy_events enable row level security;

-- Solo un platform_admin autenticato può LEGGERE (stessa funzione già usata
-- da tutte le altre tabelle solo-Admin, vedi supabase/schema.sql).
drop policy if exists "Deploy events: solo platform_admin legge" on public.deploy_events;
create policy "Deploy events: solo platform_admin legge"
  on public.deploy_events for select
  using (public.is_platform_admin());

-- Nessuna policy insert/update/delete per "authenticated": l'unica
-- scrittura arriva dall'endpoint /internal/deploy-notify tramite
-- service_role key (bypassa le RLS di proposito), stesso pattern già in
-- produzione per app/internal/beta-pipeline/route.ts — nessun utente reale,
-- autenticato o meno, può scrivere in questa tabella via client Supabase.

create index if not exists idx_deploy_events_created_at on public.deploy_events (created_at desc);

-- Igiene minima: senza retention la tabella cresce di una riga per ogni
-- deploy.sh eseguito, per sempre — volume basso (deploy manuali, non ad
-- ogni commit) ma comunque non necessario tenerli oltre qualche mese.
-- Nessun cron automatico aggiunto qui (fuori scope, additivo se servirà):
-- pulizia manuale occasionale sufficiente per questo volume.
