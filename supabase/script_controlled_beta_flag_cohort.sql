-- Script — TRAMA ONE Controlled Beta: da override globale a coorte scoped
-- (gate immediato richiesto prima di qualunque wiring di navigazione o
-- preparazione deploy per il Controlled Beta Experience gate).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, progetto eagsgfxunwyyxwwilldy.
--
-- Revisione 2 (2026-08-03) — corregge la Revisione 1 dopo il riscontro di
-- Fabrizio. Approvato: nome coorte 'trama-one-controlled-beta', durata 60
-- giorni, nessuna aggiunta di famiglie/centri pilot reali per ora. Le 5
-- correzioni di questa revisione sono elencate nella SEZIONE 0 sotto.
--
-- ════════════════════════════════════════════════════════════════
-- SEZIONE 0 — Cosa è cambiato in questa revisione e perché
-- ════════════════════════════════════════════════════════════════
--
-- (1) SCADENZE ESPLICITE. Nella Revisione 1, i due account di test avevano
-- scope='user' con expires_at=null "per non rompere TEST_SCOPE=all" — esatto
-- l'errore segnalato. Corretto: i due account di test NON hanno più un
-- override scope='user' dedicato. Sono invece arruolati come membri della
-- coorte 'trama-one-controlled-beta' stessa (beta_cohort_memberships),
-- con lo STESSO expires_at della coorte (60 giorni, non null). Motivo della
-- scelta "membership di coorte" invece di "override scope=user con scadenza
-- propria": beta_cohort_memberships supporta correttamente l'associazione
-- utente↔coorte (schema: user_id, cohort_key, active, expires_at — vedi
-- migration_08), quindi non serve un meccanismo parallelo; i due account
-- scadono insieme al pilot, con un solo posto da rinnovare (non due). Se fra
-- 60 giorni il pilot non viene esteso, tests/one/*.spec.ts tornerà a
-- fallire/skippare per questi due account: è una conseguenza INTENZIONALE
-- (niente più eccezioni permanenti nascoste), non un bug — da gestire
-- rinnovando la coorte quando serve, vedi nota in SEZIONE 2d.
--
-- (2) ACCESSO PLATFORM_ADMIN. Verificato leggendo il codice (non solo lo
-- schema): app/admin/one/layout.tsx chiama SOLO resolveFeatureFlag(), senza
-- alcun bypass strutturale per platform_admin. Il fatto che raggiungere
-- /admin/* richieda già platform_admin è un gate SEPARATO e PRECEDENTE
-- (autenticazione del portale Admin, indipendente da TRAMA_ONE_ENABLED) —
-- necessario ma non sufficiente: un platform_admin senza un override che lo
-- copra riceverebbe comunque redirect("/admin") dal layout /admin/one.
-- L'override scope='role'='platform_admin' NON è quindi un duplicato — resta
-- nello script, separato dalla coorte (SEZIONE 2c), con motivazione e stato
-- di scadenza dichiarati esplicitamente (vedi commento lì).
--
-- (3) OVERRIDE GLOBALE: DISABILITA invece di ELIMINARE. Lo schema lo
-- consente: l'unique index parziale idx_feature_flag_overrides_unique_global
-- vieta due righe 'global' per lo stesso flag, ma non impedisce di
-- aggiornare enabled/expires_at sulla riga esistente. Nessun conflitto di
-- unicità nell'usare UPDATE invece di DELETE. Corretto: la riga globale
-- viene disattivata (enabled=false, expires_at=now()) preservando id/
-- created_at/created_by per storia e audit, invece di essere eliminata.
-- Non esiste una colonna reason/metadata nello schema (migration_07): la
-- motivazione resta documentata qui nei commenti SQL, non in una colonna.
--
-- (4) ROLLBACK IN DUE BLOCCHI SEPARATI. La Revisione 1 aveva un solo
-- rollback che ripristinava la riga globale originale (enabled=true,
-- expires_at=null) — esattamente lo stato che questo script vuole correggere,
-- quindi pericoloso come "rollback di default". Corretto: SEZIONE 4
-- (ROLLBACK SICURO, quello da usare normalmente) NON riapre mai l'accesso
-- globale; SEZIONE 5 (RIPRISTINO STORICO DI EMERGENZA) resta disponibile ma
-- interamente commentata, separata, con avviso esplicito.
--
-- (5) VERIFICA DEL RESOLVER DAL CODICE (non solo dai nomi delle colonne).
-- Letto lib/feature-flags/evaluate.ts riga per riga:
--   - scope='cohort' è supportato: scopeMatchesContext() confronta
--     scope_value con context.cohortKeys (popolato da
--     getActiveCohortKeys(), che legge beta_cohort_memberships filtrando
--     active=true e non scaduto).
--   - scope='user' è supportato: confronto ESATTO (mai normalizzato,
--     scopeValue è un UUID).
--   - scope='role' è supportato: confronto normalizzato (lower/trim).
--   - expires_at è supportato: isExpired() tratta null come "mai scaduto",
--     una data non parsabile come "scaduto" (fail-safe), altrimenti scaduto
--     se <= now.
--   - PRECEDENZA REALE (SCOPE_PRECEDENCE in evaluate.ts, testuale dal
--     codice): user > role > cohort > tenant > environment > global.
--   - COMPORTAMENTO SU OVERRIDE SCADUTO: evaluateFlag() filtra PRIMA tutti
--     gli override in `applicable = overrides.filter(o => !isExpired(...)
--     && scopeMatchesContext(...))`, poi scorre SCOPE_PRECEDENCE e ritorna il
--     primo match rimasto. Un override scaduto (a QUALUNQUE scope, incluso
--     'global') è quindi rimosso dalla considerazione ancora prima del
--     controllo di precedenza — non "degrada" a un valore diverso, sparisce
--     dal calcolo. Se nessun override applicabile resta, il risultato è
--     definition.defaultValue = false per TRAMA_ONE_ENABLED (registry.ts).
--   - UTENTE ANONIMO: verificato in TUTTI E TRE i layout (app/one/
--     layout.tsx, app/center/one/layout.tsx, app/admin/one/layout.tsx) —
--     `if (!user) redirect("/auth/login")` avviene PRIMA di
--     resolveFeatureFlag(), quindi un utente anonimo non arriva mai alla
--     valutazione del flag: viene fermato dall'autenticazione, non dal
--     feature flag engine.
--
-- ════════════════════════════════════════════════════════════════
-- Contesto invariato dalla Revisione 1
-- ════════════════════════════════════════════════════════════════
-- Verificato in sola lettura il 2026-08-03: TRAMA_ONE_ENABLED aveva un
-- override scope_type='global', enabled=true, expires_at=null (id
-- 377b5a2a-e9f5-49cd-957a-ccecf187d64f, creato 2026-07-22, aggiornato
-- 2026-07-29). public.beta_cohort_memberships era (ed è, salvo modifiche nel
-- frattempo — riverificare col pre-check) completamente vuota.
--
-- Account reali verificati in sola lettura (NESSUNO inventato):
--   platform_admin        faberx83@gmail.com                  d4d80fd0-c893-401e-9578-050ee7fce2ba
--   parent di test         faberx83+test-genitore@gmail.com     e1787fd6-ffed-4d9f-aa06-4e1707c68d63
--   center_admin di test   faberx83+test-gestore@gmail.com      68cf46f3-6f3e-4e61-9f5b-532f25e09591
-- I due account "+test-..." sono TEST_PARENT_EMAIL/TEST_CENTER_ADMIN_EMAIL
-- in .env.test, usati dalla suite Playwright tests/one/*.spec.ts.
--
-- NESSUN centro pilot o famiglia pilot reale è arruolato in questa
-- revisione (approvato: "nessuna aggiunta per ora") — SEZIONE 2e resta un
-- placeholder commentato.


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 1 — PRE-CHECK (sola lettura — esegui e leggi PRIMA di procedere)
-- ════════════════════════════════════════════════════════════════

-- 1a. Tutti gli override TRAMA_ONE_ENABLED correnti.
select id, scope_type, scope_value, enabled, expires_at, created_at, updated_at
from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED'
order by scope_type, scope_value;

-- 1b. Beta cohort membership correnti (qualunque coorte).
select cohort_key, user_id, active, expires_at, created_at
from public.beta_cohort_memberships
order by cohort_key, created_at;

-- 1c. Verifica dei 3 account reali — se gli id non coincidono con quelli
-- scritti in questo file, usa gli id restituiti qui, non quelli hardcoded.
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

-- 2a. Disattiva (NON elimina) l'override globale permanente di
-- TRAMA_ONE_ENABLED. Preserva id/created_at/created_by per storia e audit.
-- WHERE doppio (flag_name + scope_type): nessun altro flag/scope toccato.
update public.feature_flag_overrides
set enabled = false,
    expires_at = now(),
    updated_at = now()
where flag_name = 'TRAMA_ONE_ENABLED'
  and scope_type = 'global';

-- 2b. Override scoped alla coorte Controlled Beta. Nome e durata approvati:
-- 'trama-one-controlled-beta', 60 giorni espliciti (non null).
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, expires_at)
values ('TRAMA_ONE_ENABLED', 'cohort', 'trama-one-controlled-beta', true, now() + interval '60 days')
on conflict (flag_name, scope_type, lower(trim(scope_value)))
  where scope_type not in ('global', 'user')
do update set enabled = excluded.enabled, expires_at = excluded.expires_at, updated_at = now();

-- 2c. Accesso team interno: scope='role'='platform_admin'. NON duplicato
-- (vedi SEZIONE 0, punto 2: nessun bypass strutturale trovato nel codice).
-- Separato dalla coorte per costruzione (scope diverso, riga diversa).
-- Concede accesso SOLO a chi ha profiles.role='platform_admin' (confronto
-- esatto normalizzato, verificato in evaluate.ts::scopeMatchesContext caso
-- 'role') — nessun altro ruolo ne beneficia.
-- SENZA scadenza: scelta deliberata, non un default. Motivazione operativa:
-- l'accesso del team interno alla piattaforma che amministra non deve
-- dipendere dalla durata di un pilot esterno (che ha una finestra di 60
-- giorni per costruzione); la popolazione è già controllata a monte da
-- profiles.role (assegnato solo da chi ha già accesso amministrativo al
-- database), quindi non è un'esposizione incontrollata. Se in futuro si
-- decide diversamente, aggiungere qui un expires_at esplicito.
insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, expires_at)
values ('TRAMA_ONE_ENABLED', 'role', 'platform_admin', true, null)
on conflict (flag_name, scope_type, lower(trim(scope_value)))
  where scope_type not in ('global', 'user')
do update set enabled = excluded.enabled, expires_at = excluded.expires_at, updated_at = now();

-- 2d. Account di test tests/one/*.spec.ts — arruolati nella coorte stessa
-- (NON un override scope='user' separato — vedi SEZIONE 0, punto 1 per il
-- perché). Stessa scadenza della coorte: 60 giorni, esplicita, non null.
-- Sostituisci gli UUID se la query 1c ne ha restituiti di diversi.
insert into public.beta_cohort_memberships (user_id, cohort_key, active, expires_at)
values
  ('e1787fd6-ffed-4d9f-aa06-4e1707c68d63', 'trama-one-controlled-beta', true, now() + interval '60 days'), -- TEST_PARENT_EMAIL
  ('68cf46f3-6f3e-4e61-9f5b-532f25e09591', 'trama-one-controlled-beta', true, now() + interval '60 days')  -- TEST_CENTER_ADMIN_EMAIL
on conflict (user_id, cohort_key) do update set active = excluded.active, expires_at = excluded.expires_at;

-- 2e. Membership pilot reale (centri/famiglie). APPROVATO: nessuna
-- aggiunta per ora. Nessuna riga inserita in questa sezione — placeholder
-- per quando Fabrizio deciderà i centri/famiglie pilot reali:
--
-- insert into public.beta_cohort_memberships (user_id, cohort_key, active, expires_at)
-- values ('<uuid-reale>', 'trama-one-controlled-beta', true, now() + interval '60 days');

commit;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 3 — POST-CHECK (sola lettura — esegui subito dopo il commit)
-- ════════════════════════════════════════════════════════════════

-- 3a. Stato atteso: 1 riga 'global' con enabled=false; 1 riga 'cohort'
-- (trama-one-controlled-beta, expires_at ~60gg); 1 riga 'role'
-- (platform_admin, expires_at null). ZERO righe 'user' per questo flag
-- (i test account ora passano dalla coorte, non da uno scope 'user').
select
  id, scope_type, scope_value, enabled, expires_at,
  (expires_at is not null and expires_at <= now()) as scaduto_ora
from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED'
order by scope_type, scope_value;

-- 3b. Stato atteso: 3 righe nella coorte 'trama-one-controlled-beta' —
-- platform_admin (expires_at null) + i 2 account di test (expires_at
-- ~60gg) — più le eventuali righe pilot reali aggiunte in 2e.
select
  cohort_key, user_id, active, expires_at,
  (expires_at is not null and expires_at <= now()) as scaduta_ora
from public.beta_cohort_memberships
where cohort_key = 'trama-one-controlled-beta'
order by created_at;

-- 3c. Nessun altro flag_name toccato da questo script (confronta col
-- conteggio della query 1a).
select flag_name, count(*) as n_overrides
from public.feature_flag_overrides
group by flag_name
order by flag_name;

-- 3d. Traccia per persona: per ciascuno dei 3 account reali, elenca TUTTI
-- gli override candidati (non scaduti) applicabili al suo contesto
-- (role/cohort). Questo NON è il calcolo finale di evaluateFlag() (che vive
-- in TypeScript, non in SQL) — è una lista di candidati. Il valore
-- applicato realmente è il PRIMO che compare, tra questi, nell'ordine di
-- precedenza user > role > cohort > tenant > environment > global (vedi
-- SEZIONE 0, punto 5). Usa questa query per ragionare, poi conferma col
-- checklist runtime sotto (3e) — è l'unico modo per verificare anche il
-- gate di autenticazione, che non vive nel database.
select
  p.email,
  p.role,
  ffo.scope_type,
  ffo.scope_value,
  ffo.enabled,
  ffo.expires_at,
  (ffo.expires_at is null or ffo.expires_at > now()) as applicabile_ora
from public.profiles p
cross join public.feature_flag_overrides ffo
where p.email in ('faberx83@gmail.com', 'faberx83+test-genitore@gmail.com', 'faberx83+test-gestore@gmail.com')
  and ffo.flag_name = 'TRAMA_ONE_ENABLED'
  and (
    ffo.scope_type = 'global'
    or (ffo.scope_type = 'role' and lower(trim(ffo.scope_value)) = lower(trim(p.role)))
    or (ffo.scope_type = 'cohort' and exists (
          select 1 from public.beta_cohort_memberships bcm
          where bcm.user_id = p.id
            and bcm.active
            and lower(trim(bcm.cohort_key)) = lower(trim(ffo.scope_value))
            and (bcm.expires_at is null or bcm.expires_at > now())
        ))
  )
order by p.email, ffo.scope_type;

-- 3e. CHECKLIST RUNTIME (da eseguire nel browser/Playwright dopo il deploy
-- — copre anche il gate di autenticazione, che non vive nel database):
--   1. platform_admin (faberx83@gmail.com) su /admin/one       -> accesso concesso (override 'role').
--   2. account test Parent (+test-genitore) su /one            -> accesso concesso e TEMPORANEO (scade con la coorte, ~60gg).
--   3. account test Partner (+test-gestore) su /center/one     -> accesso concesso e TEMPORANEO (scade con la coorte, ~60gg).
--   4. un utente autenticato reale QUALSIASI non elencato sopra -> accesso negato, redirect al fallback Legacy/NextGen esistente (nessun override applicabile -> defaultValue=false).
--   5. utente anonimo (nessuna sessione) su /one, /center/one o /admin/one -> redirect a /auth/login PRIMA di qualunque valutazione del flag (verificato nel codice dei 3 layout, non richiede DB).
--   6. dopo i 60 giorni (o con un override temporaneamente forzato a expires_at=now() per un test anticipato) -> l'account di test scaduto perde l'accesso, nessun redirect anomalo, nessun errore visibile (fail-safe invariato).


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 4 — ROLLBACK SICURO (default — usa questo se serve tornare
-- indietro). NON riapre mai l'accesso globale.
-- ════════════════════════════════════════════════════════════════

begin;

-- Disattiva la coorte pilot (non elimina la riga, stesso principio di
-- preservare storia/audit usato in 2a).
update public.feature_flag_overrides
set enabled = false, updated_at = now()
where flag_name = 'TRAMA_ONE_ENABLED'
  and scope_type = 'cohort'
  and scope_value = 'trama-one-controlled-beta';

-- Rimuove SOLO le membership create da questo script (i 2 account di test).
-- Se sono state aggiunte righe pilot reali in 2e, valuta se disattivarle
-- (active=false) invece di eliminarle, a seconda del motivo del rollback.
delete from public.beta_cohort_memberships
where cohort_key = 'trama-one-controlled-beta'
  and user_id in (
    'e1787fd6-ffed-4d9f-aa06-4e1707c68d63', -- TEST_PARENT_EMAIL
    '68cf46f3-6f3e-4e61-9f5b-532f25e09591'  -- TEST_CENTER_ADMIN_EMAIL
  );

-- L'override globale RESTA disabilitato (non viene toccato qui: era già
-- enabled=false da 2a). L'override 'role'='platform_admin' RESTA come da
-- policy verificata (SEZIONE 0, punto 2) — un rollback del pilot non deve
-- rimuovere l'accesso interno già dichiarato intenzionale. Se invece si
-- vuole rimuovere anche quello, farlo esplicitamente e separatamente:
--
-- update public.feature_flag_overrides set enabled = false, updated_at = now()
-- where flag_name = 'TRAMA_ONE_ENABLED' and scope_type = 'role' and scope_value = 'platform_admin';

commit;

-- Risultato di questo rollback: TRAMA ONE torna chiuso per chiunque non sia
-- platform_admin — stato "spento per il pubblico", MAI "riaperto a tutti".


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 5 — RIPRISTINO STORICO DI EMERGENZA (NON ESEGUIRE NORMALMENTE)
-- ════════════════════════════════════════════════════════════════
--
-- ATTENZIONE: QUESTO BLOCCO RIABILITA TRAMA ONE GLOBALMENTE A TUTTI GLI
-- UTENTI CHE CONOSCONO LE ROUTE. Non è un rollback standard — è il
-- ripristino esatto dello stato di produzione precedente a QUESTO script
-- (override globale permanente, enabled=true, expires_at=null), lo stesso
-- stato che questo intero gate esiste per correggere. Usalo SOLO se hai una
-- ragione operativa specifica per tornare esattamente lì (es. un blocco
-- totale del Controlled Beta engine che impedisce l'accesso anche
-- all'Admin, e serve un accesso di emergenza immediato senza passare dalla
-- coorte). In ogni altro caso usa la SEZIONE 4 sopra.
--
-- begin;
--
-- delete from public.feature_flag_overrides
-- where flag_name = 'TRAMA_ONE_ENABLED'
--   and scope_type in ('cohort', 'role');
--
-- delete from public.beta_cohort_memberships
-- where cohort_key = 'trama-one-controlled-beta';
--
-- insert into public.feature_flag_overrides
--   (id, flag_name, scope_type, scope_value, enabled, expires_at, created_by, updated_by, created_at, updated_at)
-- values
--   ('377b5a2a-e9f5-49cd-957a-ccecf187d64f', 'TRAMA_ONE_ENABLED', 'global', null, true, null, null, null,
--    '2026-07-22 09:41:57.238372+00', '2026-07-29 13:35:34.596538+00')
-- on conflict (id) do update set
--   enabled = true, expires_at = null, updated_at = now();
--
-- commit;
