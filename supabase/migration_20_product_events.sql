-- Migrazione 20 — TRAMA ONE Build Sprint 6, sistema eventi analytics con
-- correlationId (E11, ACR-014 "Ecosystem analytics", SPRINT_GOVERNANCE.md:
-- "sistema eventi analytics con correlationId, affianca senza sostituire
-- lib/analytics.ts").
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase.
--
-- ════════════════════════════════════════════════════════════════
-- Cosa fa e perché
-- ════════════════════════════════════════════════════════════════
-- lib/telemetry/correlation.ts (Build Sprint 0) generava già un
-- correlationId per richiesta e lo passava a logTelemetryEvent(), ma quella
-- funzione scrive SOLO su console (nessuna persistenza) — dichiarato
-- esplicitamente fuori scope fino a questo sprint ("Il sistema di
-- eventi/analytics completo (E11, tassonomia eventi, persistenza) resta
-- fuori scope fino a TRAMA ONE Build Sprint 6"). Questa migrazione chiude
-- quel gap con lo scope minimo richiesto: una tabella additiva che
-- persiste gli eventi già emessi dal codice esistente (accesso alle route
-- /one, fallback feature flag, avanzamento Walkthrough), correlati dallo
-- stesso correlationId, così da poter davvero seguire un evento "end-to-end"
-- (dalla richiesta HTTP fino all'azione applicativa che ne è conseguita),
-- non solo vederlo per un istante nei log del processo Vercel.
--
-- Design deliberatamente minimo (NON un event bus generico, NON Segment/
-- Amplitude in scala ridotta): stessa filosofia "no-PII" già stabilita in
-- lib/telemetry/correlation.ts (TELEMETRY_FORBIDDEN_FIELDS) — questa tabella
-- ha ESATTAMENTE le stesse colonne dell'interfaccia TelemetryLogEntry già
-- esistente, nessun campo libero aggiuntivo, nessun userId, nessun dato
-- personale. `lib/analytics.ts` (funzioni di aggregazione da mock-data per
-- le dashboard Legacy/NextGen) resta completamente INVARIATO: questa è una
-- capability nuova e parallela, non una sostituzione.
-- ════════════════════════════════════════════════════════════════

begin;

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),

  -- Nome evento — valori noti mantenuti in lib/telemetry/events.ts
  -- (KNOWN_PRODUCT_EVENTS, registry versionato in codice, stesso pattern di
  -- lib/feature-flags/registry.ts): nessun vincolo CHECK qui per non dover
  -- fare una migrazione ad ogni nuovo evento, la validazione è lato
  -- applicativo (persistProductEvent rifiuta eventi non noti al registry).
  event_name text not null,

  correlation_id text,

  -- "family" | "partner" | "admin" — mai un identificativo utente, stesso
  -- vincolo già documentato in TelemetryLogEntry.
  tenant text,

  -- "parent" | "center_admin" | "platform_admin" — mai nome/email.
  role text,

  -- Dettaglio tecnico breve, MAI dati personali (stesso contratto di
  -- TelemetryLogEntry.detail — enforced lato applicativo, non da un
  -- constraint SQL: non esiste un modo affidabile di validare "assenza di
  -- PII" in un CHECK, la responsabilità resta di chi chiama
  -- persistProductEvent con un `detail` costruito a mano).
  detail text,

  created_at timestamptz not null default now()
);

alter table public.product_events enable row level security;

create index if not exists idx_product_events_correlation_id on public.product_events(correlation_id);
create index if not exists idx_product_events_event_name on public.product_events(event_name);
create index if not exists idx_product_events_created_at on public.product_events(created_at desc);

-- Nessuna colonna che identifichi l'autore dell'evento (deliberato, stesso
-- principio no-PII della tabella): l'unica policy di insert richiede solo
-- una sessione autenticata (qualunque ruolo), non un controllo per-riga —
-- non c'è una colonna "owner" da confrontare con auth.uid().
create policy "Product events: qualunque utente autenticato può registrare un evento"
  on public.product_events for insert
  with check (auth.uid() is not null);

-- Solo l'Admin piattaforma può leggere lo stream eventi (visibilità
-- aggregata, stesso principio già applicato a tutorial_progress in
-- lib/walkthrough/data.ts::getWalkthroughAdminSummary).
create policy "Product events: solo l'admin piattaforma legge lo stream"
  on public.product_events for select
  using (public.is_platform_admin());

-- Nessuna policy di update/delete: gli eventi sono un log immutabile
-- (append-only), coerente con l'uso analitico/audit. Se in futuro servisse
-- una retention/pulizia, va fatta con un job dedicato lato Admin (service
-- role), non con una policy applicativa.

commit;

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE, solo lettura, prima del blocco sopra.
-- ════════════════════════════════════════════════════════════════
-- select table_name from information_schema.tables
--   where table_schema='public' and table_name='product_events';
-- -- atteso: 0 righe (tabella non ancora esistente).

-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname = 'is_platform_admin';
-- -- atteso: 1 riga (helper già esistente, riusato qui).

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query alla volta.
-- ════════════════════════════════════════════════════════════════
-- select relname, relrowsecurity from pg_class where relname = 'product_events';
-- -- atteso: 1 riga, relrowsecurity = true.

-- select policyname from pg_policies
--   where schemaname = 'public' and tablename = 'product_events';
-- -- atteso: 2 righe.

-- Test funzionale: visitare /one (o /center/one, /admin/one) da loggato ->
-- deve comparire una riga event_name='one_route_access' con correlation_id
-- valorizzato. Da /admin/one/events (platform_admin), le righe recenti
-- devono essere visibili in ordine cronologico inverso.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — sicuro finché il codice applicativo non dipende in modo
-- bloccante dalla persistenza (persistProductEvent è sempre best-effort,
-- non fa mai fallire il chiamante se l'insert fallisce/la tabella non
-- esiste — vedi lib/telemetry/events.ts).
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists "Product events: solo l'admin piattaforma legge lo stream" on public.product_events;
-- drop policy if exists "Product events: qualunque utente autenticato può registrare un evento" on public.product_events;
-- drop table if exists public.product_events;
-- commit;
