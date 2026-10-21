-- TRAMA — Migration 47: centri di prova segnati in modo esplicito
-- STATO: PREPARATA, NON APPLICATA
--
-- Correzioni dal test UX Parent del 21/10/2026 (UX-PARENT-002, ciclo 4-L).
-- Iniziativa: claude/INIZIATIVA_parent_ux_fix_2110.md.
--
-- Cosa fa:
--   1. aggiunge centers.is_test_fixture (boolean, default false): "questo
--      centro esiste solo per le prove" — un segno esplicito, non dedotto dal
--      nome;
--   2. lo accende per i 4 centri che sono chiaramente prove (verificati in
--      sola lettura il 21/10/2026): "[TEST] Centro BuddyKids" (usato dai test
--      automatici), "Test centro estivo", "Centro pippo", "Centro estivo prova
--      candidatura" (attività "Prova FP").
--
-- Effetto: con PARENT_UX_FIX_ENABLED acceso, le attività di questi centri non
-- compaiono più in Scopri né tra le idee della Home per le famiglie. Restano
-- nel database, raggiungibili per link diretto e visibili all'Admin
-- piattaforma, quindi i test automatici continuano a funzionare.
--
-- Additiva e reversibile. Nessun dato cancellato. Ripiego:
--   update public.centers set is_test_fixture = false;      -- tutto di nuovo visibile
--   alter table public.centers drop column is_test_fixture; -- e la colonna sparisce
--
-- DA DECIDERE (Fabrizio, bloccante B1 del lancio): anche i 5 centri dimostrativi
-- del seed (Centro Sportivo Lido, Accademia CreArte, TechKids Milano, Campo
-- Brera / "Soccer Academy Estate", Scuola di Musica Aria) non sono centri veri.
-- Se vanno nascosti alle famiglie, togliere il commento alla riga in fondo.

alter table public.centers
  add column if not exists is_test_fixture boolean not null default false;

comment on column public.centers.is_test_fixture is
  'Centro che esiste solo per prove e test automatici: mai mostrato alle famiglie nel catalogo (PARENT_UX_FIX_ENABLED). Migration 47, 21/10/2026.';

update public.centers
   set is_test_fixture = true
 where id in (
   '40a64d60-3d45-4851-bac4-1761915ad92e', -- [TEST] Centro BuddyKids (test automatici)
   '3a240835-6412-402c-9c63-2c8cf0944fca', -- Test centro estivo
   '9a705d7c-bd19-40bf-adaf-474d42807f05', -- Centro pippo
   'f572aa29-c070-46e0-bd98-5c3ce6dd25ed'  -- Centro estivo prova candidatura ("Prova FP")
 );

-- Centri dimostrativi del seed (decisione B1, vedi sopra):
-- update public.centers set is_test_fixture = true where id in (
--   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
--   '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
--   '55555555-5555-5555-5555-555555555555');
