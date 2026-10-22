-- TRAMA — Migration 50: categorie (tag) di prova segnate in modo esplicito
-- STATO: PREPARATA, NON APPLICATA
--
-- Secondo test UX del 22/10/2026 (UX-PARENT-019): nel dettaglio di un gruppo,
-- scegliendo l'attività preferita del bambino, compaiono "Test",
-- "Test 1786025340380", "Test 1786042113436", "Test 1786048551574".
-- Sono tag creati da prove: i tre con il numero dal test automatico Admin
-- TC-088 (agosto 2026), "Test" collegato solo all'attività "test" del centro
-- di prova "Test centro estivo" (già nascosto con la migration 47).
-- Verificato in sola lettura il 22/10/2026: nessun gruppo usa questi tag.
--
-- Cosa fa (stesso principio della migration 47 per i centri):
--   1. aggiunge tags.is_test_fixture (boolean, default false): "questo tag
--      esiste solo per le prove" — un segno esplicito, non dedotto dal nome;
--   2. lo accende per i 4 tag sopra.
--
-- Effetto: con PARENT_UX_FIX_ENABLED acceso le famiglie non li vedono più tra
-- le preferenze del gruppo. Restano nel database e nella pagina Admin → Tag.
-- Il test TC-088 da oggi elimina il tag che crea (tests/admin/gestione.spec.ts).
--
-- Additiva e reversibile. Nessun dato cancellato. Ripiego:
--   update public.tags set is_test_fixture = false;      -- tutto di nuovo visibile
--   alter table public.tags drop column is_test_fixture; -- e la colonna sparisce

alter table public.tags
  add column if not exists is_test_fixture boolean not null default false;

comment on column public.tags.is_test_fixture is
  'Tag che esiste solo per prove e test automatici: mai proposto alle famiglie (PARENT_UX_FIX_ENABLED). Migration 50, 22/10/2026.';

update public.tags
   set is_test_fixture = true
 where id in (
   'test',               -- "Test" (attività "test" del centro di prova "Test centro estivo")
   'test-1786025340380', -- "Test 1786025340380" (test automatico TC-088)
   'test-1786042113436', -- "Test 1786042113436" (test automatico TC-088)
   'test-1786048551574'  -- "Test 1786048551574" (test automatico TC-088)
 );
