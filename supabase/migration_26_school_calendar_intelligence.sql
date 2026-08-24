-- ═════════════════════════════════════════════════════════════════════════
-- Migrazione 26 — School Calendar Intelligence (task #529-532)
-- ═════════════════════════════════════════════════════════════════════════
-- Feature richiesta da Fabrizio (spec "TRAMA — SCHOOL CALENDAR INTELLIGENCE",
-- 24/08/2026): il Planner deve sapere quando la scuola di ciascun bambino è
-- chiusa, per evidenziare (in modo assistivo, mai prescrittivo) le settimane
-- in cui la famiglia potrebbe aver bisogno di organizzare un'attività.
--
-- AS-IS verificato (vedi docs/trama-one/analysis/
-- SCHOOL_CALENDAR_INTELLIGENCE_STATUS.md): nessuna tabella/colonna
-- riguardante scuole/calendari scolastici esiste oggi in alcuna forma.
-- Nessuna capability duplicata: la copertura booking (bookings/booking_weeks/
-- booking_days) resta l'UNICA fonte di "settimana coperta"; questa migrazione
-- aggiunge solo dati di CONTESTO (scuola chiusa sì/no), mai uno stato di
-- copertura alternativo.
--
-- Additiva al 100%: solo `create table if not exists`, nessun `alter` su
-- tabelle esistenti (in particolare `public.kids` NON viene toccata — il
-- profilo scolastico vive in una tabella dedicata per zero rischio sulle
-- query esistenti). Non applicata da Claude (governance): Fabrizio esegue
-- questo file su Supabase quando pronto.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1) Calendari scolastici — dato di riferimento pubblico (non personale)
-- ─────────────────────────────────────────────

create table if not exists public.school_calendars (
  id uuid primary key default gen_random_uuid(),
  country text not null default 'IT',
  region text not null,
  school_year text not null, -- es. '2026/2027'
  valid_from date not null,
  valid_to date not null,
  source text, -- es. 'Regione Lombardia - USR'
  source_url text,
  source_updated_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published')),
  version int not null default 1,
  created_at timestamptz default now(),
  unique (country, region, school_year, version)
);

alter table public.school_calendars enable row level security;

-- Dato pubblico non personale (calendario regionale, fonte pubblica): lettura
-- per chiunque sia autenticato, ma solo le versioni pubblicate — le bozze
-- restano visibili solo all'Admin (vedi policy sotto, tramite
-- is_platform_admin(), già esistente dal motore Feature Flag/Admin — vedi
-- supabase/schema.sql).
create policy "School calendars: lettura pubblica delle versioni pubblicate"
  on public.school_calendars for select
  to authenticated
  using (status = 'published');

create policy "School calendars: l'Admin gestisce il dataset"
  on public.school_calendars for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ─────────────────────────────────────────────
-- 2) Eventi di calendario — chiusure/aperture
-- ─────────────────────────────────────────────

create table if not exists public.school_calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.school_calendars(id) on delete cascade not null,
  start_date date not null,
  end_date date not null,
  event_type text not null check (event_type in (
    'school_year_start', 'school_year_end', 'christmas_break', 'easter_break',
    'public_holiday', 'regional_closure', 'bridge', 'other_closure'
  )),
  label text not null,
  source_level text check (source_level in ('national', 'regional', 'local')),
  source text,
  notes text,
  created_at timestamptz default now()
);

alter table public.school_calendar_events enable row level security;

create index if not exists idx_school_calendar_events_calendar on public.school_calendar_events(calendar_id);
create index if not exists idx_school_calendar_events_dates on public.school_calendar_events(start_date, end_date);

-- Stessa policy del calendario padre: leggibile se il calendario è
-- pubblicato, gestito solo dall'Admin.
create policy "School calendar events: lettura se il calendario è pubblicato"
  on public.school_calendar_events for select
  to authenticated
  using (
    exists (
      select 1 from public.school_calendars sc
      where sc.id = calendar_id and sc.status = 'published'
    )
  );

create policy "School calendar events: l'Admin gestisce il dataset"
  on public.school_calendar_events for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ─────────────────────────────────────────────
-- 3) Profilo scolastico del bambino — NON su public.kids (tabella dedicata)
-- ─────────────────────────────────────────────

create table if not exists public.kid_school_profiles (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid references public.kids(id) on delete cascade not null unique,
  parent_id uuid references public.profiles(id) on delete cascade not null,
  region text not null,
  comune text, -- opzionale, solo per chiusure/ponti locali
  school_calendar_id uuid references public.school_calendars(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.kid_school_profiles enable row level security;

create index if not exists idx_kid_school_profiles_kid on public.kid_school_profiles(kid_id);
create index if not exists idx_kid_school_profiles_parent on public.kid_school_profiles(parent_id);

-- Stesso perimetro RLS di public.kids: solo il genitore proprietario del
-- bambino gestisce il suo profilo scolastico. Minimizzazione privacy: nessuna
-- colonna nome scuola/classe/sezione — solo regione (+ comune opzionale).
create policy "Kid school profiles: solo il genitore gestisce il profilo del proprio bambino"
  on public.kid_school_profiles for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

-- ─────────────────────────────────────────────
-- 4) Override manuale — "Già organizzato" / "Non devo organizzare"
-- ─────────────────────────────────────────────
-- Tabella SEPARATA dal dismiss generico esistente (profiles.dismissed_weeks)
-- per non toccare in alcun modo la logica Planner attuale — zero rischio di
-- regressione su computeWeekStatus/dismiss esistente.

create table if not exists public.school_calendar_overrides (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(id) on delete cascade not null,
  kid_id uuid references public.kids(id) on delete cascade, -- null = vale per tutta la famiglia
  week_start_date date not null,
  override_type text not null check (override_type in ('already_organized', 'not_needed')),
  created_at timestamptz default now(),
  unique (parent_id, kid_id, week_start_date)
);

alter table public.school_calendar_overrides enable row level security;

create index if not exists idx_school_calendar_overrides_parent on public.school_calendar_overrides(parent_id);

create policy "School calendar overrides: solo il genitore gestisce i propri override"
  on public.school_calendar_overrides for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);
