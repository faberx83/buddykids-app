-- Script operativo — Family-first beta pass (07/10/2026), decisione D1 di Fabrizio:
-- impegni esterni (External Planner Items) e Scoperte TRAMA visibili anche alla
-- coorte beta "trama-one-controlled-beta", non più solo a "internal-preview".
--
-- Lo esegue Fabrizio, da shell:
--   APPLY_SQL="supabase/script_family_first_flags_cohort_beta.sql" SQL_ONLY=1 bash deploy.sh
--
-- Stesso pattern di script_controlled_beta_flag_cohort.sql: upsert sull'indice
-- unico (flag_name, scope_type, lower(trim(scope_value))). Scadenza allineata
-- all'override TRAMA_ONE_ENABLED della stessa coorte (31/12/2026).
-- Rollback: rimuovere i due override da Admin → Feature Flags, oppure
--   update public.feature_flag_overrides set enabled = false, updated_at = now()
--   where scope_type = 'cohort' and scope_value = 'trama-one-controlled-beta'
--     and flag_name in ('EXTERNAL_PLANNER_ITEMS_ENABLED', 'REAL_DISCOVERY_DATASET_ENABLED');

insert into public.feature_flag_overrides (flag_name, scope_type, scope_value, enabled, expires_at)
values
  ('EXTERNAL_PLANNER_ITEMS_ENABLED', 'cohort', 'trama-one-controlled-beta', true, '2026-12-31 23:59:59+00'),
  ('REAL_DISCOVERY_DATASET_ENABLED', 'cohort', 'trama-one-controlled-beta', true, '2026-12-31 23:59:59+00')
on conflict (flag_name, scope_type, lower(trim(scope_value)))
  where scope_type not in ('global', 'user')
do update set enabled = excluded.enabled, expires_at = excluded.expires_at, updated_at = now();

-- Verifica (stampata a fine esecuzione)
select flag_name, scope_type, scope_value, enabled, expires_at
from public.feature_flag_overrides
where flag_name in ('EXTERNAL_PLANNER_ITEMS_ENABLED', 'REAL_DISCOVERY_DATASET_ENABLED')
order by flag_name, scope_type, scope_value;
