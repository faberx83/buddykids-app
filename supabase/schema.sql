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
  has_bar boolean default false, -- presenza di un bar/punto ristoro nel centro (usato nei filtri di ricerca)
  -- Sconti personalizzabili dal gestore (fallback ai valori globali storici se null):
  multiweek_discount_percent numeric(4,1), -- sconto se il genitore prenota 2+ settimane (default storico: 5%)
  family_discount_tiers jsonb, -- [2°figlio%, 3°figlio%, 4°+figlio%], default storico: [10,15,20]
  group_discount_tiers jsonb, -- [{minKids,percent}], default storico: 5+:5%, 8+:10%, 12+:15%
  created_at timestamptz default now()
);

alter table public.centers enable row level security;

create policy "Centers: lettura pubblica"
  on public.centers for select
  using (true);

-- Nota: le policy di update/insert su "centers" sono definite più sotto,
-- dopo le funzioni helper current_center_id()/is_platform_admin() (schema
-- circolare: quelle funzioni leggono "profiles", quindi vanno definite prima
-- di poterle usare qui).

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
  parent_role text check (parent_role in ('padre', 'madre', 'tutore')), -- solo per genitori: usato per il check di profilo completo in Home
  dismissed_weeks jsonb default '[]', -- settimane del Planner segnate "non mi serve" dal genitore (array di date inizio settimana, ISO)
  invited_by_code text, -- codice invito (public.invites) usato in fase di registrazione, se presente
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

-- Ora che current_center_id()/is_platform_admin() esistono, completiamo le
-- policy di scrittura su "centers" (il gestore modifica il proprio centro,
-- l'Admin piattaforma può crearne di nuovi e modificarli tutti).
create policy "Centers: il gestore aggiorna il proprio centro"
  on public.centers for update
  using (id = public.current_center_id() or public.is_platform_admin())
  with check (id = public.current_center_id() or public.is_platform_admin());

create policy "Centers: l'admin piattaforma crea nuovi centri"
  on public.centers for insert
  with check (public.is_platform_admin());

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
  show_exact_spots boolean default false, -- se true mostra il numero esatto di spots_left ai genitori; se false mostra solo "Posti disponibili" generico, a scelta del gestore
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

-- ─────────────────────────────────────────────
-- PARTNER OFFERS ("Servizi consigliati" per i gestori — versione a lista
-- curata: solo l'Admin piattaforma pubblica i fornitori, non è un marketplace
-- self-service. Letta dalla dashboard Gestore centro.)
-- ─────────────────────────────────────────────
create table if not exists public.partner_offers (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  emoji text default '🤝',
  name text not null,
  description text default '',
  contact_label text not null,
  contact_href text not null,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.partner_offers enable row level security;

create policy "Partner offers: lettura pubblica"
  on public.partner_offers for select
  using (true);

create policy "Partner offers: gestibili solo dall'admin piattaforma"
  on public.partner_offers for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

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

create policy "Groups: il creatore collega l'attività target"
  on public.groups for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

alter table public.group_members enable row level security;

-- Funzione "security definer": legge group_members bypassando la RLS,
-- così la policy sotto non interroga di nuovo se stessa (altrimenti Postgres
-- segnala "infinite recursion detected in policy for relation group_members").
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and parent_id = auth.uid()
  );
$$;

create policy "Group members: visibili solo ai membri del gruppo"
  on public.group_members for select
  using (public.is_group_member(group_id));

create policy "Group members: un utente può aggiungersi da solo"
  on public.group_members for insert
  with check (auth.uid() = parent_id);

-- ─────────────────────────────────────────────
-- GRUPPI — estensione "gruppi con preferenze" (giugno 2026): ogni gruppo può
-- collegarsi a un'attività target, ogni bambino iscritto porta con sé una
-- preferenza (tag), si possono proporre sotto-gruppi/aggregazioni per
-- preferenza, e il gruppo può inviare una Richiesta Gruppo al centro con
-- sconto proporzionale al numero di bambini (vedi lib/groups.ts).
-- ─────────────────────────────────────────────

-- Bambino iscritto a un gruppo, con la preferenza (tag) indicata dal
-- genitore — es. "vuole fare Calcio" — usata per proporre le aggregazioni.
create table if not exists public.group_kids (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  kid_id uuid references public.kids(id) on delete cascade not null,
  parent_id uuid references public.profiles(id) on delete cascade not null,
  preferred_tag_id text references public.tags(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  unique (group_id, kid_id)
);

alter table public.group_kids enable row level security;

create policy "Group kids: visibili ai membri del gruppo"
  on public.group_kids for select
  using (public.is_group_member(group_id));

create policy "Group kids: un genitore aggiunge solo i propri bambini"
  on public.group_kids for insert
  with check (
    auth.uid() = parent_id and exists (
      select 1 from public.kids k where k.id = kid_id and k.parent_id = auth.uid()
    )
  );

create policy "Group kids: un genitore modifica solo i propri bambini"
  on public.group_kids for update
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

create policy "Group kids: un genitore rimuove solo i propri bambini"
  on public.group_kids for delete
  using (auth.uid() = parent_id);

-- Sotto-gruppi ("aggregazioni") proposti dentro un gruppo, es. "Calcio" o
-- "Danza" — raggruppano i bambini che condividono la stessa preferenza.
create table if not exists public.group_subgroups (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  label text not null,
  tag_id text references public.tags(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.group_subgroups enable row level security;

create policy "Group subgroups: visibili ai membri del gruppo"
  on public.group_subgroups for select
  using (public.is_group_member(group_id));

create policy "Group subgroups: gestibili dai membri del gruppo"
  on public.group_subgroups for all
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create table if not exists public.group_subgroup_kids (
  subgroup_id uuid references public.group_subgroups(id) on delete cascade not null,
  group_kid_id uuid references public.group_kids(id) on delete cascade not null,
  primary key (subgroup_id, group_kid_id)
);

alter table public.group_subgroup_kids enable row level security;

create policy "Group subgroup kids: visibili ai membri del gruppo"
  on public.group_subgroup_kids for select
  using (
    exists (
      select 1 from public.group_subgroups sg
      where sg.id = group_subgroup_kids.subgroup_id and public.is_group_member(sg.group_id)
    )
  );

create policy "Group subgroup kids: gestibili dai membri del gruppo"
  on public.group_subgroup_kids for all
  using (
    exists (
      select 1 from public.group_subgroups sg
      where sg.id = group_subgroup_kids.subgroup_id and public.is_group_member(sg.group_id)
    )
  )
  with check (
    exists (
      select 1 from public.group_subgroups sg
      where sg.id = group_subgroup_kids.subgroup_id and public.is_group_member(sg.group_id)
    )
  );

-- Richiesta Gruppo: il gruppo chiede formalmente al centro uno sconto
-- proporzionale al numero di bambini iscritti. Il gestore accetta/rifiuta
-- dalla propria dashboard (/center/group-requests).
create table if not exists public.group_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  activity_id uuid references public.activities(id) on delete cascade not null,
  center_id uuid references public.centers(id) on delete cascade not null,
  requested_by uuid references public.profiles(id) on delete set null,
  kids_count int not null default 0,
  discount_percent numeric(4, 1) not null default 0,
  message text,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  responded_at timestamptz,
  created_at timestamptz default now()
);

alter table public.group_requests enable row level security;

create policy "Group requests: visibili a membri del gruppo e centro coinvolto"
  on public.group_requests for select
  using (
    public.is_group_member(group_id)
    or center_id = public.current_center_id()
    or public.is_platform_admin()
  );

create policy "Group requests: creabili dai membri del gruppo"
  on public.group_requests for insert
  with check (public.is_group_member(group_id) and auth.uid() = requested_by);

create policy "Group requests: il centro risponde alle proprie richieste"
  on public.group_requests for update
  using (center_id = public.current_center_id() or public.is_platform_admin())
  with check (center_id = public.current_center_id() or public.is_platform_admin());

-- Accompagnamento: un genitore si candida come autista per le tratte di un
-- gruppo (andata/ritorno/entrambe), indicando posti auto e se ci sono
-- seggiolini. Gli abbinamenti con chi ha bisogno di un passaggio vengono
-- calcolati in lettura (lib/carpool.ts): restano un suggerimento, l'accordo
-- finale resta tra genitori.
create table if not exists public.carpool_offers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  parent_id uuid references public.profiles(id) on delete cascade not null,
  seats_available int not null default 0,
  has_child_seat boolean default false,
  legs text default 'both' check (legs in ('dropoff', 'pickup', 'both')),
  notes text,
  created_at timestamptz default now(),
  unique (group_id, parent_id)
);

alter table public.carpool_offers enable row level security;

create policy "Carpool offers: visibili ai membri del gruppo"
  on public.carpool_offers for select
  using (public.is_group_member(group_id));

create policy "Carpool offers: un genitore gestisce solo la propria offerta"
  on public.carpool_offers for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id and public.is_group_member(group_id));

-- Chi ha bisogno di un passaggio (e per quale tratta, e se serve un
-- seggiolino) — usato per proporre abbinamenti solo a chi lo ha richiesto.
create table if not exists public.carpool_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  parent_id uuid references public.profiles(id) on delete cascade not null,
  kids_count int not null default 1,
  needs_child_seat boolean default false,
  legs text default 'both' check (legs in ('dropoff', 'pickup', 'both')),
  created_at timestamptz default now(),
  unique (group_id, parent_id)
);

alter table public.carpool_requests enable row level security;

create policy "Carpool requests: visibili ai membri del gruppo"
  on public.carpool_requests for select
  using (public.is_group_member(group_id));

create policy "Carpool requests: un genitore gestisce solo la propria richiesta"
  on public.carpool_requests for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id and public.is_group_member(group_id));

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
-- ACTIVITY LOG (audit) — traccia le modifiche fatte dai Gestori centro, così
-- l'Admin piattaforma può vedere quanto e come intervengono (pricing,
-- calendario, promozioni…). Ogni scrittura importante lato /center inserisce
-- una riga qui (vedi app/actions/center.ts e app/actions/tags.ts).
-- ─────────────────────────────────────────────
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  center_id uuid references public.centers(id) on delete cascade,
  action text not null, -- es. "activity_update", "activity_days_save", "promotion_create", "center_profile_update", "tag_create"
  entity_type text, -- es. "activity", "center", "promotion", "tag"
  entity_id text,
  meta jsonb default '{}', -- dettagli extra (es. { "priceChanged": true, "oldPrice": 280, "newPrice": 300 })
  created_at timestamptz default now()
);

alter table public.activity_log enable row level security;

create policy "Activity log: il gestore vede/scrive il log del proprio centro"
  on public.activity_log for all
  using (center_id = public.current_center_id() or public.is_platform_admin())
  with check (center_id = public.current_center_id() or public.is_platform_admin());

create index if not exists idx_activity_log_center on public.activity_log(center_id);
create index if not exists idx_activity_log_actor on public.activity_log(actor_id);
create index if not exists idx_activity_log_created on public.activity_log(created_at desc);

-- ─────────────────────────────────────────────
-- Indici utili
-- ─────────────────────────────────────────────
-- Compatibilità con progetti dove "centers" esisteva già prima di questa
-- colonna (create table "if not exists" non aggiunge colonne mancanti a una
-- tabella già creata in precedenza).
alter table public.centers add column if not exists has_bar boolean default false;
alter table public.activities add column if not exists show_exact_spots boolean default false;
alter table public.centers add column if not exists multiweek_discount_percent numeric(4,1);
alter table public.centers add column if not exists family_discount_tiers jsonb;
alter table public.centers add column if not exists group_discount_tiers jsonb;
alter table public.profiles add column if not exists parent_role text check (parent_role in ('padre', 'madre', 'tutore'));
alter table public.profiles add column if not exists dismissed_weeks jsonb default '[]';

-- Foto profilo reali (genitore/bambino/centro/fornitore) e galleria/copertina
-- attività — caricate su Storage (bucket "buddykids-images", vedi sezione
-- STORAGE più sotto), qui salviamo solo l'URL pubblico risultante.
alter table public.profiles add column if not exists avatar_url text;
alter table public.kids add column if not exists avatar_url text;
alter table public.activities add column if not exists cover_image_url text;
alter table public.activities add column if not exists gallery_urls text[] default '{}';
alter table public.centers add column if not exists logo_url text;
alter table public.partner_offers add column if not exists image_url text;

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
-- STORAGE (foto profilo, copertina/galleria attività, logo centro/fornitore)
-- ─────────────────────────────────────────────
-- Un unico bucket pubblico in lettura: le foto (avatar, campus, fornitori)
-- sono tutte contenuti che l'app mostra pubblicamente comunque (non dati
-- sensibili), quindi non serve un bucket privato con URL firmati. Scrittura
-- permessa a chiunque sia autenticato (V1: qualsiasi utente loggato può
-- caricare in una qualsiasi sottocartella — la UI dell'app decide COSA far
-- caricare a chi; una policy più stretta, per-cartella/per-proprietario, è
-- un miglioramento V2 quando ogni immagine sarà legata 1:1 al suo proprietario).
insert into storage.buckets (id, name, public)
values ('buddykids-images', 'buddykids-images', true)
on conflict (id) do nothing;

create policy "Buddykids images: lettura pubblica"
  on storage.objects for select
  using (bucket_id = 'buddykids-images');

create policy "Buddykids images: upload da utenti autenticati"
  on storage.objects for insert
  with check (bucket_id = 'buddykids-images' and auth.role() = 'authenticated');

create policy "Buddykids images: aggiornamento da utenti autenticati"
  on storage.objects for update
  using (bucket_id = 'buddykids-images' and auth.role() = 'authenticated');

create policy "Buddykids images: eliminazione da utenti autenticati"
  on storage.objects for delete
  using (bucket_id = 'buddykids-images' and auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- INVITES (il Gestore invita potenziali nuovi genitori con un codice promo)
-- ─────────────────────────────────────────────
-- Quale codice invito ha usato un genitore in fase di registrazione (se
-- nessuno, resta null) — valorizzata dal trigger handle_new_user() più
-- sotto, leggendo raw_user_meta_data->>'invite_code' passato da signUp().
alter table public.profiles add column if not exists invited_by_code text;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  center_id uuid references public.centers(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete set null,
  contact_name text,
  contact_email text,
  contact_phone text,
  invite_code text unique not null,
  promo_discount_percent numeric(4, 1) default 10,
  promo_expires_at date,
  active boolean default true, -- il gestore può disattivare un invito prima che scada
  status text default 'pending' check (status in ('pending', 'sent', 'registered', 'redeemed', 'expired')),
  email_sent_at timestamptz,
  registered_parent_id uuid references public.profiles(id) on delete set null,
  registered_at timestamptz,
  -- Valorizzato una sola volta, quando lo sconto viene applicato alla prima
  -- prenotazione idonea del genitore invitato (vedi redeem_invite_discount
  -- più sotto) — evita che lo stesso invito dia lo sconto più di una volta.
  discount_applied_at timestamptz,
  created_at timestamptz default now()
);

alter table public.invites enable row level security;

create policy "Invites: il gestore vede/gestisce gli inviti del proprio centro"
  on public.invites for all
  using (center_id = public.current_center_id() or public.is_platform_admin())
  with check (center_id = public.current_center_id() or public.is_platform_admin());

-- Il genitore invitato deve poter leggere il PROPRIO invito (per sapere se
-- ha uno sconto da usare in Prenotazione) — solo lettura, nessun update
-- diretto: l'unica scrittura concessa al genitore passa dalla funzione
-- redeem_invite_discount() qui sotto (security definer, con i suoi controlli).
create policy "Invites: il genitore invitato vede il proprio invito"
  on public.invites for select
  using (registered_parent_id = auth.uid());

create index if not exists idx_invites_center on public.invites(center_id);
create index if not exists idx_invites_code on public.invites(invite_code);

-- Segna lo sconto di un invito come "usato" per la prima prenotazione
-- idonea del genitore invitato — security definer così il genitore non ha
-- bisogno di una policy di UPDATE generica su invites (che gli permetterebbe
-- di alterare anche altri campi, es. la percentuale di sconto).
create or replace function public.redeem_invite_discount(p_invite_id uuid)
returns boolean
language plpgsql security definer
as $$
declare
  v_count int;
begin
  update public.invites
  set discount_applied_at = now(), status = 'redeemed'
  where id = p_invite_id
    and registered_parent_id = auth.uid()
    and discount_applied_at is null
    and active = true;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- Anteprima pubblica di un invito (mostrata in fase di registrazione a chi
-- NON è ancora loggato, arrivando da un link ?invite=CODICE) — security
-- definer per restituire solo nome centro + percentuale sconto, MAI i dati
-- di contatto della persona invitata (altrimenti servirebbe una policy di
-- lettura pubblica sull'intera tabella invites, che esporrebbe email/telefono
-- di tutti gli invitati a chiunque abbia la anon key).
create or replace function public.get_invite_preview(p_code text)
returns table (center_name text, discount_percent numeric, valid boolean)
language plpgsql security definer
as $$
begin
  return query
    select
      c.name,
      i.promo_discount_percent,
      (
        i.active
        and (i.promo_expires_at is null or i.promo_expires_at >= current_date)
        and i.registered_parent_id is null
      )
    from public.invites i
    join public.centers c on c.id = i.center_id
    where i.invite_code = p_code;
end;
$$;

grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- Aggiorna il trigger di registrazione: oltre a creare il profilo, se in
-- fase di signUp() è stato passato un invite_code (raw_user_meta_data), lo
-- salva sul profilo E collega automaticamente l'invito (se esiste, è attivo
-- e non scaduto) segnandolo "registered" — lo sconto sarà applicabile alla
-- prima prenotazione senza nessuna azione manuale del genitore o del gestore.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_invite_code text;
begin
  v_invite_code := new.raw_user_meta_data->>'invite_code';

  insert into public.profiles (id, email, full_name, invited_by_code)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_invite_code);

  if v_invite_code is not null then
    update public.invites
    set registered_parent_id = new.id,
        registered_at = now(),
        status = 'registered'
    where invite_code = v_invite_code
      and active = true
      and (promo_expires_at is null or promo_expires_at >= current_date)
      and registered_parent_id is null;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
