-- ═════════════════════════════════════════════════════════════════════════
-- TRAMA — School Calendar dataset: Puglia baseline + Rutigliano locale —
-- Anno scolastico 2026/2027
-- ═════════════════════════════════════════════════════════════════════════
-- PREPARATO da Claude (16/09/2026), stesso modello region+comune già usato
-- per Lombardia/Milano. NON ESEGUITO.
--
-- PREREQUISITO: richiede che PART_D2_migration_comune_scope.sql sia stata
-- applicata (colonna school_calendar_events.comune) — è la STESSA migration
-- già preparata per Lombardia, generica per qualunque regione/comune,
-- NESSUNA nuova migration necessaria per questo dataset.
--
-- FONTI:
--   REGIONALE (Puglia): Giunta Regionale Puglia, Delibera n. 315 del
--   24/03/2026 ("Calendario scolastico regionale a.s. 2026/2027"),
--   trasmessa da USR Puglia con nota prot. 21227 del 01/04/2026
--   (https://www.pugliausr.gov.it/index.php/ordinamenti/calendario-scolastico/27551-21227-2026)
--   e pubblicata come Allegato A su regione.puglia.it
--   (https://www.regione.puglia.it/documents/4988666/7058496/Calendario+scolastico+regionale.pdf).
--   NOTA METODOLOGICA (onestà, stesso principio già seguito per Lombardia):
--   il PDF ufficiale è stato individuato e la sua esistenza/URL verificati,
--   ma non è stato possibile estrarne programmaticamente il testo in questa
--   sessione (fetch riporta contenuto vuoto/binario, nessun parser PDF
--   disponibile). Le date sotto sono quindi corroborate da TRE fonti
--   secondarie indipendenti e concordanti (comunicato stampa ufficiale
--   press.regione.puglia.it, Orizzonte Scuola, ricerche aggregate
--   concordi sullo stesso numero di delibera "315 del 24/03/2026") — un
--   grado di confidenza alto ma non identico a una lettura diretta del
--   PDF primario. Se Fabrizio ha modo di aprire il PDF direttamente,
--   consiglio una verifica visiva prima della pubblicazione.
--
--   LOCALE (Rutigliano): Comune di Rutigliano — sito istituzionale,
--   articolo "Chiusura delle scuole di ogni ordine e grado per i giorni 14
--   e 15 settembre 2026" (04/09/2026), che riporta testualmente
--   l'Ordinanza Sindacale n. 23 del 04-09-2026 del Sindaco Giuseppe
--   Valenzano: "la chiusura di tutte le scuole di ogni ordine e grado, per
--   i giorni 14 e 15 settembre 2026" per le celebrazioni della festa del
--   SS. Crocifisso (13-15 settembre).
--   (https://www.comune.rutigliano.ba.it/novita/chiusura-delle-scuole-di-ogni-ordine-e-grado-per-i-giorni-14-e-15-settembre-2026/
--   — PDF ordinanza allegato:
--   https://www.comune.rutigliano.ba.it/wp-content/uploads/2026/09/Ordinanza-Sindacale-n.23-del-04-09-2026.pdf)
--   Fonte diretta primaria, stesso rigore già usato per Sant'Ambrogio a
--   Milano.
--
-- NESSUNA formula regionale ambigua identificata per Puglia (a differenza
-- del Carnevale Lombardo): nessuna fonte consultata menziona una
-- "vacanza di Carnevale" nel calendario regionale pugliese — coerentemente
-- NON viene inserita alcuna data di Carnevale in questo dataset (stesso
-- principio "nessuna deduzione, solo quanto confermato").
-- ═════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE A — school_calendars: riga regionale Puglia 2026/2027
-- ─────────────────────────────────────────────────────────────────────────

insert into public.school_calendars (country, region, school_year, valid_from, valid_to, source, source_url, source_updated_at, status, version)
select 'IT', 'Puglia', '2026/2027', '2026-09-01', '2027-08-31',
       'Regione Puglia — Giunta Regionale, Delibera n. 315 del 24/03/2026 (Calendario scolastico regionale a.s. 2026/2027), trasmessa da USR Puglia (prot. 21227 del 01/04/2026)',
       'https://www.pugliausr.gov.it/index.php/ordinamenti/calendario-scolastico/27551-21227-2026',
       now(), 'draft', 1
where not exists (
  select 1 from public.school_calendars
  where country = 'IT' and region = 'Puglia' and school_year = '2026/2027'
);

-- Rollback SEZIONE A (cancella anche gli eventi collegati via on delete cascade):
-- delete from public.school_calendars where country = 'IT' and region = 'Puglia' and school_year = '2026/2027';


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE B — PUGLIA REGIONAL BASELINE (comune = NULL): SOLO eventi
-- realmente uniformi per tutta la regione
-- ─────────────────────────────────────────────────────────────────────────
-- Include il "Ponte dell'Immacolata" (lunedì 7 dicembre 2026, evento
-- 'bridge') in aggiunta all'Immacolata Concezione (8 dicembre, festività
-- nazionale) — decisione esplicita della delibera regionale pugliese,
-- diversa dal dataset Lombardia (che non prevedeva questo ponte). NON
-- include "San Francesco d'Assisi" (4 ottobre): era presente nel dataset
-- Lombardia perché esplicitamente elencato dalla pagina ufficiale di
-- Regione Lombardia — nessuna fonte consultata per Puglia lo conferma,
-- quindi resta escluso qui (stesso principio "solo quanto verificato PER
-- QUESTA regione", niente copia-incolla fra dataset regionali diversi).

with cal as (
  select id from public.school_calendars
  where country = 'IT' and region = 'Puglia' and school_year = '2026/2027'
)
insert into public.school_calendar_events (calendar_id, start_date, end_date, event_type, label, source_level, source, notes, comune)
select cal.id, v.start_date, v.end_date, v.event_type, v.label, v.source_level, v.source, v.notes, null
from cal, (values
  -- Inizio/fine anno scolastico — marcatori di confine, SEMPRE regionali.
  -- Scelta V1 invariata: binario "tutti gli ordini e gradi" (non
  -- infanzia) — limite noto e documentato, stesso di Lombardia.
  (date '2026-09-17', date '2026-09-17', 'school_year_start',
   'Inizio anno scolastico 2026/2027 (tutti gli ordini e gradi; anticipabile per autonomia scolastica di ciascun istituto)', 'regional',
   'Regione Puglia — Delibera n. 315 del 24/03/2026', null),
  (date '2027-06-08', date '2027-06-08', 'school_year_end',
   'Fine anno scolastico 2026/2027 (tutti gli ordini e gradi tranne infanzia, che termina 30/06/2027 — limite V1, vedi nota infanzia)', 'regional',
   'Regione Puglia — Delibera n. 315 del 24/03/2026', null),

  -- Vacanze di Natale — intervallo continuo 23 dic - 6 gen, uniforme in
  -- tutta Italia (festività nazionali fisse, nessuna dipendenza regionale).
  (date '2026-12-23', date '2027-01-06', 'christmas_break',
   'Vacanze di Natale 2026/2027 (incl. Natale, Santo Stefano, Capodanno, Epifania)', 'regional',
   'Regione Puglia — Delibera n. 315 del 24/03/2026', null),

  -- Vacanze di Pasqua — intervallo continuo 25-30 marzo 2027, stessa
  -- finestra di Lombardia (Pasqua è la stessa data nazionale in rito
  -- romano, nessuna divergenza di rito prevista in Puglia).
  (date '2027-03-25', date '2027-03-30', 'easter_break',
   'Vacanze di Pasqua 2027 (incl. Lunedì dell''Angelo)', 'regional',
   'Regione Puglia — Delibera n. 315 del 24/03/2026', null),

  -- Ponte dell'Immacolata — decisione regionale esplicita pugliese
  -- (assente nel dataset Lombardia): lunedì 7 dicembre sospensione delle
  -- lezioni, "ponte" verso la festività dell'8 dicembre.
  (date '2026-12-07', date '2026-12-07', 'bridge',
   'Ponte dell''Immacolata (lunedì, collega il weekend all''8 dicembre)', 'regional',
   'Regione Puglia — Delibera n. 315 del 24/03/2026', 'Lunedì: ponte esplicito della delibera regionale pugliese, diverso dal dataset Lombardia (che non lo prevedeva).'),

  -- Festività nazionali isolate — uniformi in tutta Italia, per legge
  -- nazionale (L. 27/05/1949 n. 260 e succ.), indipendenti dal calendario
  -- regionale.
  (date '2026-12-08', date '2026-12-08', 'public_holiday',
   'Immacolata Concezione', 'national',
   'Festività nazionale (L. 260/1949)', 'Martedì: collegata al ponte 7 dicembre sopra.'),
  (date '2026-11-01', date '2026-11-01', 'public_holiday',
   'Tutti i Santi (cade di domenica nel 2026: nessun impatto sui giorni feriali)', 'national',
   'Festività nazionale (L. 260/1949)', 'Domenica: closedWeekdaysCount=0 per costruzione.'),
  (date '2027-04-25', date '2027-04-25', 'public_holiday',
   'Anniversario della Liberazione (cade di domenica nel 2027: nessun impatto sui giorni feriali)', 'national',
   'Festività nazionale (L. 260/1949)', 'Domenica: closedWeekdaysCount=0 per costruzione.'),
  (date '2027-05-01', date '2027-05-01', 'public_holiday',
   'Festa del Lavoro (cade di sabato nel 2027: nessun impatto sui giorni feriali)', 'national',
   'Festività nazionale (L. 260/1949)', 'Sabato: closedWeekdaysCount=0 per costruzione.'),
  (date '2027-06-02', date '2027-06-02', 'public_holiday',
   'Festa della Repubblica', 'national',
   'Festività nazionale (L. 260/1949)', 'Mercoledì: genera il segnale "Scuola chiusa mer 2" per la settimana, senza far scattare "da organizzare" per l''intera settimana.')
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
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Puglia' and school_year='2026/2027')
--   and comune is null;


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE C — RUTIGLIANO LOCAL EVENTS (comune = 'Rutigliano'): SOLO eventi
-- con fonte ufficiale diretta, nessuna deduzione
-- ─────────────────────────────────────────────────────────────────────────
-- Richiede la colonna "comune" (vedi PART_D2_migration_comune_scope.sql —
-- la stessa già preparata per Lombardia, riusata qui senza modifiche).
-- Si applica SOLO ai bambini con kid_school_profiles.comune = 'Rutigliano'
-- (match normalizzato via normalizeComuneKey) — MAI a un bambino con
-- region='Puglia' e un comune diverso (es. Bari, Noicattaro).
--
-- Festa del SS. Crocifisso — chiusura scuole 14-15 settembre 2026 (lunedì-
-- martedì), disposta con Ordinanza Sindacale n. 23 del 04-09-2026 del
-- Sindaco di Rutigliano Giuseppe Valenzano, per le celebrazioni religiose e
-- civili del 13-14-15 settembre. Classe A (chiusura ufficiale comune-wide,
-- non institute-dependent: l'ordinanza dispone "la chiusura di TUTTE le
-- scuole di ogni ordine e grado").
--
-- NOTA IMPORTANTE (onestà, non risolta silenziosamente): 14-15/09/2026
-- precedono il 17/09/2026, data di inizio anno scolastico ufficialmente
-- pubblicata dalla delibera regionale pugliese (SEZIONE B). La stessa
-- delibera regionale ammette però che l'inizio possa essere ANTICIPATO per
-- autonomia di ciascun istituto — plausibile che gli istituti di Rutigliano
-- avessero già iniziato le lezioni prima del 17/09 (coerente con
-- l'ordinanza che parla di "ripresa delle attività" il 16/09, non di un
-- "primo giorno di scuola"). Questo NON viene risolto/dedotto qui (si
-- tratterebbe di un'informazione a livello di singolo istituto, fuori
-- scope per istruzione esplicita — vedi §10 SCHOOL-SPECIFIC CLOSURES nel
-- report di sessione): l'evento locale viene inserito esattamente come da
-- ordinanza (14-15/09/2026). Effetto pratico sul Planner: se le SeasonWeek
-- della famiglia non includono settimane precedenti il 17/09 (tipico,
-- l'anno scolastico "ufficiale" pubblicato è quello usato per generare le
-- settimane), questo evento non produce alcun segnale finché il layer
-- Planner non copre quella settimana — nessun comportamento errato, solo
-- un evento che potrebbe non avere ancora effetto visibile finché non si
-- estende la finestra di generazione settimane. Nessun codice applicativo
-- modificato per questo dataset.

with cal as (
  select id from public.school_calendars
  where country = 'IT' and region = 'Puglia' and school_year = '2026/2027'
)
insert into public.school_calendar_events (calendar_id, start_date, end_date, event_type, label, source_level, source, notes, comune)
select cal.id, v.start_date, v.end_date, v.event_type, v.label, v.source_level, v.source, v.notes, v.comune
from cal, (values
  (date '2026-09-14', date '2026-09-15', 'other_closure',
   'Festa del SS. Crocifisso — chiusura scuole (Ordinanza Sindacale n. 23 del 04-09-2026)', 'local',
   'Comune di Rutigliano — sito istituzionale, articolo "Chiusura delle scuole di ogni ordine e grado per i giorni 14 e 15 settembre 2026" (04/09/2026), Ordinanza Sindacale n. 23/04-09-2026 del Sindaco Giuseppe Valenzano',
   'Classe A — chiusura ufficiale, comune-wide ("tutte le scuole di ogni ordine e grado"), non institute-dependent. Precede il 17/09 (inizio anno regionale ufficiale) — vedi nota sopra sulla possibile anticipazione per autonomia scolastica, non risolta qui. Si applica SOLO a kid_school_profiles.comune = ''Rutigliano''.',
   'Rutigliano')
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
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Puglia' and school_year='2026/2027')
--   and comune = 'Rutigliano';


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE D — POST-CHECK
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Il calendario Puglia 2026/2027 esiste:
-- select id, region, school_year, status, valid_from, valid_to, source, version
-- from public.school_calendars
-- where country = 'IT' and region = 'Puglia' and school_year = '2026/2027';

-- 2) Eventi regionali (comune IS NULL) — attese 10 righe:
-- select event_type, start_date, end_date, label, source_level
-- from public.school_calendar_events
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Puglia' and school_year='2026/2027')
--   and comune is null
-- order by start_date;

-- 3) Eventi locali Rutigliano (comune = 'Rutigliano') — attesa 1 riga:
-- select event_type, start_date, end_date, label, comune
-- from public.school_calendar_events
-- where calendar_id = (select id from public.school_calendars where country='IT' and region='Puglia' and school_year='2026/2027')
--   and comune = 'Rutigliano'
-- order by start_date;

-- 4) Nessun duplicato:
-- select calendar_id, event_type, start_date, end_date, comune, count(*)
-- from public.school_calendar_events
-- group by calendar_id, event_type, start_date, end_date, comune
-- having count(*) > 1;

-- 5) Nessun marcatore di confine con comune valorizzato (deve tornare 0 righe):
-- select * from public.school_calendar_events
-- where event_type in ('school_year_start', 'school_year_end') and comune is not null;

-- 6) SOLO dopo revisione manuale — pubblica il calendario (preferibile farlo
--    da /admin/school-calendar, stesso percorso già testato):
-- update public.school_calendars
-- set status = 'published'
-- where country = 'IT' and region = 'Puglia' and school_year = '2026/2027' and status = 'draft';


-- ─────────────────────────────────────────────────────────────────────────
-- SEZIONE E — ROLLBACK COMPLETO
-- ─────────────────────────────────────────────────────────────────────────

-- delete from public.school_calendars where country = 'IT' and region = 'Puglia' and school_year = '2026/2027';
-- (cascade elimina automaticamente tutti gli eventi collegati, regionali e locali)
