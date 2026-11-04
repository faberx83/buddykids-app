-- TRAMA — Riconciliazione dopo la migration 60: posti sottocontati (EXTRA-02)
-- STATO: PIANO DI RICONCILIAZIONE — DA APPROVARE, NON ESEGUIRE IN AUTOMATICO
-- (deploy.sh NON lo propone: non ha la riga "PREPARATA, NON APPLICATA".)
--
-- Prerequisito: migration 60 applicata (colonna capacity_units).
-- Perché: prima del 04/11/2026 una prenotazione con N bambini toglieva 1
-- posto invece di N. Simulazione in sola lettura del 04/11 (passo 1):
--   2 righe, entrambe demo e future:
--   UX DEMO 3 novembre — collaudo pubblicazione, 7 e 8 dicembre 2026,
--   2 bambini ciascuna (Giulia Test, Luca Test), posti 2, liberi 1 → atteso 0.
--   0 settimane coinvolte. Nessun giorno passato.
-- Cosa cambia: per ogni riga accettata con più bambini dei posti presi,
-- toglie dai posti liberi la differenza e registra capacity_units = bambini.
-- Solo se i posti liberi bastano; le righe dove non bastano (sarebbe
-- sovraprenotato) NON vengono toccate e vanno decise a mano con il centro
-- (passo 1 le segna "DA DECIDERE").
-- Come eseguirlo (Fabrizio, dopo approvazione):
--   APPLY_SQL="supabase/riconciliazione_60_posti_per_bambino.sql" SQL_ONLY=1 bash deploy.sh

-- ── Passo 1: simulazione (sola lettura) ────────────────────────────────
select a.name as attivita, ad.date, ad.capacity, ad.spots_left,
       bd.booking_id, k.kids, bd.capacity_units,
       k.kids - greatest(bd.capacity_units, 1) as posti_mancanti,
       ad.spots_left - (k.kids - greatest(bd.capacity_units, 1)) as liberi_dopo,
       case when ad.spots_left >= k.kids - greatest(bd.capacity_units, 1) then 'OK' else 'DA DECIDERE' end as esito
from public.booking_days bd
join (select booking_id, count(*)::int as kids from public.booking_kids group by booking_id) k on k.booking_id = bd.booking_id
join public.activity_days ad on ad.id = bd.activity_day_id
join public.activities a on a.id = ad.activity_id
where bd.capacity_decremented and k.kids > greatest(bd.capacity_units, 1)
order by ad.date;

-- ── Passo 2: correzione (deploy.sh la esegue in un'unica transazione) ───

create temporary table _riconc on commit drop as
select bd.booking_id, bd.activity_day_id, k.kids, greatest(bd.capacity_units, 1) as presi,
       k.kids - greatest(bd.capacity_units, 1) as mancanti
from public.booking_days bd
join (select booking_id, count(*)::int as kids from public.booking_kids group by booking_id) k on k.booking_id = bd.booking_id
join public.activity_days ad on ad.id = bd.activity_day_id
where bd.capacity_decremented and k.kids > greatest(bd.capacity_units, 1)
  and ad.spots_left >= k.kids - greatest(bd.capacity_units, 1);

update public.activity_days ad
set spots_left = ad.spots_left - r.tot
from (select activity_day_id, sum(mancanti) as tot from _riconc group by activity_day_id) r
where ad.id = r.activity_day_id and ad.spots_left >= r.tot;

update public.booking_days bd
set capacity_units = r.kids
from _riconc r
where bd.booking_id = r.booking_id and bd.activity_day_id = r.activity_day_id;

-- Settimane: stessa regola (oggi 0 righe coinvolte).
create temporary table _riconc_w on commit drop as
select bw.booking_id, bw.week_id, k.kids, k.kids - greatest(bw.capacity_units, 1) as mancanti
from public.booking_weeks bw
join (select booking_id, count(*)::int as kids from public.booking_kids group by booking_id) k on k.booking_id = bw.booking_id
join public.activity_weeks aw on aw.id = bw.week_id
where bw.capacity_decremented and k.kids > greatest(bw.capacity_units, 1)
  and aw.spots_left >= k.kids - greatest(bw.capacity_units, 1);

update public.activity_weeks aw
set spots_left = aw.spots_left - r.tot
from (select week_id, sum(mancanti) as tot from _riconc_w group by week_id) r
where aw.id = r.week_id and aw.spots_left >= r.tot;

update public.booking_weeks bw
set capacity_units = r.kids
from _riconc_w r
where bw.booking_id = r.booking_id and bw.week_id = r.week_id;


-- ── Passo 3: verifica (deve tornare 0 righe "OK" rimaste) ───────────────
-- Rilanciare il passo 1: restano solo eventuali righe "DA DECIDERE".
-- Controllo di coerenza: liberi = totali − posti presi, per ogni giorno con prenotazioni.
select ad.id, ad.date, ad.capacity, ad.spots_left,
       coalesce(sum(bd.capacity_units) filter (where bd.capacity_decremented), 0) as presi
from public.activity_days ad
left join public.booking_days bd on bd.activity_day_id = ad.id
group by ad.id
having ad.spots_left > ad.capacity - coalesce(sum(bd.capacity_units) filter (where bd.capacity_decremented), 0);

-- ── Ripiego ────────────────────────────────────────────────────────────
-- Per le 2 righe demo: riportare spots_left a 1 sui giorni 7 e 8 dicembre
-- dell'attività "UX DEMO 3 novembre — collaudo pubblicazione" e
-- capacity_units a 1 sulle due righe booking_days corrispondenti.
