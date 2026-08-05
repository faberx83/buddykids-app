-- Script una tantum — seed di activity_days per le attività che ne sono
-- sprovviste (es. "Prova FP", creata da Fabrizio durante il tour Spotlight
-- Partner: "Configura i Giorni spot" non mostrava campi editabili perché
-- activity_days era vuota per quella attività).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase (progetto eagsgfxunwyyxwwilldy).
--
-- ════════════════════════════════════════════════════════════════
-- Contesto
-- ════════════════════════════════════════════════════════════════
-- Root cause (vedi anche il commento su defaultActivityDaysSeed in
-- app/actions/center.ts): createActivityAction non ha mai scritto righe in
-- activity_days per una nuova attività. Da questo commit in poi le NUOVE
-- attività ricevono un seed automatico di 6 settimane (lun-ven) alla
-- creazione — ma le attività GIÀ create prima di questo fix restano vuote
-- finché non le si popola manualmente. Verificato dal vivo (sola lettura):
-- oggi solo 2 attività hanno 0 righe in activity_days:
--   - "test" (slug 'test', center_id 3a240835-6412-402c-9c63-2c8cf0944fca)
--   - "Prova FP" (slug 'prova-fp', center_id f572aa29-c070-46e0-bd98-5c3ce6dd25ed
--     — il centro di test di faberx83+partnernew)
--
-- Questo script è GENERICO (non hard-codeato sui 2 id sopra): seeda
-- automaticamente 6 settimane (lun-ven, 30 giorni, a partire dal prossimo
-- lunedì) per QUALUNQUE attività che oggi ha 0 righe in activity_days —
-- copre le 2 già note e qualunque altra creata nel frattempo con lo stesso
-- problema, senza dover elencare gli id a mano.
--
-- Capacità di partenza: 15 posti/giorno (stesso valore di default usato dal
-- fix in codice) — arbitrario, il Gestore lo cambia dalla UI Calendario
-- disponibilità dopo il seed.

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — sola lettura, eseguire PRIMA
-- ════════════════════════════════════════════════════════════════

-- 1. Attività che oggi hanno 0 righe in activity_days (atteso: "test" e
--    "Prova FP", eventualmente altre create nel frattempo):
-- select a.id, a.slug, a.name, a.center_id, count(d.id) as days_count
-- from public.activities a
-- left join public.activity_days d on d.activity_id = a.id
-- group by a.id, a.slug, a.name, a.center_id
-- having count(d.id) = 0
-- order by a.id;

-- ════════════════════════════════════════════════════════════════
-- SEED
-- ════════════════════════════════════════════════════════════════

begin;

with target_activities as (
  select a.id as activity_id
  from public.activities a
  left join public.activity_days d on d.activity_id = a.id
  group by a.id
  having count(d.id) = 0
),
next_monday as (
  -- Prossimo lunedì (mai oggi stesso, coerente con nextMonday() in
  -- app/actions/center.ts): 1=lunedì in ISO dow.
  select (current_date + ((8 - extract(isodow from current_date)::int) % 7 || ' days')::interval)::date as start_date
),
week_offsets as (
  select generate_series(0, 5) as week_num -- 6 settimane: 0..5
),
weekday_offsets as (
  select generate_series(0, 4) as weekday_num -- lun..ven: 0..4
)
insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable, discount_percent, last_minute, special_label, special_emoji)
select
  ta.activity_id,
  nm.start_date + (w.week_num * 7 + wd.weekday_num) * interval '1 day',
  true,
  15,
  15,
  true,
  null,
  false,
  null,
  null
from target_activities ta
cross join next_monday nm
cross join week_offsets w
cross join weekday_offsets wd
on conflict (activity_id, date) do nothing;

commit;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il commit
-- ════════════════════════════════════════════════════════════════

-- select a.id, a.slug, a.name, count(d.id) as days_count
-- from public.activities a
-- join public.activity_days d on d.activity_id = a.id
-- where a.id in ('33283538-e529-42f4-9097-32de497f242b', '352ab541-254a-42ce-b2aa-ad2ac3c79036')
-- group by a.id, a.slug, a.name;
-- -- Atteso: days_count = 30 per entrambe.
--
-- Poi nell'app: /center/activities/prova-fp/calendar -> refresh -> il
-- calendario deve mostrare 6 righe di 5 giorni ciascuna, tutte cliccabili
-- (il pannello "Modifica" compare al click su una cella).

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- Rimuove SOLO le righe appena seedate per le 2 attività note (adatta
-- l'elenco se lo script ha toccato altre attività al momento
-- dell'esecuzione — vedi il pre-check per l'elenco reale):
-- delete from public.activity_days
-- where activity_id in ('33283538-e529-42f4-9097-32de497f242b', '352ab541-254a-42ce-b2aa-ad2ac3c79036');
