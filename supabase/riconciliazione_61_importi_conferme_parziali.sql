-- TRAMA — Riconciliazione: importi delle conferme parziali già esistenti
-- STATO: PIANO DI RICONCILIAZIONE — DA APPROVARE, NON ESEGUIRE IN AUTOMATICO
-- (deploy.sh NON lo propone: non ha la riga "PREPARATA, NON APPLICATA".)
--
-- Perché: dal 04/11/2026 l'importo di una prenotazione a giorni conta solo i
-- giorni non rifiutati dal centro (lib/booking-response/finalize-day-decisions.ts).
-- Le risposte date prima hanno lasciato l'importo di tutti i giorni.
-- Simulazione in sola lettura del 04/11: 1 prenotazione.
--   "Prova FP", 1 bambino, nessuno sconto: 5 giorni chiesti, 1 rifiutato →
--   importo salvato €160, giusto €128.
-- Il passo 2 corregge SOLO i casi semplici (1 bambino, nessuno sconto), dove
-- l'importo giusto è la somma dei giorni non rifiutati. Con più bambini o con
-- sconti il passo 1 li segna "DA DECIDERE" (oggi nessuno): il codice nuovo li
-- riallinea comunque alla prossima risposta del centro su quella prenotazione.
-- Come eseguirlo (Fabrizio, dopo approvazione):
--   APPLY_SQL="supabase/riconciliazione_61_importi_conferme_parziali.sql" SQL_ONLY=1 bash deploy.sh

-- ── Passo 1: simulazione (sola lettura) ────────────────────────────────
with k as (select booking_id, count(*)::int as kids from public.booking_kids group by booking_id)
select b.id, a.name as attivita, b.total_amount as importo_salvato, b.discount_amount, coalesce(k.kids, 1) as bambini,
       sum(bd.price) filter (where bd.partner_decision <> 'rejected') as importo_giusto_se_semplice,
       case when coalesce(k.kids, 1) = 1 and b.discount_amount = 0 then 'OK' else 'DA DECIDERE' end as esito
from public.bookings b
join public.activities a on a.id = b.activity_id
join public.booking_days bd on bd.booking_id = b.id
left join k on k.booking_id = b.id
where b.status <> 'cancelled'
group by b.id, a.name, k.kids
having count(*) filter (where bd.partner_decision = 'rejected') > 0
   and b.total_amount <> sum(bd.price) filter (where bd.partner_decision <> 'rejected') * coalesce(k.kids, 1) - b.discount_amount;

-- ── Passo 2: correzione dei casi semplici (deploy.sh: una transazione) ──
update public.bookings b
set total_amount = r.giusto
from (
  select bd.booking_id, sum(bd.price) filter (where bd.partner_decision <> 'rejected') as giusto
  from public.booking_days bd
  group by bd.booking_id
  having count(*) filter (where bd.partner_decision = 'rejected') > 0
) r
where b.id = r.booking_id
  and b.status <> 'cancelled'
  and b.discount_amount = 0
  and (select count(*) from public.booking_kids bk where bk.booking_id = b.id) <= 1
  and b.total_amount <> r.giusto;

-- ── Passo 3: verifica ──────────────────────────────────────────────────
-- Rilanciare il passo 1: devono restare solo eventuali righe "DA DECIDERE".
-- Ripiego: per "Prova FP" (id c21988c4-8380-4a26-b83f-fe9405986cf6) rimettere total_amount = 160.
