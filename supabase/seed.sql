-- Seed BuddyKids — carica gli stessi centri/attività di esempio già visibili
-- nella demo, dentro il database Supabase reale. Esegui questo file UNA VOLTA
-- nello SQL Editor di Supabase, DOPO aver eseguito schema.sql e
-- migration_02_home_search.sql.
--
-- Sicuro da ri-eseguire per tags/centers/activities/activity_tags/activity_days
-- (usano "on conflict do nothing"). Le tabelle activity_weeks e promotions non
-- hanno una chiave naturale univoca: se lo esegui due volte duplicherà quelle
-- righe — in caso, cancellale e ripeti solo quella parte.

-- ─────────────────────────────────────────────
-- TAGS
-- ─────────────────────────────────────────────
insert into public.tags (id, label, emoji, bg_color) values
  ('sport', 'Sport', '⚽', '#E3F9F5'),
  ('arte', 'Arte', '🎨', '#FFF0EA'),
  ('musica', 'Musica', '🎵', '#F0EEFF'),
  ('stem', 'STEM', '🔬', '#E8F6FD'),
  ('outdoor', 'Outdoor', '🌳', '#E8F9EE'),
  ('intera', 'Intera', '☀️', '#FFF8E7'),
  ('mezza', 'Mezza', '🕐', '#FFF0EA'),
  ('piscina', 'Piscina', '🏊', '#E3F9F5'),
  ('teatro', 'Teatro', '🎭', '#F0EEFF'),
  ('tecnologia', 'Tecnologia', '💻', '#E8F6FD'),
  ('natura', 'Natura', '🌿', '#E8F9EE'),
  ('lingue', 'Lingue', '🌍', '#E8F6FD'),
  ('cucina', 'Cucina', '🍳', '#FFF0EA'),
  ('danza', 'Danza', '💃', '#F0EEFF')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- CENTERS (id fissi per poterli referenziare qui sotto)
-- ─────────────────────────────────────────────
insert into public.centers (id, slug, name, emoji, city, address, description, contact_email, contact_phone, social_links, gradient) values
  ('11111111-1111-1111-1111-111111111111', 'centro-sportivo-lido', 'Centro Sportivo Lido', '🏊', 'Milano', 'Via Lido 12, Porta Nuova',
   'Centro sportivo con piscina olimpionica, campi esterni e staff qualificato per camp estivi acquatici e multisport.',
   'info@centrolido.it', '+39 02 1234567',
   '{"instagram":"https://instagram.com/centrolido","facebook":"https://facebook.com/centrolido"}',
   'linear-gradient(135deg,#C8ECFD,#A5E5D8)'),
  ('22222222-2222-2222-2222-222222222222', 'accademia-crearte', 'Accademia CreArte', '🎨', 'Milano', 'Via delle Arti 8',
   'Scuola d''arte con laboratori di pittura, ceramica e teatro per bambini e ragazzi.',
   'info@crearte.it', '+39 02 2345678',
   '{"instagram":"https://instagram.com/crearte_milano","website":"https://crearte.it"}',
   'linear-gradient(135deg,#FFE8D9,#FFD0BB)'),
  ('33333333-3333-3333-3333-333333333333', 'techkids-milano', 'TechKids Milano', '🔬', 'Milano', 'Via dell''Innovazione 3',
   'Centro STEM specializzato in coding, robotica e stampa 3D per ragazzi.',
   'info@techkids.it', '+39 02 3456789',
   '{"website":"https://techkids.it","youtube":"https://youtube.com/@techkidsmilano"}',
   'linear-gradient(135deg,#EDE8FF,#D4CDFF)'),
  ('44444444-4444-4444-4444-444444444444', 'campo-brera', 'Campo Brera', '⚽', 'Milano', 'Via Brera 22',
   'Impianto sportivo dedicato al calcio giovanile con staff di allenatori certificati.',
   'info@camobrera.it', '+39 02 4567890',
   '{"instagram":"https://instagram.com/campobrera"}',
   'linear-gradient(135deg,#D8F5E8,#B5EDD1)'),
  ('55555555-5555-5555-5555-555555555555', 'scuola-musica-aria', 'Scuola di Musica Aria', '🎵', 'Milano', 'Via delle Note 5',
   'Scuola di musica con corsi di canto, strumento e propedeutica musicale.',
   'info@scuolaaria.it', '+39 02 5678901',
   '{"instagram":"https://instagram.com/scuolaaria","tiktok":"https://tiktok.com/@scuolaaria"}',
   'linear-gradient(135deg,#FFF5D6,#FFE89A)')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────
-- ACTIVITIES (id fissi per poterli referenziare qui sotto)
-- ─────────────────────────────────────────────
insert into public.activities (
  id, center_id, slug, name, emoji, address, city, latitude, longitude, age_min, age_max,
  price_per_week, shuttle_price, description, schedule, meal_option, pre_service, post_service,
  rating, reviews_count, img_gradient, days, hours, distance_km, spots_left, weeks_available, pills, badges
) values
  (
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '11111111-1111-1111-1111-111111111111', 'summer-camp-acquatico',
    'Summer Camp Acquatico', '🏊', 'Porta Nuova, Milano', 'Milano', 45.479, 9.1938, 6, 14,
    280, 30,
    'Un''estate all''insegna dell''acqua, del divertimento e della crescita! Il nostro Summer Camp offre attività in piscina, giochi di squadra, lezioni di nuoto e molto altro in un ambiente sicuro e accogliente, con istruttori qualificati e certificati.',
    '[{"time":"08:00","label":"Accoglienza e giochi liberi","color":"#4DAFEF"},{"time":"09:00","label":"Attività in piscina — nuoto e acquagym","color":"#3ECFB2"},{"time":"12:30","label":"Pranzo incluso + riposo","color":"#FF8C5A"},{"time":"14:00","label":"Laboratori creativi e sport","color":"#8B7CF8"},{"time":"16:30","label":"Merenda e giochi outdoor","color":"#52C87A"},{"time":"17:30","label":"Uscita / navetta di ritorno","color":"#9CA3AF"}]',
    'included', '{"available":true,"time":"07:30","priceExtra":5}', '{"available":true,"time":"18:30","priceExtra":8}',
    4.9, 128, 'linear-gradient(135deg,#C8ECFD,#A5E5D8)', 'Lun-Ven', '08:00 - 17:30', 1.2, 3, '6 di 8',
    '[{"label":"🏊 Piscina","color":"aqua"},{"label":"🌍 Inglese","color":"sky"},{"label":"🍽️ Pranzo","color":"orange"},{"label":"🚌 Navetta","color":"green"}]',
    '[{"label":"Piscina","icon":"ti-droplet","color":"sky"},{"label":"Inglese","icon":"ti-language","color":"aqua"},{"label":"Pranzo incl.","icon":"ti-tools-kitchen","color":"orange"},{"label":"Navetta","icon":"ti-bus","color":"green"},{"label":"Outdoor","icon":"ti-sun","color":"purple"}]'
  ),
  (
    'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '22222222-2222-2222-2222-222222222222', 'laboratorio-arti-creative',
    'Laboratorio Arti Creative', '🎨', 'Milano', 'Milano', 45.48, 9.195, 7, 12,
    220, 25,
    'Laboratori di pittura, ceramica, teatro e creatività per stimolare l''immaginazione dei più piccoli in un ambiente stimolante e sicuro.',
    '[{"time":"09:00","label":"Accoglienza e giochi liberi","color":"#4DAFEF"},{"time":"10:00","label":"Laboratorio pittura e ceramica","color":"#FF8C5A"},{"time":"12:30","label":"Pranzo incluso","color":"#3ECFB2"},{"time":"14:00","label":"Teatro e improvvisazione","color":"#8B7CF8"},{"time":"16:00","label":"Uscita","color":"#9CA3AF"}]',
    'included', '{"available":false,"time":null,"priceExtra":0}', '{"available":true,"time":"17:00","priceExtra":6}',
    4.8, 94, 'linear-gradient(135deg,#FFE8D9,#FFD0BB)', null, null, 2.5, null, '8 di 8',
    '[{"label":"🎨 Arte","color":"orange"},{"label":"🎭 Teatro","color":"purple"},{"label":"🍽️ Pranzo","color":"aqua"}]',
    '[{"label":"Arte","icon":"ti-brush","color":"orange"},{"label":"Teatro","icon":"ti-mask","color":"purple"},{"label":"Pranzo incl.","icon":"ti-tools-kitchen","color":"aqua"}]'
  ),
  (
    'a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '33333333-3333-3333-3333-333333333333', 'coding-robotica-kids',
    'Coding & Robotica Kids', '🔬', 'Milano', 'Milano', 45.4685, 9.1824, 8, 13,
    310, 0,
    'Un percorso hands-on tra coding, robotica e stampa 3D, pensato per far scoprire ai ragazzi il mondo della tecnologia divertendosi.',
    '[{"time":"09:00","label":"Accoglienza","color":"#4DAFEF"},{"time":"09:30","label":"Coding a blocchi e robotica","color":"#8B7CF8"},{"time":"12:30","label":"Pranzo (non incluso)","color":"#FF8C5A"},{"time":"14:00","label":"Progetto di gruppo","color":"#3ECFB2"},{"time":"17:00","label":"Uscita","color":"#9CA3AF"}]',
    'packed', '{"available":false,"time":null,"priceExtra":0}', '{"available":false,"time":null,"priceExtra":0}',
    4.7, 61, 'linear-gradient(135deg,#EDE8FF,#D4CDFF)', null, null, 0.8, null, '5 di 8',
    '[{"label":"🤖 Robot","color":"purple"},{"label":"💻 Coding","color":"sky"}]',
    '[{"label":"Robotica","icon":"ti-robot","color":"purple"},{"label":"Coding","icon":"ti-code","color":"sky"}]'
  ),
  (
    'a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '44444444-4444-4444-4444-444444444444', 'soccer-academy-estate',
    'Soccer Academy Estate', '⚽', 'Milano', 'Milano', 45.4719, 9.188, 6, 16,
    250, 20,
    'Allenamenti tecnici, tornei interni e tanto divertimento con lo staff della Soccer Academy, per bambini di tutte le età.',
    '[{"time":"08:30","label":"Accoglienza e riscaldamento","color":"#52C87A"},{"time":"09:00","label":"Allenamento tecnico","color":"#4DAFEF"},{"time":"12:30","label":"Pranzo incluso","color":"#FF8C5A"},{"time":"14:30","label":"Torneo interno","color":"#8B7CF8"},{"time":"17:00","label":"Uscita","color":"#9CA3AF"}]',
    'included', '{"available":true,"time":"08:00","priceExtra":4}', '{"available":true,"time":"18:00","priceExtra":6}',
    4.6, 47, 'linear-gradient(135deg,#D8F5E8,#B5EDD1)', null, null, 3.1, null, '7 di 8',
    '[{"label":"⚽ Sport","color":"green"},{"label":"🍽️ Pranzo","color":"orange"}]',
    '[{"label":"Sport","icon":"ti-ball-football","color":"green"},{"label":"Pranzo incl.","icon":"ti-tools-kitchen","color":"orange"}]'
  ),
  (
    'a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '55555555-5555-5555-5555-555555555555', 'summer-music-camp',
    'Summer Music Camp', '🎵', 'Milano', 'Milano', 45.475, 9.205, 7, 15,
    195, 0,
    'Corsi di canto, strumento e propedeutica musicale in un ambiente giocoso e stimolante, con saggio finale per le famiglie.',
    '[{"time":"09:00","label":"Accoglienza e vocalità","color":"#4DAFEF"},{"time":"10:00","label":"Laboratorio strumento","color":"#8B7CF8"},{"time":"12:30","label":"Pranzo (non incluso)","color":"#FF8C5A"},{"time":"14:00","label":"Coro e prove d''insieme","color":"#3ECFB2"},{"time":"16:00","label":"Uscita","color":"#9CA3AF"}]',
    'packed', '{"available":false,"time":null,"priceExtra":0}', '{"available":false,"time":null,"priceExtra":0}',
    4.5, 38, 'linear-gradient(135deg,#FFF5D6,#FFE89A)', null, null, 1.8, null, '8 di 8',
    '[{"label":"🎵 Musica","color":"purple"},{"label":"🎤 Canto","color":"aqua"}]',
    '[{"label":"Musica","icon":"ti-music","color":"purple"},{"label":"Canto","icon":"ti-microphone","color":"aqua"}]'
  )
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────
-- ACTIVITY_TAGS (tag multipli per attività)
-- ─────────────────────────────────────────────
insert into public.activity_tags (activity_id, tag_id) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'sport'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'piscina'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'intera'),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'arte'),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'teatro'),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'mezza'),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 'stem'),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 'tecnologia'),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'sport'),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'outdoor'),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'intera'),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', 'musica')
on conflict (activity_id, tag_id) do nothing;

-- ─────────────────────────────────────────────
-- ACTIVITY_WEEKS (usate dal flusso di prenotazione)
-- ─────────────────────────────────────────────
insert into public.activity_weeks (activity_id, label, start_date, end_date, capacity, spots_left) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Settimana 1', '2025-06-24', '2025-06-28', 12, 3),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Settimana 2', '2025-07-01', '2025-07-05', 12, 6),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Settimana 3', '2025-07-08', '2025-07-12', 12, 4),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Settimana 4', '2025-07-15', '2025-07-19', 12, 7),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Settimana 5', '2025-07-22', '2025-07-26', 12, 5),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Settimana 6', '2025-07-29', '2025-08-02', 12, 0),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'Settimana 1', '2025-06-24', '2025-06-28', 10, 5),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'Settimana 2', '2025-07-01', '2025-07-05', 10, 6),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'Settimana 3', '2025-07-08', '2025-07-12', 10, 4),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'Settimana 4', '2025-07-15', '2025-07-19', 10, 7),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 'Settimana 1', '2025-06-24', '2025-06-28', 8, 5),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 'Settimana 2', '2025-07-01', '2025-07-05', 8, 6),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 'Settimana 3', '2025-07-08', '2025-07-12', 8, 4),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 'Settimana 4', '2025-07-15', '2025-07-19', 8, 7),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'Settimana 1', '2025-06-24', '2025-06-28', 16, 5),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'Settimana 2', '2025-07-01', '2025-07-05', 16, 6),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'Settimana 3', '2025-07-08', '2025-07-12', 16, 4),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'Settimana 4', '2025-07-15', '2025-07-19', 16, 7),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', 'Settimana 1', '2025-06-24', '2025-06-28', 9, 5),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', 'Settimana 2', '2025-07-01', '2025-07-05', 9, 6),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', 'Settimana 3', '2025-07-08', '2025-07-12', 9, 4),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', 'Settimana 4', '2025-07-15', '2025-07-19', 9, 7);

-- ─────────────────────────────────────────────
-- PROMOTIONS
-- ─────────────────────────────────────────────
insert into public.promotions (activity_id, type, label, discount_percent, day_of_week, valid_from, valid_to, active) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'day_discount', 'Venerdì scontato', 15, 4, null, null, true),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'last_minute', 'Ultimi posti settimana 2 — sconto last-minute', 20, null, '2025-06-25', '2025-06-30', true),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'day_discount', 'Venerdì -10%', 10, 4, null, null, true),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 'last_minute', 'Ultimi posti disponibili — sconto flash', 20, null, '2025-06-24', '2025-06-26', true),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'day_discount', 'Mercoledì -10%', 10, 2, null, null, true),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', 'last_minute', 'Ultimi posti disponibili', 25, null, '2025-06-25', '2025-06-28', true);

-- ─────────────────────────────────────────────
-- ACTIVITY_DAYS (calendario giorno-per-giorno, generato automaticamente)
-- ─────────────────────────────────────────────
insert into public.activity_days (activity_id, date, is_open, capacity, spots_left, single_day_bookable, discount_percent, last_minute, special_label, special_emoji) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-06-24', true, 12, 12, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-06-25', true, 12, 9, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-06-26', true, 12, 6, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-06-27', true, 12, 3, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-06-28', true, 12, 0, true, 15, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-01', true, 12, 10, true, null, true, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-02', true, 12, 7, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-03', true, 12, 4, true, null, false, 'Giornata in piscina', '🏊'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-04', true, 12, 1, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-05', true, 12, 11, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-08', true, 12, 8, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-09', true, 12, 5, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-10', true, 12, 2, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-11', true, 12, 12, true, null, false, 'Giochi d''acqua', '💦'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-12', true, 12, 9, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-15', true, 12, 6, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-16', true, 12, 3, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-17', true, 12, 0, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-18', true, 12, 10, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-19', true, 12, 7, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-22', true, 12, 4, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-23', true, 12, 1, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-24', true, 12, 11, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-25', true, 12, 8, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-26', true, 12, 5, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-29', false, 12, 0, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-30', false, 12, 0, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-07-31', false, 12, 0, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-08-01', false, 12, 0, true, null, false, null, null),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2025-08-02', false, 12, 0, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-06-24', true, 10, 10, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-06-25', true, 10, 7, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-06-26', true, 10, 4, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-06-27', true, 10, 1, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-06-28', true, 10, 9, true, 10, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-01', true, 10, 8, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-02', true, 10, 5, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-03', true, 10, 2, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-04', true, 10, 10, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-05', true, 10, 7, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-08', true, 10, 6, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-09', true, 10, 3, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-10', true, 10, 0, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-11', true, 10, 8, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-12', true, 10, 5, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-15', true, 10, 4, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-16', true, 10, 1, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-17', true, 10, 9, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-18', true, 10, 6, true, null, false, null, null),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', '2025-07-19', true, 10, 3, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-06-24', true, 8, 8, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-06-25', true, 8, 5, true, null, true, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-06-26', true, 8, 2, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-06-27', true, 8, 8, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-06-28', true, 8, 5, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-01', true, 8, 6, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-02', true, 8, 3, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-03', true, 8, 0, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-04', true, 8, 6, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-05', true, 8, 3, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-08', true, 8, 4, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-09', true, 8, 1, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-10', true, 8, 7, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-11', true, 8, 4, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-12', true, 8, 1, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-15', true, 8, 2, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-16', true, 8, 8, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-17', true, 8, 5, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-18', true, 8, 2, true, null, false, null, null),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', '2025-07-19', true, 8, 8, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-06-24', true, 16, 16, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-06-25', true, 16, 13, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-06-26', true, 16, 10, true, 10, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-06-27', true, 16, 7, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-06-28', true, 16, 4, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-01', true, 16, 14, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-02', true, 16, 11, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-03', true, 16, 8, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-04', true, 16, 5, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-05', true, 16, 2, true, null, false, 'Torneo di fine settimana', '🏆'),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-08', true, 16, 12, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-09', true, 16, 9, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-10', true, 16, 6, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-11', true, 16, 3, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-12', true, 16, 0, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-15', true, 16, 10, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-16', true, 16, 7, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-17', true, 16, 4, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-18', true, 16, 1, true, null, false, null, null),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', '2025-07-19', true, 16, 15, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-06-24', true, 9, 9, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-06-25', true, 9, 6, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-06-26', true, 9, 3, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-06-27', true, 9, 0, true, 25, true, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-06-28', true, 9, 7, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-01', true, 9, 7, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-02', true, 9, 4, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-03', true, 9, 1, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-04', true, 9, 8, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-05', true, 9, 5, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-08', true, 9, 5, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-09', true, 9, 2, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-10', true, 9, 9, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-11', true, 9, 6, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-12', true, 9, 3, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-15', true, 9, 3, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-16', true, 9, 0, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-17', true, 9, 7, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-18', true, 9, 4, true, null, false, null, null),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5', '2025-07-19', true, 9, 1, true, null, false, null, null)
on conflict (activity_id, date) do nothing;
