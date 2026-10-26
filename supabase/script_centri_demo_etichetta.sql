-- TRAMA — Centri dimostrativi del seed: restano visibili, dichiarati "di prova"
-- STATO: PREPARATA, NON APPLICATA
--
-- Decisione di Fabrizio del 26/10/2026 (B1 del lancio): i 5 centri del seed
-- (Centro Sportivo Lido, Accademia CreArte, TechKids Milano, Campo Brera,
-- Scuola di Musica Aria) hanno nomi realistici ma non esistono. "Lasciali ma
-- metti una etichetta che faccia intendere che sono di test."
--
-- Cosa fa, senza codice nuovo: aggiunge "· centro di prova" al nome del
-- centro e "(prova)" al nome della sua attività, così si vede su card,
-- scheda e mappa. I test automatici cercano il nome per sottostringa
-- ("Centro Sportivo Lido" resta dentro il nome nuovo). Rieseguibile.
--
-- Ripiego:
--   update public.centers set name = replace(name, ' · centro di prova', '')
--    where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
--      '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555');
--   update public.activities set name = replace(name, ' (prova)', '')
--    where center_id in (…stessi id…);

update public.centers
   set name = name || ' · centro di prova'
 where id in (
   '11111111-1111-1111-1111-111111111111', -- Centro Sportivo Lido
   '22222222-2222-2222-2222-222222222222', -- Accademia CreArte
   '33333333-3333-3333-3333-333333333333', -- TechKids Milano
   '44444444-4444-4444-4444-444444444444', -- Campo Brera
   '55555555-5555-5555-5555-555555555555'  -- Scuola di Musica Aria
 )
   and name not like '%· centro di prova';

update public.activities
   set name = name || ' (prova)'
 where center_id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444',
   '55555555-5555-5555-5555-555555555555'
 )
   and name not like '%(prova)';
