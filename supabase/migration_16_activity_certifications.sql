-- Migrazione 16 — Gate C, settima ondata (29/07): tabella mancante in
-- produzione per la Certificazione servizio (task #169-174).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase.
--
-- ════════════════════════════════════════════════════════════════
-- Come è stato trovato
-- ════════════════════════════════════════════════════════════════
-- TC-200 ("Il gestore può inviare una richiesta di Certificazione
-- servizio") falliva in modo identico e inspiegato in TUTTE E SEI le
-- ondate di triage di Gate C finora. Investigando l'error-context.md del
-- run reale, la pagina mostrava letteralmente l'errore restituito da
-- Supabase sotto il form:
--
--   "Could not find the table 'public.activity_certifications' in the
--   schema cache"
--
-- Verificato via query di sola lettura (Supabase MCP, read-only) sul
-- progetto live "buddykids" (eagsgfxunwyyxwwilldy):
--
--   select table_name from information_schema.tables
--     where table_schema='public' and table_name='activity_certifications';
--   -- ha restituito 0 righe: la tabella non esiste DAVVERO in produzione,
--   -- non è un problema di cache PostgREST da ricaricare.
--
-- La definizione esiste SOLO in supabase/schema.sql (righe 404-458, la
-- "fonte di verità" di riferimento per l'intero schema) ma non è mai stata
-- consegnata come migrazione a sé stante da eseguire — a differenza di
-- tutte le altre tabelle create dopo la baseline TRAMA ONE (migration_02 in
-- poi), questa risale a uno sprint precedente (#169) ed è stata
-- evidentemente saltata quando la tabella è stata scritta in schema.sql.
--
-- Il bucket di storage "buddykids-certifications" e le sue policy invece
-- esistono già in produzione (verificato: select id, public from
-- storage.buckets where id = 'buddykids-certifications' -> 1 riga,
-- public=false) e gli helper public.current_center_id()/
-- public.is_platform_admin() usati dalle policy sotto esistono già
-- (migration_07/09) — nessun'altra dipendenza mancante.
-- ════════════════════════════════════════════════════════════════
-- Cosa fa
-- ════════════════════════════════════════════════════════════════
-- Crea la tabella public.activity_certifications (copia esatta da
-- schema.sql, invariata) con RLS abilitata, i 3 indici e le 5 policy
-- (select/insert/update x2/delete) già scritte in schema.sql.
-- ════════════════════════════════════════════════════════════════

begin;

create table if not exists public.activity_certifications (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade not null,
  center_id uuid references public.centers(id) on delete cascade not null,
  label text not null, -- testo libero, es. "Istruttori certificati FISE per equitazione"
  document_url text, -- percorso nel bucket privato "buddykids-certifications" (non un URL pubblico, vedi lib/storage.ts)
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text, -- motivazione facoltativa in caso di rifiuto
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.activity_certifications enable row level security;

create index if not exists idx_activity_certifications_activity on public.activity_certifications(activity_id);
create index if not exists idx_activity_certifications_center on public.activity_certifications(center_id);
create index if not exists idx_activity_certifications_status on public.activity_certifications(status);

create policy "Activity certifications: approvate pubbliche, il resto solo al centro e all'admin"
  on public.activity_certifications for select
  using (
    status = 'approved'
    or center_id = public.current_center_id()
    or public.is_platform_admin()
  );

create policy "Activity certifications: il centro crea le proprie richieste (sempre pending)"
  on public.activity_certifications for insert
  with check (
    (center_id = public.current_center_id() and submitted_by = auth.uid() and status = 'pending')
    or public.is_platform_admin()
  );

-- Due policy separate (permissive, si combinano in OR): il centro può
-- modificare le proprie richieste ma SOLO restando in stato "pending" (non
-- può auto-approvarsi), l'admin piattaforma può invece impostare
-- approved/rejected su qualunque richiesta.
create policy "Activity certifications: il centro modifica le proprie richieste (restano pending)"
  on public.activity_certifications for update
  using (center_id = public.current_center_id())
  with check (center_id = public.current_center_id() and status = 'pending');

create policy "Activity certifications: l'admin approva/rifiuta qualunque richiesta"
  on public.activity_certifications for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Activity certifications: il centro elimina le proprie richieste pending, l'admin tutte"
  on public.activity_certifications for delete
  using (
    (center_id = public.current_center_id() and status = 'pending')
    or public.is_platform_admin()
  );

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, post-check, rollback. Mai eseguiti insieme al blocco
-- sopra.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA del blocco
-- begin;/commit; sopra. Solo lettura.
-- ════════════════════════════════════════════════════════════════

-- 1. Confermare che la tabella non esiste già (atteso: 0 righe):
-- select table_name from information_schema.tables
--   where table_schema='public' and table_name='activity_certifications';

-- 2. Gli helper riusati esistono già (atteso: 2 righe):
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname in ('current_center_id', 'is_platform_admin');

-- 3. Il bucket di storage esiste già (atteso: 1 riga, public=false):
-- select id, public from storage.buckets where id = 'buddykids-certifications';

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query
-- alla volta.
-- ════════════════════════════════════════════════════════════════

-- 4. La tabella esiste con RLS abilitata:
-- select relname, relrowsecurity from pg_class
--   where relname = 'activity_certifications';
-- -- atteso: 1 riga, relrowsecurity = true.

-- 5. Le 5 policy esistono:
-- select policyname from pg_policies
--   where schemaname = 'public' and tablename = 'activity_certifications';
-- -- atteso: 5 righe.

-- 6. Test funzionale: da /center/activities/[id] (Gestore), sezione
-- "Certificazioni servizio", inviare una richiesta -> deve comparire subito
-- con badge "In verifica" (nessun errore "Could not find the table..."
-- sotto il form). Da /admin (platform_admin), la richiesta deve comparire
-- nella coda di approvazione Certificazioni.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — sicuro finché non ci sono ancora richieste reali salvate
-- (nessun'altra tabella referenzia activity_certifications con FK).
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists "Activity certifications: il centro elimina le proprie richieste pending, l'admin tutte" on public.activity_certifications;
-- drop policy if exists "Activity certifications: l'admin approva/rifiuta qualunque richiesta" on public.activity_certifications;
-- drop policy if exists "Activity certifications: il centro modifica le proprie richieste (restano pending)" on public.activity_certifications;
-- drop policy if exists "Activity certifications: il centro crea le proprie richieste (sempre pending)" on public.activity_certifications;
-- drop policy if exists "Activity certifications: approvate pubbliche, il resto solo al centro e all'admin" on public.activity_certifications;
-- drop table if exists public.activity_certifications;
-- commit;
