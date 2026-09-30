-- ═════════════════════════════════════════════════════════════════════════
-- TRAMA — School Calendar: municipal (comune) scoping — MIGRATION FINALE
-- ═════════════════════════════════════════════════════════════════════════
-- PREPARATA da Claude. NON APPLICATA. Governance: Claude non applica mai
-- migration. Fabrizio la esegue su Supabase (SQL Editor o psql) solo dopo
-- revisione ed esplicita approvazione.
--
-- SOSTITUISCE PART_D2_migration_proposed_comune_scope.sql: stessa colonna,
-- stesso indice, stesso constraint — SOLO la sintassi del constraint è
-- stata corretta (vedi FIX sotto). Nessun'altra modifica di sostanza.
--
-- FIX rispetto alla versione precedente: "ALTER TABLE ... ADD CONSTRAINT
-- IF NOT EXISTS ..." NON è sintassi valida in PostgreSQL — PostgreSQL (a
-- qualunque versione, incluse tutte quelle usate da Supabase, oggi su
-- Postgres 15/17) non supporta IF NOT EXISTS per ADD CONSTRAINT, solo per
-- ADD COLUMN/CREATE INDEX/CREATE TABLE. L'idempotenza per un constraint va
-- ottenuta con un blocco procedurale DO $$ ... $$ che verifica prima
-- l'esistenza in pg_constraint — costrutto PL/pgSQL standard, supportato da
-- qualunque versione di Postgres usata da Supabase (verificato contro la
-- documentazione ufficiale Postgres: ALTER TABLE non espone IF NOT EXISTS
-- per ADD CONSTRAINT in nessuna versione stabile ad oggi).
--
-- PERCHÉ SERVE (vedi SCHOOL CALENDAR FINAL MODEL AUDIT nel report sessione):
-- school_calendar_events oggi eredita SOLO lo scope di school_calendars
-- (country, region, school_year) — nessuna colonna per rappresentare un
-- evento specifico di un singolo comune (es. Sant'Ambrogio a Milano,
-- Carnevale Ambrosiano). kid_school_profiles.comune esiste già (colonna
-- opzionale) ma non è mai stato collegato a un meccanismo di eventi
-- comunali — resta oggi un campo scritto ma mai letto dalla logica di
-- chiusura (verificato leggendo lib/data/school-calendar.ts prima di questa
-- correzione).
--
-- SOLUZIONE MINIMA SCELTA (la più additiva possibile): una sola colonna
-- nullable su school_calendar_events. NULL = evento regionale (baseline,
-- si applica a chiunque abbia quella region, comportamento IDENTICO a
-- oggi). Valorizzata = evento locale, si applica SOLO ai bambini il cui
-- kid_school_profiles.comune corrisponde (match normalizzato via
-- normalizeComuneKey(), vedi lib/school-calendar/comune.ts — il valore in
-- colonna resta il testo originale, es. "Milano", MAI riscritto in
-- lowercase).
--
-- Alternative scartate e perché:
--   - Una riga school_calendars separata "per comune" (es. region='Milano')
--     romperebbe la semantica di region (usata anche altrove — es.
--     ITALIAN_REGIONS in lib/school-calendar/regions.ts) e duplicherebbe
--     l'intera baseline regionale per ogni comune con anche un solo evento
--     locale.
--   - Riusare school_calendar_overrides: SCARTATO per istruzione esplicita
--     (quella tabella è family+week-level, "already_organized"/"not_needed",
--     una dichiarazione del GENITORE — non un dato di calendario pubblico).
-- ═════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- PRE-CHECK — eseguire PRIMA della migration e leggere l'esito
-- ─────────────────────────────────────────────────────────────────────────

-- 1) La colonna "comune" non esiste già (atteso: 0 righe):
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'school_calendar_events' and column_name = 'comune';

-- 2) Quante righe esistono oggi in school_calendar_events (impatto atteso:
--    0 o poche — nessun dato reale è mai stato inserito da questa sessione):
select count(*) as righe_esistenti from public.school_calendar_events;

-- 3) Il constraint non esiste già (atteso: 0 righe):
select conname
from pg_constraint
where conname = 'chk_boundary_events_region_only'
  and conrelid = 'public.school_calendar_events'::regclass;

-- 4) L'indice non esiste già (atteso: 0 righe):
select indexname
from pg_indexes
where schemaname = 'public' and tablename = 'school_calendar_events' and indexname = 'idx_school_calendar_events_comune';


-- ─────────────────────────────────────────────────────────────────────────
-- MIGRATION — additiva, backward compatible, nessuna riga esistente toccata
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Colonna nullable — IF NOT EXISTS è sintassi VALIDA qui (ADD COLUMN la
--    supporta dalla 9.6 in poi).
alter table public.school_calendar_events
  add column if not exists comune text;

comment on column public.school_calendar_events.comune is
  'NULL = evento a livello di intera regione (baseline regionale, comportamento invariato rispetto a prima di questa colonna). Se valorizzato: evento locale specifico di QUESTO comune — si applica SOLO ai bambini il cui kid_school_profiles.comune corrisponde (match normalizzato via normalizeComuneKey() a livello applicativo: trim + spazi collassati + lowercase; il valore qui resta il testo originale digitato in Admin, es. "Milano", mai riscritto). Default NULL: un evento inserito senza specificare comune resta regionale per costruzione (fail-safe).';

-- 2) Indice parziale — IF NOT EXISTS è sintassi VALIDA qui (CREATE INDEX la
--    supporta da sempre). Utile solo per gli eventi locali (la maggioranza
--    delle righe, quelle regionali, non lo usano mai in questa query).
create index if not exists idx_school_calendar_events_comune
  on public.school_calendar_events(calendar_id, comune)
  where comune is not null;

-- 3) Constraint opzionale (consigliata, separabile senza impatto sul resto):
--    i marcatori di confine anno scolastico (school_year_start/
--    school_year_end) restano SOLO regionali in questo V1 —
--    lib/school-calendar/need-core.ts#deriveSummerIntervals non ha alcuna
--    nozione di comune, quindi un marcatore di confine "locale" non
--    avrebbe oggi alcun effetto diverso da uno regionale, solo la
--    possibilità di inserirlo per errore. Questo vincolo lo impedisce
--    esplicitamente a livello di schema.
--    FIX: "ADD CONSTRAINT IF NOT EXISTS" NON è sintassi Postgres valida —
--    sostituito con un blocco DO $$ idempotente che verifica pg_constraint
--    prima di aggiungere il vincolo (costrutto PL/pgSQL standard,
--    supportato da qualunque versione Postgres usata da Supabase).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_boundary_events_region_only'
      and conrelid = 'public.school_calendar_events'::regclass
  ) then
    alter table public.school_calendar_events
      add constraint chk_boundary_events_region_only
      check (
        event_type not in ('school_year_start', 'school_year_end')
        or comune is null
      );
  end if;
end
$$;

-- RLS: NESSUNA modifica necessaria. Le policy esistenti (vedi
-- migration_26_school_calendar_intelligence.sql) sono row-level, non
-- column-level:
--   - SELECT: "il calendario padre è published" (non fa riferimento a
--     nessuna colonna specifica dell'evento, quindi si applica identica
--     anche alla nuova colonna comune).
--   - ALL: "solo l'Admin" (is_platform_admin()), stesso ragionamento.
-- Verificato leggendo le policy esistenti — nessun ALTER POLICY qui.


-- ─────────────────────────────────────────────────────────────────────────
-- POST-CHECK — eseguire DOPO l'applicazione
-- ─────────────────────────────────────────────────────────────────────────

-- 1) La colonna esiste, è nullable, nessun default diverso da NULL:
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'school_calendar_events' and column_name = 'comune';
-- atteso: 1 riga — data_type='text', is_nullable='YES', column_default=null

-- 2) Le righe esistenti (se presenti) restano tutte comune IS NULL —
--    nessuna riscritta a sorpresa:
select count(*) as righe_totali, count(comune) as righe_con_comune
from public.school_calendar_events;
-- atteso: righe_con_comune = 0 finché non si eseguono i nuovi insert
-- (vedi PART_D2_data_regional_and_milano_2026_2027.sql)

-- 3) L'indice esiste:
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'school_calendar_events' and indexname = 'idx_school_calendar_events_comune';
-- atteso: 1 riga

-- 4) Il constraint esiste ed è attivo:
select conname, pg_get_constraintdef(oid) as definizione
from pg_constraint
where conname = 'chk_boundary_events_region_only'
  and conrelid = 'public.school_calendar_events'::regclass;
-- atteso: 1 riga, definizione = "CHECK (((event_type)::text <> ALL (ARRAY['school_year_start'::text, 'school_year_end'::text])) OR (comune IS NULL))"

-- 5) Verifica funzionale del constraint (NON eseguire in produzione, solo
--    in un ambiente isolato/di test — deve fallire per violazione):
-- insert into public.school_calendar_events (calendar_id, start_date, end_date, event_type, label, comune)
-- values ('00000000-0000-0000-0000-000000000000', '2026-09-01', '2026-09-01', 'school_year_start', 'test', 'Milano');
-- -- atteso: errore "new row for relation ... violates check constraint chk_boundary_events_region_only"


-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK — da eseguire manualmente solo se necessario, mai automatico.
-- Ordine inverso (constraint -> indice -> colonna): un DROP COLUMN
-- rimuoverebbe comunque anche indice/constraint automaticamente in
-- PostgreSQL, ma l'ordine esplicito rende il rollback leggibile e
-- verificabile passo-passo.
-- ─────────────────────────────────────────────────────────────────────────

-- alter table public.school_calendar_events drop constraint if exists chk_boundary_events_region_only;
-- drop index if exists idx_school_calendar_events_comune;
-- alter table public.school_calendar_events drop column if exists comune;
-- (Il rollback della colonna è sicuro anche con righe già inserite: essendo
-- additiva e mai referenziata da foreign key, la DROP COLUMN non impatta
-- nessun'altra tabella. Le eventuali righe locali (comune valorizzato)
-- perderebbero però quell'informazione — verificare di non avere ancora
-- bisogno dei dati locali prima di eseguire il rollback.)
