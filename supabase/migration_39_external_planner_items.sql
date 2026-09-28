-- Migrazione 39 — External Planner Items.
--
-- PREPARATA, NON APPLICATA — in attesa di revisione ed esecuzione manuale
-- (project_id eagsgfxunwyyxwwilldy). Audit propedeutico read-only eseguito
-- in questa sessione (list_tables + query di verifica riportate nel
-- PRE-CHECK sotto): nessuna collisione di nome, nessuna tabella
-- "external_planner_items"/"external_planner_item_kids" esistente.
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO
-- ════════════════════════════════════════════════════════════════
-- TRAMA — EXTERNAL PLANNER ITEMS (prossimo major product block dopo Curated
-- Favorites + Novità TRAMA). Principio di prodotto: il Planner deve poter
-- rappresentare "un impegno reale organizzato dalla famiglia" anche quando
-- non dipende da una prenotazione TRAMA — creato manualmente, oppure a
-- partire da una Scoperta TRAMA già presente in Discovery (curated_leads,
-- lib/discovery/real-dataset.ts). Questo NON deve creare fake Partner, fake
-- Activity, fake booking, fake availability: External Planner Item è
-- un'entità di organizzazione familiare, mai un dominio booking.
--
-- AUDIT (Planner Architecture Audit, sezione 1 del task) — conclusione: C,
-- NEW ADDITIVE ENTITY REQUIRED. Non esiste oggi un'entità sufficientemente
-- generica per rappresentare un impegno esterno senza mentire
-- semanticamente:
--   - "bookings" presuppone SEMPRE un'attività reale di un Partner reale
--     (activity_id NOT NULL FK verso activities, partner_decision,
--     capacità/spots_left, booking_weeks/booking_days legati a
--     activity_weeks/activity_days) — riusarlo per un impegno esterno
--     creerebbe un fake booking (vietato esplicitamente dalla governance).
--   - "curated_favorites" (migration_38) rappresenta un INTERESSE
--     ("Preferito"), non un impegno di organizzazione reale — il confine di
--     prodotto Favorite ≠ Planner Item (sezione "PRODUCT BOUNDARY" del
--     task) impone che restino tabelle distinte: una stessa Scoperta TRAMA
--     può essere SOLO Favorite, SOLO Planner Item, entrambe, o nessuna.
--   - "week_responsibilities" ("Chi fa cosa?") è etichettatura di
--     coordinamento (chi accompagna/ritira una settimana/giorno/momento GIÀ
--     organizzato altrove) — non un'entità organizzativa in sé, presuppone
--     che l'impegno esista già.
--   - SeasonWeek.covered (lib/data/planner.ts#getPlannerData) è un valore
--     DERIVATO a runtime da una query su bookings/booking_weeks/booking_days,
--     non un'entità persistita: non esiste una riga "impegno" a cui
--     agganciarsi.
-- Tabella nuova additiva, quindi, con un modello volutamente minimo e
-- forward-compatible (vedi commenti sulle singole colonne).
--
-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK (eseguire PRIMA di applicare, per conferma manuale)
-- ════════════════════════════════════════════════════════════════
-- select 1 from information_schema.tables where table_schema='public' and
--   table_name='external_planner_items'; -- atteso: 0 righe (verificato via list_tables in questa sessione: assente)
-- select 1 from information_schema.tables where table_schema='public' and
--   table_name='external_planner_item_kids'; -- atteso: 0 righe (verificato: assente)
-- select count(*) from public.kids; -- solo per confronto post-check (RLS invariata su kids, nessuna modifica in questa migration)

-- ════════════════════════════════════════════════════════════════
-- A) EXTERNAL PLANNER ITEMS
-- ════════════════════════════════════════════════════════════════
create table if not exists public.external_planner_items (
  id uuid primary key default gen_random_uuid(),
  -- Proprietario: il genitore che ha creato l'impegno. Stessa semantica di
  -- kids.parent_id/favorites.parent_id/curated_favorites.parent_id (RLS
  -- Audit, sezione 27 del task): NON family_people/families (percorsi
  -- verificati a 0-2 righe in produzione, non il modello di ownership
  -- primario oggi) — un impegno resta visibile/gestibile solo dal genitore
  -- che lo ha creato, stessa policy di kids/favorites, nessuna nuova
  -- semantica di condivisione introdotta da questa migration.
  parent_id uuid references public.profiles(id) on delete cascade not null,

  -- Activity (centro estivo, calcio, danza — organizzazione ricorrente con
  -- un orario/luogo) vs Commitment (dentista, compleanno, riunione scuola —
  -- impegno puntuale). Sezione 12 del task: usato SOLO per la grammatica
  -- visuale del Planner (icona/etichetta), MAI per decidere la Coverage
  -- (vedi coverage_behavior sotto — resta 'none' per costruzione in questo
  -- rilascio, indipendentemente da kind).
  kind text not null default 'commitment' check (kind in ('activity', 'commitment')),

  title text not null,

  -- Intervallo date — sempre presente (un evento one-off ha start_date =
  -- end_date). Supporta nativamente il caso multi-day (centro estivo 10-14
  -- giugno) senza dover materializzare una riga per giorno (sezione 6 del
  -- task: "NON trasformare necessariamente ogni giorno in una riga DB
  -- indipendente"). date, non timestamptz: il "giorno" è sempre inteso nel
  -- fuso locale della famiglia, stessa convenzione di activity_weeks/
  -- activity_days/school_calendar_events (tutti date, mai timestamptz).
  start_date date not null,
  end_date date not null,
  constraint external_planner_items_date_range check (end_date >= start_date),

  all_day boolean not null default true,
  -- Orari opzionali, ignorati se all_day = true (validazione applicativa,
  -- non un check SQL: evita di dover reintrodurre una migration se in
  -- futuro un all_day dovesse comunque voler registrare un orario
  -- indicativo). start_time/end_time senza fuso: stesso principio di
  -- activity_days (nessuna colonna time NELLE tabelle esistenti usa tz).
  start_time time without time zone,
  end_time time without time zone,

  location text,
  notes text,
  external_url text,

  -- ORIGINE (sezione 2 del task): 'manual' (creato da zero dal genitore) o
  -- 'curated_discovery' (creato da "Aggiungi al Planner" su una Scoperta
  -- TRAMA). NON 'partner': le attività Partner continuano a usare il flow
  -- booking esistente, mai questa tabella — 'partner' è deliberatamente
  -- escluso dal check per rendere impossibile, a livello di schema, un
  -- "fake booking" mascherato da External Planner Item. Altre origini
  -- (calendar_sync, ecc., sezioni 19-23) sono preparate concettualmente ma
  -- NON aggiunte al check ora: verranno aggiunte con un ALTER CHECK
  -- dedicato quando quella capability sarà davvero costruita (nessuna
  -- textual freedom oggi: un valore fuori da questi due è un errore
  -- applicativo, non un dato silenzioso).
  source_type text not null default 'manual' check (source_type in ('manual', 'curated_discovery')),

  -- Id stringa del Curated Lead (lib/discovery/real-dataset.ts, es.
  -- "lyceum-summer-camp") quando source_type='curated_discovery' — STESSO
  -- pattern di curated_favorites.curated_lead_id: MAI un uuid, MAI una FK
  -- verso "activities". Null quando source_type='manual'. Nessun check di
  -- coerenza source_type/source_ref a livello SQL (stessa scelta già fatta
  -- per curated_favorites: la coerenza è responsabilità del data layer
  -- applicativo, lib/data/external-planner-items.ts), per restare
  -- consistenti con il pattern esistente e non introdurre un vincolo che
  -- richiederebbe poi eccezioni per fonti future.
  source_ref text,

  -- SNAPSHOT PRINCIPLE (sezione 8 del task): title/location/external_url/
  -- start_date/end_date sopra SONO GIÀ lo snapshot (copiati una volta sola
  -- al momento della creazione, mai ri-sincronizzati a runtime dal dataset
  -- Discovery). organizer_snapshot è l'unico campo aggiuntivo necessario
  -- (il modello item non ha altrimenti un concetto di "organizzatore" — le
  -- attività manuali non ne hanno bisogno, i Commitment nemmeno).
  -- source_metadata jsonb per estensioni future non anticipabili ora (es.
  -- categoria Discovery, confidence) SENZA richiedere una nuova migration:
  -- mai letto per decisioni di Coverage/RLS, solo display opzionale.
  organizer_snapshot text,
  source_metadata jsonb,

  -- RECURRENCE (sezione 5 del task) — REQUIRED: one-off (default, nessuna
  -- colonna necessaria: un item senza recurrence_rule È one-off).
  -- STRONGLY DESIRED (settimanale semplice) NON implementato in questo
  -- rilascio: costruire anche solo "ogni martedì dal 6/10 al 15/12" in modo
  -- riusabile avrebbe richiesto materializzare occorrenze (nuova tabella
  -- e/o job) o un motore di espansione a runtime — entrambi fuori dal
  -- perimetro "nessun nuovo recurrence engine" di questo blocco. Colonna
  -- jsonb nullable preparata come SOLO placeholder forward-compatible (mai
  -- letta da alcun codice applicativo in questo rilascio, mai esposta in
  -- UI): quando la ricorrenza settimanale verrà costruita (classificata P1
  -- immediato, vedi ROADMAP.md), potrà essere popolata senza un'ulteriore
  -- ALTER TABLE. Forma prevista (non applicata ora):
  -- {"freq":"weekly","byWeekday":[2],"until":"2026-12-15"}.
  recurrence_rule jsonb,

  -- COVERAGE SEMANTICS (sezione 13 del task, CRITICAL) — regola
  -- conservativa scelta: 'none' per COSTRUZIONE in questo rilascio, per
  -- OGNI riga, indipendentemente da kind/orari. Nessun codice applicativo
  -- in questo rilascio imposta mai 'activity' né legge questa colonna per
  -- decidere SeasonWeek.covered/WeekStatus/School Calendar need (vedi
  -- commento esteso in lib/data/external-planner-items.ts). La colonna
  -- esiste già (invece di essere aggiunta più avanti con una nuova
  -- migration) perché la sezione 13 la richiede esplicitamente come
  -- concetto nel modello dati, ma la sua UNICA istanza di valore possibile
  -- scritta da questo rilascio è 'none' — attivare 'activity' per un
  -- centro estivo full-day è una decisione di prodotto esplicitamente
  -- rimandata (richiede una regola più precisa di "kind=activity" da solo,
  -- es. soglia oraria, come discusso nel task) e verrà introdotta con un
  -- cambio di CODICE, non di schema.
  coverage_behavior text not null default 'none' check (coverage_behavior in ('none', 'activity')),

  -- FUTURE COMPATIBILITY (sezioni 19-23 del task) — identità stabile +
  -- timestamps: created_at/updated_at per un futuro sync calendario,
  -- deleted_at per soft-delete (mai un DELETE fisico dalle azioni V1 — vedi
  -- app/actions/external-planner-items.ts) cosi un consumer futuro
  -- (Accompagnamento/Ritiro, Calendar Sync) può distinguere "mai esistito"
  -- da "esistito e poi rimosso" senza dipendere da un log esterno.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.external_planner_items enable row level security;

-- Stesso pattern RLS di kids/favorites/curated_favorites: il genitore
-- gestisce solo le proprie righe, l'admin piattaforma legge tutto (bypass
-- fin da subito, non come fix successivo — stessa lezione di
-- curated_favorites/announcement_receipts).
create policy "External planner items: il genitore gestisce i propri" on public.external_planner_items for all
  using (auth.uid() = parent_id) with check (auth.uid() = parent_id);
create policy "External planner items: l'admin piattaforma legge tutti" on public.external_planner_items for select
  using (public.is_platform_admin());

create index if not exists idx_external_planner_items_parent on public.external_planner_items (parent_id);
-- Utile per le query "impegni di questa settimana/stagione" (range di
-- date) che il Planner farà a runtime.
create index if not exists idx_external_planner_items_dates on public.external_planner_items (parent_id, start_date, end_date);
-- Utile per il meccanismo "già nel Planner" su una Scoperta TRAMA (sezione
-- 15 del task) e per un futuro "Ora disponibile su TRAMA" (sezione 9, non
-- implementato ora).
create index if not exists idx_external_planner_items_source on public.external_planner_items (parent_id, source_type, source_ref);

-- Trigger updated_at — stesso pattern minimo già in uso altrove nello
-- schema per colonne updated_at (nessuna funzione condivisa esistente
-- individuata per questo scopo specifico: definita qui, isolata,
-- reversibile col DROP TABLE in ROLLBACK).
create or replace function public.external_planner_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_external_planner_items_updated_at
  before update on public.external_planner_items
  for each row execute function public.external_planner_items_set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- B) EXTERNAL PLANNER ITEM KIDS (child association, N:N)
-- ════════════════════════════════════════════════════════════════
-- CHILD ASSOCIATION AUDIT (sezione 4 del task) — conclusione: supportare
-- più bambini sullo stesso item con una tabella di giunzione N:N, stesso
-- identico pattern già collaudato da booking_kids (migration bootstrap) e
-- group_kids/community_members — NON duplicare la riga
-- external_planner_items N volte (avrebbe rotto l'identità stabile
-- richiesta dalla sezione 19-23 e reso edit/delete "singolo impegno,
-- multi-bambino" ambiguo tra "modifica tutte le copie" e "modifica solo la
-- mia"). Un item senza nessuna riga qui è concettualmente valido a livello
-- schema (0 bambini) ma il data layer applicativo richiede sempre almeno 1
-- bambino alla creazione (validazione applicativa, non un check SQL: la
-- tabella resta riusabile anche per un futuro caso "impegno di famiglia
-- senza bambino specifico" senza una nuova migration).
create table if not exists public.external_planner_item_kids (
  item_id uuid references public.external_planner_items(id) on delete cascade not null,
  kid_id uuid references public.kids(id) on delete cascade not null,
  primary key (item_id, kid_id)
);

alter table public.external_planner_item_kids enable row level security;

-- Difesa in profondità: non basta essere il proprietario dell'item, il
-- kid_id deve appartenere anche allo stesso genitore (stesso principio già
-- richiesto sezione 27 "RLS deve impedire accesso tra famiglie" — nessuna
-- famiglia può referenziare il bambino di un'altra famiglia su un proprio
-- item, e nessun genitore può referenziare un proprio bambino su un item
-- che non possiede).
create policy "External planner item kids: il genitore gestisce le proprie righe" on public.external_planner_item_kids for all
  using (
    exists (select 1 from public.external_planner_items i where i.id = item_id and i.parent_id = auth.uid())
    and exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid())
  )
  with check (
    exists (select 1 from public.external_planner_items i where i.id = item_id and i.parent_id = auth.uid())
    and exists (select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid())
  );
create policy "External planner item kids: l'admin piattaforma legge tutte" on public.external_planner_item_kids for select
  using (public.is_platform_admin());

create index if not exists idx_external_planner_item_kids_item on public.external_planner_item_kids (item_id);
create index if not exists idx_external_planner_item_kids_kid on public.external_planner_item_kids (kid_id);

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK (eseguire DOPO aver applicato)
-- ════════════════════════════════════════════════════════════════
-- select count(*) from public.external_planner_items; -- atteso: 0 (tabella nuova, vuota)
-- select count(*) from public.external_planner_item_kids; -- atteso: 0
-- select count(*) from public.bookings; -- atteso: invariato rispetto a PRIMA di applicare (nessuna riga toccata)
-- select count(*) from public.activities; -- atteso: invariato
-- select count(*) from public.kids; -- atteso: invariato (nessuna riga toccata, solo referenziata)
-- select policyname from pg_policies where tablename='external_planner_items'; -- attese le 2 policy sopra
-- select policyname from pg_policies where tablename='external_planner_item_kids'; -- attese le 2 policy sopra

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- drop trigger if exists trg_external_planner_items_updated_at on public.external_planner_items;
-- drop function if exists public.external_planner_items_set_updated_at();
-- drop table if exists public.external_planner_item_kids;
-- drop table if exists public.external_planner_items;
-- Entrambe le tabelle sono isolate (nessun'altra tabella esistente ha una
-- FK ENTRANTE verso di loro) — il rollback è un semplice DROP nell'ordine
-- sopra (kids prima, per la FK in uscita verso external_planner_items),
-- senza effetti collaterali su bookings/activities/kids/curated_favorites/
-- favorites/School Calendar.

-- ════════════════════════════════════════════════════════════════
-- BACKWARD COMPATIBILITY
-- ════════════════════════════════════════════════════════════════
-- Additiva pura: 2 tabelle nuove + 1 funzione trigger nuova, ZERO colonne
-- aggiunte a tabelle esistenti, ZERO righe esistenti modificate
-- (bookings/booking_weeks/booking_days/activities/kids/curated_favorites/
-- favorites restano bit-per-bit invariate). Finché questa migration non è
-- applicata: il codice applicativo che la assume (lib/data/
-- external-planner-items.ts, app/actions/external-planner-items.ts)
-- fallirà le query su "external_planner_items"/"external_planner_item_kids"
-- con errore Postgres 42P01 (relation does not exist) — stesso
-- comportamento "atteso, non un bug" già documentato in migration_38. Tutti
-- i call site sono nuovi in questo stesso ciclo di lavoro: nessuna
-- funzionalità già in produzione dipende da queste tabelle, quindi nessuna
-- regressione nel frattempo — la feature resta comunque dietro
-- EXTERNAL_PLANNER_ITEMS_ENABLED (cohort internal-preview), quindi anche
-- dopo l'applicazione della migration nessun utente normale la vede finché
-- Fabrizio non promuove il flag da Admin → Feature Flags → Release.
