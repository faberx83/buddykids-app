-- Migrazione incrementale — "Gruppi avanzati" (bambini + preferenze,
-- aggregazioni, Richiesta Gruppo, accompagnamento) + campo "bar" sul centro.
--
-- IMPORTANTE: esegui SOLO questo file nel SQL Editor di Supabase (non
-- ri-eseguire tutto schema.sql, altrimenti otterrai errori "policy already
-- exists" sulle tabelle già create in precedenza). Questo file va eseguito
-- UNA SOLA VOLTA — le "create table" sono sicure da ripetere, ma le "create
-- policy" no.
--
-- schema.sql è stato aggiornato con lo stesso contenuto (per chi parte da
-- zero in un nuovo progetto Supabase può eseguire solo quello).

create policy "Groups: il creatore collega l'attività target"
  on public.groups for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

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

-- Nuovo campo sul profilo centro, usato dal filtro "Servizi" in Cerca.
alter table public.centers add column if not exists has_bar boolean default false;
