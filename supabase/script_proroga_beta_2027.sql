-- TRAMA — Proroga della beta famiglie (bloccante B4 del lancio del 20/11/2026)
-- STATO: PREPARATA, NON APPLICATA
--
-- Fabrizio, 26/10/2026: "puoi aggiornare tu a fine giugno 27? o più avanti
-- ancora?". Oggi (verificato in sola lettura il 26/10/2026):
--   - il codice d'invito della beta ("Beta test amici", coorte
--     trama-one-controlled-beta, 4 iscrizioni) scade il 01/12/2026;
--   - tre accessi della coorte beta scadono il 31/12/2026:
--     TRAMA_ONE_ENABLED, EXTERNAL_PLANNER_ITEMS_ENABLED,
--     REAL_DISCOVERY_DATASET_ENABLED. Senza TRAMA_ONE_ENABLED la beta si
--     spegnerebbe da sola a capodanno.
--
-- Cosa fa (solo due date, nessun dato cancellato):
--   1. accessi della coorte beta fino al 30/09/2027: copre l'estate 2027,
--      cioè la stagione dei centri estivi per cui le famiglie usano TRAMA
--      (fermarsi a fine giugno vorrebbe dire spegnere tutto proprio allora);
--   2. codice d'invito fino al 31/01/2027: basta per le ondate di inviti di
--      novembre–gennaio; un codice che gira per mesi si diffonde oltre gli
--      amici. A febbraio se ne crea uno nuovo da Admin → Beta, se serve.
-- Le date si possono cambiare qui sotto prima di APPLICA.
--
-- Il codice non è scritto qui: si individua dall'id.
-- Ripiego: rimettere le date di prima
--   update public.feature_flag_overrides set expires_at = '2026-12-31 23:59:00+01'
--    where scope_type = 'cohort' and scope_value = 'trama-one-controlled-beta'
--      and flag_name in ('TRAMA_ONE_ENABLED','EXTERNAL_PLANNER_ITEMS_ENABLED','REAL_DISCOVERY_DATASET_ENABLED');
--   update public.beta_invite_codes set expires_at = '2026-12-01 23:59:00+01'
--    where id = '195b8ed9-0444-4fa9-9584-50d6968ae241';

update public.feature_flag_overrides
   set expires_at = '2027-09-30 23:59:00+02',
       updated_at = now()
 where scope_type = 'cohort'
   and scope_value = 'trama-one-controlled-beta'
   and expires_at is not null
   and flag_name in ('TRAMA_ONE_ENABLED', 'EXTERNAL_PLANNER_ITEMS_ENABLED', 'REAL_DISCOVERY_DATASET_ENABLED');

update public.beta_invite_codes
   set expires_at = '2027-01-31 23:59:00+01',
       updated_at = now()
 where id = '195b8ed9-0444-4fa9-9584-50d6968ae241';

-- Verifica dopo l'applicazione (sola lettura):
--   select flag_name, expires_at from public.feature_flag_overrides
--    where scope_value = 'trama-one-controlled-beta' and expires_at is not null;
--   select label, expires_at from public.beta_invite_codes;
