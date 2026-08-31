-- Migrazione 31 — Push subscriptions (Web Push, banner di sistema).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase quando pronto a procedere con
-- l'implementazione delle push notification (Wave 4, disegnata ma NON
-- implementata in questa sessione — vedi report "PUSH NOTIFICATIONS —
-- MIGRATION REQUIRED" in chat per il contesto completo).
--
-- ════════════════════════════════════════════════════════════════
-- ESIGENZA FUNZIONALE
-- ════════════════════════════════════════════════════════════════
-- Il notification center in-app (Wave 3, lib/notifications/model.ts) è
-- COMPUTED: nessuno stato viene mai persistito lato notifiche stesse. Una
-- vera push notification (banner di sistema, anche ad app chiusa) richiede
-- però un pezzo di stato che oggi non esiste in nessuna tabella: la
-- "push subscription" che il browser crea quando l'utente concede il
-- permesso (endpoint + chiavi di cifratura), necessaria al server per poter
-- consegnare un messaggio a QUEL dispositivo specifico. Senza questa riga
-- persistita non è possibile inviare nulla: è un requisito del protocollo
-- Web Push stesso (RFC 8030/8291), non una scelta di design di questo
-- progetto.
--
-- ════════════════════════════════════════════════════════════════
-- TABELLA
-- ════════════════════════════════════════════════════════════════
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  -- URL del push service del browser (es. https://fcm.googleapis.com/...) —
  -- univoco per dispositivo/browser: se lo stesso utente concede di nuovo il
  -- permesso sullo stesso device, il browser restituisce lo STESSO endpoint,
  -- quindi upsert su questa colonna evita righe duplicate per lo stesso
  -- device (nessuna nuova migration futura solo per "de-duplicare i device").
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Diagnostica soltanto (mai usato per logica applicativa) — utile a
  -- Fabrizio per capire quali device sono effettivamente iscritti durante
  -- il pilota, stesso principio "osservabilità minima" di Wave 1.
  user_agent text,
  created_at timestamptz not null default now(),
  -- Aggiornato dal server ad ogni invio riuscito verso questa riga — righe
  -- mai aggiornate per N giorni sono probabilmente device dismessi/permesso
  -- revocato: usato per pulizia periodica (nessun job automatico incluso in
  -- questa migrazione, solo la colonna che lo renderebbe possibile in
  -- futuro).
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- RLS: un utente gestisce SOLO le proprie subscription (crea la propria
-- quando concede il permesso, la cancella se revoca/disinstalla). Nessuna
-- policy SELECT per "leggere le subscription di altri utenti", nemmeno per
-- un center_admin: l'INVIO (che deve necessariamente leggere subscription
-- di destinatari diversi dal chiamante, es. il centro che notifica un
-- genitore) passa dal service role lato server — STESSO principio già
-- stabilito per lib/supabase/service.ts (Wave 1 Admin pilot-users.ts): mai
-- una policy RLS "ampia" per un caso che serve solo al server, un client
-- non deve mai poter enumerare le subscription altrui nemmeno in teoria.
drop policy if exists "Push subscriptions: l'utente gestisce le proprie" on public.push_subscriptions;
create policy "Push subscriptions: l'utente gestisce le proprie"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK (eseguire PRIMA di applicare, per conferma manuale)
-- ════════════════════════════════════════════════════════════════
-- select count(*) from public.push_subscriptions; -- deve fallire con
--   "relation does not exist" (la tabella non esiste ancora) — se invece
--   restituisce un conteggio, qualcuno ha già applicato questa migration:
--   FERMARSI e verificare prima di procedere.

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK (eseguire DOPO aver applicato)
-- ════════════════════════════════════════════════════════════════
-- select count(*) from public.push_subscriptions; -- deve restituire 0 (tabella vuota, nessun errore)
-- select polname from pg_policies where tablename = 'push_subscriptions'; -- deve restituire esattamente 1 riga

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- drop table if exists public.push_subscriptions; -- rimuove tabella + policy + indice, nessun impatto su altre tabelle (nessuna FK entrante da altre tabelle verso questa)

-- ════════════════════════════════════════════════════════════════
-- BACKWARD COMPATIBILITY
-- ════════════════════════════════════════════════════════════════
-- Additiva pura: nuova tabella, nessuna colonna aggiunta a tabelle
-- esistenti, nessun trigger su tabelle esistenti modificato. L'app continua
-- a funzionare identica se questa migration NON viene mai applicata (il
-- notification center in-app Wave 3/Partner non dipende in alcun modo da
-- questa tabella) — le push sono un canale AGGIUNTIVO, non un requisito.
