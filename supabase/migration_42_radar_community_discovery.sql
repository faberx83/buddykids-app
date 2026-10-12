-- Migrazione 42 — Radar / Community Discovery (motore, patch 1 di 2).
--
-- STATO: PREPARATA, NON APPLICATA. La applica Fabrizio con "bash deploy.sh":
-- lo script la trova da solo (riga qui sopra) e chiede la conferma APPLICA.
--
-- Additiva e reversibile. Nessuna riga esistente modificata. Separa i tre
-- concetti richiesti dal brief (§21):
--   CONTENUTO  → community_discoveries   (1 riga per attività reale)
--   FONTE      → discovery_submissions   (N invii per contenuto: foto, link, testo)
--   SEGNALE    → interest_signals        (N segnali per contenuto, privati di default)
-- Lo stesso volantino caricato da 8 genitori produce 1 contenuto, 8 invii e
-- 8 segnali: mai 8 attività.
--
-- Privacy (decisione di Fabrizio, 12/10/2026): i file dei volantini NON
-- vengono conservati. Di un'immagine resta solo l'impronta SHA-256 (per
-- riconoscere i doppioni) e i dati estratti approvati dall'utente. Nessuna
-- coordinata GPS: "dove l'hai trovato" è solo testo facoltativo.
--
-- Visibilità (decisione di Fabrizio, 12/10/2026): una Community Discovery
-- salvata è subito visibile a tutti gli utenti autenticati, con il badge
-- "Segnalato dalla community". L'admin può nasconderla (status = 'hidden').

-- ════════════════════════════════════════════════════════════════
-- 1) CONTENUTO
-- ════════════════════════════════════════════════════════════════
create table if not exists public.community_discoveries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  organizer_name text check (organizer_name is null or char_length(organizer_name) <= 160),
  category text check (category is null or category in ('educativo', 'sportivo', 'multisport', 'artistico', 'evento', 'altro')),
  short_description text check (short_description is null or char_length(short_description) <= 600),
  age_min smallint check (age_min is null or age_min between 0 and 18),
  age_max smallint check (age_max is null or age_max between 0 and 18),
  start_date date,
  end_date date,
  -- Testo originale delle date quando l'anno non è certo: l'anno non si
  -- assume mai (§17 "data senza anno").
  date_text_raw text check (date_text_raw is null or char_length(date_text_raw) <= 200),
  schedule_text text check (schedule_text is null or char_length(schedule_text) <= 300),
  location_name text check (location_name is null or char_length(location_name) <= 200),
  address text check (address is null or char_length(address) <= 300),
  comune text check (comune is null or char_length(comune) <= 120),
  -- Prezzo mai stimato: null se non presente nella fonte.
  price numeric(10, 2) check (price is null or price >= 0),
  price_unit text check (price_unit is null or price_unit in ('per_settimana', 'per_giorno', 'totale', 'per_mese', 'per_lezione')),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  contact_email text check (contact_email is null or char_length(contact_email) <= 200),
  website_url text check (website_url is null or website_url ~ '^https?://'),
  social_url text check (social_url is null or social_url ~ '^https?://'),
  registration_info text check (registration_info is null or char_length(registration_info) <= 300),
  -- Provenienza per campo: { "<campo>": "extracted" | "user_confirmed" | "existing_trama_data" }.
  field_provenance jsonb not null default '{}'::jsonb,
  -- Chiave di deduplica (titolo + organizzatore normalizzati, comune, anno).
  dedupe_key text not null,
  -- Collegamenti facoltativi a dati TRAMA già esistenti (Caso B: provider presente).
  matched_center_id uuid references public.centers(id) on delete set null,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'merged')),
  merged_into uuid references public.community_discoveries(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_discoveries_age_range check (age_min is null or age_max is null or age_min <= age_max),
  constraint community_discoveries_date_range check (start_date is null or end_date is null or start_date <= end_date)
);

create index if not exists idx_community_discoveries_dedupe on public.community_discoveries (dedupe_key);
create index if not exists idx_community_discoveries_status on public.community_discoveries (status, created_at desc);

alter table public.community_discoveries enable row level security;

drop policy if exists "Community discoveries: visibili agli utenti autenticati" on public.community_discoveries;
create policy "Community discoveries: visibili agli utenti autenticati" on public.community_discoveries for select
  using (auth.uid() is not null and (status = 'visible' or created_by = auth.uid() or public.is_platform_admin()));

drop policy if exists "Community discoveries: l'utente crea le proprie" on public.community_discoveries;
create policy "Community discoveries: l'utente crea le proprie" on public.community_discoveries for insert
  with check (auth.uid() = created_by and status = 'visible');

drop policy if exists "Community discoveries: solo l'admin modifica" on public.community_discoveries;
create policy "Community discoveries: solo l'admin modifica" on public.community_discoveries for update
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ════════════════════════════════════════════════════════════════
-- 2) FONTE
-- ════════════════════════════════════════════════════════════════
create table if not exists public.discovery_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles(id) on delete cascade not null,
  source_type text not null check (source_type in ('flyer_photo', 'screenshot', 'shared_url', 'pasted_url', 'pasted_text', 'shared_image', 'manual', 'future_other')),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  url_normalized text,
  -- Solo l'impronta dell'immagine, mai il file (privacy).
  image_sha256 text check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$'),
  user_note text check (user_note is null or char_length(user_note) <= 500),
  found_near text check (found_near is null or char_length(found_near) <= 200),
  relevance_status text not null check (relevance_status in ('relevant', 'not_relevant', 'uncertain')),
  relevance_confidence text not null check (relevance_confidence in ('high', 'medium', 'low')),
  extraction_confidence text check (extraction_confidence is null or extraction_confidence in ('high', 'medium', 'low')),
  warnings jsonb not null default '[]'::jsonb,
  extracted jsonb not null default '{}'::jsonb,
  analyzer text not null default 'mock',
  outcome text not null default 'pending' check (outcome in ('pending', 'rejected', 'abandoned', 'matched_activity', 'matched_curated', 'matched_community', 'created_community', 'reported_anyway')),
  community_discovery_id uuid references public.community_discoveries(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  curated_lead_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_discovery_submissions_user on public.discovery_submissions (submitted_by, created_at desc);
create index if not exists idx_discovery_submissions_hash on public.discovery_submissions (image_sha256) where image_sha256 is not null;
create index if not exists idx_discovery_submissions_url on public.discovery_submissions (url_normalized) where url_normalized is not null;
create index if not exists idx_discovery_submissions_review on public.discovery_submissions (relevance_status, outcome, created_at desc);

alter table public.discovery_submissions enable row level security;

drop policy if exists "Discovery submissions: l'utente gestisce le proprie" on public.discovery_submissions;
create policy "Discovery submissions: l'utente gestisce le proprie" on public.discovery_submissions for all
  using (auth.uid() = submitted_by) with check (auth.uid() = submitted_by);

drop policy if exists "Discovery submissions: l'admin legge tutte" on public.discovery_submissions;
create policy "Discovery submissions: l'admin legge tutte" on public.discovery_submissions for select
  using (public.is_platform_admin());

-- Deduplica tra utenti diversi senza esporre gli invii altrui: dato
-- un'impronta o un URL normalizzato, restituisce SOLO il contenuto già
-- collegato (mai chi l'ha inviato). Usata dal motore Radar lato server.
create or replace function public.radar_find_existing_source(p_image_sha256 text, p_url_normalized text)
returns table (community_discovery_id uuid, activity_id uuid, curated_lead_id text)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select s.community_discovery_id, s.activity_id, s.curated_lead_id
  from public.discovery_submissions s
  where auth.uid() is not null
    and s.outcome in ('matched_activity', 'matched_curated', 'matched_community', 'created_community')
    and (
      (p_image_sha256 is not null and s.image_sha256 = p_image_sha256)
      or (p_url_normalized is not null and s.url_normalized = p_url_normalized)
    )
  order by s.created_at asc
  limit 1;
$$;

revoke execute on function public.radar_find_existing_source(text, text) from public, anon;
grant execute on function public.radar_find_existing_source(text, text) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════
-- 3) SEGNALE
-- ════════════════════════════════════════════════════════════════
create table if not exists public.interest_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('activity', 'curated', 'community')),
  target_id text not null check (char_length(target_id) between 1 and 120),
  signal_type text not null check (signal_type in ('imported', 'viewed', 'searched', 'favorited', 'added_to_planner', 'shared', 'proposed_to_group', 'explicitly_interested', 'booked')),
  -- Privato di default (§13). Un segnale diventa condiviso solo con
  -- un'azione esplicita dell'utente.
  visibility text not null default 'private' check (visibility in ('private', 'shared_group', 'shared_family')),
  shared_with_group_id uuid references public.groups(id) on delete set null,
  source_submission_id uuid references public.discovery_submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint interest_signals_shared_group check (visibility <> 'shared_group' or shared_with_group_id is not null)
);

create index if not exists idx_interest_signals_target on public.interest_signals (target_type, target_id, signal_type);
create index if not exists idx_interest_signals_user on public.interest_signals (user_id, created_at desc);

alter table public.interest_signals enable row level security;

drop policy if exists "Interest signals: l'utente gestisce i propri" on public.interest_signals;
create policy "Interest signals: l'utente gestisce i propri" on public.interest_signals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Interest signals: l'admin legge tutti" on public.interest_signals;
create policy "Interest signals: l'admin legge tutti" on public.interest_signals for select
  using (public.is_platform_admin());

-- ════════════════════════════════════════════════════════════════
-- 4) "Da organizzare" anche per le Community Discovery
-- ════════════════════════════════════════════════════════════════
alter table public.external_planner_items drop constraint if exists external_planner_items_source_type_check;
alter table public.external_planner_items add constraint external_planner_items_source_type_check
  check (source_type in ('manual', 'curated_discovery', 'community_discovery'));

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK (sola lettura)
-- ════════════════════════════════════════════════════════════════
-- select count(*) from pg_policies where tablename in ('community_discoveries','discovery_submissions','interest_signals');  -- 7
-- select has_function_privilege('anon', 'public.radar_find_existing_source(text,text)', 'execute');                     -- false
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'external_planner_items_source_type_check';
--
-- Qualità dati (Admin, sola lettura):
-- select relevance_status, outcome, count(*) from public.discovery_submissions group by 1, 2;
-- select dedupe_key, count(*) from public.community_discoveries group by 1 having count(*) > 1;   -- possibili duplicati
--
-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (solo se necessario)
-- ════════════════════════════════════════════════════════════════
-- alter table public.external_planner_items drop constraint if exists external_planner_items_source_type_check;
-- alter table public.external_planner_items add constraint external_planner_items_source_type_check
--   check (source_type in ('manual', 'curated_discovery'));
-- drop function if exists public.radar_find_existing_source(text, text);
-- drop table if exists public.interest_signals;
-- drop table if exists public.discovery_submissions;
-- drop table if exists public.community_discoveries;
