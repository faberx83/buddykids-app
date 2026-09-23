-- Migrazione 38 — Curated Favorites + Novità TRAMA / Feature Announcements.
--
-- APPLICATA in produzione il 23/09/2026 (project_id eagsgfxunwyyxwwilldy),
-- dopo revisione: schema/RLS verificati contro favorites (stesso pattern),
-- assenza di collisioni di nome confermata, post-check eseguito (0 righe
-- nelle due tabelle nuove, favorites invariata a 5 righe, 2 policy per
-- tabella). Nessuna riga esistente toccata: entrambe le tabelle sono nuove,
-- additive, isolate l'una dall'altra.
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO
-- ════════════════════════════════════════════════════════════════
-- TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026): CURATED FAVORITES +
-- NOVITÀ TRAMA / FEATURE ANNOUNCEMENTS.
--
-- A) CURATED FAVORITES — public.favorites.activity_id è un uuid FK →
--    activities(id): un Curated Lead (lib/discovery/real-dataset.ts) ha
--    invece un id stringa (slug, es. "lyceum-summer-camp"), NON un uuid, e
--    non esiste come riga in "activities" (deliberatamente: non è un
--    Partner). Non si può salvare uno slug in una colonna uuid, non si crea
--    una fake Activity, non si tocca il modello favorites/Partner esistente
--    (RLS, unique, default — tutti invariati). Tabella nuova e separata,
--    stesso identico pattern RLS di favorites, con una colonna aggiuntiva
--    (promoted_to_activity_id) per il meccanismo di transizione Curated →
--    Partner (sezione B sotto).
--
-- B) NOVITÀ TRAMA / ANNOUNCEMENTS — Il Release Catalog
--    (lib/releases/catalog.ts) resta code-based (source of truth editoriale,
--    come richiesto: "NON: git commit → notification automatica. SÌ: release
--    con announceToUsers=true → announcement disponibile" — quel campo booleano
--    e i metadata editoriali (userTitle/userBody/deepLink/audience/version)
--    vivono in un nuovo file di codice, lib/announcements/catalog.ts, non in
--    questa tabella). Il Notification Center esistente (lib/notifications/
--    model.ts) è deliberatamente COMPUTED, mai persistito — ma per questa
--    capability serve un vero stato per-utente cross-device (bell "visto"/
--    contextual callout "dismesso"), e la governance vieta esplicitamente
--    localStorage come datastore. Serve quindi UNA tabella additiva minima
--    che copra ENTRAMBI i livelli (bell unread + contextual callout
--    dismissed) senza sovraccaricare una tabella con significati
--    incompatibili: due colonne timestamp separate (seen_at/dismissed_at)
--    sulla STESSA riga, perché entrambe le colonne descrivono la stessa
--    entità reale ("come QUESTO utente ha interagito con QUESTO annuncio in
--    QUESTA versione"), non due domini diversi.
--
-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK (eseguire PRIMA di applicare, per conferma manuale)
-- ════════════════════════════════════════════════════════════════
-- select 1 from information_schema.tables where table_schema='public' and
--   table_name='curated_favorites'; -- deve restituire 0 righe
-- select 1 from information_schema.tables where table_schema='public' and
--   table_name='announcement_receipts'; -- deve restituire 0 righe
-- (verificato via query read-only in questa sessione, 23/09/2026: entrambe
-- assenti, nessuna collisione di nome con tabelle esistenti)

-- ════════════════════════════════════════════════════════════════
-- A) CURATED FAVORITES
-- ════════════════════════════════════════════════════════════════
create table if not exists public.curated_favorites (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(id) on delete cascade not null,
  -- Id stringa del Curated Lead (lib/discovery/real-dataset.ts, es.
  -- "lyceum-summer-camp") — MAI un uuid, MAI una FK verso "activities": il
  -- dataset curato resta code-based, zero righe in una tabella DB. Un lead
  -- rimosso/rinominato nel dataset code-based semplicemente smette di
  -- risolvere lato applicativo (vedi lib/data/curated-favorites.ts, gestione
  -- "Curated missing data") — nessuna FK da mantenere qui per costruzione.
  curated_lead_id text not null,
  -- CURATED → FULL TRAMA TRANSITION (sezione 4 del task): quando un Curated
  -- Lead diventa realmente un Partner TRAMA (es. Lyceum entra come Partner),
  -- questa colonna viene valorizzata con l'activity_id reale — a
  -- RESOLUTION-TIME (lettura dei Preferiti, lib/data/favorites.ts), un
  -- curated_favorites con promoted_to_activity_id valorizzato viene
  -- presentato come favorite Partner (stessa card, stessa grammatica) invece
  -- che come Scoperta TRAMA, SENZA che il genitore debba ricliccare il
  -- cuore e SENZA generare un duplicato in "favorites" — nessuna scrittura
  -- automatica in favorites, solo un merge di sola LETTURA. on delete set
  -- null (mai cascade): se l'attività Partner viene eliminata, il preferito
  -- curated resta valido e torna a essere presentato come Scoperta TRAMA
  -- invece di sparire silenziosamente.
  promoted_to_activity_id uuid references public.activities(id) on delete set null,
  created_at timestamptz default now(),
  unique (parent_id, curated_lead_id)
);

alter table public.curated_favorites enable row level security;

-- Stesso identico pattern RLS di public.favorites (supabase/schema.sql
-- riga ~852): il genitore gestisce solo le proprie righe, l'admin
-- piattaforma legge tutto (stesso principio già corretto come bugfix per
-- favorites — qui applicato fin da subito, non come fix successivo).
create policy "Preferiti Curated: il genitore gestisce i propri" on public.curated_favorites for all
  using (auth.uid() = parent_id) with check (auth.uid() = parent_id);
create policy "Preferiti Curated: l'admin piattaforma legge tutti" on public.curated_favorites for select
  using (public.is_platform_admin());

create index if not exists idx_curated_favorites_parent on public.curated_favorites (parent_id);
-- Utile per il meccanismo di promotion (sezione 4): trovare rapidamente
-- tutte le righe curated_favorites di un dato lead quando quel lead viene
-- promosso a Partner (operazione rara, manuale, lato Admin).
create index if not exists idx_curated_favorites_lead on public.curated_favorites (curated_lead_id);

-- ════════════════════════════════════════════════════════════════
-- B) ANNOUNCEMENT RECEIPTS (Novità TRAMA / Feature Announcements)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.announcement_receipts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(id) on delete cascade not null,
  -- Id stabile di lib/announcements/catalog.ts#ANNOUNCEMENT_CATALOG (es.
  -- "real-discovery-pilot") — testo, non una FK: il catalogo resta
  -- code-based (source of truth editoriale), questa tabella conosce solo
  -- l'INTERAZIONE dell'utente, mai il contenuto editoriale (title/body/
  -- deepLink), che non viene mai duplicato qui.
  announcement_id text not null,
  -- announcementVersion (sezione 9/15 del task): se il catalogo incrementa
  -- la versione di un annuncio per un'evoluzione significativa della STESSA
  -- feature, una riga con una versione precedente NON conta più come
  -- "vista"/"dismessa" — vedi lib/data/announcements.ts, che ignora righe
  -- con announcement_version < versione corrente del catalogo invece di
  -- fare update in place (storicizza le versioni precedenti, mai le
  -- sovrascrive).
  announcement_version integer not null default 1,
  -- LEVEL 1 — Notification Center: non-null quando l'utente ha aperto il
  -- Notification Center con questo annuncio presente nella lista (stesso
  -- "momento di lettura" già usato per read_by_parent su
  -- activity_inquiries/bookings, qui in una tabella dedicata perché non
  -- esiste una riga di dominio preesistente a cui appendere la colonna).
  seen_at timestamptz,
  -- LEVEL 2 — Contextual callout: non-null quando l'utente ha chiuso
  -- esplicitamente il callout "✨ Nuovo — ... [Ho capito]" sulla superficie
  -- pertinente (lib/announcements/catalog.ts#contextualSurface). Colonna
  -- SEPARATA da seen_at per costruzione (sezione 11: "NON sovraccaricare
  -- una tabella con significati incompatibili") — un utente può aver visto
  -- l'annuncio dal bell senza mai aver visitato/dismesso il callout
  -- contestuale, e viceversa.
  dismissed_at timestamptz,
  created_at timestamptz default now(),
  unique (parent_id, announcement_id, announcement_version)
);

alter table public.announcement_receipts enable row level security;

create policy "Announcement receipts: il genitore gestisce i propri" on public.announcement_receipts for all
  using (auth.uid() = parent_id) with check (auth.uid() = parent_id);
create policy "Announcement receipts: l'admin piattaforma legge tutti" on public.announcement_receipts for select
  using (public.is_platform_admin());

create index if not exists idx_announcement_receipts_parent on public.announcement_receipts (parent_id);

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK (eseguire DOPO aver applicato)
-- ════════════════════════════════════════════════════════════════
-- select count(*) from public.curated_favorites; -- deve restituire 0 (tabella nuova, vuota)
-- select count(*) from public.announcement_receipts; -- deve restituire 0
-- select count(*) from public.favorites; -- deve restituire lo stesso numero di righe di PRIMA di applicare questa migration (invariato: nessuna riga esistente toccata)
-- select policyname from pg_policies where tablename='curated_favorites'; -- deve restituire le 2 policy sopra
-- select policyname from pg_policies where tablename='announcement_receipts'; -- deve restituire le 2 policy sopra

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- drop table if exists public.curated_favorites;
-- drop table if exists public.announcement_receipts;
-- Entrambe le tabelle sono isolate (nessun'altra tabella ha una FK ENTRANTE
-- verso di loro): il rollback è un semplice DROP, senza effetti collaterali
-- su favorites/activities/centers/bookings/School Calendar.

-- ════════════════════════════════════════════════════════════════
-- BACKWARD COMPATIBILITY
-- ════════════════════════════════════════════════════════════════
-- Additiva pura: 2 tabelle nuove, ZERO colonne aggiunte a tabelle esistenti,
-- ZERO righe esistenti modificate (favorites/activities/centers/bookings/
-- school_calendar_* restano bit-per-bit invariate). Finché questa migration
-- non è applicata: il codice applicativo che la assume (lib/data/
-- curated-favorites.ts, app/actions/curated-favorites.ts, lib/data/
-- announcements.ts, app/actions/announcements.ts) fallirà le query su
-- "curated_favorites"/"announcement_receipts" con errore Postgres 42P01
-- (relation does not exist) — questi punti sono TUTTI nuovi call site
-- introdotti in questo stesso ciclo di lavoro (nessuna funzionalità già in
-- produzione dipende da queste tabelle), quindi non c'è alcuna regressione
-- su funzionalità esistenti nel frattempo: il cuore su una Scoperta TRAMA e
-- il bell/callout Novità TRAMA semplicemente non devono essere deployati
-- prima che questa migration sia applicata in produzione.
