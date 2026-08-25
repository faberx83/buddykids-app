-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION 29 — legal_documents: remediation POST-CHECK migration_28
-- (BOZZA, NON APPLICATA)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Origine: MIGRATION_28 LIVE POST-CHECK (25/08/2026, sola lettura, richiesto
-- da Fabrizio dopo aver applicato manualmente migration_28 dallo SQL
-- Editor). Il post-check ha trovato 2 problemi reali sullo stato LIVE,
-- entrambi verificati con query dirette contro il progetto Supabase
-- (eagsgfxunwyyxwwilldy), NON dedotti dal solo file SQL:
--
-- PROBLEMA 1 — "Legal documents: lettura pubblica anonima (solo corrente)"
-- (la policy introdotta da migration_28) causa un errore reale invece di
-- funzionare come previsto:
--   ERROR 42P17: infinite recursion detected in policy for relation
--   "legal_documents"
-- Riprodotto due volte in modo identico con una query SELECT eseguita come
-- ruolo anon. Causa: il predicato della policy contiene una sotto-query
-- che legge di nuovo legal_documents ("from public.legal_documents ld2"):
-- Postgres deve ri-applicare la RLS della stessa tabella per valutare
-- quella sotto-query, il che richiede rivalutare la stessa policy da capo
-- -> ricorsione infinita. Stesso identico pattern di errore già risolto in
-- questo progetto in migration_04_fix_group_recursion.sql per
-- group_members (vedi commento lì: "bypassa la RLS con una funzione
-- security definer per evitare che la policy interroghi se stessa").
-- Effetto pratico oggi: NON è "più permissivo del previsto" — è
-- completamente NON FUNZIONANTE, ogni SELECT anon su legal_documents va in
-- errore, previsto o no dal predicato. Non è uno "sblocco" involontario,
-- non c'è stata alcuna esposizione dati: prima di questa remediation
-- l'accesso anon resta di fatto a zero (errore) invece che scoped come
-- da intento originale. Nessun rischio privacy nel frattempo perché il
-- codice applicativo per /privacy e /terms usa ancora
-- resolvePublishedDocumentForPublicRoute() (createServiceClient(), che
-- bypassa RLS) — vedi nota di sequenziamento in migration_28 — quindi le
-- pagine pubbliche continuano a funzionare oggi nonostante questo bug.
--
-- PROBLEMA 2 — "AUTHENTICATED LEGAL DOCUMENT EXPOSURE: FAIL", segnalato
-- da Fabrizio come rischio da verificare puntualmente:
--   select policyname, cmd, roles, qual from pg_policies
--     where tablename = 'legal_documents';
--   ["Legal documents: lettura autenticata", cmd SELECT, roles
--     {authenticated}, qual: true]
-- Confermato con pg_policy.polpermissive = true per tutte e 3 le policy di
-- legal_documents: in Postgres più policy PERMISSIVE per lo stesso comando
-- si combinano in OR. La policy "solo Admin scrive" (cmd ALL, qual
-- is_platform_admin()) NON restringe quella di lettura: un Parent/Partner
-- autenticato qualsiasi (is_platform_admin() = false) può comunque leggere
-- OGNI riga di legal_documents attraverso "lettura autenticata" (qual =
-- true), incluse eventuali bozze (published_at is null) mai destinate alla
-- vista di un utente normale, riservate alla sola preparazione Admin.
-- Verificato anche che la tabella è oggi vuota (0 righe) quindi nessun
-- contenuto reale è stato esposto finora — ma la policy resta strutturalmente
-- sbagliata e va corretta PRIMA che Fabrizio pubblichi o crei bozze reali.
--
-- ADDITIVA (quasi) AL 100%: il problema 1 richiede necessariamente
-- ricreare la policy rotta (drop + create, stessa tecnica già usata in
-- migration_04) perché oggi non funziona affatto — non è una riduzione di
-- un accesso funzionante. Il problema 2 è risolto SENZA toccare o
-- rimuovere alcuna policy esistente: si aggiunge una nuova policy
-- RESTRICTIVE (anziché la PERMISSIVE di default), che in Postgres si
-- combina in AND con l'OR delle policy permissive — quindi restringe
-- l'accesso letto sopra senza dover modificare "Legal documents: lettura
-- autenticata" né "Legal documents: solo Admin scrive".
--
-- Nessuna nuova tabella. Nessuna modifica a legal_acceptances,
-- consent_events, parental_declarations (già verificate irraggiungibili
-- per anon nello stesso POST-CHECK, nessuna regressione lì).
--
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────
-- FIX 1 — ricorsione infinita nella policy anon (PROBLEMA 1)
-- ───────────────────────────────────────────────────────────────────────
-- Stessa tecnica di migration_04_fix_group_recursion.sql: la funzione gira
-- "security definer" quindi la sua query interna su legal_documents NON
-- riattiva la RLS del chiamante (bypassa la policy invece di rivalutarla),
-- eliminando la ricorsione. "stable" perché il risultato dipende solo dai
-- parametri e dallo stato del DB nella stessa transazione, non da
-- auth.uid() o da altro stato di sessione — sicuro da usare in una policy.
create or replace function public.is_current_published_legal_document(
  doc_type text,
  doc_published_at timestamptz
)
returns boolean
language sql security definer stable
as $$
  select doc_published_at is not null
    and doc_published_at = (
      select max(ld2.published_at)
      from public.legal_documents ld2
      where ld2.document_type = doc_type
        and ld2.published_at is not null
    );
$$;

drop policy if exists "Legal documents: lettura pubblica anonima (solo corrente)" on public.legal_documents;

create policy "Legal documents: lettura pubblica anonima (solo corrente)"
  on public.legal_documents
  for select
  to anon
  using (
    public.is_current_published_legal_document(document_type, published_at)
  );

-- ───────────────────────────────────────────────────────────────────────
-- FIX 2 — AUTHENTICATED LEGAL DOCUMENT EXPOSURE (PROBLEMA 2)
-- ───────────────────────────────────────────────────────────────────────
-- Policy RESTRICTIVE aggiuntiva (non sostituisce "lettura autenticata"):
-- un utente authenticated normale vede solo righe pubblicate; l'Admin
-- piattaforma (is_platform_admin()) vede anche le bozze, necessario per
-- prepararle/rivederle prima della pubblicazione.
create policy "Legal documents: authenticated non-admin solo pubblicati"
  on public.legal_documents
  as restrictive
  for select
  to authenticated
  using (
    published_at is not null or public.is_platform_admin()
  );

commit;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — NON ESEGUITO AUTOMATICAMENTE, da eseguire dopo il commit.
-- ════════════════════════════════════════════════════════════════

-- 1. La ricorsione è risolta (nessun errore, anche con 0 righe pubblicate):
-- begin; set local role anon; set local request.jwt.claims = '{}';
-- select count(*) from public.legal_documents;
-- rollback;
-- -- atteso: 0 (nessun errore 42P17).

-- 2. Un authenticated NON admin non vede bozze (richiede un utente reale
--    non-admin e almeno una riga con published_at is null per un test
--    pieno; con 0 righe oggi il conteggio è comunque 0 in entrambi i casi
--    — da riverificare quando esisteranno righe DRAFT):
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub": "<uuid utente non-admin>"}';
-- select * from public.legal_documents where published_at is null;
-- -- atteso: 0 righe per un utente non-admin, N righe per un Admin.

-- 3. Nessuna regressione sulle policy esistenti (stesso conteggio di prima,
--    +1 nuova policy authenticated restrictive, stessa "lettura
--    autenticata" e "solo Admin scrive" invariate):
-- select policyname, cmd, roles from pg_policies
--   where schemaname = 'public' and tablename = 'legal_documents' order by policyname;
-- -- atteso: 4 righe totali (le 3 di prima + questa nuova restrictive).

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — blocco separato, solo se questa remediation va annullata.
-- ATTENZIONE: annullare FIX 1 ripristina la ricorsione infinita (blocca di
-- nuovo ogni lettura anon reale) — farlo solo se si torna anche al
-- workaround service-role per /privacy e /terms.
-- ════════════════════════════════════════════════════════════════

-- begin;
-- drop policy if exists "Legal documents: authenticated non-admin solo pubblicati" on public.legal_documents;
-- drop policy if exists "Legal documents: lettura pubblica anonima (solo corrente)" on public.legal_documents;
-- create policy "Legal documents: lettura pubblica anonima (solo corrente)"
--   on public.legal_documents for select to anon
--   using (
--     published_at is not null
--     and published_at = (
--       select max(ld2.published_at) from public.legal_documents ld2
--       where ld2.document_type = legal_documents.document_type
--         and ld2.published_at is not null
--     )
--   );
-- drop function if exists public.is_current_published_legal_document(text, timestamptz);
-- commit;
