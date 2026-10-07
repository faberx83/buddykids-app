-- Migrazione 40 — Family-first beta pass: feedback con categoria/contesto e
-- voti 👍/👎 sulle Novità "In arrivo".
--
-- STATO: PREPARATA, NON APPLICATA. La applica Fabrizio (governance invariata),
-- da shell:  APPLY_SQL="supabase/migration_40_beta_feedback_context_and_announcement_votes.sql" bash deploy.sh
--
-- Additiva e reversibile. Nessuna riga esistente modificata.
-- Il codice funziona anche PRIMA di questa migrazione:
--   - beta_feedback: se category/client_context mancano, l'insert ripiega
--     sulle sole colonne storiche (app/actions/beta-feedback.ts);
--   - announcement_votes: se la tabella manca, i pulsanti 👍/👎 non vengono
--     mostrati (mai un pulsante visibile che non salva nulla).
--
-- ════════════════════════════════════════════════════════════════
-- 1) beta_feedback — tipo di feedback + contesto automatico
-- ════════════════════════════════════════════════════════════════
-- category: scelta facoltativa dell'utente (Idea / Problema / Cosa manca /
-- Altro). NULL = feedback storico o non categorizzato.
-- client_context: raccolto automaticamente, MAI compilato dall'utente e mai
-- dati sensibili: ruolo, route, versione build, user agent ridotto, viewport,
-- standalone (PWA installata o browser). Nessuna posizione, nessun contatto.
alter table public.beta_feedback add column if not exists category text;
alter table public.beta_feedback add column if not exists client_context jsonb;

alter table public.beta_feedback drop constraint if exists beta_feedback_category_check;
alter table public.beta_feedback add constraint beta_feedback_category_check
  check (category is null or category in ('idea', 'problema', 'manca', 'altro'));

-- RLS invariata: la policy di insert esistente ("il genitore crea solo le
-- proprie, sempre 'nuovo'") copre già le nuove colonne.

-- ════════════════════════════════════════════════════════════════
-- 2) announcement_votes — consenso sulle Novità "In arrivo"
-- ════════════════════════════════════════════════════════════════
-- Un voto per utente per annuncio (ultimo vince, upsert). announcement_id è
-- l'id testuale di lib/announcements/catalog.ts (stesso principio di
-- announcement_receipts: il catalogo resta code-based, qui solo l'interazione).
create table if not exists public.announcement_votes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(id) on delete cascade not null,
  announcement_id text not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_id, announcement_id)
);

alter table public.announcement_votes enable row level security;

drop policy if exists "Announcement votes: l'utente gestisce i propri" on public.announcement_votes;
create policy "Announcement votes: l'utente gestisce i propri" on public.announcement_votes for all
  using (auth.uid() = parent_id) with check (auth.uid() = parent_id);

drop policy if exists "Announcement votes: l'admin piattaforma legge tutti" on public.announcement_votes;
create policy "Announcement votes: l'admin piattaforma legge tutti" on public.announcement_votes for select
  using (public.is_platform_admin());

create index if not exists idx_announcement_votes_announcement on public.announcement_votes (announcement_id);

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK (sola lettura, da eseguire dopo l'apply)
-- ════════════════════════════════════════════════════════════════
-- select column_name from information_schema.columns
--   where table_name = 'beta_feedback' and column_name in ('category', 'client_context');   -- 2 righe
-- select count(*) from pg_policies where tablename = 'announcement_votes';                   -- 2
-- select count(*) from public.beta_feedback;                                                  -- invariato
--
-- Riepilogo consensi (Admin, sola lettura):
-- select announcement_id,
--        count(*) filter (where vote = 1)  as pollice_su,
--        count(*) filter (where vote = -1) as pollice_giu
--   from public.announcement_votes group by announcement_id;
--
-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (solo se necessario)
-- ════════════════════════════════════════════════════════════════
-- drop table if exists public.announcement_votes;
-- alter table public.beta_feedback drop constraint if exists beta_feedback_category_check;
-- alter table public.beta_feedback drop column if exists client_context;
-- alter table public.beta_feedback drop column if exists category;
