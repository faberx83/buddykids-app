-- ─────────────────────────────────────────────────────────────────
-- MIGRATION 06 — Profilo personale esteso (genitore + gestore) e
-- registro presenze giornaliero per i Gestori centro.
--
-- Esegui questo file UNA VOLTA nello SQL Editor di Supabase, incollando
-- uno STEP alla volta (come per seed-test-data.sql). Idempotente: puoi
-- rieseguirlo senza errori se un blocco è già stato applicato.
-- ─────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- STEP 1 — Nuove colonne su "profiles" (dati personali, sicurezza,
-- preferenze, privacy/account) — valgono sia per genitori sia per gestori,
-- dato che "profiles" è la tabella condivisa da tutti i ruoli.
-- ═══════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists gender text check (gender in ('M', 'F', 'altro'));
alter table public.profiles add column if not exists language text default 'it' check (language in ('it', 'en'));
alter table public.profiles add column if not exists theme text default 'light' check (theme in ('light', 'dark'));
alter table public.profiles add column if not exists notify_email boolean default true;
alter table public.profiles add column if not exists notify_push boolean default true;
alter table public.profiles add column if not exists notify_sms boolean default false;
alter table public.profiles add column if not exists marketing_consent boolean default false;
alter table public.profiles add column if not exists account_status text default 'active' check (account_status in ('active', 'deactivated', 'deletion_requested'));
alter table public.profiles add column if not exists deletion_requested_at timestamptz;

-- Fold-in difensivo: migration_03_kids_profile.sql aggiungeva "gender" a
-- "kids" ma non risultava presente in schema.sql — la aggiungiamo di nuovo
-- qui in modo idempotente così è garantita indipendentemente dallo storico.
alter table public.kids add column if not exists gender text check (gender in ('M', 'F', 'altro'));


-- ═══════════════════════════════════════════════════════════════
-- STEP 2 — RLS aggiuntive: il Gestore centro deve poter vedere nome
-- bambino + dati di contatto genitore per le prenotazioni del PROPRIO
-- centro (oggi "profiles"/"kids" sono visibili solo al proprietario).
-- Sono policy AGGIUNTIVE (permissive, si sommano in OR alle esistenti):
-- non tolgono nulla ai genitori, aggiungono solo visibilità al centro.
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Profiles: il centro vede i genitori delle proprie prenotazioni" on public.profiles;
create policy "Profiles: il centro vede i genitori delle proprie prenotazioni"
  on public.profiles for select
  using (
    exists (
      select 1 from public.bookings b
      join public.activities a on a.id = b.activity_id
      where b.parent_id = profiles.id and a.center_id = public.current_center_id()
    )
  );

drop policy if exists "Kids: il centro vede i bambini iscritti alle proprie attività" on public.kids;
create policy "Kids: il centro vede i bambini iscritti alle proprie attività"
  on public.kids for select
  using (
    public.is_platform_admin() or exists (
      select 1 from public.booking_kids bk
      join public.bookings b on b.id = bk.booking_id
      join public.activities a on a.id = b.activity_id
      where bk.kid_id = kids.id and a.center_id = public.current_center_id()
    )
  );

drop policy if exists "Booking kids: il centro vede i bambini delle proprie prenotazioni" on public.booking_kids;
create policy "Booking kids: il centro vede i bambini delle proprie prenotazioni"
  on public.booking_kids for select
  using (
    public.is_platform_admin() or exists (
      select 1 from public.bookings b
      join public.activities a on a.id = b.activity_id
      where b.id = booking_kids.booking_id and a.center_id = public.current_center_id()
    )
  );

drop policy if exists "Booking weeks: il centro vede le settimane delle proprie prenotazioni" on public.booking_weeks;
create policy "Booking weeks: il centro vede le settimane delle proprie prenotazioni"
  on public.booking_weeks for select
  using (
    public.is_platform_admin() or exists (
      select 1 from public.bookings b
      join public.activities a on a.id = b.activity_id
      where b.id = booking_weeks.booking_id and a.center_id = public.current_center_id()
    )
  );

drop policy if exists "Groups: il centro vede i gruppi collegati alle proprie attività" on public.groups;
create policy "Groups: il centro vede i gruppi collegati alle proprie attività"
  on public.groups for select
  using (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = groups.activity_id and a.center_id = public.current_center_id()
    )
  );

drop policy if exists "Group kids: il centro vede i bambini dei gruppi delle proprie attività" on public.group_kids;
create policy "Group kids: il centro vede i bambini dei gruppi delle proprie attività"
  on public.group_kids for select
  using (
    public.is_platform_admin() or exists (
      select 1 from public.groups g
      join public.activities a on a.id = g.activity_id
      where g.id = group_kids.group_id and a.center_id = public.current_center_id()
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- STEP 3 — Registro presenze giornaliero (una riga per bambino, settimana
-- di camp e giorno specifico all'interno di quella settimana).
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade not null,
  week_id uuid references public.activity_weeks(id) on delete cascade not null,
  kid_id uuid references public.kids(id) on delete cascade not null,
  date date not null,
  status text not null default 'assente' check (status in ('presente', 'assente')),
  note text,
  marked_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now(),
  unique (kid_id, week_id, date)
);

alter table public.attendance_records enable row level security;

drop policy if exists "Attendance: il centro gestisce le presenze delle proprie attività" on public.attendance_records;
create policy "Attendance: il centro gestisce le presenze delle proprie attività"
  on public.attendance_records for all
  using (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = attendance_records.activity_id and a.center_id = public.current_center_id()
    )
  )
  with check (
    public.is_platform_admin() or exists (
      select 1 from public.activities a
      where a.id = attendance_records.activity_id and a.center_id = public.current_center_id()
    )
  );

create index if not exists idx_attendance_activity_week on public.attendance_records (activity_id, week_id);


-- ═══════════════════════════════════════════════════════════════
-- Verifica (facoltativa, da eseguire dopo tutti gli STEP sopra)
-- ═══════════════════════════════════════════════════════════════
-- select column_name from information_schema.columns where table_name = 'profiles' order by column_name;
-- select column_name from information_schema.columns where table_name = 'kids' order by column_name;
-- select * from public.attendance_records limit 5;
-- select policyname from pg_policies where tablename in ('profiles','kids','booking_kids','booking_weeks','groups','group_kids','attendance_records') order by tablename, policyname;
