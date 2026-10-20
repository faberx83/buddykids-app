-- Migrazione 44 — Lista d'attesa per la beta (beta_waitlist).
--
-- STATO: PREPARATA, NON APPLICATA
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito da Fabrizio
-- (deploy.sh lo propone e chiede APPLICA, oppure SQL Editor di Supabase).
--
-- Perché (20/10/2026): la pagina pubblica tramapp.it/benvenuto spiega cos'è
-- TRAMA a chi non ha un account. La beta è solo su invito (decisione di
-- Fabrizio) ma "se qualcuno ci arriva mi interessa": chi vuole provarla
-- lascia la sua email e Fabrizio la vede in Admin → Lista d'attesa.
--
-- NEW (alternative di riuso valutate): center_leads è per i centri da
-- iscrivere (lead_type, reward, claim) e beta_feedback richiede un utente
-- registrato; nessuna tabella esistente raccoglie l'interesse di una
-- famiglia SENZA account. Tabella separata, piccola, senza legami con il
-- resto del modello.
--
-- Sicurezza: RLS attiva, nessuna politica di inserimento per anon o
-- authenticated: scrive solo il server (app/actions/waitlist.ts, client di
-- servizio dopo i controlli). Lettura, aggiornamento e cancellazione solo
-- per l'Admin piattaforma (is_platform_admin(), già presente).
-- Privacy: email salvata in minuscolo, nessun dato dei figli oltre al numero
-- facoltativo; conservazione dichiarata nel modulo (12 mesi).
--
-- Additiva e idempotente. Nessun dato esistente viene toccato.
--
-- ROLLBACK (solo se necessario):
--   drop table if exists public.beta_waitlist;
--
-- POST-CHECK:
--   select count(*) from public.beta_waitlist;                       -- 0, nessun errore
--   select count(*) from pg_policies where tablename = 'beta_waitlist'; -- 3

create table if not exists public.beta_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) <= 254),
  comune text check (char_length(comune) <= 80),
  kids_count smallint check (kids_count between 1 and 9),
  note text check (char_length(note) <= 500),
  source text check (char_length(source) <= 40),
  contact_consent boolean not null default false,
  status text not null default 'nuovo' check (status in ('nuovo', 'invitato', 'archiviato')),
  admin_note text check (char_length(admin_note) <= 500),
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_beta_waitlist_created on public.beta_waitlist (created_at desc);

alter table public.beta_waitlist enable row level security;

drop policy if exists "Beta waitlist: solo l'admin piattaforma legge" on public.beta_waitlist;
create policy "Beta waitlist: solo l'admin piattaforma legge"
  on public.beta_waitlist for select
  using (public.is_platform_admin());

drop policy if exists "Beta waitlist: solo l'admin piattaforma aggiorna" on public.beta_waitlist;
create policy "Beta waitlist: solo l'admin piattaforma aggiorna"
  on public.beta_waitlist for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Beta waitlist: solo l'admin piattaforma cancella" on public.beta_waitlist;
create policy "Beta waitlist: solo l'admin piattaforma cancella"
  on public.beta_waitlist for delete
  using (public.is_platform_admin());
