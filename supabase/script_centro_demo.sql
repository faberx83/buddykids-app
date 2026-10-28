-- TRAMA — CENTRO DIMOSTRATIVO PER LE DEMO AI CENTRI (28/10/2026)
-- Script da lanciare a mano, non una migration (deploy.sh non lo applica da solo).
--
-- Richiesta di Fabrizio: portale centri "pronto per una prima condivisione con
-- potenziali partner"; scelta l'opzione 1: un centro finto ma realistico, con un
-- suo account, da mostrare dal vivo.
--
-- Cosa crea (idempotente: si può rilanciare prima di ogni demo, rinfresca
-- "oggi", richieste e registro):
--   1. il centro "Ludoteca Il Girasole" (Milano), ATTIVO, con 4 attività a
--      giorni singoli e i giorni già aperti: Pomeriggi (6 settimane da oggi),
--      Ponte dell'Immacolata (7–8/12), Vacanze di Natale (feriali 22/12–6/1),
--      Laboratorio del sabato (6 sabati);
--   2. tre famiglie dimostrative con quattro bambini dai nomi inventati, che NON
--      possono entrare in TRAMA (nessuna password, account bloccato): servono
--      solo a far vedere richieste e registro al centro;
--   3. le richieste: 2 da rispondere (Ponte, Natale), 2 accettate per oggi
--      (Pomeriggi), 2 messaggi (uno da rispondere, uno già risposto), il
--      check-in di un genitore da confermare.
--
-- Dove si vede e dove no:
--   - le famiglie vere NON vedono il centro: è segnato come prova
--     (centers.is_test_fixture), come i centri di prova del 21/10;
--   - le famiglie dimostrative stanno nella coorte "internal-preview", quindi
--     il cruscotto della beta non le conta tra le famiglie;
--   - si vede solo entrando col gestore faberx83+centrodemo@gmail.com e in Admin.
--
-- Il gestore: se l'account faberx83+centrodemo@gmail.com esiste già diventa
-- gestore del centro; se non esiste, lo script prepara la candidatura approvata,
-- e la registrazione su partner.tramapp.it con quell'email lo fa nascere gestore
-- (stesso percorso dei centri veri, migration_52).
--
-- Lancio: APPLY_SQL=supabase/script_centro_demo.sql SQL_ONLY=1 bash deploy.sh
--
-- Ripiego (toglie tutto):
--   delete from public.attendance_records where kid_id::text like 'd3e00000-0000-4000-8000-0000000002%';
--   delete from public.inquiry_messages where inquiry_id in (select id from public.activity_inquiries where activity_id::text like 'd3e00000-0000-4000-8000-0000000000%');
--   delete from public.activity_inquiries where activity_id::text like 'd3e00000-0000-4000-8000-0000000000%';
--   delete from public.booking_days where booking_id in (select id from public.bookings where activity_id::text like 'd3e00000-0000-4000-8000-0000000000%');
--   delete from public.booking_kids where booking_id in (select id from public.bookings where activity_id::text like 'd3e00000-0000-4000-8000-0000000000%');
--   delete from public.bookings where activity_id::text like 'd3e00000-0000-4000-8000-0000000000%';
--   delete from auth.users where id::text like 'd3e00000-0000-4000-8000-0000000001%';   -- famiglie e bambini (a cascata)
--   update public.profiles set center_id = null, role = 'parent' where lower(email) = 'faberx83+centrodemo@gmail.com';
--   delete from public.center_leads where dedupe_key = 'demo-ludoteca-il-girasole';
--   delete from public.centers where id = 'd3e00000-0000-4000-8000-000000000001';      -- attività e giorni a cascata

do $$
declare
  v_center   constant uuid := 'd3e00000-0000-4000-8000-000000000001';
  v_pom      constant uuid := 'd3e00000-0000-4000-8000-000000000011';
  v_ponte    constant uuid := 'd3e00000-0000-4000-8000-000000000012';
  v_natale   constant uuid := 'd3e00000-0000-4000-8000-000000000013';
  v_sabato   constant uuid := 'd3e00000-0000-4000-8000-000000000014';
  v_fam1     constant uuid := 'd3e00000-0000-4000-8000-000000000101';
  v_fam2     constant uuid := 'd3e00000-0000-4000-8000-000000000102';
  v_fam3     constant uuid := 'd3e00000-0000-4000-8000-000000000103';
  v_leo      constant uuid := 'd3e00000-0000-4000-8000-000000000201';
  v_emma     constant uuid := 'd3e00000-0000-4000-8000-000000000202';
  v_tommaso  constant uuid := 'd3e00000-0000-4000-8000-000000000203';
  v_sofia    constant uuid := 'd3e00000-0000-4000-8000-000000000204';
  v_b1       constant uuid := 'd3e00000-0000-4000-8000-000000000301';
  v_b2       constant uuid := 'd3e00000-0000-4000-8000-000000000302';
  v_b3       constant uuid := 'd3e00000-0000-4000-8000-000000000303';
  v_b4       constant uuid := 'd3e00000-0000-4000-8000-000000000304';
  v_q1       constant uuid := 'd3e00000-0000-4000-8000-000000000401';
  v_q2       constant uuid := 'd3e00000-0000-4000-8000-000000000402';
  v_email    constant text := 'faberx83+centrodemo@gmail.com';
  v_today    date := (now() at time zone 'Europe/Rome')::date;
  v_year     int;
  v_gestore  uuid;
  v_day      date;
  v_today_is_weekday boolean;
  v_pom_days uuid[];
  v_d        uuid;
begin
  v_today_is_weekday := extract(isodow from v_today) between 1 and 5;

  -- ── 1. Centro ────────────────────────────────────────────────────────
  insert into public.centers
    (id, slug, name, emoji, city, address, description, contact_email, gradient,
     has_bar, accessible, accessible_note, cancellation_window_days, multiweek_discount_percent,
     family_discount_tiers, is_test_fixture)
  values
    (v_center, 'demo-ludoteca-il-girasole', 'Ludoteca Il Girasole', '🌻', 'Milano', 'Via delle Margherite 8, Milano',
     'Ludoteca per bambini dai 4 ai 10 anni: pomeriggi dopo la scuola, laboratori del sabato e giornate intere quando la scuola è chiusa. Spazio luminoso con giardino, educatori fissi, merenda inclusa.',
     v_email, 'linear-gradient(135deg,#FFF6D6,#E2F0EF)', false, true, 'Ingresso senza gradini e bagno attrezzato',
     2, 5, '[10, 15, 20]'::jsonb, true)
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, address = excluded.address,
    contact_email = excluded.contact_email, is_test_fixture = true;

  -- Il trigger trg_init_center_onboarding_lead crea lo stato LEAD: il centro
  -- dimostrativo nasce già attivo, con le due verifiche fatte.
  insert into public.center_onboarding_state (center_id, status, referent_confirmed_at, activities_checked_at)
  values (v_center, 'APPROVED', now(), now())
  on conflict (center_id) do update set status = 'APPROVED',
    referent_confirmed_at = coalesce(public.center_onboarding_state.referent_confirmed_at, now()),
    activities_checked_at = coalesce(public.center_onboarding_state.activities_checked_at, now());

  -- Regole di cancellazione confermate (stessa voce della checklist).
  insert into public.center_onboarding_checklist_completions (center_id, item_key, completed, completed_at)
  values (v_center, 'cancellation_policy_set', true, now())
  on conflict (center_id, item_key) do nothing;

  -- ── 2. Gestore ──────────────────────────────────────────────────────
  select id into v_gestore from public.profiles where lower(email) = v_email;
  if v_gestore is not null then
    update public.profiles set role = 'center_admin', center_id = v_center
    where id = v_gestore and role <> 'platform_admin';
    raise notice 'Gestore collegato: % è gestore di Ludoteca Il Girasole.', v_email;
  else
    insert into public.center_leads
      (suggested_name, suggested_locality, dedupe_key, status, lead_type, candidate_email,
       claimed_center_id, claimed_at, admin_note, reward_status)
    select 'Ludoteca Il Girasole', 'Milano', 'demo-ludoteca-il-girasole', 'claimed', 'self_candidacy', v_email,
           v_center, now(), 'Centro dimostrativo per le demo ai centri (script_centro_demo.sql)', 'not_applicable'
    where not exists (select 1 from public.center_leads where dedupe_key = 'demo-ludoteca-il-girasole');
    raise notice 'Manca l''account %: registralo su partner.tramapp.it ("Crea l''accesso") e nascerà gestore del centro.', v_email;
  end if;

  -- ── 3. Attività (a giorni singoli) ──────────────────────────────────
  insert into public.activities
    (id, center_id, slug, name, emoji, city, address, age_min, age_max, price_per_week,
     description, booking_mode, min_days_per_booking, days, hours, img_gradient, meal_option)
  values
    (v_pom, v_center, 'demo-girasole-pomeriggi', 'Pomeriggi al Girasole', '🎒', 'Milano', 'Via delle Margherite 8, Milano', 6, 10, 75,
     'Dopo la scuola: merenda, compiti con un educatore, poi gioco libero e un laboratorio diverso ogni giorno. Si viene anche solo nei giorni che servono.',
     'day_only', 1, 'Dal lunedì al venerdì', '16:30 - 18:30', 'linear-gradient(135deg,#FFF6D6,#FDE7B0)', 'none'),
    (v_ponte, v_center, 'demo-girasole-ponte-immacolata', 'Ponte dell''Immacolata', '🎄', 'Milano', 'Via delle Margherite 8, Milano', 4, 10, 175,
     'Due giornate intere mentre la scuola è chiusa: addobbi, biscotti di Natale, giochi in giardino e pranzo insieme. Si può scegliere anche un giorno solo.',
     'day_only', 1, '7 e 8 dicembre', '08:30 - 16:30', 'linear-gradient(135deg,#E2F0EF,#CFE6E3)', 'included'),
    (v_natale, v_center, 'demo-girasole-vacanze-natale', 'Vacanze di Natale al Girasole', '⛄', 'Milano', 'Via delle Margherite 8, Milano', 4, 10, 175,
     'Le giornate delle vacanze con laboratori, cinema del mattino e uscite al parco. Pranzo incluso. Si sceglie giorno per giorno.',
     'day_only', 1, 'Giorni feriali dal 22 dicembre al 5 gennaio', '08:30 - 16:30', 'linear-gradient(135deg,#E8EEF6,#E2F0EF)', 'included'),
    (v_sabato, v_center, 'demo-girasole-laboratorio-sabato', 'Laboratorio del sabato: arte e riciclo', '🎨', 'Milano', 'Via delle Margherite 8, Milano', 5, 10, 60,
     'Due ore il sabato mattina per costruire, dipingere e inventare con materiali di recupero. Ogni sabato un progetto nuovo da portare a casa.',
     'day_only', 1, 'Il sabato', '10:00 - 12:00', 'linear-gradient(135deg,#FCE8E3,#FFF6D6)', 'none')
  on conflict (id) do update set name = excluded.name, description = excluded.description,
    hours = excluded.hours, days = excluded.days, price_per_week = excluded.price_per_week;

  -- Giorni aperti. Pomeriggi: feriali da oggi per 6 settimane.
  insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable)
  select v_pom, d::date, true, 12, 12, true
  from generate_series(v_today, v_today + 41, '1 day') d
  where extract(isodow from d) between 1 and 5
  on conflict (activity_id, date) do nothing;

  -- Ponte: 7 e 8 dicembre di quest'anno, o dell'anno dopo se sono passati.
  v_year := case when v_today > make_date(extract(year from v_today)::int, 12, 8)
                 then extract(year from v_today)::int + 1 else extract(year from v_today)::int end;
  insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable, special_label, special_emoji)
  select v_ponte, d, true, 15, 15, true, null, null
  from unnest(array[make_date(v_year, 12, 7), make_date(v_year, 12, 8)]) d
  where d >= v_today
  on conflict (activity_id, date) do nothing;

  -- Natale: feriali dal 22/12 al 6/1, senza 25, 26 dicembre, 1 e 6 gennaio.
  v_year := case when v_today <= make_date(extract(year from v_today)::int, 1, 6)
                 then extract(year from v_today)::int - 1 else extract(year from v_today)::int end;
  insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable)
  select v_natale, d::date, true, 15, 15, true
  from generate_series(make_date(v_year, 12, 22), make_date(v_year + 1, 1, 6), '1 day') d
  where extract(isodow from d) between 1 and 5
    and to_char(d, 'MM-DD') not in ('12-25', '12-26', '01-01', '01-06')
    and d::date >= v_today
  on conflict (activity_id, date) do nothing;

  -- Sabato: i prossimi 6 sabati (oggi compreso se è sabato).
  insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable)
  select v_sabato, (v_today + ((6 - extract(isodow from v_today)::int + 7) % 7) + 7 * n)::date, true, 10, 10, true
  from generate_series(0, 5) n
  on conflict (activity_id, date) do nothing;

  -- ── 4. Famiglie dimostrative (non possono entrare: niente password, bloccate) ──
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, banned_until,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', f.id, 'authenticated', 'authenticated', f.email, '', now(), '2999-01-01',
         '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', f.name), now(), now(),
         '', '', '', ''
  from (values
    (v_fam1, 'faberx83+demo-ferri@gmail.com', 'Giulia Ferri'),
    (v_fam2, 'faberx83+demo-colombo@gmail.com', 'Marco Colombo'),
    (v_fam3, 'faberx83+demo-bianchi@gmail.com', 'Sara Bianchi')
  ) as f(id, email, name)
  where not exists (select 1 from auth.users u where u.id = f.id);

  -- Il profilo lo crea il trigger handle_new_user; qui solo il nome.
  update public.profiles set full_name = 'Giulia Ferri' where id = v_fam1;
  update public.profiles set full_name = 'Marco Colombo' where id = v_fam2;
  update public.profiles set full_name = 'Sara Bianchi' where id = v_fam3;

  -- Fuori dai numeri della beta (il cruscotto esclude la coorte interna).
  insert into public.beta_cohort_memberships (user_id, cohort_key, active)
  select u, 'internal-preview', true from unnest(array[v_fam1, v_fam2, v_fam3]) u
  where not exists (select 1 from public.beta_cohort_memberships m where m.user_id = u and m.cohort_key = 'internal-preview');

  insert into public.kids (id, parent_id, name, birth_date, gender)
  values
    (v_leo, v_fam1, 'Leo', (v_today - interval '8 years 3 months')::date, 'M'),
    (v_emma, v_fam2, 'Emma', (v_today - interval '7 years 1 month')::date, 'F'),
    (v_tommaso, v_fam2, 'Tommaso', (v_today - interval '9 years 6 months')::date, 'M'),
    (v_sofia, v_fam3, 'Sofia', (v_today - interval '6 years 8 months')::date, 'F')
  on conflict (id) do nothing;

  -- ── 5. Richieste e registro (si rifanno a ogni lancio) ──────────────
  delete from public.attendance_records where kid_id in (v_leo, v_emma, v_tommaso, v_sofia);
  delete from public.inquiry_messages where inquiry_id in (v_q1, v_q2);
  delete from public.activity_inquiries where id in (v_q1, v_q2);
  delete from public.booking_days where booking_id in (v_b1, v_b2, v_b3, v_b4);
  delete from public.booking_kids where booking_id in (v_b1, v_b2, v_b3, v_b4);
  delete from public.bookings where id in (v_b1, v_b2, v_b3, v_b4);
  update public.activity_days set spots_left = capacity where activity_id in (v_pom, v_ponte, v_natale, v_sabato);

  -- I primi tre giorni dei Pomeriggi da oggi (oggi compreso se è feriale).
  select array_agg(id order by date) into v_pom_days
  from (select id, date from public.activity_days where activity_id = v_pom and date >= v_today order by date limit 3) x;

  -- B1: Sofia, Pomeriggi, 3 giorni da oggi, accettata.
  insert into public.bookings (id, parent_id, activity_id, status, payment_method, total_amount, partner_decision,
                               created_at, responded_at, read_by_center, read_by_parent)
  values (v_b1, v_fam3, v_pom, 'confirmed', 'bank_transfer', 45, 'accepted', now() - interval '3 days', now() - interval '2 days', true, true);
  insert into public.booking_kids (booking_id, kid_id) values (v_b1, v_sofia);
  insert into public.booking_days (booking_id, activity_day_id, price, partner_decision, capacity_decremented)
  select v_b1, unnest(v_pom_days), 15, 'accepted', true;

  -- B2: Leo, Pomeriggi, i primi 2 giorni, accettata.
  insert into public.bookings (id, parent_id, activity_id, status, payment_method, total_amount, partner_decision,
                               created_at, responded_at, read_by_center, read_by_parent)
  values (v_b2, v_fam1, v_pom, 'confirmed', 'bank_transfer', 30, 'accepted', now() - interval '4 days', now() - interval '4 days', true, true);
  insert into public.booking_kids (booking_id, kid_id) values (v_b2, v_leo);
  insert into public.booking_days (booking_id, activity_day_id, price, partner_decision, capacity_decremented)
  select v_b2, unnest(v_pom_days[1:2]), 15, 'accepted', true;

  -- Posti occupati dalle due prenotazioni accettate.
  update public.activity_days d set spots_left = d.capacity - (
    select count(*) from public.booking_days bd join public.booking_kids bk on bk.booking_id = bd.booking_id
    where bd.activity_day_id = d.id and bd.partner_decision = 'accepted')
  where d.activity_id = v_pom and d.id = any(v_pom_days);

  -- B3: Leo, Ponte, due giorni, da rispondere (da ieri).
  insert into public.bookings (id, parent_id, activity_id, status, payment_method, total_amount, partner_decision,
                               created_at, read_by_center, read_by_parent)
  select v_b3, v_fam1, v_ponte, 'pending', 'bank_transfer', 70, 'pending', now() - interval '26 hours', false, true;
  insert into public.booking_kids (booking_id, kid_id) values (v_b3, v_leo);
  insert into public.booking_days (booking_id, activity_day_id, price, partner_decision, capacity_decremented)
  select v_b3, id, 35, 'pending', false from public.activity_days where activity_id = v_ponte;

  -- B4: Emma e Tommaso, Natale, i primi 3 giorni, da rispondere (da stamattina).
  insert into public.bookings (id, parent_id, activity_id, status, payment_method, total_amount, partner_decision,
                               created_at, read_by_center, read_by_parent)
  values (v_b4, v_fam2, v_natale, 'pending', 'bank_transfer', 210, 'pending', now() - interval '3 hours', false, true);
  insert into public.booking_kids (booking_id, kid_id) values (v_b4, v_emma), (v_b4, v_tommaso);
  insert into public.booking_days (booking_id, activity_day_id, price, partner_decision, capacity_decremented)
  select v_b4, id, 35, 'pending', false
  from (select id from public.activity_days where activity_id = v_natale order by date limit 3) x;

  -- Registro di oggi: Sofia, check-in fatto dalla mamma alle 16:28, da confermare.
  -- (Solo se oggi è un giorno dei Pomeriggi; Leo resta da segnare.)
  if v_today_is_weekday then
    select id into v_d from public.activity_days where activity_id = v_pom and date = v_today;
    if v_d is not null then
      insert into public.attendance_records (activity_id, kid_id, date, status, checked_in_by, checkin_at, activity_day_id)
      values (v_pom, v_sofia, v_today, 'presente', 'parent',
              (v_today + time '16:28') at time zone 'Europe/Rome', v_d);
    end if;
  end if;

  -- Messaggi: uno da rispondere, uno già risposto.
  insert into public.activity_inquiries (id, activity_id, parent_id, message, status, created_at, read_by_center, read_by_parent, last_message_at)
  values (v_q1, v_natale, v_fam2,
          'Buongiorno, per le vacanze di Natale si può arrivare alle 8? E il pranzo è per tutti o si porta da casa?',
          'aperta', now() - interval '5 hours', false, true, now() - interval '5 hours');
  insert into public.inquiry_messages (inquiry_id, author_id, author_side, body, created_at)
  values (v_q1, v_fam2, 'parent',
          'Buongiorno, per le vacanze di Natale si può arrivare alle 8? E il pranzo è per tutti o si porta da casa?', now() - interval '5 hours');

  insert into public.activity_inquiries (id, activity_id, parent_id, message, status, reply, replied_by, replied_at, created_at, read_by_center, read_by_parent, last_message_at)
  values (v_q2, v_sabato, v_fam3,
          'Ciao! Sofia ha 6 anni, può partecipare al laboratorio del sabato?',
          'risposta', 'Certo! Dai 5 anni in su va benissimo. Vi aspettiamo sabato alle 10.', v_gestore, now() - interval '1 day',
          now() - interval '2 days', true, true, now() - interval '1 day');
  insert into public.inquiry_messages (inquiry_id, author_id, author_side, body, created_at)
  values
    (v_q2, v_fam3, 'parent', 'Ciao! Sofia ha 6 anni, può partecipare al laboratorio del sabato?', now() - interval '2 days'),
    (v_q2, v_gestore, 'center', 'Certo! Dai 5 anni in su va benissimo. Vi aspettiamo sabato alle 10.', now() - interval '1 day');

  raise notice 'Centro dimostrativo pronto: Ludoteca Il Girasole, 4 attività, 4 prenotazioni (2 da rispondere), 2 messaggi%.',
    case when v_today_is_weekday then ', 1 check-in da confermare oggi' else ' (oggi non è un giorno feriale: registro vuoto)' end;
end;
$$;
