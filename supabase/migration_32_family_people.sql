-- Migrazione 32 — Family People (persone custom persistenti per "Chi fa
-- cosa?", TRAMA BETA v1.1.1 — FINAL GAP CLOSURE).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase PRIMA di deployare il codice che la
-- usa (app/actions/responsibilities.ts, lib/data/family-people.ts,
-- lib/nextgen/responsibility-options.ts, PlannerCalendarView.tsx,
-- TodayResponsibilityReminder.tsx) — senza questa migrazione le query verso
-- public.family_people falliscono (tabella inesistente) e la colonna
-- week_responsibilities.family_person_id non esiste.
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO E PROBLEMA RISOLTO
-- ════════════════════════════════════════════════════════════════
-- TRAMA BETA v1.1.1 (UI Refinement) aveva marcato BLOCKED la persistenza
-- cross-settimana di una persona aggiunta tramite "Altro" (es. "Zio Marco"):
-- vedi docs/trama-one/analysis/TRAMA_PLANNER_BETA_V1.1.1_UI_REFINEMENT.md,
-- §6. Il gap era: week_responsibilities.responsible_label è testo libero
-- SCOPED alla singola riga (parent_id, kid_id, week_start_date, weekday,
-- moment) — nessuna anagrafica persistente dietro quella label.
--
-- ════════════════════════════════════════════════════════════════
-- AUDIT DEL MODELLO DATI ESISTENTE (fatto PRIMA di questa proposta, come
-- richiesto dalla revisione — "riusa pattern esistenti, non inventare un
-- nuovo concetto di family ownership se ne esiste già uno")
-- ════════════════════════════════════════════════════════════════
-- Il progetto ha DUE concetti distinti che si chiamano entrambi "famiglia",
-- e vanno tenuti separati:
--
--   1. public.kids / public.week_responsibilities / public.plan_shares /
--      profiles.dismissed_weeks — TUTTI scoped da un singolo
--      "parent_id references public.profiles(id)" con RLS
--      "using (parent_id = auth.uid())". Questo È il confine reale dei dati
--      del Planner oggi: un solo genitore vede/gestisce i propri bambini e
--      le proprie responsabilità, punto. Nessuna condivisione automatica
--      con un secondo genitore, anche se "in famiglia" nel senso 2 sotto.
--
--   2. public.families / public.family_members (supabase/schema.sql, righe
--      ~1714-1732) — feature SEPARATA e ORTOGONALE ("Invita il tuo
--      partner", lib/data/family.ts, app/actions/family.ts): un gruppo di
--      account con invito/codice e ruoli creatore/admin/membro, usata SOLO
--      per la pagina "la mia famiglia" (elenco membri). Nessuna query in
--      lib/data/*.ts di kids/bookings/week_responsibilities fa mai JOIN con
--      family_members: un genitore membro della stessa "famiglia" (senso 2)
--      NON vede oggi i bambini o le responsabilità dell'altro genitore.
--
-- Family People (questa tabella) segue il modello 1, IDENTICO a
-- week_responsibilities/kids — stesso parent_id, stessa policy RLS
-- "for all using/with check (parent_id = auth.uid())". Estendere il modello
-- 2 (family_members/family_id) sarebbe un cambiamento di scope molto più
-- grande (introdurrebbe condivisione dati cross-account nel Planner, mai
-- esistita finora) e non è ciò che il gap richiede: la persona custom deve
-- persistere PER IL GENITORE che la usa, non diventare visibile a un
-- secondo account.
--
-- ════════════════════════════════════════════════════════════════
-- TABELLA
-- ════════════════════════════════════════════════════════════════
create table if not exists public.family_people (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  emoji text not null default '🧑',
  -- Soft-disable, stesso principio di plan_shares.revoked_at: nessuna UI di
  -- modifica/cancellazione prevista in questa wave (esplicitamente fuori
  -- scope), ma la colonna evita una futura migration solo per aggiungerla.
  -- Nessun codice in questa wave imposta mai active = false.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_people_display_name_not_blank check (btrim(display_name) <> '')
);

-- Un genitore non può avere due persone con lo stesso nome (case-insensitive
-- — "Zio Marco" e "zio marco" sono la stessa persona): l'unicità va su
-- un'espressione, quindi indice univoco invece di un vincolo UNIQUE inline.
create unique index if not exists idx_family_people_parent_name
  on public.family_people (parent_id, lower(display_name));

create index if not exists idx_family_people_parent
  on public.family_people (parent_id)
  where active;

alter table public.family_people enable row level security;

drop policy if exists "Family people: il genitore gestisce le proprie persone" on public.family_people;
create policy "Family people: il genitore gestisce le proprie persone"
  on public.family_people for all
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- week_responsibilities.family_person_id — riferimento stabile OPZIONALE
-- ════════════════════════════════════════════════════════════════
-- Nullable, additiva: ogni riga esistente resta valida senza alcun backfill
-- (family_person_id = null per tutte le righe già presenti — nessuna
-- reinterpretazione automatica delle vecchie label "Altro"). Il vincolo
-- enum su week_responsibilities.responsible ('io'|'partner'|'nonno'|
-- 'nonna'|'tata'|'altro') NON viene toccato: una persona custom resta
-- responsible='altro' + responsible_label=<nome> (denormalizzato, per
-- letture/reminder senza JOIN) + family_person_id=<id> (riferimento
-- stabile, per il selettore e per distinguere una persona persistente da
-- un "Altro" ad-hoc senza affidarsi alla sola label).
alter table public.week_responsibilities
  add column if not exists family_person_id uuid references public.family_people(id) on delete set null;

create index if not exists idx_week_responsibilities_family_person
  on public.week_responsibilities (family_person_id)
  where family_person_id is not null;

-- ON DELETE SET NULL (non CASCADE): se in futuro una persona venisse
-- eliminata, le responsabilità già assegnate restano leggibili (con la
-- label denormalizzata già salvata), semplicemente senza più un
-- riferimento stabile — stesso principio "la storia non si nasconde" già
-- usato altrove nel Planner (v1.1, week status "covered ma passata").

-- ════════════════════════════════════════════════════════════════
-- NOTA su supabase/schema.sql
-- ════════════════════════════════════════════════════════════════
-- Come le migrazioni numerate precedenti (es. migration_31), questo file
-- NON viene fuso in supabase/schema.sql (che resta "schema iniziale" — vedi
-- header di quel file): schema.sql non riflette family_people finché
-- qualcuno non lo aggiorna manualmente, stesso comportamento già in essere
-- per push_subscriptions e le altre migrazioni 08-31.
