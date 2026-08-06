-- Migrazione 24 — Fix privacy (piano BuddyKids_Privacy_Compliance_Piano.docx,
-- rischio urgente dati di minori): il link pubblico "Condivisione Piano"
-- (supabase/schema.sql, plan_shares + get_shared_plan()/get_shared_plan_meta())
-- non scadeva mai ed esponeva il nome completo del bambino a chiunque avesse
-- il link, senza autenticazione.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase.
--
-- ════════════════════════════════════════════════════════════════
-- Cosa fa e perché
-- ════════════════════════════════════════════════════════════════
-- Decisione di Fabrizio (06/08/2026): "Iniziale + scadenza 30gg".
--
-- 1. expires_at su plan_shares: ogni link creato da ora in poi scade 30
--    giorni dopo la creazione (default now() + 30gg). I link GIÀ ESISTENTI
--    vengono retrodatati a created_at + 30gg — quindi un link creato ad es.
--    il 01/07 risulterà già scaduto oggi (06/08), coerente con la stessa
--    regola applicata a tutti: nessun trattamento speciale per il pregresso,
--    è esattamente il comportamento privacy-corretto voluto.
-- 2. get_shared_plan() restituisce l'INIZIALE del nome ("M." invece di
--    "Marco") anziché il nome completo — sufficiente per chi guarda il piano
--    già sapendo di chi si tratta (nonni/tata), non identifica il bambino a
--    chi intercetta il link da un'altra fonte.
-- 3. Sia get_shared_plan_meta() che get_shared_plan() ora considerano
--    "valido" un link solo se non revocato E non scaduto.
-- ════════════════════════════════════════════════════════════════

begin;

-- Colonna nullable + backfill per-riga (created_at + 30gg), poi default per i
-- nuovi insert e NOT NULL — un semplice "add column ... default ... not null"
-- varrebbe il default (now() al momento della ALTER) per TUTTE le righe
-- esistenti invece che created_at+30gg riga per riga.
alter table public.plan_shares add column if not exists expires_at timestamptz;

update public.plan_shares
set expires_at = created_at + interval '30 days'
where expires_at is null;

alter table public.plan_shares alter column expires_at set default (now() + interval '30 days');
alter table public.plan_shares alter column expires_at set not null;

-- get_shared_plan_meta() aggiunge una colonna alla riga restituita
-- (expires_at): Postgres non permette CREATE OR REPLACE quando cambia la
-- "shape" del risultato (ERRORE 42P13 "cannot change return type of
-- existing function" — provato in produzione, non solo teorico), va
-- eliminata prima esplicitamente. Sicuro: viene ricreata subito dopo nella
-- stessa transazione, mai un istante senza la funzione.
drop function if exists public.get_shared_plan_meta(text);

create or replace function public.get_shared_plan_meta(p_token text)
returns table (label text, scope_start date, scope_end date, expires_at timestamptz, valid boolean)
language plpgsql security definer
as $$
begin
  return query
    select
      ps.label,
      ps.scope_start,
      ps.scope_end,
      ps.expires_at,
      (ps.revoked_at is null and ps.expires_at > now()) as valid
    from public.plan_shares ps
    where ps.token = p_token;
end;
$$;

grant execute on function public.get_shared_plan_meta(text) to anon, authenticated;

-- Contenuto del link: SOLO iniziale del bambino, nome attività, date della
-- settimana e stato — MAI importi/indirizzi/contatti/nome completo. Se il
-- token non esiste, è stato revocato, o è scaduto, non restituisce righe.
create or replace function public.get_shared_plan(p_token text)
returns table (
  kid_name text,
  activity_name text,
  week_start_date date,
  week_end_date date,
  status text
)
language plpgsql security definer
as $$
declare
  v_share record;
begin
  select * into v_share
  from public.plan_shares
  where token = p_token
    and revoked_at is null
    and expires_at > now();

  if not found then
    return;
  end if;

  return query
    select
      left(k.name, 1) || '.',
      a.name,
      aw.start_date,
      aw.end_date,
      b.status
    from public.bookings b
    join public.booking_kids bk on bk.booking_id = b.id
    join public.kids k on k.id = bk.kid_id
    join public.booking_weeks bw on bw.booking_id = b.id
    join public.activity_weeks aw on aw.id = bw.week_id
    join public.activities a on a.id = b.activity_id
    where b.parent_id = v_share.parent_id
      and b.status <> 'cancelled'
      and aw.start_date <= v_share.scope_end
      and aw.end_date >= v_share.scope_start
    order by aw.start_date, k.name;
end;
$$;

grant execute on function public.get_shared_plan(text) to anon, authenticated;

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, post-check, rollback. Mai eseguiti insieme al blocco
-- sopra.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- ════════════════════════════════════════════════════════════════

-- 1. La colonna non esiste già:
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'plan_shares' and column_name = 'expires_at';
-- -- atteso: 0 righe.

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente.
-- ════════════════════════════════════════════════════════════════

-- 2. La colonna esiste, NOT NULL, con default:
-- select column_name, is_nullable, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'plan_shares' and column_name = 'expires_at';
-- -- atteso: 1 riga, is_nullable = 'NO', column_default contiene "30 days".

-- 3. I link esistenti sono stati retrodatati coerentemente:
-- select token, created_at, expires_at, (expires_at = created_at + interval '30 days') as ok
--   from public.plan_shares;
-- -- atteso: ok = true su ogni riga.

-- 4. Test funzionale: creare un link nuovo da Planner -> Condivisione Piano,
-- aprirlo in incognito (senza login) -> deve mostrare solo l'iniziale del
-- bambino (es. "M.") mai il nome completo. Un link con scope nel passato
-- (creato prima di questa migrazione, quindi già scaduto secondo il
-- backfill) deve mostrare "Link non disponibile".
--
-- NOTA IMPORTANTE: dopo questa migrazione, TUTTI i link creati più di 30
-- giorni fa smettono di funzionare immediatamente (comportamento voluto,
-- non un effetto collaterale) — chi li aveva salvati dovrà farsene generare
-- uno nuovo dal genitore.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — sicuro, nessuna perdita di dati referenziali (expires_at è
-- un campo aggiuntivo, plan_shares.token/scope_* restano invariati).
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop function if exists public.get_shared_plan_meta(text);
-- create or replace function public.get_shared_plan_meta(p_token text)
-- returns table (label text, scope_start date, scope_end date, valid boolean)
-- language plpgsql security definer
-- as $$
-- begin
--   return query
--     select ps.label, ps.scope_start, ps.scope_end, (ps.revoked_at is null) as valid
--     from public.plan_shares ps
--     where ps.token = p_token;
-- end;
-- $$;
-- grant execute on function public.get_shared_plan_meta(text) to anon, authenticated;
--
-- create or replace function public.get_shared_plan(p_token text)
-- returns table (
--   kid_name text, activity_name text, week_start_date date, week_end_date date, status text
-- )
-- language plpgsql security definer
-- as $$
-- declare
--   v_share record;
-- begin
--   select * into v_share from public.plan_shares where token = p_token and revoked_at is null;
--   if not found then return; end if;
--   return query
--     select k.name, a.name, aw.start_date, aw.end_date, b.status
--     from public.bookings b
--     join public.booking_kids bk on bk.booking_id = b.id
--     join public.kids k on k.id = bk.kid_id
--     join public.booking_weeks bw on bw.booking_id = b.id
--     join public.activity_weeks aw on aw.id = bw.week_id
--     join public.activities a on a.id = b.activity_id
--     where b.parent_id = v_share.parent_id
--       and b.status <> 'cancelled'
--       and aw.start_date <= v_share.scope_end
--       and aw.end_date >= v_share.scope_start
--     order by aw.start_date, k.name;
-- end;
-- $$;
-- grant execute on function public.get_shared_plan(text) to anon, authenticated;
--
-- alter table public.plan_shares alter column expires_at drop not null;
-- alter table public.plan_shares alter column expires_at drop default;
-- alter table public.plan_shares drop column expires_at;
-- commit;
