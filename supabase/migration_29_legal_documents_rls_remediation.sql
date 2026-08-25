-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION 29 — legal_documents: remediation POST-CHECK migration_28
-- (BOZZA, NON APPLICATA) — v2, dopo SECURITY REVIEW di Fabrizio (25/08/2026)
-- ═══════════════════════════════════════════════════════════════════════
--
-- STORIA: la v1 di questo file (commit 5b31d0d) copriva i 2 problemi del
-- POST-CHECK migration_28 con una funzione SECURITY DEFINER non hardenizzata
-- e una policy RESTRICTIVE compensativa. Fabrizio ha richiesto una SECURITY
-- REVIEW completa prima di procedere — questa v2 la recepisce e SOSTITUISCE
-- interamente la v1 (stesso file, non applicato in nessuna delle due
-- versioni). Vedi in fondo il verdetto "MIGRATION_29 SECURITY REVIEW".
--
-- ───────────────────────────────────────────────────────────────────────
-- ROOT CAUSE (POST-CHECK migration_28, verificato live, read-only, contro
-- il progetto Supabase eagsgfxunwyyxwwilldy)
-- ───────────────────────────────────────────────────────────────────────
-- PROBLEMA 1: la policy anon di migration_28 contiene una sotto-query che
-- rilegge legal_documents dentro il proprio USING — Postgres deve
-- rivalutare la RLS della stessa tabella per calcolare la sotto-query,
-- quindi rivaluta la stessa policy, ricorsivamente. Riprodotto 2 volte:
-- ERROR 42P17: infinite recursion detected in policy for relation
-- "legal_documents". Effetto: ogni SELECT anon fallisce (non più
-- permissivo del previsto — semplicemente rotto). Nessuna esposizione dati
-- avvenuta: la tabella ha 0 righe oggi e /privacy e /terms usano ancora il
-- workaround service-role (bypassa RLS, non toccato da questa migrazione).
--
-- PROBLEMA 2: "Legal documents: lettura autenticata" (qual = true,
-- PERMISSIVE, roles {authenticated}) espone OGNI riga — incluse eventuali
-- bozze — a qualunque Parent/Partner autenticato. La policy "solo Admin
-- scrive" (cmd ALL, is_platform_admin()) non la restringe: le policy
-- PERMISSIVE per lo stesso comando si combinano in OR, quindi basta che
-- UNA policy dica "true" perché l'accesso sia concesso a chiunque.
--
-- ───────────────────────────────────────────────────────────────────────
-- SCHEMA REALE VERIFICATO (non assunto) — information_schema + pg_constraint
-- ───────────────────────────────────────────────────────────────────────
-- Colonne di public.legal_documents: id (uuid pk), document_type (text,
-- not null), version (text, not null), sha256 (text, nullable), published_at
-- (timestamptz, nullable), created_at (timestamptz, not null, default now()).
-- NESSUNA colonna audience, NESSUNA colonna effective_at, NESSUNA colonna
-- status/visibility. Vincolo reale:
--   CHECK (document_type = ANY (ARRAY['terms', 'privacy_notice']))
-- Confermato anche lato applicativo: lib/legal/consent.ts riga 62 —
--   export type LegalDocumentType = "terms" | "privacy_notice";
-- — lo stesso identico universo di 2 valori, nessun terzo tipo
-- "internal"/"admin"/"partner" esiste oggi né nello schema né nel codice.
-- Conseguenza pratica: OGNI riga possibile in questa tabella è per
-- costruzione un documento destinato alla consultazione pubblica (Termini o
-- Informativa Privacy) — non esiste oggi un vettore per cui "published_at
-- valorizzato" possa corrispondere a un documento interno. La whitelist
-- sotto (§ "whitelist esplicita") non restringe quindi l'insieme di righe
-- leggibili oggi (coincide con l'intero universo consentito dal CHECK) — è
-- una seconda barriera indipendente contro un domani in cui qualcuno
-- estendesse il CHECK constraint con un nuovo document_type (es. un
-- addendum interno Gestore) SENZA aggiornare anche questa migrazione: senza
-- whitelist, quel nuovo tipo diventerebbe automaticamente pubblico/leggibile
-- da chiunque nel momento stesso in cui venisse "pubblicato" (published_at
-- valorizzato) — con la whitelist, resta invisibile ad anon/authenticated
-- non-admin finché una migrazione dedicata non lo aggiunge esplicitamente.
--
-- ───────────────────────────────────────────────────────────────────────
-- COERENZA CON deriveDocumentStatus() (lib/legal/consent.ts, righe 74-97)
-- ───────────────────────────────────────────────────────────────────────
-- L'app deriva DRAFT/PUBLISHED/SUPERSEDED così: DRAFT se published_at è
-- null; PUBLISHED se è la riga con published_at più recente per quel
-- document_type; SUPERSEDED se ha published_at valorizzato ma non è la più
-- recente. Esattamente la stessa regola implementata sotto in SQL
-- (is_current_published_legal_document — "corrente" = max(published_at)
-- per lo stesso document_type). Nessuna colonna "status" esiste nello
-- schema in nessuno dei due lati: entrambi ricalcolano la stessa
-- classificazione dallo stesso dato grezzo (published_at), quindi restano
-- strutturalmente coerenti per costruzione — non due implementazioni
-- indipendenti che potrebbero divergere.
--
-- Caso Termini v1/v2 (verificato contro questa logica):
--   Terms v1, published_at = T1; Terms v2, published_at = T2 (T2 > T1).
--   -> anon: la funzione ritorna true SOLO per v2 (max(published_at) per
--      'terms' = T2) — v1 non è MAI restituita ad anon, né come "corrente"
--      né in alcun altro modo (l'unica policy anon è quella "solo corrente").
--   -> authenticated Parent/Partner (non-admin): vede ENTRAMBE v1 e v2 (la
--      nuova policy authenticated sotto concede lettura a ogni riga
--      PUBLISHED, non solo alla più recente — scelta esplicita di
--      Fabrizio, §3: "legge i documenti pubblicati", non "il documento
--      corrente"). deriveDocumentStatus() lato app etichetterà comunque v1
--      come "superseded" e v2 come "published" quando li renderizza — la
--      RLS permette la lettura della riga, la semantica "è quello corrente
--      o no" resta un calcolo applicativo, mai un valore letto dal DB.
--   -> platform_admin: vede v1 e v2 (e qualunque DRAFT) via la policy
--      "solo Admin scrive" (cmd ALL, is_platform_admin()), invariata.
--
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────
-- Helper 1 — whitelist esplicita dei document_type pubblicamente
-- consultabili. NON security definer (nessun bypass RLS necessario: legge
-- solo una costante, zero I/O su tabelle) — usata sia dalla funzione anon
-- sotto sia dalla nuova policy authenticated, in un solo punto per evitare
-- che i due elenchi divergano nel tempo. Se in futuro un nuovo
-- document_type viene aggiunto al CHECK constraint di legal_documents
-- SENZA modificare anche questa funzione, quel nuovo tipo resta escluso da
-- anon/authenticated non-admin per default (fail-closed) finché una
-- migrazione dedicata non lo aggiunge qui esplicitamente.
create or replace function public.publicly_consultable_legal_document_types()
returns text[]
language sql
immutable
set search_path = pg_catalog, public
as $$
  select array['terms', 'privacy_notice']::text[];
$$;

revoke all on function public.publicly_consultable_legal_document_types() from public;
grant execute on function public.publicly_consultable_legal_document_types() to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- Helper 2 — FIX ricorsione anon (PROBLEMA 1). SECURITY DEFINER, hardened
-- secondo la checklist di Fabrizio:
--
--  - search_path fisso e sicuro: "set search_path = pg_catalog, public"
--    esplicito sulla funzione stessa (non ereditato dalla sessione
--    chiamante) — impedisce a un ruolo con privilegi di creare oggetti che
--    "dirottino" la risoluzione dei nomi non qualificati usati qui dentro
--    (rischio classico dei SECURITY DEFINER senza search_path fisso).
--  - riferimenti schema-qualified: "public.legal_documents" sempre per
--    esteso, mai un nome nudo che dipenda dal search_path del chiamante.
--  - nessun dynamic SQL: corpo "language sql" puro, un'unica query
--    statica, nessun EXECUTE/format() con input concatenato.
--  - nessun input arbitrario che consenta data exposure: i 2 parametri
--    (doc_type, doc_published_at) sono SEMPRE i valori delle colonne
--    document_type/published_at della RIGA che la RLS sta già valutando
--    per quel ruolo (passati dalla policy stessa, non da un form/endpoint)
--    — anche chiamata direttamente con valori "indovinati" da un client, la
--    funzione ritorna SOLO un booleano, mai il contenuto di una riga: non
--    esiste alcun modo di usarla per esfiltrare colonne (nemmeno di righe
--    DRAFT, vedi punto sotto), solo per confermare/negare "questo
--    (tipo, timestamp) è la versione pubblicata corrente?" — un fatto che,
--    per un documento REALMENTE pubblicato, è già per definizione
--    pubblico.
--  - owner appropriato: creata dal ruolo che applica la migrazione (lo
--    stesso proprietario di public.legal_documents e delle altre funzioni
--    helper del progetto, es. is_platform_admin/is_group_member in
--    schema.sql e migration_04) — nessun ruolo applicativo a privilegio
--    minore la possiede, quindi nessun percorso per un utente non
--    privilegiato di alterarne il corpo.
--  - comportamento con RLS/FORCE RLS verificato: confermato via
--    pg_class.relforcerowsecurity = false su legal_documents (query
--    diretta nel POST-CHECK) — quindi il proprietario/i ruoli con
--    privilegi bypassano comunque la RLS sulla tabella quando eseguono
--    query come SECURITY DEFINER, che è esattamente il meccanismo che
--    elimina la ricorsione (la sotto-query interna a questa funzione non
--    riattiva la policy anon). ATTENZIONE per manutenzione futura: se
--    "FORCE ROW LEVEL SECURITY" venisse mai abilitata su legal_documents,
--    la RLS si applicherebbe anche al proprietario/SECURITY DEFINER e la
--    ricorsione qui risolta potrebbe ripresentarsi — non abilitare FORCE
--    RLS su questa tabella senza rivedere anche questa funzione.
--  - EXECUTE concesso solo ai ruoli realmente necessari: REVOKE ALL FROM
--    PUBLIC (Postgres la concede a PUBLIC per default alla creazione) +
--    GRANT EXECUTE al solo ruolo "anon", l'unico che la invoca (la policy
--    authenticated sotto non ne ha bisogno, non fa alcun self-join).
--  - funzione che espone il minimo indispensabile: ritorna un booleano,
--    mai una riga/colonna.
--  - nessuna possibilità di leggere DRAFT tramite la funzione: il
--    predicato richiede "doc_published_at is not null" PRIMA di calcolare
--    il max — una riga DRAFT (published_at null) non può mai far
--    risultare true la funzione, qualunque parametro le venga passato.
--
-- Perché elimina la ricorsione senza creare un privilege-escalation path:
-- la funzione bypassa la RLS SOLO per la propria sotto-query interna
-- (grazie a SECURITY DEFINER + assenza di FORCE RLS sulla tabella), non per
-- il chiamante: il chiamante (ruolo anon) resta soggetto alla RLS come
-- prima, ottiene soltanto un booleano calcolato "dietro le quinte" — non
-- acquisisce alcun privilegio aggiuntivo sulla tabella, non può leggere
-- colonne extra, non può scrivere. È esattamente lo stesso pattern già
-- adottato in questo progetto in migration_04_fix_group_recursion.sql per
-- public.is_group_member() (gruppi), qui ulteriormente hardenizzato con
-- search_path fisso e revoke/grant espliciti (che la is_group_member/
-- is_platform_admin esistenti NON hanno — segnalato dall'advisor Supabase
-- come "Function Search Path Mutable", gap preesistente e separato, fuori
-- perimetro di questa migrazione: non le tocchiamo qui).
create or replace function public.is_current_published_legal_document(
  doc_type text,
  doc_published_at timestamptz
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select doc_published_at is not null
    and doc_type = any (public.publicly_consultable_legal_document_types())
    and doc_published_at = (
      select max(ld2.published_at)
      from public.legal_documents ld2
      where ld2.document_type = doc_type
        and ld2.published_at is not null
    );
$$;

revoke all on function public.is_current_published_legal_document(text, timestamptz) from public;
grant execute on function public.is_current_published_legal_document(text, timestamptz) to anon;

-- ───────────────────────────────────────────────────────────────────────
-- Policy anon — DROP + CREATE (la v1 di migration_28 era rotta, non
-- funzionante: questo non è "restringere un accesso funzionante", è
-- sostituire qualcosa che oggi fallisce sempre con la versione corretta).
-- ───────────────────────────────────────────────────────────────────────
drop policy if exists "Legal documents: lettura pubblica anonima (solo corrente)" on public.legal_documents;

create policy "Legal documents: lettura pubblica anonima (solo corrente)"
  on public.legal_documents
  for select
  to anon
  using (
    public.is_current_published_legal_document(document_type, published_at)
  );

-- ───────────────────────────────────────────────────────────────────────
-- Policy authenticated — DROP + CREATE (preferenza esplicita di Fabrizio
-- rispetto a una RESTRICTIVE compensativa). Nessuna ragione architetturale
-- impedisce il replacement diretto qui: la policy "Legal documents: solo
-- Admin scrive" (cmd ALL, using is_platform_admin()) è una policy
-- PERMISSIVE indipendente che GIÀ include SELECT nel suo "ALL" — quindi un
-- platform_admin autenticato continua a vedere ogni riga (incluse le
-- bozze) tramite quella policy da sola, per pura composizione OR tra
-- policy permissive dello stesso comando. Non serve alcuna RESTRICTIVE per
-- "riaprire" l'accesso Admin: DROP+CREATE della sola policy troppo ampia
-- ottiene esattamente la matrice voluta senza introdurre un secondo tipo
-- di policy da mantenere.
drop policy if exists "Legal documents: lettura autenticata" on public.legal_documents;

create policy "Legal documents: lettura autenticata (pubblicati, non bozze)"
  on public.legal_documents
  for select
  to authenticated
  using (
    published_at is not null
    and document_type = any (public.publicly_consultable_legal_document_types())
  );

-- "Legal documents: solo Admin scrive" (cmd ALL, is_platform_admin()) NON
-- viene toccata: resta la fonte di visibilità DRAFT/storico per l'Admin.

commit;

-- ════════════════════════════════════════════════════════════════
-- MATRICE ALLOW/DENY (dimostrata con la composizione reale delle policy
-- sopra, non solo letta da pg_policies — vedi POST-CHECK #4 sotto per la
-- simulazione effettiva da eseguire dopo l'apply)
-- ════════════════════════════════════════════════════════════════
--
-- ROLE                      | DRAFT | CURRENT PUBLISHED | SUPERSEDED | INTERNAL (ipotetico, futuro)
-- anon                      | DENY  | ALLOW              | DENY       | DENY (whitelist esclude)
-- authenticated Parent      | DENY  | ALLOW              | ALLOW      | DENY (whitelist esclude)
-- authenticated Partner     | DENY  | ALLOW              | ALLOW      | DENY (whitelist esclude)
-- platform_admin            | ALLOW | ALLOW              | ALLOW      | ALLOW (policy Admin non filtra per tipo)
--
-- Note:
-- - "INTERNAL" non esiste oggi (CHECK constraint ammette solo 'terms' e
--   'privacy_notice') — colonna dimostrativa per il caso in cui un domani
--   venga aggiunto un terzo document_type non pensato per la consultazione
--   pubblica: la whitelist lo esclude per anon/authenticated non-admin
--   finché non verrà aggiunto esplicitamente qui.
-- - authenticated Parent/Partner non sono distinti da alcuna colonna in
--   legal_documents (non esiste una colonna "audience" nello schema reale,
--   verificato) — la policy si applica identica a qualunque riga
--   authenticated, che è corretto qui perché Termini/Privacy Notice sono
--   destinati a chiunque abbia un account, non specifici per ruolo.

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE. Da eseguire manualmente PRIMA
-- del blocco begin;/commit; sopra.
-- ════════════════════════════════════════════════════════════════

-- 1. Conferma lo stato attuale (rotto) prima della remediation:
-- select policyname, cmd, roles, qual from pg_policies
--   where schemaname = 'public' and tablename = 'legal_documents' order by policyname;
-- -- atteso: 3 righe — "lettura autenticata" (qual=true), "lettura pubblica
--    anonima (solo corrente)" (la v1 rotta), "solo Admin scrive".

-- 2. Conferma che nessuna riga esiste ancora (nessun rischio nel finestra
--    di modifica delle policy):
-- select count(*) from public.legal_documents;
-- -- atteso: 0.

-- 3. Conferma FORCE RLS disabilitata (precondizione per il funzionamento
--    del SECURITY DEFINER senza reintrodurre la ricorsione):
-- select relforcerowsecurity from pg_class where relname = 'legal_documents';
-- -- atteso: false.

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — NON ESEGUITO AUTOMATICAMENTE. Da eseguire DOPO il commit.
-- ════════════════════════════════════════════════════════════════

-- 1. Nessuna ricorsione (anche con 0 righe pubblicate):
-- begin; set local role anon; set local request.jwt.claims = '{}';
-- select count(*) from public.legal_documents;
-- rollback;
-- -- atteso: 0, NESSUN errore 42P17.

-- 2. EXECUTE corretto sulle 2 funzioni (solo ai ruoli previsti):
-- select p.proname, r.rolname
-- from pg_proc p
-- join pg_language l on l.oid = p.prolang
-- join pg_namespace n on n.oid = p.pronamespace
-- join aclexplode(p.proacl) a on true
-- join pg_roles r on r.oid = a.grantee
-- where n.nspname = 'public'
--   and p.proname in ('is_current_published_legal_document', 'publicly_consultable_legal_document_types')
--   and a.privilege_type = 'EXECUTE';
-- -- atteso: is_current_published_legal_document -> solo {anon} (oltre
--    all'owner, implicito); publicly_consultable_legal_document_types ->
--    {anon, authenticated}. Nessuna riga con "PUBLIC".

-- 3. Matrice ALLOW/DENY riprodotta con dati reali (da eseguire quando
--    esisteranno righe vere — oggi la tabella è vuota, quindi ogni test
--    sotto restituisce 0 righe in ogni caso; questi test vanno RIPETUTI da
--    Fabrizio non appena pubblica un primo documento reale):
--   a) inserire manualmente 1 riga DRAFT, 1 CURRENT PUBLISHED, 1 SUPERSEDED
--      per 'terms' (fuori da questa migrazione, con lo strumento Admin);
--   b) per ciascun ruolo (anon, authenticated senza is_platform_admin,
--      authenticated con is_platform_admin), contare quante di quelle 3
--      righe sono visibili — deve corrispondere esattamente alla matrice
--      sopra.

-- 4. Nessuna regressione sulle altre 3 tabelle (invariate da questa
--    migrazione):
-- select policyname, roles from pg_policies
--   where schemaname = 'public'
--   and tablename in ('legal_acceptances', 'consent_events', 'parental_declarations');
-- -- atteso: identico al POST-CHECK migration_28 (nessuna riga con "anon").

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — blocco separato, SOLO se questa remediation va annullata.
-- FAIL-CLOSED per costruzione: rimuove le 2 nuove policy SELECT (anon e
-- authenticated) e le 2 funzioni helper, SENZA ripristinare la vecchia
-- policy "lettura autenticata" (qual=true). Risultato dopo il rollback:
-- NESSUNO tranne l'Admin (via "solo Admin scrive") può più leggere
-- legal_documents — né anon né un Parent/Partner normale. Deliberatamente
-- più restrittivo di ENTRAMBI gli stati precedenti (pre-migration_28 e
-- post-migration_28-v1): non esiste alcuna combinazione di eventi in cui
-- questo rollback possa ricreare "using (true) to authenticated" o
-- riesporre bozze — quella policy viene distrutta, mai ricreata da questo
-- blocco. Se in futuro servirà di nuovo un accesso authenticated più ampio
-- di "solo pubblicati", andrà scritta come nuova migrazione deliberata, mai
-- come sotto-prodotto di un rollback.
--
-- ATTENZIONE OPERATIVA: se, nel frattempo, è già stata applicata la
-- remediation applicativa del punto 7 (rimozione del workaround
-- service-role da /privacy e /terms in favore delle nuove policy RLS),
-- questo rollback ROMPE quelle 2 pagine pubbliche per gli utenti anonimi
-- reali (nessuna policy anon resterebbe attiva). In tal caso, ripristinare
-- PRIMA resolvePublishedDocumentForPublicRoute()/createServiceClient() nel
-- codice applicativo, POI eseguire questo rollback — mai il contrario
-- (stessa sequenza, invertita, della nota di sequenziamento in
-- migration_28).
-- ════════════════════════════════════════════════════════════════

-- begin;
-- drop policy if exists "Legal documents: lettura autenticata (pubblicati, non bozze)" on public.legal_documents;
-- drop policy if exists "Legal documents: lettura pubblica anonima (solo corrente)" on public.legal_documents;
-- drop function if exists public.is_current_published_legal_document(text, timestamptz);
-- drop function if exists public.publicly_consultable_legal_document_types();
-- commit;
