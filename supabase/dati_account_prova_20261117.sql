-- TRAMA — Account di prova: segnatura degli account esistenti (17/11/2026)
-- STATO: SCRIPT DATI — DA LANCIARE A MANO, NON ESEGUIRE IN AUTOMATICO
-- (deploy.sh NON lo propone: non ha la riga "PREPARATA, NON APPLICATA".)
--
-- Richiesta di Fabrizio (17/11): "flagghiamo tutti i parent e partner
-- presenti ad oggi come DEMO [...] cosicché lato ADMIN possa filtrare e non
-- considerarli nei report". Decisione: restano fuori solo luca.d.magi,
-- mariafpoli e ppirulli; faberpirulli e l'admin sono di prova.
-- Iniziativa: claude/INIZIATIVA_account_prova.md (Project).
--
-- Cosa fa: aggiunge 14 account, elencati per id (non per data: chi si
-- registra da domani NON viene toccato), alla lista già esistente
-- beta_cockpit_settings.excluded_user_ids (migration 46), che da questo
-- rilascio vale come "Account di prova" in tutti i report Admin.
-- Non tocca profili, prenotazioni, bambini, segnalazioni o altri dati.
-- Rieseguibile: un id già presente non viene duplicato.
--
-- Rientro (togliere gli stessi 14 id, lasciando gli altri):
--   update public.beta_cockpit_settings
--      set excluded_user_ids = array(select u from unnest(excluded_user_ids) u
--                                    where u <> all (<stessa lista di id>::uuid[])),
--          updated_at = now()
--    where id = 1;
-- oppure, uno per uno: Beta Famiglie → Report → Impostazioni → "Account di prova".
--
-- Come eseguirlo (Fabrizio):
--   APPLY_SQL="supabase/dati_account_prova_20261117.sql" SQL_ONLY=1 bash deploy.sh

-- ── Passo 1: anteprima (sola lettura) ──────────────────────────────────
with ids(id) as (values
  ('68cf46f3-6f3e-4e61-9f5b-532f25e09591'::uuid), -- center_admin  faberx83+test-gestore
  ('847bc128-7725-42cb-9dd2-6012360df9a7'::uuid), -- center_admin  faberx83+partnernew
  ('94ba1ea6-94f8-4d65-99cd-9e2b31119f6b'::uuid), -- center_admin  faberx83+centroprova
  ('6e8d9ec4-ec23-44aa-95c3-c7e69840f195'::uuid), -- center_admin  faberx83+centrodemo
  ('001a697d-7569-4e21-b86e-6770769d7028'::uuid), -- parent        faberpirulli
  ('e1787fd6-ffed-4d9f-aa06-4e1707c68d63'::uuid), -- parent        faberx83+test-genitore
  ('9085b816-8008-4707-9867-441694ae2e0a'::uuid), -- parent        faberx83+newparent
  ('19fb4a74-31bc-4531-b9e3-ce36d9351ecf'::uuid), -- parent        faberx83+testparent
  ('363a28e4-0e41-4852-b445-c830d67ba58a'::uuid), -- parent        faberx83+prova
  ('c1f68eb3-0ae5-4d7a-86e6-debb9847a5bc'::uuid), -- parent        faberx83+uxtest
  ('d3e00000-0000-4000-8000-000000000101'::uuid), -- parent        faberx83+demo-ferri
  ('d3e00000-0000-4000-8000-000000000102'::uuid), -- parent        faberx83+demo-colombo
  ('d3e00000-0000-4000-8000-000000000103'::uuid), -- parent        faberx83+demo-bianchi
  ('d4d80fd0-c893-401e-9578-050ee7fce2ba'::uuid)  -- platform_admin faberx83
)
select p.role, split_part(p.email, '@', 1) as utente, p.created_at::date as creato,
       coalesce(p.id = any(s.excluded_user_ids), false) as gia_di_prova
from ids
join public.profiles p on p.id = ids.id
left join public.beta_cockpit_settings s on s.id = 1
order by p.role, p.created_at;

-- ── Passo 2: segnatura ─────────────────────────────────────────────────
insert into public.beta_cockpit_settings (id) values (1) on conflict (id) do nothing;

update public.beta_cockpit_settings s
   set excluded_user_ids = array(
         select distinct u from unnest(
           coalesce(s.excluded_user_ids, '{}'::uuid[]) ||
           array(select p.id from public.profiles p where p.id = any (array[
             '68cf46f3-6f3e-4e61-9f5b-532f25e09591',
             '847bc128-7725-42cb-9dd2-6012360df9a7',
             '94ba1ea6-94f8-4d65-99cd-9e2b31119f6b',
             '6e8d9ec4-ec23-44aa-95c3-c7e69840f195',
             '001a697d-7569-4e21-b86e-6770769d7028',
             'e1787fd6-ffed-4d9f-aa06-4e1707c68d63',
             '9085b816-8008-4707-9867-441694ae2e0a',
             '19fb4a74-31bc-4531-b9e3-ce36d9351ecf',
             '363a28e4-0e41-4852-b445-c830d67ba58a',
             'c1f68eb3-0ae5-4d7a-86e6-debb9847a5bc',
             'd3e00000-0000-4000-8000-000000000101',
             'd3e00000-0000-4000-8000-000000000102',
             'd3e00000-0000-4000-8000-000000000103',
             'd4d80fd0-c893-401e-9578-050ee7fce2ba'
           ]::uuid[]))
         ) u
       ),
       updated_at = now()
 where s.id = 1;

-- ── Passo 3: verifica ──────────────────────────────────────────────────
select coalesce(array_length(excluded_user_ids, 1), 0) as account_di_prova,
       (select count(*) from public.profiles p where not (p.id = any(s.excluded_user_ids))) as account_contati
from public.beta_cockpit_settings s
where s.id = 1;
