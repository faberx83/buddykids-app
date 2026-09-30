-- ═════════════════════════════════════════════════════════════════════════
-- TRAMA — School Calendar: municipal (comune) scoping — MIGRATION PROPOSTA
-- ═════════════════════════════════════════════════════════════════════════
-- PREPARATA da Claude (PART D — correzione modello dominio, 15/09/2026).
-- NON APPLICATA. Governance: Claude non applica mai migration. Fabrizio la
-- esegue su Supabase (SQL Editor o psql) solo dopo revisione ed esplicita
-- approvazione.
--
-- PERCHÉ SERVE (vedi SCHOOL CALENDAR FINAL MODEL AUDIT nel report sessione):
-- school_calendar_events oggi eredita SOLO lo scope di school_calendars
-- (country, region, school_year) — nessuna colonna per rappresentare un
-- evento specifico di un singolo comune (es. Sant'Ambrogio a Milano,
-- Carnevale Ambrosiano). kid_school_profiles.comune esiste già (colonna
-- opzionale, commento originale in migration_26: "solo per chiusure/ponti
-- locali") ma NON è mai stato collegato a un meccanismo di eventi comunali —
-- resta oggi un campo scritto ma mai letto dalla logica di chiusura
-- (verificato leggendo lib/data/school-calendar.ts).
--
-- SOLUZIONE MINIMA SCELTA (Opzione B, la più additiva possibile): una sola
-- colonna nullable su school_calendar_events. NULL = evento regionale
-- (baseline, si applica a chiunque abbia quella region, comportamento
-- IDENTICO a oggi). Valorizzata = evento locale, si applica SOLO ai bambini
-- il cui kid_school_profiles.comune corrisponde esattamente.
--
-- Alternative scartate e perché:
--   - Una riga school_calendars separata "per comune" (es. region='Milano')
--     romperebbe la semantica di region (che deve restare una vera regione
--     italiana, usata anche altrove — es. ITALIAN_REGIONS in
--     lib/school-calendar/regions.ts) e duplicherebbe l'intera baseline
--     regionale per ogni comune che avesse anche un solo evento locale.
--   - Riusare school_calendar_overrides: SCARTATO per istruzione esplicita
--     (quella tabella è family+week-level, "already_organized"/"not_needed",
--     una dichiarazione del GENITORE — non un dato di calendario pubblico.
--     Sovrascriverne la semantica per fingere eventi comunali cambierebbe il
--     significato di una tabella già in produzione, per famiglie che la
--     usano già per un fine diverso).
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- PRE-CHECK — verificare PRIMA di applicare (eseguire e leggere l'esito)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) La colonna non esiste già (deve tornare 0 righe):
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'school_calendar_events' and column_name = 'comune';

-- 2) Quante righe esistono oggi in school_calendar_events (per capire
--    l'impatto — atteso 0 o poche, nessun dato reale è mai stato inserito
--    da questa sessione):
-- select count(*) from public.school_calendar_events;


-- ─────────────────────────────────────────────────────────────────────────
-- MIGRATION — additiva, backward compatible, nessuna riga esistente toccata
-- ─────────────────────────────────────────────────────────────────────────

alter table public.school_calendar_events
  add column if not exists comune text;

comment on column public.school_calendar_events.comune is
  'NULL = evento a livello di intera regione (baseline regionale, comportamento invariato rispetto a prima di questa colonna). Se valorizzato: evento locale specifico di QUESTO comune — si applica SOLO ai bambini il cui kid_school_profiles.comune corrisponde esattamente (match testuale, stessa stringa già scritta in kid_school_profiles.comune, es. ''Milano''). Default NULL: un evento inserito senza specificare comune resta regionale per costruzione (fail-safe, coerente con "un flag non dichiarato non è mai promuovibile" già seguito altrove nel repository).';

-- Indice parziale: utile solo per gli eventi locali (la maggioranza delle
-- righe, quelle regionali, non lo usano mai in questa query).
create index if not exists idx_school_calendar_events_comune
  on public.school_calendar_events(calendar_id, comune)
  where comune is not null;

-- OPZIONALE, CONSIGLIATA ma separabile (Fabrizio può ometterla senza
-- impatto sul resto): i marcatori di confine anno scolastico
-- (school_year_start/school_year_end) restano SOLO regionali in questo V1
-- — lib/school-calendar/need-core.ts#deriveSummerIntervals non ha alcuna
-- nozione di comune, quindi un marcatore di confine "locale" non avrebbe
-- oggi alcun effetto diverso da uno regionale, solo la possibilità di
-- inserirlo per errore. Questo vincolo lo impedisce esplicitamente a
-- livello di schema invece di fidarsi solo della disciplina applicativa.
alter table public.school_calendar_events
  add constraint if not exists chk_boundary_events_region_only
  check (event_type not in ('school_year_start', 'school_year_end') or comune is null);

-- RLS: NESSUNA modifica necessaria. Le policy esistenti (vedi
-- migration_26_school_calendar_intelligence.sql) sono row-level, non
-- column-level:
--   - SELECT: "il calendario padre è published" (non fa riferimento a
--     nessuna colonna specifica dell'evento, quindi si applica identica
--     anche alla nuova colonna comune).
--   - ALL: "solo l'Admin" (is_platform_admin()), stesso ragionamento.
-- Verificato leggendo le policy esistenti — nessun ALTER POLICY qui.


-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK — da eseguire manualmente solo se necessario, mai automatico
-- ─────────────────────────────────────────────────────────────────────────

-- alter table public.school_calendar_events drop constraint if exists chk_boundary_events_region_only;
-- drop index if exists idx_school_calendar_events_comune;
-- alter table public.school_calendar_events drop column if exists comune;
-- (Il rollback della colonna è sicuro anche con righe già inserite: essendo
-- additiva e mai referenziata da foreign key, la DROP COLUMN non impatta
-- nessun'altra tabella. Le eventuali righe locali (comune valorizzato)
-- perderebbero però quell'informazione — verificare di non avere ancora
-- bisogno dei dati locali prima di eseguire il rollback.)


-- ─────────────────────────────────────────────────────────────────────────
-- POST-CHECK — da eseguire dopo l'applicazione
-- ─────────────────────────────────────────────────────────────────────────

-- 1) La colonna esiste, è nullable, nessun default diverso da NULL:
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'school_calendar_events' and column_name = 'comune';

-- 2) Le righe esistenti (se presenti) restano tutte comune IS NULL — nessuna
--    riscritta a sorpresa:
-- select count(*) as righe_totali, count(comune) as righe_con_comune
-- from public.school_calendar_events;
-- (atteso: righe_con_comune = 0 finché non si inseriscono i nuovi eventi
-- Milano-locali, vedi PART_D2_data_regional_and_milano_2026_2027.sql)

-- 3) Il vincolo opzionale sui marcatori di confine è attivo (deve fallire se
--    si prova a inserire un boundary marker con comune valorizzato — NON
--    eseguire in produzione, solo per verifica isolata):
-- insert into public.school_calendar_events (calendar_id, start_date, end_date, event_type, label, comune)
-- values ('00000000-0000-0000-0000-000000000000', '2026-09-01', '2026-09-01', 'school_year_start', 'test', 'Milano');
-- -- atteso: errore di violazione del check constraint chk_boundary_events_region_only
