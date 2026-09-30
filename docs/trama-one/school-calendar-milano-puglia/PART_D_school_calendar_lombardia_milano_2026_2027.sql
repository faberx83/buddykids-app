-- ═════════════════════════════════════════════════════════════════════════
-- TRAMA — School Calendar Intelligence: dataset pilota Lombardia/Milano
-- Anno scolastico 2026/2027
-- ═════════════════════════════════════════════════════════════════════════
-- PREPARATO da Claude (PART D, 15/09/2026) — NON ESEGUITO.
-- Governance: Claude non applica mai migration/scritture DB. Fabrizio esegue
-- questo file su Supabase (SQL Editor o psql) quando pronto, dopo revisione.
--
-- Schema target: supabase/migration_26_school_calendar_intelligence.sql
-- (già live in produzione — NESSUNA migration qui, solo INSERT sui dati).
--
-- IDEMPOTENZA: ogni blocco usa "insert ... select ... where not exists"
-- (mai un semplice insert nudo) — rieseguire questo file più volte non crea
-- duplicati e non sovrascrive righe esistenti. Se una riga con la stessa
-- chiave naturale esiste già, quel blocco è un no-op silenzioso.
--
-- REVERSIBILITÀ: ogni blocco ha la sua query di rollback (delete mirato)
-- subito sotto, commentata — da eseguire manualmente solo se necessario,
-- mai automatica.
--
-- FONTI (vedi report sessione per il dettaglio completo):
--   1. Regione Lombardia — pagina ufficiale "Calendario scolastico 2026/2027"
--      https://www.regione.lombardia.it/istruzione-formazione-e-lavoro/formazione-professionale/calendario-scolastico-2026-2027
--      (conferma DGR n. 3318 del 18/04/2012, Nota firmata allegata in PDF)
--   2. Comune di Milano — Direzione Educazione, "CALENDARIO EDUCATIVO PER LE
--      SCUOLE E NIDI D'INFANZIA E SERVIZI INTEGRATIVI — ANNO 2026/2027"
--      (Comunicato n. 10/2025, Prot. 18/12/2025.0663861.I) — PDF ufficiale:
--      https://www.comune.milano.it/documents/20118/5527378/Calendario+Educativo+2026-2027.pdf
--
-- STATO: inserito come status='draft' di proposito (default schema). Non
-- diventa visibile in app finché non viene pubblicato dalla vista Admin
-- esistente (/admin/school-calendar) o con l'UPDATE opzionale in fondo a
-- questo file — SOLO dopo revisione da parte di Fabrizio.
-- ═════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- BLOCCO 1 — school_calendars: riga regionale Lombardia 2026/2027
-- ─────────────────────────────────────────────────────────────────────────
-- Chiave naturale idempotente: (country, region, school_year) — lo schema ha
-- anche "version" nella unique constraint (country, region, school_year,
-- version): qui si assume sempre version=1 (default), quindi il controllo
-- "not exists" su country+region+school_year è sufficiente a evitare
-- duplicati nel caso normale (nessuna versione 2+ già presente).

insert into public.school_calendars (country, region, school_year, valid_from, valid_to, source, source_url, source_updated_at, status, version)
select 'IT', 'Lombardia', '2026/2027', '2026-09-01', '2027-08-31',
       'Regione Lombardia — Calendario Scolastico Regionale (DGR n. 3318 del 18/04/2012, confermato per il 2026/2027)',
       'https://www.regione.lombardia.it/istruzione-formazione-e-lavoro/formazione-professionale/calendario-scolastico-2026-2027',
       now(), 'draft', 1
where not exists (
  select 1 from public.school_calendars
  where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027'
);

-- Rollback BLOCCO 1 (cancella anche gli eventi collegati via on delete cascade):
-- delete from public.school_calendars where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027';


-- ─────────────────────────────────────────────────────────────────────────
-- BLOCCO 2 — school_calendar_events: BASELINE REGIONALE (Lombardia, valida
-- per l'intera regione — nessun problema di scoping comune, sicura da
-- inserire senza riserve)
-- ─────────────────────────────────────────────────────────────────────────
-- Idempotenza: chiave naturale (calendar_id, event_type, start_date,
-- end_date) — non esiste una unique constraint DB su questa combinazione
-- (lo schema non la definisce), quindi il controllo "not exists" qui sotto
-- è l'unico meccanismo di idempotenza: rieseguire questo blocco non crea
-- righe duplicate.

with cal as (
  select id from public.school_calendars
  where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027'
)
insert into public.school_calendar_events (calendar_id, start_date, end_date, event_type, label, source_level, source, notes)
select v.calendar_id, v.start_date, v.end_date, v.event_type, v.label, v.source_level, v.source, v.notes
from cal, (values
  -- Inizio/fine anno scolastico — marcatori di confine (mai chiusure in sé,
  -- usati solo per derivare l'estate, vedi lib/school-calendar/need-core.ts).
  -- Scelta V1: si usa la coppia "tutti gli ordini e gradi" (non quella
  -- infanzia, 7 sett/30 giu) — limite noto, documentato nel report sessione
  -- (§LOMBARDIA BASELINE): school_calendar_events non distingue per ordine
  -- scolastico, un solo binario per calendario.
  (cal.id, date '2026-09-14', date '2026-09-14', 'school_year_start',
   'Inizio anno scolastico 2026/2027 (tutti gli ordini e gradi e IeFP)', 'regional',
   'Regione Lombardia — Calendario Scolastico Regionale', null),
  (cal.id, date '2027-06-08', date '2027-06-08', 'school_year_end',
   'Fine anno scolastico 2026/2027 (tutti gli ordini e gradi e IeFP)', 'regional',
   'Regione Lombardia — Calendario Scolastico Regionale', null),

  -- Vacanze di Natale — intervallo continuo 23 dic - 6 gen (include Natale,
  -- Santo Stefano, Capodanno, Epifania: nessun giorno di scuola in mezzo,
  -- vedi verifica calendario nel report). Chiusura COMPLETA (5/5 giorni per
  -- ogni settimana coinvolta) — può generare "da organizzare".
  (cal.id, date '2026-12-23', date '2027-01-06', 'christmas_break',
   'Vacanze di Natale 2026/2027 (incl. Natale, Santo Stefano, Capodanno, Epifania)', 'regional',
   'Regione Lombardia — Calendario Scolastico Regionale', null),

  -- Vacanze di Pasqua — intervallo continuo 25-30 marzo 2027 (3 giorni prima
  -- di Pasqua + Pasqua stessa + Lunedì dell'Angelo + martedì successivo,
  -- come da testo ufficiale regionale). Chiusura COMPLETA.
  (cal.id, date '2027-03-25', date '2027-03-30', 'easter_break',
   'Vacanze di Pasqua 2027 (incl. Lunedì dell''Angelo)', 'regional',
   'Regione Lombardia — Calendario Scolastico Regionale', null),

  -- Vacanze di Carnevale (regionale, rito romano) — "i 2 giorni antecedenti
  -- l'avvio del periodo quaresimale": lunedì 8 e martedì 9 febbraio 2027
  -- (Mercoledì delle Ceneri = 10 febbraio 2027, calcolato da Pasqua 28/03/2027).
  -- DISTINTA dal "Carnevale Ambrosiano" milanese (vedi BLOCCO 3, ESCLUSO).
  (cal.id, date '2027-02-08', date '2027-02-09', 'regional_closure',
   'Vacanze di Carnevale (calendario scolastico regionale Lombardia, rito romano)', 'regional',
   'Regione Lombardia — Calendario Scolastico Regionale', null),

  -- Festività nazionali isolate (non già coperte da Natale/Pasqua sopra).
  -- Quelle che cadono di domenica/sabato restano nel dataset per
  -- completezza/tracciabilità (closedWeekdaysCount=0 quel giorno -> nessun
  -- segnale Planner, nessun rumore — comportamento atteso, non un bug).
  (cal.id, date '2026-10-04', date '2026-10-04', 'public_holiday',
   'San Francesco d''Assisi (cade di domenica nel 2026: nessun impatto sui giorni feriali)', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Domenica: closedWeekdaysCount=0 per costruzione.'),
  (cal.id, date '2026-11-01', date '2026-11-01', 'public_holiday',
   'Tutti i Santi (cade di domenica nel 2026: nessun impatto sui giorni feriali)', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Domenica: closedWeekdaysCount=0 per costruzione.'),
  (cal.id, date '2026-12-08', date '2026-12-08', 'public_holiday',
   'Immacolata Concezione', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Martedì: contribuisce al segnale "2 giorni senza scuola" della settimana 7-8 dicembre insieme a Sant''Ambrogio (vedi BLOCCO 3).'),
  (cal.id, date '2027-04-25', date '2027-04-25', 'public_holiday',
   'Anniversario della Liberazione (cade di domenica nel 2027: nessun impatto sui giorni feriali)', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Domenica: closedWeekdaysCount=0 per costruzione.'),
  (cal.id, date '2027-05-01', date '2027-05-01', 'public_holiday',
   'Festa del Lavoro (cade di sabato nel 2027: nessun impatto sui giorni feriali)', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Sabato: closedWeekdaysCount=0 per costruzione.'),
  (cal.id, date '2027-06-02', date '2027-06-02', 'public_holiday',
   'Festa della Repubblica', 'national',
   'Regione Lombardia — Calendario Scolastico Regionale', 'Mercoledì: genera il segnale "Scuola chiusa mer 2" per la settimana, senza far scattare "da organizzare" per l''intera settimana.')
) as v(calendar_id, start_date, end_date, event_type, label, source_level, source, notes)
where not exists (
  select 1 from public.school_calendar_events e
  where e.calendar_id = v.calendar_id
    and e.event_type = v.event_type
    and e.start_date = v.start_date
    and e.end_date = v.end_date
);

-- Rollback BLOCCO 2 (SOLO gli eventi regionali appena inseriti, per label):
-- delete from public.school_calendar_events
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Lombardia' and school_year='2026/2027')
--   and label in (
--     'Inizio anno scolastico 2026/2027 (tutti gli ordini e gradi e IeFP)',
--     'Fine anno scolastico 2026/2027 (tutti gli ordini e gradi e IeFP)',
--     'Vacanze di Natale 2026/2027 (incl. Natale, Santo Stefano, Capodanno, Epifania)',
--     'Vacanze di Pasqua 2027 (incl. Lunedì dell''Angelo)',
--     'Vacanze di Carnevale (calendario scolastico regionale Lombardia, rito romano)',
--     'San Francesco d''Assisi (cade di domenica nel 2026: nessun impatto sui giorni feriali)',
--     'Tutti i Santi (cade di domenica nel 2026: nessun impatto sui giorni feriali)',
--     'Immacolata Concezione',
--     'Anniversario della Liberazione (cade di domenica nel 2027: nessun impatto sui giorni feriali)',
--     'Festa del Lavoro (cade di sabato nel 2027: nessun impatto sui giorni feriali)',
--     'Festa della Repubblica'
--   );


-- ═════════════════════════════════════════════════════════════════════════
-- BLOCCO 3 — MILANO LOCALE: Sant'Ambrogio (7 dicembre 2026) — OPZIONALE,
-- DA NON ESEGUIRE senza decisione esplicita di Fabrizio (vedi report
-- sessione, sezione "FABRIZIO REQUIRED").
--
-- PERCHÉ È SEPARATO E OPZIONALE (limite architetturale reale, non
-- inventato): school_calendars/school_calendar_events sono scoperti a
-- livello di REGIONE, mai di comune (nessuna colonna "comune" in
-- school_calendar_events — kid_school_profiles.comune esiste ma NON è mai
-- letto dalla logica di chiusura in lib/data/school-calendar.ts, verificato
-- leggendo il codice). Sant'Ambrogio è ufficialmente un giorno di chiusura
-- SOLO per Milano (patrono cittadino) — inserirlo in questa riga
-- calendario "Lombardia" lo applicherebbe, con la logica attuale, a
-- QUALUNQUE famiglia con kid_school_profiles.region='Lombardia', anche se
-- non a Milano (es. una famiglia di Bergamo, il cui patrono è
-- Sant'Alessandro, 26 agosto).
--
-- Oggi questo è INNOCUO in pratica: l'unico account con un profilo
-- scolastico configurato per questo pilota è la famiglia di test
-- (bambino "Lino", region="Lombardia", comune="Milano"). Diventa un
-- problema reale SOLO se/quando una seconda famiglia non-Milano ottiene un
-- profilo scolastico sulla stessa riga regionale.
--
-- FONTE (doppia conferma istituzionale indipendente):
--  - Regione Lombardia (pagina ufficiale sopra): "Festa del Santo Patrono,
--    secondo la normativa vigente" — categoria esplicitamente prevista dal
--    calendario regionale ufficiale, ma con data dipendente dal comune.
--  - Comune di Milano, Direzione Educazione, Comunicato n. 10/2025:
--    "il 7 dicembre 2026 – festa del Santo Patrono" — riga esplicita nel
--    documento ufficiale.
-- Classificazione: A (chiusura scolastica ufficiale, comune-wide,
-- non facoltativa) — confidenza ALTA, NON institute-dependent.
-- ═════════════════════════════════════════════════════════════════════════

-- Eseguire SOLO se Fabrizio conferma esplicitamente di accettare
-- l'approssimazione "region-wide" per questo pilota a famiglia singola:
--
-- with cal as (
--   select id from public.school_calendars
--   where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027'
-- )
-- insert into public.school_calendar_events (calendar_id, start_date, end_date, event_type, label, source_level, source, notes)
-- select cal.id, date '2026-12-07', date '2026-12-07', 'public_holiday',
--        'Sant''Ambrogio — Festa del Santo Patrono di Milano', 'local',
--        'Comune di Milano — Direzione Educazione, Comunicato n. 10/2025 (Prot. 18/12/2025.0663861.I); confermato da Regione Lombardia come categoria "Festa del Santo Patrono, secondo la normativa vigente"',
--        'MILANO-SPECIFICO applicato region-wide per limite di schema attuale (nessuna colonna comune in school_calendar_events) — sicuro SOLO finché l''unico profilo scolastico su questa riga regionale è a Milano. Rivalutare se/quando una famiglia non-Milano ottiene un profilo su region=Lombardia.'
-- from cal
-- where not exists (
--   select 1 from public.school_calendar_events e
--   where e.calendar_id = cal.id and e.event_type = 'public_holiday' and e.start_date = date '2026-12-07'
-- );
--
-- Rollback BLOCCO 3:
-- delete from public.school_calendar_events
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Lombardia' and school_year='2026/2027')
--   and start_date = date '2026-12-07' and event_type = 'public_holiday';


-- ═════════════════════════════════════════════════════════════════════════
-- CARNEVALE AMBROSIANO (11-12 febbraio 2027, con variabilità 10-13) —
-- VOLUTAMENTE ASSENTE da questo file, in NESSUNA forma (né BLOCCO
-- obbligatorio né opzionale commentato).
--
-- Classificazione: C — localmente conosciuto ma institute-dependent.
-- Nessuna fonte istituzionale uniforme lo conferma per TUTTI gli istituti
-- milanesi: il calendario ufficiale Comune di Milano — Direzione Educazione
-- (servizi 0-6, Comunicato n. 10/2025) indica un SOLO giorno di sospensione
-- ("il 12 febbraio 2027 – Carnevale"), mentre la pratica diffusa negli
-- istituti scolastici statali (autonomia scolastica, delibera di ogni
-- Consiglio d'Istituto) aggiunge spesso anche giovedì 11 febbraio, e in
-- alcuni casi mercoledì 10 febbraio — nessuna delle due estensioni è
-- uniformemente ufficiale. Per istruzione esplicita della sessione
-- precedente ("non inserire 10 febbraio o altri giorni solo perché alcuni
-- istituti li adottano"): NON auto-assegnato. Se Fabrizio vuole comunque
-- rappresentarlo, andrebbe modellato come contesto locale
-- institute-dependent (fuori da questo dataset regionale, es. tramite un
-- futuro override per-famiglia), mai come chiusura automatica.
-- ═════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- POST-CHECK — da eseguire dopo l'INSERT per verificare il risultato
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Il calendario Lombardia 2026/2027 esiste ed è nello stato atteso:
-- select id, region, school_year, status, valid_from, valid_to, source, version
-- from public.school_calendars
-- where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027';

-- 2) Tutti gli eventi regionali attesi sono presenti (attesi: 11 righe dal
--    BLOCCO 2, +1 se il BLOCCO 3 opzionale viene eseguito):
-- select event_type, start_date, end_date, label, source_level
-- from public.school_calendar_events
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Lombardia' and school_year='2026/2027')
-- order by start_date;

-- 3) Nessun duplicato (stessa chiave naturale inserita due volte):
-- select calendar_id, event_type, start_date, end_date, count(*)
-- from public.school_calendar_events
-- group by calendar_id, event_type, start_date, end_date
-- having count(*) > 1;

-- 4) Verifica il profilo scolastico esistente del test account (Lino) è
--    davvero su region='Lombardia' e punterà a questo calendario una volta
--    pubblicato:
-- select kid_id, region, comune from public.kid_school_profiles;

-- 5) SOLO dopo revisione manuale — pubblica il calendario (lo rende visibile
--    in app, vedi RLS "status = 'published'" in migration_26). In
--    alternativa: usare la vista Admin esistente /admin/school-calendar, se
--    espone già un'azione "Pubblica" equivalente — preferibile a questo
--    UPDATE diretto perché passa dallo stesso percorso già testato.
-- update public.school_calendars
-- set status = 'published'
-- where country = 'IT' and region = 'Lombardia' and school_year = '2026/2027' and status = 'draft';
