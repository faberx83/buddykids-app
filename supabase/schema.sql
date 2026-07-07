-- BuddyKids — schema iniziale per Supabase (Postgres)
-- Esegui questo file nel SQL Editor di Supabase dopo aver creato il progetto.
--
-- Tre ruoli applicativi (colonna profiles.role):
--   - parent          genitore: prenota attività, gestisce i propri bambini
--   - center_admin     gestore di UN centro (profiles.center_id): gestisce le
--                      proprie attività, il calendario di disponibilità e le
--                      promozioni
--   - platform_admin   admin BuddyKids: visibilità e gestione su tutti i centri

-- ─────────────────────────────────────────────
-- CENTERS (centri estivi / organizzatori)
-- ─────────────────────────────────────────────
create table if not exists public.centers (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  emoji text default '🏫',
  city text default 'Milano',
  address text,
  description text,
  contact_email text,
  contact_phone text,
  social_links jsonb default '{}', -- { instagram, facebook, tiktok, youtube, website }
  gradient text default 'linear-gradient(135deg,#E8F6FD,#E3F9F5)', -- sfondo decorativo mostrato nell'app
  created_at timestamptz default now()
);

alter table public.centers enable row level security;

create policy "Centers: lettura pubblica"
  on public.centers for select
  using (true);

-- ─────────────────────────────────────────────
-- PROFILES (estende auth.users)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  city text default 'Milano',
  avatar_emoji text default '🙂',
  role text default 'parent' check (role in ('parent', 'center_admin', 'platform_admin')),
  center_id uuid references public.centers(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Funzioni helper per le policy basate su ruolo (security definer per evitare
-- ricorsione infinita quando una policy su "profiles" deve leggere "profiles")
create or replace function public.current_role()
returns text
language sql security definer stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_center_id()
returns uuid
language sql security definer stable
as $$
  select center_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql security definer stable
as $$
  select public.current_role() = 'platform_admin';
$$;

create policy "Profiles: un utente vede/modifica il proprio profilo"
  on public.profiles for all
  using (auth.uid() = id or public.is_platform_admin())
  with check (auth.uid() = id);

-- Crea automaticamente un profilo alla registrazione (ruolo di default: parent)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- KIDS (bambini associati a un genitore)
-- ─────────────────────────────────────────────
create table if not exists public.kids (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  birth_date date,
  avatar_emoji text default '🙂',
  interests text[] default '{}',
  created_at timestamptz default now()
);

alter table public.kids enable row level security;

create policy "Kids: solo il genitore gestisce i propri bambini"
  on public.kids for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

-- ─────────────────────────────────────────────
-- ACTIVITIES (ogni attività appartiene a un centro)
-- ─────────────────────────────────────────────
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  center_id uuid references public.centers(id) on delete cascade not null,
  slug text unique,
  name text not null,
  emoji text default '⭐',
  address text,
  city text default 'Milano',
  latitude double precision,
  longitude double precision,
  age_min int,
  age_max int,
  price_per_week numeric(10, 2) not null,
  shuttle_price numeric(10, 2) default 0,
  description text,
  schedule jsonb default '[]', -- agenda della giornata: [{ time, label, color }]
  tags text[] default '{}', -- deprecato, non più popolato: sostituito da "pills" jsonb + activity_tags
  meal_option text default 'none' check (meal_option in ('included', 'packed', 'none')),
  pre_service jsonb default '{"available": false, "time": null, "priceExtra": 0}',
  post_service jsonb default '{"available": false, "time": null, "priceExtra": 0}',
  rating numeric(2, 1) default 0,
  reviews_count int default 0,
  img_gradient text default 'linear-gradient(135deg,#E8F6FD,#E3F9F5)', -- sfondo decorativo scheda/copertina
  days text, -- riepilogo testuale, es. "Lun-Ven"
  hours text, -- riepilogo testuale, es. "08:00 - 17:30"
  distance_km numeric(4, 1) default 0, -- placeholder finché non calcoliamo la distanza reale dalla posizione dell'utente
  spots_left int, -- posti "in evidenza" mostrati in scheda (separato dal dettaglio giorno-per-giorno di activity_days)
  weeks_available text default '', -- riepilogo testuale, es. "6 di 8"
  pills jsonb default '[]', -- pillole colorate mostrate in scheda: [{ label, color }]
  badges jsonb default '[]', -- badge mostrati nel dettaglio: [{ label, icon, color }]
  created_at timestamptz default now()
);

alter table public.activities enable row level security;

create policy "Activities: lettura pubblica"
  on public.activities for select
  using (true);

create policy "Activities: il gestore modifica le attività del proprio centro"
  on public.activities for insert
  with check (center_id = public.current_center_id() or public.is_platform_admin());

create policy "Activities: il gestore aggiorna le attività del proprio centro"
  on public.activities for update
  using (center_id = public.current_center_id() or public.is_platform_admin());

create policy "Activities: il gestore elimina le attività del proprio centro"
  on public.activities for delete
  using (center_id = public.current_center_id() or public.is_platform_admin());

-- ─────────────────────────────────────────────
-- TAGS (lista master gestita dall'Admin piattaforma, es. sportivo, musica,
-- piscina… — un'attività può avere più tag, vedi ACTIVITY_TAGS sotto)
-- ─────────────────────────────────────────────
create table if not exists public.tags (
  id text primary key, -- slug, es. "piscina"
  label text not null,
  emoji text default '🏷️',
  bg_color text default '#E3F9F5',
  created_at timestamptz default now()
);

alter table public.tags enable row level security;

create policy "Tags: lettura pubblica"
  on public.tags for select
  using (true);

create policy "Tags: gestibili solo dall'admin piattaforma"
  on public.tags for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create table if not exists public.activity_tags (
  activity_id uuid references public.activities(id) on delete cascade not null,
  tag_id text references public.tags(id) on delete cascade not null,
  primary key (activity_id, tag_id)
);

alter table public.activity_tags enable row level security;

create policy "Activity tags: lettura pubblica"
  on public.activity_tags for select
  using (true);

create policy "Activity tags: gestibili dal centro proprietario"
  on public.activity_tags for all
  using (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = activity_tags.activity_id and a.center_id = public.current_center_id()
    )
  )
  with check (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = activity_tags.activity_id and a.center_id = public.current_center_id()
    )
  );

-- ─────────────────────────────────────────────
-- ACTIVITY WEEKS (disponibilità settimanale — usata dal flusso di prenotazione)
-- ─────────────────────────────────────────────
create table if not exists public.activity_weeks (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade not null,
  label text not null,
  start_date date not null,
  end_date date not null,
  capacity int default 0,
  spots_left int default 0
);

alter table public.activity_weeks enable row level security;

create policy "Activity weeks: lettura pubblica"
  on public.activity_weeks for select
  using (true);

create policy "Activity weeks: gestibili dal centro proprietario"
  on public.activity_weeks for all
  using (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = activity_weeks.activity_id and a.center_id = public.current_center_id()
    )
  );

-- ─────────────────────────────────────────────
-- ACTIVITY DAYS (disponibilità giorno-per-giorno — calendario stile booking:
-- apertura/chiusura, posti liberi, sconto sul singolo giorno, last-minute)
-- ─────────────────────────────────────────────
create table if not exists public.activity_days (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade not null,
  date date not null,
  is_open boolean default true,
  capacity int default 0,
  spots_left int default 0,
  single_day_bookable boolean default true,
  discount_percent numeric(4, 1),
  last_minute boolean default false,
  special_label text, -- giornata particolare, es. "Giornata in piscina"
  special_emoji text, -- es. 🏊, 💦, 🎉
  unique (activity_id, date)
);

alter table public.activity_days enable row level security;

create policy "Activity days: lettura pubblica"
  on public.activity_days for select
  using (true);

create policy "Activity days: gestibili dal centro proprietario"
  on public.activity_days for all
  using (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = activity_days.activity_id and a.center_id = public.current_center_id()
    )
  )
  with check (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = activity_days.activity_id and a.center_id = public.current_center_id()
    )
  );

-- ─────────────────────────────────────────────
-- PROMOTIONS (sconti su giorni della settimana + promo last-minute)
-- ─────────────────────────────────────────────
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade not null,
  type text not null check (type in ('day_discount', 'last_minute')),
  label text not null,
  discount_percent numeric(4, 1) not null,
  day_of_week int check (day_of_week between 0 and 6), -- 0=lun … 6=dom, per day_discount
  valid_from date,
  valid_to date,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.promotions enable row level security;

create policy "Promotions: lettura pubblica"
  on public.promotions for select
  using (true);

create policy "Promotions: gestibili dal centro proprietario"
  on public.promotions for all
  using (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = promotions.activity_id and a.center_id = public.current_center_id()
    )
  )
  with check (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = promotions.activity_id and a.center_id = public.current_center_id()
    )
  );

-- ─────────────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(id) on delete cascade not null,
  activity_id uuid references public.activities(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  payment_method text check (payment_method in ('card', 'apple_pay', 'bank_transfer')),
  total_amount numeric(10, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  shuttle_included boolean default false,
  created_at timestamptz default now()
);

alter table public.bookings enable row level security;

create policy "Bookings: il genitore vede/gestisce le proprie prenotazioni"
  on public.bookings for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

create policy "Bookings: il centro vede le prenotazioni delle proprie attività"
  on public.bookings for select
  using (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = bookings.activity_id and a.center_id = public.current_center_id()
    )
  );

-- Settimane scelte per una prenotazione (relazione N:N)
create table if not exists public.booking_weeks (
  booking_id uuid references public.bookings(id) on delete cascade not null,
  week_id uuid references public.activity_weeks(id) on delete cascade not null,
  primary key (booking_id, week_id)
);

alter table public.booking_weeks enable row level security;

create policy "Booking weeks: visibili solo tramite la prenotazione del genitore"
  on public.booking_weeks for all
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_weeks.booking_id and b.parent_id = auth.uid()
    )
  );

-- Bambini iscritti a una prenotazione
create table if not exists public.booking_kids (
  booking_id uuid references public.bookings(id) on delete cascade not null,
  kid_id uuid references public.kids(id) on delete cascade not null,
  primary key (booking_id, kid_id)
);

alter table public.booking_kids enable row level security;

create policy "Booking kids: visibili solo tramite la prenotazione del genitore"
  on public.booking_kids for all
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_kids.booking_id and b.parent_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- GROUPS ("Andiamo Insieme")
-- ─────────────────────────────────────────────
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  discount_percent numeric(4, 1) default 0,
  created_at timestamptz default now()
);

create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade not null,
  parent_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  primary key (group_id, parent_id)
);

alter table public.groups enable row level security;

create policy "Groups: lettura per i membri"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and gm.parent_id = auth.uid()
    ) or created_by = auth.uid()
  );

create policy "Groups: creazione da utenti autenticati"
  on public.groups for insert
  with check (auth.uid() = created_by);

alter table public.group_members enable row level security;

create policy "Group members: visibili solo ai membri del gruppo"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_members.group_id and gm2.parent_id = auth.uid()
    )
  );

create policy "Group members: un utente può aggiungersi da solo"
  on public.group_members for insert
  with check (auth.uid() = parent_id);

-- ─────────────────────────────────────────────
-- REVIEWS
-- ─────────────────────────────────────────────
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade not null,
  parent_id uuid references public.profiles(id) on delete cascade not null,
  rating int check (rating between 1 and 5),
  text text,
  created_at timestamptz default now()
);

alter table public.reviews enable row level security;

create policy "Reviews: lettura pubblica"
  on public.reviews for select
  using (true);

create policy "Reviews: scrittura solo dall'autore"
  on public.reviews for insert
  with check (auth.uid() = parent_id);

-- ─────────────────────────────────────────────
-- Indici utili
-- ─────────────────────────────────────────────
create index if not exists idx_profiles_center on public.profiles(center_id);
create index if not exists idx_kids_parent on public.kids(parent_id);
create index if not exists idx_activities_center on public.activities(center_id);
create index if not exists idx_activity_tags_activity on public.activity_tags(activity_id);
create index if not exists idx_activity_tags_tag on public.activity_tags(tag_id);
create index if not exists idx_bookings_parent on public.bookings(parent_id);
create index if not exists idx_bookings_activity on public.bookings(activity_id);
create index if not exists idx_activity_weeks_activity on public.activity_weeks(activity_id);
create index if not exists idx_activity_days_activity on public.activity_days(activity_id);
create index if not exists idx_activity_days_date on public.activity_days(date);
create index if not exists idx_promotions_activity on public.promotions(activity_id);
create index if not exists idx_reviews_activity on public.reviews(activity_id);

-- ─────────────────────────────────────────────
-- Come promuovere un utente a center_admin o platform_admin
-- ─────────────────────────────────────────────
-- 1) L'utente si registra normalmente dall'app (ottiene ruolo "parent").
-- 2) Dal SQL Editor di Supabase, assegna il ruolo:
--
--    -- Gestore di un centro specifico:
--    update public.profiles
--    set role = 'center_admin', center_id = (select id from public.centers where slug = 'centro-sportivo-lido')
--    where email = 'gestore@centrolido.it';
--
--    -- Admin della piattaforma:
--    update public.profiles set role = 'platform_admin' where email = 'admin@buddykids.it';
