-- TRAMA — Centro di prova per la beta: attività con date vere (nov 2026 – gen 2027)
-- Bloccante B1 del lancio (LANCIO_BETA_20NOV.md, sezione 7, livello 2:
-- "centri di prova, dichiarati"). Decisione di Fabrizio del 26/10/2026:
-- un account gestore nuovo, centro "TRAMA · Centro di prova".
--
-- NON parte da solo con deploy.sh (manca di proposito la riga di stato
-- "preparata"): prima servono l'account e il centro, poi lo applichi con
--   APPLY_SQL=supabase/script_centro_di_prova_attivita.sql bash deploy.sh
--
-- Prima (Fabrizio, 5 minuti) — 27/10/2026: si passa dalla candidatura,
-- come farà un centro vero (form già compilato, in Admin → Segnalazioni
-- centri → "Candidature dei centri"). DOPO il deploy con migration_52 e con
-- la release "Centri: percorso del pilota" accesa:
--   1. Admin → Segnalazioni centri → "Centro di Prova" → "Approva e crea
--      centro" (città Milano, descrizione "Centro di prova di TRAMA per la
--      beta: le attività non esistono. Serve a provare richiesta, risposta
--      del centro, email e check-in. Nessun pagamento.");
--   2. arriva l'email "Centro di Prova è su TRAMA" a
--      faberx83+centroprova@gmail.com → "Crea l'accesso" (portale centri,
--      email già compilata) → conferma l'email → si entra già gestore;
--   3. solo allora questo script.
--   (Il nome del centro si può poi cambiare in "TRAMA · Centro di prova" da
--   Admin → Centri.)
--
-- Cosa fa: trova il centro di quell'account e aggiunge 4 attività di prova,
-- dichiarate nel nome e nella descrizione, a iscrizione per giorno singolo,
-- prezzo 0, 10 posti al giorno:
--   1. Milano — Pomeriggi di prova: tutti i giorni feriali dal 28/10 al
--      06/11 (settimana della prova generale) e poi mercoledì e venerdì fino
--      al 18/12;
--   2. Milano — Ponte di Sant'Ambrogio e dell'Immacolata: 7 e 8 dicembre;
--   3. Rutigliano — Pomeriggi di prova: feriali dal 28/10 al 06/11, poi
--      martedì e giovedì fino al 17/12;
--   4. Rutigliano — Vacanze di Natale di prova: 23, 24, 28, 29, 30 dicembre,
--      4 e 5 gennaio.
-- Nessun indirizzo e nessuna posizione sulla mappa: il centro non esiste.
-- Si può rieseguire: niente doppioni.
--
-- Ripiego: delete from public.activities where id in (
--   'a1c0de00-0000-4000-8000-000000000001','a1c0de00-0000-4000-8000-000000000002',
--   'a1c0de00-0000-4000-8000-000000000003','a1c0de00-0000-4000-8000-000000000004');
-- (i giorni e le eventuali prenotazioni di prova se ne vanno con le attività).

do $$
declare
  v_center uuid;
begin
  select p.center_id into v_center
  from public.profiles p
  where lower(p.email) = 'faberx83+centroprova@gmail.com' and p.role = 'center_admin';
  if v_center is null then
    raise exception 'Manca il gestore faberx83+centroprova@gmail.com: approva la candidatura "Centro di Prova" (Admin → Segnalazioni centri) e crea l''accesso dal link dell''email, poi rilancia.';
  end if;

  insert into public.activities
    (id, center_id, slug, name, emoji, city, address, age_min, age_max, price_per_week,
     description, booking_mode, min_days_per_booking, days, hours, weeks_available, img_gradient)
  values
    ('a1c0de00-0000-4000-8000-000000000001', v_center, 'prova-pomeriggi-milano',
     'Pomeriggi di prova · Milano', '🧪', 'Milano', null, 6, 11, 0,
     'Attività di prova di TRAMA: non esiste. Serve alle famiglie della beta per provare la richiesta a un centro, la risposta, le email e il check-in. Nessun pagamento.',
     'day_only', 1, 'Feriali fino al 6/11, poi mercoledì e venerdì', '16:30 - 18:30', '', 'linear-gradient(135deg,#EEF0F4,#E3F9F5)'),
    ('a1c0de00-0000-4000-8000-000000000002', v_center, 'prova-ponte-immacolata-milano',
     'Ponte di Sant''Ambrogio e Immacolata (prova) · Milano', '🧪', 'Milano', null, 6, 11, 0,
     'Attività di prova di TRAMA per il ponte del 7 e 8 dicembre: non esiste. Serve a provare la richiesta per i giorni di scuola chiusa. Nessun pagamento.',
     'day_only', 1, '7 e 8 dicembre', '08:30 - 16:30', '', 'linear-gradient(135deg,#EEF0F4,#E8F6FD)'),
    ('a1c0de00-0000-4000-8000-000000000003', v_center, 'prova-pomeriggi-rutigliano',
     'Pomeriggi di prova · Rutigliano', '🧪', 'Rutigliano', null, 6, 11, 0,
     'Attività di prova di TRAMA: non esiste. Serve alle famiglie della beta per provare la richiesta a un centro, la risposta, le email e il check-in. Nessun pagamento.',
     'day_only', 1, 'Feriali fino al 6/11, poi martedì e giovedì', '16:30 - 18:30', '', 'linear-gradient(135deg,#EEF0F4,#E3F9F5)'),
    ('a1c0de00-0000-4000-8000-000000000004', v_center, 'prova-natale-rutigliano',
     'Vacanze di Natale (prova) · Rutigliano', '🧪', 'Rutigliano', null, 6, 11, 0,
     'Attività di prova di TRAMA per le vacanze di Natale: non esiste. Serve a provare la richiesta per più giorni. Nessun pagamento.',
     'day_only', 1, '23, 24, 28, 29, 30 dicembre, 4 e 5 gennaio', '08:30 - 13:00', '', 'linear-gradient(135deg,#EEF0F4,#FFF3E0)')
  on conflict (id) do nothing;

  insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable)
  select 'a1c0de00-0000-4000-8000-000000000001'::uuid, d::date, true, 10, 10, true
  from generate_series('2026-10-28'::date, '2026-12-18'::date, '1 day') d
  where extract(isodow from d) between 1 and 5
    and (d <= '2026-11-06' or extract(isodow from d) in (3, 5))
  on conflict (activity_id, date) do nothing;

  insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable)
  select 'a1c0de00-0000-4000-8000-000000000002'::uuid, d::date, true, 10, 10, true
  from unnest(array['2026-12-07', '2026-12-08']) d
  on conflict (activity_id, date) do nothing;

  insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable)
  select 'a1c0de00-0000-4000-8000-000000000003'::uuid, d::date, true, 10, 10, true
  from generate_series('2026-10-28'::date, '2026-12-17'::date, '1 day') d
  where extract(isodow from d) between 1 and 5
    and (d <= '2026-11-06' or extract(isodow from d) in (2, 4))
  on conflict (activity_id, date) do nothing;

  insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable)
  select 'a1c0de00-0000-4000-8000-000000000004'::uuid, d::date, true, 10, 10, true
  from unnest(array['2026-12-23', '2026-12-24', '2026-12-28', '2026-12-29', '2026-12-30', '2027-01-04', '2027-01-05']) d
  on conflict (activity_id, date) do nothing;
end;
$$;

-- Verifica (sola lettura):
--   select a.name, count(d.*) as giorni, min(d.date), max(d.date)
--   from public.activities a join public.activity_days d on d.activity_id = a.id
--   where a.id::text like 'a1c0de00-%' group by a.name;
