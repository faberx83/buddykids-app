-- Script — TRAMA ONE Controlled Beta: da override globale a coorte scoped
-- (gate immediato richiesto prima di qualunque wiring di navigazione o
-- preparazione deploy per il Controlled Beta Experience gate).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, progetto eagsgfxunwyyxwwilldy.
--
-- ════════════════════════════════════════════════════════════════
-- Cosa fa e perché
-- ════════════════════════════════════════════════════════════════
-- Verificato in sola lettura (MCP Supabase, read-only) il 2026-08-03:
-- `TRAMA_ONE_ENABLED` ha un override `scope_type='global'`, `enabled=true`,
-- `expires_at=null` (id 377b5a2a-e9f5-49cd-957a-ccecf187d64f, creato
-- 2026-07-22, aggiornato 2026-07-29). Questo rende /one, /center/one,
-- /admin/one raggiungibili da CHIUNQUE in produzione, non solo dalla coorte
-- Controlled Beta — incompatibile con questo gate.
--
-- `public.beta_cohort_memberships` è oggi completamente vuota (0 righe,
-- verificato) — nessuna coorte pre-esistente da riusare. Questo script crea
-- la coorte `trama-one-controlled-beta` (nome proposto, come richiesto,
-- perché nessun nome esistente è stato trovato).
--
-- Account reali verificati in sola lettura da preservare (NESSUNO inventato):
--   platform_admin        faberx83@gmail.com                  d4d80fd0-c893-401e-9578-050ee7fce2ba
--   parent di test        faberx83+test-genitore@gmail.com     e1787fd6-ffed-4d9f-aa06-4e1707c68d63
--   center_admin di test   faberx83+test-gestore@gmail.com      68cf46f3-6f3e-4e61-9f5b-532f25e09591
-- I due account "+test-..." sono esattamente TEST_PARENT_EMAIL e
-- TEST_CENTER_ADMIN_EMAIL in .env.test, usati dalla suite Playwright
-- tests/one/*.spec.ts: se restassero fuori dalla nuova policy, il prossimo
-- TEST_SCOPE=all romperebbe l'intera suite TRAMA ONE per redirect (flag
-- risolto a false per quei ruoli) — un falso negativo, non un bug reale.
-- Vanno quindi preservati esplicitamente (scope 'user', §2c sotto).
--
-- NESSUN centro pilot o famiglia pilot reale (oltre agli account sopra) è
-- stato identificato nel database: 0 righe pre-esistenti in
-- beta_cohort_memberships, nessun'altra evidenza di selezione pilot. La
-- SEZIONE 2e sotto contiene quindi SOLO l'account platform_admin come membro
-- della coorte (in aggiunta al suo accesso già garantito via scope 'role' al
-- punto 2c) — la scelta dei centri/famiglie pilot reali da arruolare resta
-- una decisione di Fabrizio da completare a mano in quella sezione, con gli
-- UUID reali (vedi query 1c per come trovarli).
--
-- Precedenza di risoluzione del Feature Flag Engine (invariata, vedi
-- lib/feature-flags/evaluate.ts::SCOPE_PRECEDENCE): user > role > cohort >
-- tenant > environment > global. Per questo gli account "sempre dentro"
-- (interni, test) usano scope 'user'/'role' — vincono comunque sulla coorte,
-- che resta il meccanismo per il pilot vero e proprio.
--
-- Scelta deliberata su expires_at: la riga 'cohort' (il pilot vero) ha una
-- scadenza esplicita (60 giorni, modificabile). Le righe 'role'/'user'
-- (team interno + account di test CI) NON hanno scadenza: un accesso interno
-- o di test che scade silenziosamente è esattamente il bug già corretto in
-- DEC-48/TC-N409 (override scaduto non rilevato) — qui la scelta è
-- deliberata e dichiarata, non un'omissione.
--
-- ════════════════════════════════════════════════════════════════
-- SEZIONE 1 — PRE-CHECK (sola lettura — esegui e leggi PRIMA di procedere)
-- ════════════════════════════════════════════════════════════════

-- 1a. Tutti gli override TRAMA_ONE_ENABLED correnti.
select id, scope_type, scope_value, enabled, expires_at, created_at, updated_at
from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED'
order by scope_type, scope_value;

-- 1b. Beta cohort membership correnti (qualunque coorte, non solo quella
-- proposta — per essere sicuri di non calpestare qualcosa che non conosco).
select cohort_key, user_id, active, expires_at, created_at
from public.beta_cohort_memberships
order by cohort_key, created_at;

-- 1c. Verifica dei 3 account reali citati sopra — se gli id non coincidono
-- con quelli scritti in questo file (es. account ricreato), usa gli id
-- restituiti qui, non quelli hardcoded più sotto.
select id, email, role
from public.profiles
where email in (
  'faberx83@gmail.com',
  'faberx83+test-genitore@gmail.com',
  'faberx83+test-gestore@gmail.com'
)
order by email;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 2 — CORREZIONE (blocco transazionale: tutto o niente)
-- ════════════════════════════════════════════════════════════════

begin;

-- 2a. Elimina ESCLUSIVAMENTE l'override globale permanente di
-- TRAMA_ONE_ENABLED. Nessun altro flag_name, nessun altro scope_type viene
-- toccato da questa istruzione (WHERE doppio: flag_name + scope_type).
delete from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED'
  and scope_type = 'global';

-- 2b. Override scoped alla coorte Controlled Beta. Se preferisci un nome
-- diverso da 'trama-one-controlled-beta', sostituiscilo QUI e in TUTTE le
-- righe beta_cohort_memberships della sezione 2e (deve essere identico).
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, expires_at)
values ('TRAMA_ONE_ENABLED', 'cohort', 'trama-one-controlled-beta', true, now() + interval '60 days')
on conflict (flag_name, scope_type, lower(trim(scope_value)))
  where scope_type not in ('global', 'user')
do update set enabled = excluded.enabled, expires_at = excluded.expires_at, updated_at = now();

-- 2c. Accesso permanente per il team interno: scope 'role' su
-- platform_admin (chiunque abbia/ottenga questo ruolo resta dentro, senza
-- dover enumerare singoli account). Nessuna scadenza (vedi nota sopra).
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, expires_at)
values ('TRAMA_ONE_ENABLED', 'role', 'platform_admin', true, null)
on conflict (flag_name, scope_type, lower(trim(scope_value)))
  where scope_type not in ('global', 'user')
do update set enabled = excluded.enabled, expires_at = excluded.expires_at, updated_at = now();

-- 2d. Account di test della suite Playwright tests/one/*.spec.ts (scope
-- 'user', confronto ESATTO per UUID — mai normalizzato, vedi migration_07).
-- Sostituisci gli UUID se la query 1c ne ha restituiti di diversi.
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, expires_at)
values
  ('TRAMA_ONE_ENABLED', 'user', 'e1787fd6-ffed-4d9f-aa06-4e1707c68d63', true, null), -- TEST_PARENT_EMAIL (faberx83+test-genitore@gmail.com)
  ('TRAMA_ONE_ENABLED', 'user', '68cf46f3-6f3e-4e61-9f5b-532f25e09591', true, null)  -- TEST_CENTER_ADMIN_EMAIL (faberx83+test-gestore@gmail.com)
on conflict (flag_name, scope_value)
  where scope_type = 'user'
do update set enabled = excluded.enabled, expires_at = excluded.expires_at, updated_at = now();

-- 2e. Membership reale della coorte 'trama-one-controlled-beta'.
-- Riga già verificata (platform_admin, come membro esplicito della coorte
-- oltre al suo accesso via scope 'role' al punto 2c):
insert into public.beta_cohort_memberships (user_id, cohort_key, active, expires_at)
values ('d4d80fd0-c893-401e-9578-050ee7fce2ba', 'trama-one-controlled-beta', true, null)
on conflict (user_id, cohort_key) do update set active = excluded.active, expires_at = excluded.expires_at;

-- ATTENZIONE — SEZIONE DA COMPLETARE TU: nessun centro pilot o famiglia
-- pilot reale è stato identificato in questo database (0 righe
-- pre-esistenti). Aggiungi qui una riga per OGNI account reale (center_admin
-- o parent) che decidi di includere nel pilot, con il suo UUID reale da
-- public.profiles (usa una query come 1c, sostituendo l'email):
--
-- insert into public.beta_cohort_memberships (user_id, cohort_key, active, expires_at)
-- values ('<uuid-reale-1>', 'trama-one-controlled-beta', true, now() + interval '60 days');
-- insert into public.beta_cohort_memberships (user_id, cohort_key, active, expires_at)
-- values ('<uuid-reale-2>', 'trama-one-controlled-beta', true, now() + interval '60 days');

commit;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 3 — POST-CHECK (sola lettura — esegui subito dopo il commit)
-- ════════════════════════════════════════════════════════════════

-- 3a. Deve restare ZERO righe 'global'. Deve comparire 1 riga 'cohort'
-- (con expires_at valorizzato), 1 riga 'role' (platform_admin, expires_at
-- null), 2 righe 'user' (i due account di test, expires_at null) — più le
-- eventuali righe 'cohort'/altre aggiunte da te.
select id, scope_type, scope_value, enabled, expires_at
from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED'
order by scope_type, scope_value;

-- 3b. Deve mostrare almeno l'account platform_admin nella coorte, più
-- ogni riga pilot che hai aggiunto in 2e.
select cohort_key, user_id, active, expires_at
from public.beta_cohort_memberships
where cohort_key = 'trama-one-controlled-beta'
order by created_at;

-- 3c. Nessun altro flag_name deve risultare toccato da questo script
-- (confronta il conteggio con quello che avevi prima, sezione 1a per gli
-- altri flag_name eventualmente presenti).
select flag_name, count(*) as n_overrides
from public.feature_flag_overrides
group by flag_name
order by flag_name;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 4 — ROLLBACK IMMEDIATO (esegui SOLO se serve tornare allo stato
-- precedente: flag globale permanente di nuovo attivo per chiunque)
-- ════════════════════════════════════════════════════════════════

begin;

delete from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED'
  and scope_type in ('cohort', 'role', 'user');

delete from public.beta_cohort_memberships
where cohort_key = 'trama-one-controlled-beta';

-- Ripristina ESATTAMENTE la riga globale originale (stesso id/timestamp
-- verificati in sola lettura prima di questo script).
insert into public.feature_flag_overrides
  (id, flag_name, scope_type, scope_value, enabled, expires_at, created_by, updated_by, created_at, updated_at)
values
  ('377b5a2a-e9f5-49cd-957a-ccecf187d64f', 'TRAMA_ONE_ENABLED', 'global', null, true, null, null, null,
   '2026-07-22 09:41:57.238372+00', '2026-07-29 13:35:34.596538+00');

commit;
