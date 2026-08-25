-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION 27 — Privacy Notice / Termini / Consensi / Dichiarazione
-- genitoriale (BOZZA v2, NON APPLICATA)
-- ═══════════════════════════════════════════════════════════════════════
--
-- PRE-LAUNCH REMEDIATION WAVE 1 — R-546/C-01/C-02/C-03 (24/08/2026).
-- REVISIONE v2 — PRE-MICRO-PILOT CLOSURE GATE (decisione Fabrizio,
-- 25/08/2026): Fabrizio ha chiesto di riverificare la coerenza del modello
-- v1 (folded qui sotto) contro 7 punti espliciti prima di autorizzarne
-- l'applicazione. Verifica eseguita rileggendo v1 + lib/legal/consent.ts +
-- docs/trama-one/analysis/PRIVACY_TERMS_TECHNICAL_DESIGN.md + una query
-- Supabase read-only sullo stato reale di produzione: 3 problemi reali
-- trovati (1 incoerenza concettuale, 1 gap di integrità referenziale, 1
-- colonna pre-esistente non nota a v1) + 1 gap esplicitamente aperto in v1
-- colmato (dichiarazione genitoriale), tutti corretti in questa v2 (vedi
-- CHANGELOG v1→v2 sotto).
-- STATO: ancora bozza tecnica, NON eseguita su Supabase. Fabrizio applica
-- SOLO dopo aver confermato (a) questo modello a 4 tabelle, (b) i valori di
-- versione reali per Termini/Privacy Notice/dichiarazione genitoriale (oggi
-- solo segnaposto "v0-draft-2026-08-24") — vedi lib/legal/consent.ts.
-- Additiva al 100%: nessuna tabella/colonna esistente viene toccata,
-- alterata o rimossa.
--
-- STATO CONTENUTO LEGALE: PENDING EXTERNAL REVIEW. Nessun testo di questo
-- file, del design doc collegato, o di qualunque altro documento di questo
-- programma può concludere "TRAMA è conforme al GDPR" — quella valutazione
-- richiede una revisione legale esterna (vedi
-- TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md, C-01/C-02/C-03), fuori dal perimetro
-- di questo lavoro tecnico.
--
-- ═══════════════════════════════════════════════════════════════════════
-- CHANGELOG v1 → v2 (cosa cambia e perché — richiesto da Fabrizio,
-- "correggi il design/la migration se è più povero/incoerente")
-- ═══════════════════════════════════════════════════════════════════════
--
-- 1. INCOERENZA TROVATA in v1: la Privacy Notice era registrata dentro
--    `consent_events` con lo stesso vocabolario azione ('accepted',
--    'declined', 'withdrawn') usato per un vero consenso revocabile
--    (marketing). Ma l'Informativa Privacy (Art. 13 GDPR) NON è qualcosa
--    che si "ritira" restando utente del servizio — è una presa visione,
--    non un opt-in/opt-out. Trattarla con lo stesso vocabolario di
--    'withdrawn' del marketing è concettualmente sbagliato e rischia di
--    far pensare, in un audit, che esista un percorso per "ritirare
--    l'informativa" (non esiste e non avrebbe senso). FIX v2: Termini e
--    Privacy Notice escono da `consent_events` e vivono in una tabella
--    dedicata, `legal_acceptances` (solo azione "accettato", niente
--    withdraw/decline) — `consent_events` resta SOLO per il marketing, la
--    sola delle 3 aree che è genuinamente un consenso opzionale e
--    revocabile.
-- 2. MANCANZA TROVATA in v1: nessuna tabella per la versione dei
--    documenti legali stessi — la versione era solo una stringa libera
--    (`version text`), senza integrità referenziale: un refuso in
--    `lib/legal/consent.ts` (es. "v0-draft-2026-08-24 " con uno spazio)
--    avrebbe prodotto silenziosamente un'accettazione "orfana", mai
--    riconosciuta come valida da nessuna query. FIX v2: nuova tabella
--    `legal_documents` (registro versionato) — `legal_acceptances`
--    referenzia `legal_documents.id` con una vera foreign key: un'
--    accettazione di una versione mai pubblicata è impossibile per
--    costruzione, non solo per disciplina di scrittura.
-- 3. GAP ESPLICITAMENTE APERTO in v1 (§6 del design doc, "non risolta
--    qui"): nessun meccanismo per la dichiarazione di responsabilità
--    genitoriale sui dati dei bambini (i profili `kids` sono creati dal
--    genitore, non dal minore). FIX v2: nuova tabella
--    `parental_declarations` — un evento append-only per (genitore,
--    bambino, versione del testo della dichiarazione), verificato contro
--    `kids.parent_id` in fase di scrittura (un genitore non può dichiarare
--    per un bambino che non è il proprio).
-- 4. INVARIATO (già coerente in v1, riverificato): il consenso marketing
--    resta sempre separato, mai precompilato/bundlato — vedi tabella 3
--    sotto, RLS identica a v1.
-- 5. SCOPERTA in fase di riverifica (query Supabase read-only,
--    25/08/2026): `profiles.marketing_consent` esiste GIÀ in produzione,
--    introdotta da `migration_06_profilo_esteso_presenze.sql` (sprint
--    precedente, indipendente), già letta/scritta da
--    `updateMarketingConsentAction()` (app/actions/profile.ts) — v1
--    l'avrebbe ri-aggiunta come se fosse nuova (`add column if not
--    exists` l'avrebbe reso un no-op silenzioso, ma la documentazione era
--    fattualmente sbagliata). FIX v2: rimossa dall'`alter table` sotto,
--    aggiunta solo `marketing_consent_updated_at` (verificata assente) —
--    vedi nota dettagliata nella sezione 5 del file.
--
-- MODELLO A 4 TABELLE (dopo la revisione):
--   1. public.legal_documents     — registro versionato di Termini/Privacy
--      Notice (COSA esiste, quando pubblicato, hash del testo).
--   2. public.legal_acceptances   — chi ha accettato quale versione di
--      quale documento, quando (SOLO accettazione, mai withdraw/decline).
--   3. public.consent_events      — SOLO marketing, genuinamente
--      revocabile (accepted/withdrawn).
--   4. public.parental_declarations — dichiarazione di responsabilità
--      genitoriale per bambino, verificata contro kids.parent_id.
--   + 5 nuove colonne di cache su public.profiles (stato CORRENTE, lettura
--     O(1) senza join per qualunque gate applicativo futuro) — PIÙ la
--     colonna `marketing_consent` già esistente da migration_06 (vedi
--     punto 5 sotto).
--
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────
-- 1) Registro versionato dei documenti legali
-- ─────────────────────────────────────────────

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms', 'privacy_notice')),
  version text not null,
  sha256 text, -- hash del testo pubblicato; NULL finché il testo è ancora bozza
  published_at timestamptz, -- NULL = bozza interna, non ancora mostrata a utenti reali
  created_at timestamptz not null default now(),
  unique (document_type, version)
);

comment on table public.legal_documents is
  'Registro versionato di Termini di Servizio e Privacy Notice. published_at NULL = bozza interna (mai da mostrare a utenti reali). Scritta SOLO da platform_admin (vedi policy sotto) — nessun utente normale può inserire una versione.';

alter table public.legal_documents enable row level security;

-- Metadato non sensibile (quale versione esiste, quando pubblicata) —
-- lettura per chiunque sia autenticato, così un futuro controllo lato
-- client può sempre sapere "qual è la versione corrente" senza passare da
-- un endpoint admin-only.
drop policy if exists "Legal documents: lettura autenticata" on public.legal_documents;
create policy "Legal documents: lettura autenticata"
  on public.legal_documents for select
  to authenticated
  using (true);

drop policy if exists "Legal documents: solo Admin scrive" on public.legal_documents;
create policy "Legal documents: solo Admin scrive"
  on public.legal_documents for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ─────────────────────────────────────────────
-- 2) Accettazioni di documenti legali (append-only, SOLO "accettato" —
--    niente withdraw/decline: si ri-accetta una versione nuova, non si
--    "ritira" l'accettazione di una passata)
-- ─────────────────────────────────────────────

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legal_document_id uuid not null references public.legal_documents(id),
  accepted_at timestamptz not null default now(),
  source text, -- es. 'signup'
  unique (user_id, legal_document_id)
);

comment on table public.legal_acceptances is
  'Accettazioni di Termini/Privacy Notice, una riga per (utente, versione documento). Append-only per costruzione: nessuna policy UPDATE/DELETE. Un utente NON può "ritirare" l''accettazione di una versione passata — può solo accettare una versione nuova quando pubblicata (nuova riga).';

alter table public.legal_acceptances enable row level security;

drop policy if exists "Legal acceptances: un utente vede le proprie" on public.legal_acceptances;
create policy "Legal acceptances: un utente vede le proprie"
  on public.legal_acceptances for select
  using (auth.uid() = user_id or public.is_platform_admin());

drop policy if exists "Legal acceptances: un utente registra la propria" on public.legal_acceptances;
create policy "Legal acceptances: un utente registra la propria"
  on public.legal_acceptances for insert
  with check (auth.uid() = user_id);

create index if not exists idx_legal_acceptances_user_id on public.legal_acceptances(user_id);

-- ─────────────────────────────────────────────
-- 3) Consenso marketing — SOLO qui la semantica "revocabile" si applica
--    davvero (opt-in/opt-out, mai precompilato, mai bundlato con i
--    Termini/la Privacy Notice sopra)
-- ─────────────────────────────────────────────

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type = 'marketing'), -- vincolato: SOLO marketing (v1 permetteva anche 'terms'/'privacy_notice', spostati in legal_acceptances)
  action text not null check (action in ('accepted', 'withdrawn')),
  source text, -- es. 'signup', 'settings_withdraw'
  created_at timestamptz not null default now()
);

comment on table public.consent_events is
  'Storico del SOLO consenso marketing (opt-in/opt-out genuino, revocabile). Termini/Privacy Notice NON vivono qui dalla v2 — vedi public.legal_acceptances (non sono un consenso revocabile).';

alter table public.consent_events enable row level security;

drop policy if exists "Consent events: un utente vede i propri consensi" on public.consent_events;
create policy "Consent events: un utente vede i propri consensi"
  on public.consent_events for select
  using (auth.uid() = user_id or public.is_platform_admin());

drop policy if exists "Consent events: un utente registra i propri consensi" on public.consent_events;
create policy "Consent events: un utente registra i propri consensi"
  on public.consent_events for insert
  with check (auth.uid() = user_id);

create index if not exists idx_consent_events_user_id on public.consent_events(user_id);

-- ─────────────────────────────────────────────
-- 4) Dichiarazione di responsabilità genitoriale (NUOVA in v2 — colma il
--    gap esplicitamente lasciato aperto in v1 §6 del design doc)
-- ─────────────────────────────────────────────

create table if not exists public.parental_declarations (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  declaration_version text not null, -- versionata come i documenti legali, es. "v0-draft-2026-08-24"
  declared_at timestamptz not null default now(),
  unique (parent_user_id, kid_id, declaration_version)
);

comment on table public.parental_declarations is
  'Dichiarazione del genitore di essere titolare della responsabilità genitoriale per un bambino iscritto, e di autorizzare il trattamento dei suoi dati per l''uso del servizio. Il testo reale della dichiarazione è da validare legalmente (stesso gate di Termini/Privacy Notice) — NON introduce un consenso separato per il minore stesso (il minore non ha un account): è il genitore a dichiarare, non il bambino.';

alter table public.parental_declarations enable row level security;

drop policy if exists "Parental declarations: il genitore vede le proprie" on public.parental_declarations;
create policy "Parental declarations: il genitore vede le proprie"
  on public.parental_declarations for select
  using (auth.uid() = parent_user_id or public.is_platform_admin());

-- Un genitore può dichiarare SOLO per un bambino che è effettivamente il
-- proprio (verificato contro kids.parent_id, non solo contro auth.uid() =
-- parent_user_id) — impedisce a un utente autenticato di scrivere una
-- dichiarazione per un kid_id che non gli appartiene, anche se
-- indovinasse l'UUID.
drop policy if exists "Parental declarations: il genitore dichiara per i propri figli" on public.parental_declarations;
create policy "Parental declarations: il genitore dichiara per i propri figli"
  on public.parental_declarations for insert
  with check (
    auth.uid() = parent_user_id
    and exists (
      select 1 from public.kids
      where kids.id = kid_id and kids.parent_id = parent_user_id
    )
  );

create index if not exists idx_parental_declarations_parent_user_id on public.parental_declarations(parent_user_id);
create index if not exists idx_parental_declarations_kid_id on public.parental_declarations(kid_id);

-- ─────────────────────────────────────────────
-- 5) Cache di stato corrente su profiles (lettura O(1), nessun join)
-- ─────────────────────────────────────────────
--
-- SCOPERTA in fase di revisione v2 (verifica Supabase read-only,
-- 25/08/2026): `profiles.marketing_consent` ESISTE GIÀ in produzione —
-- introdotta da `migration_06_profilo_esteso_presenze.sql` (sprint Profilo
-- esteso, precedente e indipendente da questo lavoro Privacy/Termini), già
-- letta/scritta da `lib/data/profile.ts`/`app/actions/profile.ts`
-- (`updateMarketingConsentAction`, che la definisce esplicitamente "opt-in
-- commerciale... separato dalle preferenze notifiche funzionali" — la
-- separazione richiesta da Fabrizio ESISTE GIÀ, non va reinventata). v1 di
-- questa migrazione non lo sapeva e la includeva nell'`alter table` sotto
-- come se fosse nuova: `add column if not exists` l'avrebbe resa un no-op
-- silenzioso, ma il commento/l'intento dichiarato in v1 era comunque
-- fattualmente sbagliato. Colonna oggi: `boolean`, nullable, default
-- `false` (NON `not null` — discrepanza minore, fuori scope qui: cambiarla
-- richiederebbe un ALTER SET NOT NULL + backfill, decisione separata da
-- prendere con Fabrizio, non necessaria per sbloccare questo gate).
--
-- Di conseguenza, v2 aggiunge SOLO `marketing_consent_updated_at`
-- (verificata assente) come companion della colonna esistente — e
-- `consent_events` (tabella 3 sopra) diventa il registro storico DI QUESTA
-- colonna già esistente, non di un meccanismo nuovo.
--
-- Per tos_version/tos_accepted_at/privacy_notice_version/
-- privacy_notice_accepted_at: verificate assenti (nessuna riga nel
-- PRE-CHECK), genuinamente nuove. La SEMANTICA di
-- privacy_notice_accepted_at, a differenza di v1, è ora un puntatore di
-- comodo a legal_acceptances (accettazione immutabile), MAI un consenso
-- revocabile — vedi commento sulla colonna sotto.

alter table public.profiles
  add column if not exists tos_version text,
  add column if not exists tos_accepted_at timestamptz,
  add column if not exists privacy_notice_version text,
  add column if not exists privacy_notice_accepted_at timestamptz,
  add column if not exists marketing_consent_updated_at timestamptz;

comment on column public.profiles.privacy_notice_accepted_at is
  'Cache di comodo (O(1), nessun join) della più recente riga in legal_acceptances per document_type=privacy_notice. NON è un consenso revocabile: non esiste (e non deve mai esistere) un percorso applicativo che la imposti a NULL per "ritiro" — l''utente può solo accettare una versione nuova quando pubblicata.';

comment on column public.profiles.marketing_consent_updated_at is
  'Companion di profiles.marketing_consent (colonna PRE-ESISTENTE da migration_06, non introdotta qui). Da popolare quando updateMarketingConsentAction() (app/actions/profile.ts) verrà esteso per scrivere anche una riga in consent_events — wiring non ancora fatto, fuori scope per questo gate.';

-- Nessuna RLS nuova richiesta su queste colonne: vivono sulla riga
-- "profiles" già esistente, coperta dalla policy "un utente vede/modifica
-- il proprio profilo" (migration_22, verificata APPLICATA live il
-- 24/08/2026 — vedi Production Truth, Wave 1 #1).

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): blocchi di riferimento (pre-check, verifica, rollback), non
-- parte della migrazione automatica. Eseguiti a parte, manualmente.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA del blocco
-- begin;/commit; sopra. Solo lettura. Se una verifica di "eventuale
-- esistenza" restituisce righe inattese, FERMARSI e capire perché prima
-- di procedere.
-- ════════════════════════════════════════════════════════════════

-- 1. Esistenza di public.profiles e public.kids (dipendenze obbligatorie):
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('profiles', 'kids');
-- -- atteso: 2 righe.

-- 2. Esistenza di public.is_platform_admin() (usata da più policy sotto):
-- select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'is_platform_admin';
-- -- atteso: 1 riga.

-- 3. Eventuale esistenza delle 4 nuove tabelle (atteso: 0 righe, ambiente pulito):
-- select table_name from information_schema.tables
--   where table_schema = 'public'
--   and table_name in ('legal_documents', 'legal_acceptances', 'consent_events', 'parental_declarations');

-- 4. Eventuale esistenza delle colonne su profiles — VERIFICATO
--    25/08/2026 via query read-only reale: atteso 5 righe (tos_version,
--    tos_accepted_at, privacy_notice_version, privacy_notice_accepted_at,
--    marketing_consent_updated_at → 0 righe, genuinamente nuove) PIÙ 1
--    riga PRE-ESISTENTE (marketing_consent, da migration_06 — vedi nota
--    nella sezione 5 sopra). Se questa query restituisce PIÙ di 1 riga
--    (cioè marketing_consent non è l'unica preesistente), FERMARSI: lo
--    stato di produzione è cambiato rispetto a quanto verificato qui e va
--    capito perché prima di procedere.
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--   and (column_name like 'tos_%' or column_name like 'privacy_notice_%' or column_name like 'marketing_consent%');
-- -- atteso oggi (verificato): 1 riga, "marketing_consent" (pre-esistente).

-- 5. Nessuna riga preesistente in consent_events con consent_type diverso
--    da 'marketing' (rilevante SOLO se una v1 fosse già stata applicata in
--    un ambiente — non il caso oggi, verificato: nessuna delle 4 tabelle
--    esiste in produzione al 25/08/2026):
-- select distinct consent_type from public.consent_events;
-- -- atteso: 0 righe (tabella non esiste) o errore "relation does not exist".

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire DOPO il commit sopra, per confermare che la migrazione ha
-- fatto esattamente quello che doveva.
-- ════════════════════════════════════════════════════════════════

-- 1. Le 4 tabelle esistono con RLS abilitata:
-- select relname, relrowsecurity from pg_class
--   where relname in ('legal_documents', 'legal_acceptances', 'consent_events', 'parental_declarations');
-- -- atteso: 4 righe, relrowsecurity = true su tutte.

-- 2. Le 5 colonne nuove esistono su profiles (marketing_consent stessa
--    NON è tra queste: pre-esisteva già, vedi nota sezione 5):
-- select column_name, data_type, is_nullable from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--   and column_name in ('tos_version','tos_accepted_at','privacy_notice_version',
--                        'privacy_notice_accepted_at','marketing_consent_updated_at');
-- -- atteso: 5 righe.

-- 3. Integrità referenziale legal_acceptances → legal_documents (deve
--    fallire, prova negativa): da un utente autenticato reale, provare
--    select id from public.legal_documents limit 1; -- prendere un id ESISTENTE (o, se 0 righe, questo test non è eseguibile finché Fabrizio non pubblica almeno una versione)
--    insert into public.legal_acceptances (user_id, legal_document_id, source)
--      values (auth.uid(), '00000000-0000-0000-0000-000000000000', 'test');
-- -- atteso: errore di foreign key violation (l'UUID finto non esiste in legal_documents).

-- 4. Un genitore NON può dichiarare per un bambino che non è il proprio
--    (prova negativa, da un utente autenticato reale con almeno un kid_id
--    di un ALTRO genitore noto, es. per verifica incrociata Admin):
-- insert into public.parental_declarations (parent_user_id, kid_id, declaration_version)
--   values (auth.uid(), '<kid_id di un altro genitore>', 'v0-draft-2026-08-24');
-- -- atteso: 0 righe inserite, violazione della policy INSERT (WITH CHECK).

-- 5. consent_events rifiuta un consent_type diverso da 'marketing' (prova
--    negativa — verifica che l'incoerenza v1 sia stata davvero rimossa):
-- insert into public.consent_events (user_id, consent_type, action)
--   values (auth.uid(), 'terms', 'accepted');
-- -- atteso: errore di CHECK constraint violation (consent_type deve essere 'marketing').

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — eseguire come blocco separato, SOLO se questa migrazione va
-- annullata. Sicuro: nessuna query esistente nel prodotto referenzia
-- ancora queste tabelle/colonne (il wiring §5 del design doc non è stato
-- implementato), quindi il rollback non rompe alcun percorso applicativo
-- oggi in uso.
-- ════════════════════════════════════════════════════════════════

-- ATTENZIONE: NON droppare `marketing_consent` — è una colonna
-- PRE-ESISTENTE da migration_06, in uso da updateMarketingConsentAction()
-- (app/actions/profile.ts) ben prima e indipendentemente da questa
-- migrazione. Il rollback sotto tocca SOLO ciò che questa migrazione ha
-- introdotto.
--
-- begin;
-- drop table if exists public.parental_declarations;
-- drop table if exists public.consent_events;
-- drop table if exists public.legal_acceptances;
-- drop table if exists public.legal_documents;
-- alter table public.profiles
--   drop column if exists tos_version,
--   drop column if exists tos_accepted_at,
--   drop column if exists privacy_notice_version,
--   drop column if exists privacy_notice_accepted_at,
--   drop column if exists marketing_consent_updated_at;
-- commit;
