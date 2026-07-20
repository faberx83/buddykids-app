-- Migrazione 09 — TRAMA ONE Build Sprint 1: Partner Onboarding, Admin Review
-- e motore Walkthrough generico (foundation dati).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, DOPO supabase/schema.sql,
-- migration_07_feature_flags_foundation.sql e
-- migration_08_beta_cohort_memberships.sql (nessuna dipendenza diretta da
-- questi due file, ma stessa convenzione di numerazione progressiva).
--
-- Scope: introduce la state machine di onboarding del Centro
-- (LEAD→CLAIMED→SUBMITTED→CHANGES_REQUESTED→APPROVED→SUSPENDED), la
-- checklist onboarding, la verifica identità, l'audit delle transizioni e il
-- motore Walkthrough generico (tutorial_progress, riusabile per qualunque
-- tutorial_key futuro, non solo l'onboarding Center).
--
-- Compatibilità Legacy/Next Gen: totale. Nessuna colonna aggiunta o alterata
-- su public.centers/public.profiles — tutte le tabelle sotto sono satelliti
-- additivi che referenziano centers/profiles solo in lettura tramite chiave
-- esterna. I centri già esistenti (creati prima di questo sprint) non hanno
-- una riga in center_onboarding_state: il resolver applicativo
-- (lib/onboarding/resolve.ts) tratta l'assenza di riga come stato APPROVED
-- (comportamento AS-IS preservato, nessun backfill richiesto). Vedi
-- docs/trama-one/analysis/SPRINT_1_FEATURE_PRESERVATION_MATRIX.md.
--
-- Scrittura controllata: niente policy RLS "UPDATE" aperta lato client per
-- le transizioni di stato. Le transizioni passano esclusivamente dalle 3
-- funzioni SECURITY DEFINER sotto, che verificano chi chiama (center_admin
-- proprietario del centro, tramite public.current_center_id(), oppure
-- public.is_platform_admin()) e la legalità della transizione richiesta
-- PRIMA di scrivere, e registrano sempre una riga di audit. Stesso principio
-- già usato per public.is_platform_admin()/public.current_center_id() in
-- schema.sql (funzioni helper security definer per bypassare in modo
-- controllato le policy di riga).
--
-- Dipendenze: public.profiles, public.centers, public.is_platform_admin(),
-- public.current_center_id() — tutte già presenti in schema.sql.
--
-- Transazionalità: tutte le istruzioni DDL sotto sono transazionali, nessuna
-- richiede CONCURRENTLY. Applicate tutte dentro BEGIN/COMMIT: o vengono
-- applicate TUTTE, o (in caso di errore) NESSUNA.

begin;

-- ─────────────────────────────────────────────
-- 1. center_onboarding_state — stato corrente della macchina a stati
-- ─────────────────────────────────────────────
create table if not exists public.center_onboarding_state (
  id            uuid primary key default gen_random_uuid(),
  center_id     uuid not null references public.centers(id) on delete cascade,
  status        text not null default 'LEAD'
                  check (status in ('LEAD', 'CLAIMED', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'SUSPENDED')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_center_onboarding_state_center unique (center_id)
);

comment on table public.center_onboarding_state is
  'TRAMA ONE Sprint 1 — stato onboarding del Centro. Assenza di riga per un center_id = centro pre-esistente, trattato come APPROVED dal resolver applicativo (lib/onboarding/resolve.ts), mai da una query diretta client-side. Scrittura solo tramite le funzioni public.center_claim_onboarding()/center_submit_onboarding()/admin_review_center_onboarding(), mai UPDATE diretto.';

-- ─────────────────────────────────────────────
-- 2. center_onboarding_checklist_completions — checklist onboarding
-- ─────────────────────────────────────────────
create table if not exists public.center_onboarding_checklist_completions (
  id            uuid primary key default gen_random_uuid(),
  center_id     uuid not null references public.centers(id) on delete cascade,
  item_key      text not null,
  completed     boolean not null default false,
  completed_at  timestamptz,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_center_onboarding_checklist_item unique (center_id, item_key)
);

comment on table public.center_onboarding_checklist_completions is
  'TRAMA ONE Sprint 1 — completamento checklist onboarding per Centro. item_key coerente con il registry TypeScript lib/onboarding/checklist-registry.ts (stesso pattern del registry Feature Flag di Sprint 0: sorgente di verità in TypeScript, righe di stato in tabella).';

-- ─────────────────────────────────────────────
-- 3. center_identity_verifications — verifica identità
-- ─────────────────────────────────────────────
create table if not exists public.center_identity_verifications (
  id            uuid primary key default gen_random_uuid(),
  center_id     uuid not null references public.centers(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'verified', 'rejected')),
  note          text,
  document_url  text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_center_identity_verification_center unique (center_id)
);

comment on table public.center_identity_verifications is
  'TRAMA ONE Sprint 1 — verifica identità del Centro. document_url predisposto ma non ancora collegato a un upload reale in questo sprint (DEC-22, docs/trama-one/analysis/DECISION_LOG.md): nota testuale del center_admin più decisione Admin (verified/rejected). Wiring dello storage documenti differito, colonna già pronta per non richiedere una nuova migrazione quando verrà aggiunto.';

-- ─────────────────────────────────────────────
-- 4. center_onboarding_audit_log — audit delle transizioni
-- ─────────────────────────────────────────────
create table if not exists public.center_onboarding_audit_log (
  id            uuid primary key default gen_random_uuid(),
  center_id     uuid not null references public.centers(id) on delete cascade,
  from_status   text,
  to_status     text not null,
  actor_id      uuid references public.profiles(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);

comment on table public.center_onboarding_audit_log is
  'TRAMA ONE Sprint 1 — log immutabile delle transizioni di stato onboarding. Scritto esclusivamente dalle funzioni SECURITY DEFINER di transizione, mai da INSERT diretto lato client.';

-- ─────────────────────────────────────────────
-- 5. tutorial_progress — motore Walkthrough generico (non solo onboarding
--    Center: tutorial_key è libero, riusabile per qualunque Walkthrough
--    futuro, Parent/Partner/Admin, per esplicita richiesta A6/V4 in
--    ASSUMPTION_LOG.md)
-- ─────────────────────────────────────────────
create table if not exists public.tutorial_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  tutorial_key  text not null,
  step_key      text not null,
  status        text not null default 'not_started'
                  check (status in ('not_started', 'in_progress', 'completed', 'skipped')),
  started_at    timestamptz,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint uq_tutorial_progress_step unique (user_id, tutorial_key, step_key)
);

comment on table public.tutorial_progress is
  'TRAMA ONE Sprint 1 — motore Walkthrough generico. Ogni riga è un passo (step_key) di un percorso (tutorial_key) per un utente. Letto/scritto dal proprio utente (auth.uid() = user_id) o da platform_admin in sola lettura (Admin visibility minima).';

-- ─────────────────────────────────────────────
-- Trigger updated_at — funzioni locali qualificate "public.", stessa
-- convenzione di migration_07/08 (nessuna funzione trigger condivisa nel
-- repository per updated_at).
-- ─────────────────────────────────────────────
create or replace function public.set_center_onboarding_state_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_center_onboarding_state_updated_at on public.center_onboarding_state;
create trigger trg_center_onboarding_state_updated_at
  before update on public.center_onboarding_state
  for each row execute function public.set_center_onboarding_state_updated_at();

create or replace function public.set_center_onboarding_checklist_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_center_onboarding_checklist_updated_at on public.center_onboarding_checklist_completions;
create trigger trg_center_onboarding_checklist_updated_at
  before update on public.center_onboarding_checklist_completions
  for each row execute function public.set_center_onboarding_checklist_updated_at();

create or replace function public.set_center_identity_verifications_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_center_identity_verifications_updated_at on public.center_identity_verifications;
create trigger trg_center_identity_verifications_updated_at
  before update on public.center_identity_verifications
  for each row execute function public.set_center_identity_verifications_updated_at();

create or replace function public.set_tutorial_progress_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tutorial_progress_updated_at on public.tutorial_progress;
create trigger trg_tutorial_progress_updated_at
  before update on public.tutorial_progress
  for each row execute function public.set_tutorial_progress_updated_at();

-- ─────────────────────────────────────────────
-- RLS — abilitata su tutte le tabelle nuove
-- ─────────────────────────────────────────────
alter table public.center_onboarding_state enable row level security;
alter table public.center_onboarding_checklist_completions enable row level security;
alter table public.center_identity_verifications enable row level security;
alter table public.center_onboarding_audit_log enable row level security;
alter table public.tutorial_progress enable row level security;

-- center_onboarding_state: SELECT per il center_admin proprietario o
-- platform_admin. NESSUNA policy INSERT/UPDATE/DELETE per nessuno: ogni
-- scrittura passa dalle funzioni SECURITY DEFINER sotto (bypassano RLS per
-- costruzione, essendo eseguite col privilegio del proprietario della
-- funzione, non del chiamante).
drop policy if exists center_onboarding_state_select on public.center_onboarding_state;
create policy center_onboarding_state_select
  on public.center_onboarding_state for select
  using (center_id = public.current_center_id() or public.is_platform_admin());

-- center_onboarding_checklist_completions: SELECT come sopra; UPDATE/INSERT
-- concessi al center_admin proprietario SOLO per i propri item (la checklist
-- è a basso rischio: flag di completamento dichiarati dal centro stesso,
-- non una decisione di approvazione), oltre a platform_admin.
drop policy if exists center_onboarding_checklist_select on public.center_onboarding_checklist_completions;
create policy center_onboarding_checklist_select
  on public.center_onboarding_checklist_completions for select
  using (center_id = public.current_center_id() or public.is_platform_admin());

drop policy if exists center_onboarding_checklist_insert on public.center_onboarding_checklist_completions;
create policy center_onboarding_checklist_insert
  on public.center_onboarding_checklist_completions for insert
  with check (center_id = public.current_center_id() or public.is_platform_admin());

drop policy if exists center_onboarding_checklist_update on public.center_onboarding_checklist_completions;
create policy center_onboarding_checklist_update
  on public.center_onboarding_checklist_completions for update
  using (center_id = public.current_center_id() or public.is_platform_admin())
  with check (center_id = public.current_center_id() or public.is_platform_admin());

-- center_identity_verifications: SELECT per il proprietario o admin; INSERT
-- (creazione della richiesta con nota/documento) concesso al center_admin
-- proprietario; UPDATE (decisione verified/rejected + reviewed_by/at)
-- riservato a platform_admin, il center_admin non può auto-approvarsi.
drop policy if exists center_identity_verifications_select on public.center_identity_verifications;
create policy center_identity_verifications_select
  on public.center_identity_verifications for select
  using (center_id = public.current_center_id() or public.is_platform_admin());

drop policy if exists center_identity_verifications_insert on public.center_identity_verifications;
create policy center_identity_verifications_insert
  on public.center_identity_verifications for insert
  with check (center_id = public.current_center_id() or public.is_platform_admin());

drop policy if exists center_identity_verifications_update_admin on public.center_identity_verifications;
create policy center_identity_verifications_update_admin
  on public.center_identity_verifications for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Il center_admin proprietario può correggere nota/documento SOLO finché la
-- riga è ancora "pending" (nessuna decisione presa) — using() verifica la
-- riga PRIMA dell'update (deve essere pending), with check() verifica la
-- riga DOPO (deve restare pending): un center_admin non può quindi mai
-- scrivere "verified"/"rejected" su se stesso, può solo modificare
-- nota/documento mentre è in attesa di revisione.
drop policy if exists center_identity_verifications_update_owner_pending on public.center_identity_verifications;
create policy center_identity_verifications_update_owner_pending
  on public.center_identity_verifications for update
  using (center_id = public.current_center_id() and status = 'pending')
  with check (center_id = public.current_center_id() and status = 'pending');

-- center_onboarding_audit_log: SELECT per il proprietario (trasparenza sulle
-- proprie transizioni) o platform_admin. Nessuna policy di scrittura: solo
-- le funzioni SECURITY DEFINER scrivono qui.
drop policy if exists center_onboarding_audit_log_select on public.center_onboarding_audit_log;
create policy center_onboarding_audit_log_select
  on public.center_onboarding_audit_log for select
  using (center_id = public.current_center_id() or public.is_platform_admin());

-- tutorial_progress: reuse-first, stesso pattern "riga propria o admin" già
-- usato sopra e in migration_07/08, applicato qui a auth.uid() invece che a
-- current_center_id() (dominio utente, non centro).
drop policy if exists tutorial_progress_select on public.tutorial_progress;
create policy tutorial_progress_select
  on public.tutorial_progress for select
  using (auth.uid() = user_id or public.is_platform_admin());

drop policy if exists tutorial_progress_insert on public.tutorial_progress;
create policy tutorial_progress_insert
  on public.tutorial_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists tutorial_progress_update on public.tutorial_progress;
create policy tutorial_progress_update
  on public.tutorial_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Funzioni SECURITY DEFINER di transizione — unico punto di scrittura per
-- center_onboarding_state, ciascuna verifica il chiamante e la legalità
-- della transizione PRIMA di scrivere, e registra sempre l'audit.
-- ─────────────────────────────────────────────

-- center_claim_onboarding: il center_admin proprietario reclama il proprio
-- centro (LEAD -> CLAIMED, oppure crea la riga direttamente in CLAIMED se
-- non esiste ancora nessuna riga per quel centro).
create or replace function public.center_claim_onboarding(p_center_id uuid)
returns public.center_onboarding_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.center_onboarding_state;
  v_current_status text;
begin
  if p_center_id is distinct from public.current_center_id() and not public.is_platform_admin() then
    raise exception 'center_claim_onboarding: non autorizzato per questo centro';
  end if;

  select status into v_current_status from public.center_onboarding_state where center_id = p_center_id;

  if v_current_status is null then
    insert into public.center_onboarding_state (center_id, status)
    values (p_center_id, 'CLAIMED')
    returning * into v_row;
    insert into public.center_onboarding_audit_log (center_id, from_status, to_status, actor_id, note)
    values (p_center_id, null, 'CLAIMED', auth.uid(), 'claim iniziale');
    return v_row;
  end if;

  if v_current_status <> 'LEAD' then
    raise exception 'center_claim_onboarding: transizione non valida da %', v_current_status;
  end if;

  update public.center_onboarding_state
    set status = 'CLAIMED'
    where center_id = p_center_id
    returning * into v_row;

  insert into public.center_onboarding_audit_log (center_id, from_status, to_status, actor_id, note)
  values (p_center_id, 'LEAD', 'CLAIMED', auth.uid(), 'claim');

  return v_row;
end;
$$;

comment on function public.center_claim_onboarding(uuid) is
  'TRAMA ONE Sprint 1 — center_admin proprietario reclama il proprio centro (LEAD/assente -> CLAIMED). SECURITY DEFINER: unico punto di scrittura per questa transizione, verifica il chiamante prima di scrivere.';

-- center_submit_onboarding: il center_admin proprietario invia per revisione
-- (CLAIMED o CHANGES_REQUESTED -> SUBMITTED).
create or replace function public.center_submit_onboarding(p_center_id uuid, p_note text default null)
returns public.center_onboarding_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.center_onboarding_state;
  v_current_status text;
begin
  if p_center_id is distinct from public.current_center_id() and not public.is_platform_admin() then
    raise exception 'center_submit_onboarding: non autorizzato per questo centro';
  end if;

  select status into v_current_status from public.center_onboarding_state where center_id = p_center_id;

  if v_current_status is null or v_current_status not in ('CLAIMED', 'CHANGES_REQUESTED') then
    raise exception 'center_submit_onboarding: transizione non valida da %', coalesce(v_current_status, '(nessuna riga)');
  end if;

  update public.center_onboarding_state
    set status = 'SUBMITTED'
    where center_id = p_center_id
    returning * into v_row;

  insert into public.center_onboarding_audit_log (center_id, from_status, to_status, actor_id, note)
  values (p_center_id, v_current_status, 'SUBMITTED', auth.uid(), p_note);

  return v_row;
end;
$$;

comment on function public.center_submit_onboarding(uuid, text) is
  'TRAMA ONE Sprint 1 — center_admin proprietario invia il centro per revisione Admin (CLAIMED/CHANGES_REQUESTED -> SUBMITTED). SECURITY DEFINER: unico punto di scrittura per questa transizione.';

-- admin_review_center_onboarding: platform_admin decide (SUBMITTED ->
-- APPROVED | CHANGES_REQUESTED; APPROVED|SUBMITTED -> SUSPENDED).
create or replace function public.admin_review_center_onboarding(p_center_id uuid, p_decision text, p_note text default null)
returns public.center_onboarding_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.center_onboarding_state;
  v_current_status text;
  v_target_status text;
begin
  if not public.is_platform_admin() then
    raise exception 'admin_review_center_onboarding: riservato a platform_admin';
  end if;

  if p_decision not in ('approve', 'request_changes', 'suspend') then
    raise exception 'admin_review_center_onboarding: decisione non valida %', p_decision;
  end if;

  select status into v_current_status from public.center_onboarding_state where center_id = p_center_id;

  if p_decision = 'approve' then
    if v_current_status <> 'SUBMITTED' then
      raise exception 'admin_review_center_onboarding: approve non valido da %', coalesce(v_current_status, '(nessuna riga)');
    end if;
    v_target_status := 'APPROVED';
  elsif p_decision = 'request_changes' then
    if v_current_status <> 'SUBMITTED' then
      raise exception 'admin_review_center_onboarding: request_changes non valido da %', coalesce(v_current_status, '(nessuna riga)');
    end if;
    v_target_status := 'CHANGES_REQUESTED';
  else -- suspend
    if v_current_status not in ('APPROVED', 'SUBMITTED') then
      raise exception 'admin_review_center_onboarding: suspend non valido da %', coalesce(v_current_status, '(nessuna riga)');
    end if;
    v_target_status := 'SUSPENDED';
  end if;

  update public.center_onboarding_state
    set status = v_target_status
    where center_id = p_center_id
    returning * into v_row;

  insert into public.center_onboarding_audit_log (center_id, from_status, to_status, actor_id, note)
  values (p_center_id, v_current_status, v_target_status, auth.uid(), p_note);

  return v_row;
end;
$$;

comment on function public.admin_review_center_onboarding(uuid, text, text) is
  'TRAMA ONE Sprint 1 — decisione Admin sull''onboarding del Centro (approve/request_changes/suspend). SECURITY DEFINER, riservata a platform_admin, unico punto di scrittura per queste transizioni.';

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, esempi, verifica post-applicazione, rollback. Mai
-- eseguiti insieme al blocco DDL.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA di applicare il
-- blocco begin;/commit; sopra. Solo lettura. Se una riga "eventuale
-- esistenza" restituisce righe inattese, FERMARSI e capire perché prima di
-- procedere.
-- ════════════════════════════════════════════════════════════════

-- 1. Esistenza di public.centers e public.profiles (dipendenze obbligatorie):
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('centers', 'profiles');
-- -- atteso: 2 righe.

-- 2. Esistenza e proprietà di public.is_platform_admin() e
--    public.current_center_id() (usate dalle policy e dalle funzioni sotto):
-- select p.proname, p.prosecdef as security_definer, p.provolatile,
--        pg_get_function_result(p.oid) as return_type
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname in ('is_platform_admin', 'current_center_id');
-- -- atteso: 2 righe, entrambe security_definer = true, provolatile = 's'.

-- 3. Eventuale esistenza delle 5 tabelle nuove:
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in (
--     'center_onboarding_state', 'center_onboarding_checklist_completions',
--     'center_identity_verifications', 'center_onboarding_audit_log', 'tutorial_progress');
-- -- atteso su un ambiente pulito: 0 righe.

-- 4. Eventuale esistenza delle 3 funzioni di transizione:
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in (
--     'center_claim_onboarding', 'center_submit_onboarding', 'admin_review_center_onboarding');
-- -- atteso su un ambiente pulito: 0 righe.

-- 5. Eventuale esistenza delle policy sulle 5 tabelle nuove:
-- select tablename, policyname from pg_policies
--   where schemaname = 'public' and tablename in (
--     'center_onboarding_state', 'center_onboarding_checklist_completions',
--     'center_identity_verifications', 'center_onboarding_audit_log', 'tutorial_progress');
-- -- atteso su un ambiente pulito: 0 righe.

-- VERIFICA POST-APPLICAZIONE (eseguire DOPO il COMMIT sopra, separatamente):
-- select relrowsecurity from pg_class where relname in (
--   'center_onboarding_state', 'center_onboarding_checklist_completions',
--   'center_identity_verifications', 'center_onboarding_audit_log', 'tutorial_progress'); -- tutte true
-- select public.center_claim_onboarding('<uuid centro di test>'); -- da sessione center_admin proprietario: ok, ritorna riga CLAIMED
-- select public.center_submit_onboarding('<uuid centro di test>'); -- ok, ritorna riga SUBMITTED
-- select public.admin_review_center_onboarding('<uuid centro di test>', 'approve', 'test'); -- da sessione platform_admin: ok, ritorna riga APPROVED
-- select * from public.center_onboarding_audit_log where center_id = '<uuid centro di test>' order by created_at; -- 3 righe

-- ROLLBACK (eseguire come blocco separato — sicuro, nessuna tabella/colonna
-- esistente referenzia questi oggetti, nessuna modifica a schema.sql da
-- annullare):
-- begin;
-- drop function if exists public.admin_review_center_onboarding(uuid, text, text);
-- drop function if exists public.center_submit_onboarding(uuid, text);
-- drop function if exists public.center_claim_onboarding(uuid);
-- drop trigger if exists trg_tutorial_progress_updated_at on public.tutorial_progress;
-- drop function if exists public.set_tutorial_progress_updated_at();
-- drop trigger if exists trg_center_identity_verifications_updated_at on public.center_identity_verifications;
-- drop function if exists public.set_center_identity_verifications_updated_at();
-- drop trigger if exists trg_center_onboarding_checklist_updated_at on public.center_onboarding_checklist_completions;
-- drop function if exists public.set_center_onboarding_checklist_updated_at();
-- drop trigger if exists trg_center_onboarding_state_updated_at on public.center_onboarding_state;
-- drop function if exists public.set_center_onboarding_state_updated_at();
-- drop table if exists public.tutorial_progress;
-- drop table if exists public.center_onboarding_audit_log;
-- drop table if exists public.center_identity_verifications;
-- drop table if exists public.center_onboarding_checklist_completions;
-- drop table if exists public.center_onboarding_state;
-- commit;
