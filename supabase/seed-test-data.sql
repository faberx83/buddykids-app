-- BuddyKids — seed dati di TEST per la simulazione in produzione (Playwright)
--
-- Obiettivo: creare un centro/attività "sandbox" isolati dai dati reali, e
-- promuovere i 3 account di test già usati da .env.test ai ruoli giusti, in
-- modo che test-deploy.sh possa fare login reale e prenotare/gestire senza
-- toccare centri/attività di clienti veri.
--
-- PRECONDIZIONE (da fare UNA VOLTA, a mano, prima di lanciare questo file):
-- registra normalmente dall'app (schermata di login/signup, come farebbe un
-- utente vero) questi 3 account, con una password a tua scelta da salvare
-- poi in ".env.test". USA UN DOMINIO EMAIL VERO (con MX validi) — Supabase
-- rifiuta con "invalid mail" domini inventati come @buddykids.it. Un trucco
-- comodo: il tuo indirizzo con alias "+" (se il provider li supporta):
--   faberx83+test-genitore@gmail.com
--   faberx83+test-gestore@gmail.com
--   faberx83@gmail.com
-- (se usi indirizzi diversi, sostituisci le email nei 3 UPDATE più sotto e
-- in .env.test). Questo script NON crea utenti auth (serve il flusso signUp dell'app, o la
-- Admin API, non un insert SQL diretto) — presuppone che esistano già in
-- auth.users/public.profiles con il trigger handle_new_user() già passato.
--
-- Come eseguirlo: incolla UNO STEP alla volta nel SQL Editor di Supabase
-- (non tutto il file insieme), verificando che ogni blocco vada a buon fine
-- prima di passare al successivo — stessa convenzione usata per schema.sql.
-- Lo script è idempotente: si può rilanciare più volte senza duplicare nulla.


-- ─────────────────────────────────────────────
-- STEP 1 — Centro di test
-- ─────────────────────────────────────────────
insert into public.centers (slug, name, emoji, city, address, description, contact_email)
values (
  'centro-test-buddykids',
  '[TEST] Centro BuddyKids',
  '🧪',
  'Milano',
  'Via di Prova 1, Milano',
  'Centro riservato ai test automatici (Playwright) — non è un cliente reale, non modificare/eliminare a mano.',
  'faberx83+test-gestore@gmail.com'
)
on conflict (slug) do nothing;


-- ─────────────────────────────────────────────
-- STEP 2 — Attività di test, agganciata al centro sopra
-- ─────────────────────────────────────────────
insert into public.activities (
  center_id, slug, name, emoji, address, city,
  age_min, age_max, price_per_week, shuttle_price,
  description, meal_option, rating, reviews_count,
  days, hours, spots_left, show_exact_spots
)
select
  c.id,
  'attivita-test-buddykids',
  '[TEST] Attività BuddyKids',
  '🧪',
  'Via di Prova 1, Milano',
  'Milano',
  3, 12, 120.00, 15.00,
  'Attività riservata ai test automatici (Playwright) — non è un servizio reale, non modificare/eliminare a mano.',
  'none', 4.5, 0,
  'Lun-Ven', '08:00 - 17:30', 20, true
from public.centers c
where c.slug = 'centro-test-buddykids'
on conflict (slug) do nothing;


-- ─────────────────────────────────────────────
-- STEP 3 — Settimane prenotabili per l'attività di test (13 settimane, come
-- la griglia stagionale dell'app, a partire dal primo lunedì di giugno
-- dell'anno corrente) — solo se non esistono già per non duplicarle ad ogni
-- rilancio dello script.
-- ─────────────────────────────────────────────
do $$
declare
  v_activity_id uuid;
  v_year int := extract(year from current_date);
  v_june1 date := make_date(v_year, 6, 1);
  v_dow int := extract(dow from v_june1); -- 0=domenica..6=sabato
  v_days_to_monday int := (8 - v_dow) % 7;
  v_first_monday date := v_june1 + v_days_to_monday;
  i int;
begin
  select id into v_activity_id
  from public.activities
  where slug = 'attivita-test-buddykids';

  if v_activity_id is null then
    raise notice 'Attività di test non trovata — esegui prima lo STEP 2.';
  elsif exists (select 1 from public.activity_weeks where activity_id = v_activity_id) then
    raise notice 'Settimane già presenti per l''attività di test — nessuna azione.';
  else
    for i in 0..12 loop
      insert into public.activity_weeks (activity_id, label, start_date, end_date, capacity, spots_left)
      values (
        v_activity_id,
        'Settimana ' || (i + 1),
        v_first_monday + (i * 7),
        v_first_monday + (i * 7) + 4,
        20,
        20
      );
    end loop;
  end if;
end $$;


-- ─────────────────────────────────────────────
-- STEP 4 — Promuovi faberx83+test-gestore@gmail.com a "center_admin" del centro di
-- test (richiede che l'account si sia già registrato via app, vedi sopra).
-- ─────────────────────────────────────────────
update public.profiles p
set role = 'center_admin',
    center_id = c.id
from public.centers c
where p.email = 'faberx83+test-gestore@gmail.com'
  and c.slug = 'centro-test-buddykids';


-- ─────────────────────────────────────────────
-- STEP 5 — Promuovi faberx83@gmail.com a "platform_admin".
-- ─────────────────────────────────────────────
update public.profiles
set role = 'platform_admin'
where email = 'faberx83@gmail.com';


-- ─────────────────────────────────────────────
-- STEP 6 — Bambino di test per faberx83+test-genitore@gmail.com (serve per i test
-- di prenotazione/gruppi lato genitore) — solo se non ne ha già uno.
-- avatar_url: una piccola SVG inline (data URI, nessuna dipendenza da rete
-- esterna) — serve a testare che l'avatar in "Per bambino" mostri la FOTO
-- reale invece dell'emoji, senza dover automatizzare l'intero flusso di
-- upload+ritaglio (vedi tests/genitori/home.spec.ts TC-143).
-- ─────────────────────────────────────────────
insert into public.kids (parent_id, name, birth_date, avatar_emoji, avatar_url)
select
  p.id,
  '[TEST] Bimbo Prova',
  make_date(extract(year from current_date)::int - 7, 6, 15),
  '🧪',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100''%3E%3Ccircle cx=''50'' cy=''50'' r=''50'' fill=''%234DAFEF''/%3E%3C/svg%3E'
from public.profiles p
where p.email = 'faberx83+test-genitore@gmail.com'
  and not exists (
    select 1 from public.kids k where k.parent_id = p.id and k.name = '[TEST] Bimbo Prova'
  );

-- Se il bambino di test esiste già da prima di questa modifica, aggiorna
-- comunque il suo avatar_url (idempotente, non duplica righe).
update public.kids
set avatar_url = 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''100'' height=''100''%3E%3Ccircle cx=''50'' cy=''50'' r=''50'' fill=''%234DAFEF''/%3E%3C/svg%3E'
where name = '[TEST] Bimbo Prova'
  and avatar_url is null
  and parent_id = (select id from public.profiles where email = 'faberx83+test-genitore@gmail.com');


-- ─────────────────────────────────────────────
-- VERIFICA — esegui questa select per controllare che tutto sia a posto:
-- ─────────────────────────────────────────────
-- select email, role, center_id from public.profiles
--   where email in ('faberx83+test-genitore@gmail.com','faberx83+test-gestore@gmail.com','faberx83@gmail.com');
-- select id, slug, name from public.centers where slug = 'centro-test-buddykids';
-- select id, slug, name from public.activities where slug = 'attivita-test-buddykids';
-- select label, start_date, end_date, spots_left from public.activity_weeks
--   where activity_id = (select id from public.activities where slug = 'attivita-test-buddykids')
--   order by start_date;
