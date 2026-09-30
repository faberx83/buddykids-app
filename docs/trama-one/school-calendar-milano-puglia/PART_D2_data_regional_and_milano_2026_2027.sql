-- ═════════════════════════════════════════════════════════════════════════
-- TRAMA — School Calendar dataset CORRETTO: Lombardia baseline + Milano
-- locale — Anno scolastico 2026/2027
-- ═════════════════════════════════════════════════════════════════════════
-- PREPARATO da Claude (PART D — correzione modello dominio, 15/09/2026).
-- NON ESEGUITO.
--
-- SOSTITUISCE il file precedente
-- PART_D_school_calendar_lombardia_milano_2026_2027.sql: quel file conteneva
-- un errore di dominio reale (Carnevale regionale 08-09/02/2027 inserito
-- come baseline uniforme per tutta la Lombardia, e Sant'Ambrogio inserito
-- come approssimazione region-wide "temporaneamente accettabile") — vedi
-- SCHOOL CALENDAR FINAL MODEL AUDIT nel report di sessione per il dettaglio
-- completo. Non eseguire più quel file.
--
-- PREREQUISITO: richiede che PART_D2_migration_comune_scope.sql
-- sia stata applicata (colonna school_calendar_events.comune esistente) —
-- la SEZIONE C sotto fallirebbe silenziosamente (colonna non trovata) se
-- eseguita prima.
-- ═════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE A — school_calendars: riga regionale Lombardia 2026/2027
-- (invariata rispetto al file precedente — nessun problema di dominio qui,
-- la riga calendario resta a livello di regione per costruzione)
-- ─────────────────────────────────────────────────────────────────────────

insert into public.school_calendars (country, region, school_year, valid_from, valid_to, source, source_url, source_updated_at, status, version)
select 'IT', 'Lombardia', '2026/2027', '2026-09-01', '2027-08-31',
       'Regione Lombardia — Calendario Scolastico Regionale (DGR n. 3318 del 18/04/2012, confermato per il 2026/2027)',
       'https://www.regione.lombardia.it/istruzione-formazione-e-lavoro/formazione-professionale/calendario-scolastico-2026-2027',
       now(), 'draft', 1
where not exists (
  select 1 from public.school_calendars
  where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027'
);

-- Rollback SEZIONE A (cancella anche gli eventi collegati via on delete cascade):
-- delete from public.school_calendars where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027';


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE B — REGIONAL BASELINE (comune = NULL): SOLO eventi realmente
-- uniformi per tutta la Lombardia
-- ─────────────────────────────────────────────────────────────────────────
-- CORREZIONE rispetto al file precedente: la "Vacanze di Carnevale
-- (08-09/02/2027)" è stata RIMOSSA da questa sezione. Motivo (vedi CARNEVALE
-- REGIONAL BUG nel report): la formula ufficiale di Regione Lombardia
-- ("i 2 giorni antecedenti l'avvio del periodo quaresimale") NON produce la
-- stessa data concreta in tutta la regione — dipende dal rito liturgico
-- della diocesi di appartenenza (romano vs ambrosiano), non solo dalla
-- regione amministrativa. Milano (rito ambrosiano) ha una Quaresima che
-- inizia 4 giorni dopo quella romana: applicando la STESSA formula regionale
-- con la domenica ambrosiana (14/02/2027) si ottiene venerdì 12 febbraio
-- (il sabato 13 è già un giorno non scolastico per la maggior parte delle
-- scuole) — ESATTAMENTE la data pubblicata dal Comune di Milano nel proprio
-- calendario ufficiale, e DIVERSA dal calcolo romano (lunedì 8/martedì 9
-- febbraio). Questo dimostra che la formula regionale non ha un'unica
-- risoluzione concreta valida ovunque — nessuna fonte comunale/diocesana
-- specifica è stata verificata per gli altri comuni lombardi (rito romano),
-- quindi NESSUNA data di Carnevale entra nella baseline regionale in questo
-- V1. Vedi SEZIONE C per Milano (unico comune con fonte ufficiale diretta).

-- FIX POST-ESECUZIONE (16/09/2026): la versione precedente di questa
-- sezione referenziava "cal.id" DENTRO le righe della VALUES(...) — non
-- valido in PostgreSQL (una VALUES list non può leggere un'altra tabella
-- del FROM a cui viene accostata senza LATERAL, e qui non serve nemmeno
-- LATERAL: cal.id è lo STESSO per ogni riga, quindi va portato SOLO nella
-- SELECT esterna, non ripetuto in ogni tupla). Bug reale, mai eseguito
-- prima contro un Postgres vero (governance: Claude non scrive sul DB) —
-- scoperto da Fabrizio alla prima esecuzione reale, corretto qui.
with cal as (
  select id from public.school_calendars
  where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027'
)
insert into public.school_calendar_events (calendar_id, start_date, end_date, event_type, label, source_level, source, notes, comune)
select cal.id, v.start_date, v.end_date, v.event_type, v.label, v.source_level, v.source, v.notes, null
from cal, (values
  -- Inizio/fine anno scolastico — marcatori di confine, SEMPRE regionali
  -- (comune NULL, imposto anche dal check constraint opzionale della
  -- migration). Scelta V1: binario "tutti gli ordini e gradi" (non
  -- infanzia, 7 sett/30 giu) — limite noto e documentato (§10 del report):
  -- non presentato come universalmente corretto per l'infanzia.
  (date '2026-09-14', date '2026-09-14', 'school_year_start',
   'Inizio anno scolastico 2026/2027 (tutti gli ordini e gradi e IeFP)', 'regional',
   'Regione Lombardia — Calendario Scolastico Regionale', null),
  (date '2027-06-08', date '2027-06-08', 'school_year_end',
   'Fine anno scolastico 2026/2027 (tutti gli ordini e gradi e IeFP)', 'regional',
   'Regione Lombardia — Calendario Scolastico Regionale', null),

  -- Vacanze di Natale — intervallo continuo 23 dic - 6 gen, uniforme in
  -- tutta Italia (festività nazionali fisse, nessuna dipendenza da rito).
  (date '2026-12-23', date '2027-01-06', 'christmas_break',
   'Vacanze di Natale 2026/2027 (incl. Natale, Santo Stefano, Capodanno, Epifania)', 'regional',
   'Regione Lombardia — Calendario Scolastico Regionale', null),

  -- Vacanze di Pasqua — intervallo continuo 25-30 marzo 2027. Pasqua
  -- CATTOLICA ROMANA è la stessa data anche nel rito ambrosiano (a
  -- differenza della Quaresima, che nel rito ambrosiano inizia più tardi ma
  -- converge sulla STESSA Domenica di Pasqua) — nessuna divergenza attesa
  -- per questo evento, uniforme in tutta la regione.
  (date '2027-03-25', date '2027-03-30', 'easter_break',
   'Vacanze di Pasqua 2027 (incl. Lunedì dell''Angelo)', 'regional',
   'Regione Lombardia — Calendario Scolastico Regionale', null),

  -- Festività nazionali isolate — uniformi in tutta Italia, nessuna
  -- dipendenza territoriale/di rito. Quelle che cadono di sabato/domenica
  -- restano nel dataset per completezza (closedWeekdaysCount=0 quel giorno).
  (date '2026-10-04', date '2026-10-04', 'public_holiday',
   'San Francesco d''Assisi (cade di domenica nel 2026: nessun impatto sui giorni feriali)', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Domenica: closedWeekdaysCount=0 per costruzione.'),
  (date '2026-11-01', date '2026-11-01', 'public_holiday',
   'Tutti i Santi (cade di domenica nel 2026: nessun impatto sui giorni feriali)', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Domenica: closedWeekdaysCount=0 per costruzione.'),
  (date '2026-12-08', date '2026-12-08', 'public_holiday',
   'Immacolata Concezione', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Martedì: a Milano contribuisce al segnale "2 giorni senza scuola" 7-8 dicembre insieme a Sant''Ambrogio (evento locale, SEZIONE C) — nessun collegamento diretto in tabella, si sommano naturalmente a runtime nel service di composizione.'),
  (date '2027-04-25', date '2027-04-25', 'public_holiday',
   'Anniversario della Liberazione (cade di domenica nel 2027: nessun impatto sui giorni feriali)', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Domenica: closedWeekdaysCount=0 per costruzione.'),
  (date '2027-05-01', date '2027-05-01', 'public_holiday',
   'Festa del Lavoro (cade di sabato nel 2027: nessun impatto sui giorni feriali)', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Sabato: closedWeekdaysCount=0 per costruzione.'),
  (date '2027-06-02', date '2027-06-02', 'public_holiday',
   'Festa della Repubblica', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Mercoledì: genera il segnale "Scuola chiusa mer 2" per la settimana, senza far scattare "da organizzare" per l''intera settimana.')
) as v(start_date, end_date, event_type, label, source_level, source, notes)
where not exists (
  select 1 from public.school_calendar_events e
  where e.calendar_id = cal.id
    and e.event_type = v.event_type
    and e.start_date = v.start_date
    and e.end_date = v.end_date
    and e.comune is null
);

-- Rollback SEZIONE B:
-- delete from public.school_calendar_events
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Lombardia' and school_year='2026/2027')
--   and comune is null
--   and label in (
--     'Inizio anno scolastico 2026/2027 (tutti gli ordini e gradi e IeFP)',
--     'Fine anno scolastico 2026/2027 (tutti gli ordini e gradi e IeFP)',
--     'Vacanze di Natale 2026/2027 (incl. Natale, Santo Stefano, Capodanno, Epifania)',
--     'Vacanze di Pasqua 2027 (incl. Lunedì dell''Angelo)',
--     'San Francesco d''Assisi (cade di domenica nel 2026: nessun impatto sui giorni feriali)',
--     'Tutti i Santi (cade di domenica nel 2026: nessun impatto sui giorni feriali)',
--     'Immacolata Concezione',
--     'Anniversario della Liberazione (cade di domenica nel 2027: nessun impatto sui giorni feriali)',
--     'Festa del Lavoro (cade di sabato nel 2027: nessun impatto sui giorni feriali)',
--     'Festa della Repubblica'
--   );


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE C — MILANO LOCAL EVENTS (comune = 'Milano'): SOLO eventi con
-- fonte ufficiale diretta, nessuna deduzione
-- ─────────────────────────────────────────────────────────────────────────
-- Richiede la colonna "comune" (vedi PART_D2_migration_comune_scope.sql).
-- Ogni evento qui si applica SOLO ai bambini con kid_school_profiles.comune
-- = 'Milano' (match esatto) — MAI a un bambino con region='Lombardia' e un
-- comune diverso (es. Bergamo).
--
-- Sant'Ambrogio — 7 dicembre 2026, lunedì. Classe A (chiusura ufficiale,
-- non institute-dependent). Doppia fonte istituzionale indipendente:
--   - Regione Lombardia (pagina ufficiale): categoria "Festa del Santo
--     Patrono, secondo la normativa vigente" (prevista dal calendario
--     regionale, data dipendente dal comune).
--   - Comune di Milano, Direzione Educazione, Comunicato n. 10/2025
--     (Prot. 18/12/2025.0663861.I): "il 7 dicembre 2026 – festa del Santo
--     Patrono" — riga esplicita nel documento ufficiale.
--
-- Carnevale Ambrosiano — 12 febbraio 2027, venerdì. Classe A per QUESTO
-- singolo giorno (fonte ufficiale diretta): Comune di Milano, stesso
-- documento, sezione "SOSPENSIONE DELL'ATTIVITÀ EDUCATIVA": "il 12 febbraio
-- 2027 – Carnevale". NESSUNA deduzione di giorni aggiuntivi (11 o 10
-- febbraio) — quell'estensione è adottata da alcuni istituti per autonomia
-- scolastica (Consiglio d'Istituto), non uniformemente confermata da una
-- fonte istituzionale comune-wide, quindi resta ESCLUSA da questo dataset
-- (classe C, institute-dependent — vedi report, non inserita in nessuna
-- forma, nemmeno commentata come blocco opzionale, per istruzione esplicita
-- di non dedurre 10/11 febbraio).

-- FIX POST-ESECUZIONE (16/09/2026): stesso bug e stessa correzione della
-- SEZIONE B sopra — "cal.id" spostato dalla VALUES(...) alla SELECT esterna.
with cal as (
  select id from public.school_calendars
  where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027'
)
insert into public.school_calendar_events (calendar_id, start_date, end_date, event_type, label, source_level, source, notes, comune)
select cal.id, v.start_date, v.end_date, v.event_type, v.label, v.source_level, v.source, v.notes, v.comune
from cal, (values
  (date '2026-12-07', date '2026-12-07', 'public_holiday',
   'Sant''Ambrogio — Festa del Santo Patrono di Milano', 'local',
   'Comune di Milano — Direzione Educazione, Comunicato n. 10/2025 (Prot. 18/12/2025.0663861.I); categoria confermata anche da Regione Lombardia ("Festa del Santo Patrono, secondo la normativa vigente")',
   'Classe A — chiusura ufficiale, comune-wide, non institute-dependent. Si applica SOLO a kid_school_profiles.comune = ''Milano''.',
   'Milano'),
  (date '2027-02-12', date '2027-02-12', 'other_closure',
   'Carnevale Ambrosiano (Comune di Milano)', 'local',
   'Comune di Milano — Direzione Educazione, Comunicato n. 10/2025 (Prot. 18/12/2025.0663861.I), sezione "Sospensione dell''attività educativa": "il 12 febbraio 2027 – Carnevale"',
   'Classe A per QUESTO singolo giorno. Giovedì 11/mercoledì 10 febbraio NON inclusi: adottati da alcuni istituti per autonomia scolastica, non confermati da fonte comune-wide — restano classe C, institute-dependent, esclusi da questo dataset in ogni forma.',
   'Milano')
) as v(start_date, end_date, event_type, label, source_level, source, notes, comune)
where not exists (
  select 1 from public.school_calendar_events e
  where e.calendar_id = cal.id
    and e.event_type = v.event_type
    and e.start_date = v.start_date
    and e.end_date = v.end_date
    and e.comune = v.comune
);

-- Rollback SEZIONE C:
-- delete from public.school_calendar_events
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Lombardia' and school_year='2026/2027')
--   and comune = 'Milano';


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE D — POST-CHECK
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Il calendario Lombardia 2026/2027 esiste:
-- select id, region, school_year, status, valid_from, valid_to, source, version
-- from public.school_calendars
-- where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027';

-- 2) Eventi regionali (comune IS NULL) — attesi 10 righe:
-- select event_type, start_date, end_date, label, source_level
-- from public.school_calendar_events
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Lombardia' and school_year='2026/2027')
--   and comune is null
-- order by start_date;

-- 3) Eventi locali Milano (comune = 'Milano') — attese 2 righe:
-- select event_type, start_date, end_date, label, comune
-- from public.school_calendar_events
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Lombardia' and school_year='2026/2027')
--   and comune = 'Milano'
-- order by start_date;

-- 4) Nessun duplicato (stessa chiave naturale + comune inserita due volte):
-- select calendar_id, event_type, start_date, end_date, comune, count(*)
-- from public.school_calendar_events
-- group by calendar_id, event_type, start_date, end_date, comune
-- having count(*) > 1;

-- 5) Nessun marcatore di confine con comune valorizzato (deve tornare 0 righe
--    — verifica indipendente dal check constraint, utile anche se la
--    migration è stata applicata SENZA il vincolo opzionale):
-- select * from public.school_calendar_events
-- where event_type in ('school_year_start', 'school_year_end') and comune is not null;

-- 6) Verifica il profilo scolastico esistente del test account (Lino) è su
--    region='Lombardia', comune='Milano' — riceverà baseline regionale + i
--    2 eventi locali Milano una volta pubblicato il calendario:
-- select kid_id, region, comune from public.kid_school_profiles;

-- 7) SOLO dopo revisione manuale — pubblica il calendario (vedi anche la
--    vista Admin /admin/school-calendar, preferibile a questo UPDATE
--    diretto perché passa dallo stesso percorso già testato):
-- update public.school_calendars
-- set status = 'published'
-- where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027' and status = 'draft';


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE E — ROLLBACK COMPLETO (tutte le sezioni, in caso di ripensamento
-- totale — usare i rollback per-sezione sopra per un rollback selettivo)
-- ─────────────────────────────────────────────────────────────────────────

-- delete from public.school_calendars where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027';
-- (cascade elimina automaticamente tutti gli eventi collegati, regionali e locali)
