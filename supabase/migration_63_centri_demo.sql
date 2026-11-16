-- TRAMA — Migration 63: centri DEMO riconosciuti dai dati e richieste DEMO bloccate nel database
-- STATO: PREPARATA, NON APPLICATA
--
-- Release candidate 20/11 (16/11/2026), Lotto A. Fabrizio: "Una famiglia
-- reale non autorizzata non possa inoltrare richieste verso attività DEMO…
-- Non sia possibile aggirare il blocco chiamando direttamente una server
-- action o modificando una richiesta HTTP… Non affidarti esclusivamente ai
-- nomi". E (A3): "Nessun collegamento DEMO deve portare accidentalmente a un
-- soggetto reale".
--
-- Cosa fa:
--   1. centers.is_demo (default false): il dato che dice "centro di prova
--      visibile". Valorizzato per gli 8 centri di prova visibili (elenco
--      letto in sola lettura il 16/11, per id) e per i centri is_test_fixture.
--   2. public.can_simulate_demo(): vero per Admin piattaforma, coorte
--      internal-preview attiva o account di prova di Fabrizio (stessa regola
--      di lib/nextgen/demo-label.ts#isDemoTester e lib/dev/test-accounts.ts).
--   3. Trigger BEFORE INSERT su bookings e activity_inquiries: una richiesta
--      o un messaggio verso un centro DEMO da un utente loggato che non è
--      collaudatore viene rifiutato con "DEMO_NOT_ALLOWED". Gli script SQL e
--      il client di servizio (auth.uid() nullo) non sono toccati.
--   4. Contatti fittizi ma plausibili dei 5 centri di prova storici (email,
--      telefono, social con domini che possono essere reali): svuotati.
--      Valori originali qui sotto, per il rientro.
--
-- Rientro:
--   drop trigger if exists bookings_block_demo on public.bookings;
--   drop trigger if exists activity_inquiries_block_demo on public.activity_inquiries;
--   drop function if exists public.block_demo_requests();
--   drop function if exists public.can_simulate_demo();
--   alter table public.centers drop column if exists is_demo;
--   update public.centers set contact_email='info@crearte.it', contact_phone='+39 02 2345678',
--     social_links='{"website":"https://crearte.it","instagram":"https://instagram.com/crearte_milano"}' where id='22222222-2222-2222-2222-222222222222';
--   update public.centers set contact_email='info@camobrera.it', contact_phone='+39 02 4567890',
--     social_links='{"instagram":"https://instagram.com/campobrera"}' where id='44444444-4444-4444-4444-444444444444';
--   update public.centers set contact_email='info@centrolido.it', contact_phone='+39 02 1234567',
--     social_links='{"facebook":"https://facebook.com/centrolido","instagram":"https://instagram.com/centrolido"}' where id='11111111-1111-1111-1111-111111111111';
--   update public.centers set contact_email='info@scuolaaria.it', contact_phone='+39 02 5678901',
--     social_links='{"tiktok":"https://tiktok.com/@scuolaaria","instagram":"https://instagram.com/scuolaaria"}' where id='55555555-5555-5555-5555-555555555555';
--   update public.centers set contact_email='info@techkids.it', contact_phone='+39 02 3456789',
--     social_links='{"website":"https://techkids.it","youtube":"https://youtube.com/@techkidsmilano"}' where id='33333333-3333-3333-3333-333333333333';
--
-- Verifica dopo l'applicazione:
--   select name, is_demo, contact_email, contact_phone, social_links from public.centers where is_test_fixture = false order by name;   -- 8 righe is_demo = true
--   select tgname from pg_trigger where tgname in ('bookings_block_demo', 'activity_inquiries_block_demo');   -- 2 righe

-- 1. Dato "centro di prova"
alter table public.centers add column if not exists is_demo boolean not null default false;

update public.centers set is_demo = true
 where id in (
   '22222222-2222-2222-2222-222222222222', -- Accademia CreArte · centro di prova
   '44444444-4444-4444-4444-444444444444', -- Campo Brera · centro di prova
   'f4d10a31-3254-4549-ba59-ec636dd6ade2', -- Centro Demo
   '55260bf7-eb9e-46ff-9440-5132af8d1268', -- Centro di Prova
   '669854b7-99ae-4535-9146-a5d044022531', -- Centro prova candidatura
   '11111111-1111-1111-1111-111111111111', -- Centro Sportivo Lido · centro di prova
   '55555555-5555-5555-5555-555555555555', -- Scuola di Musica Aria · centro di prova
   '33333333-3333-3333-3333-333333333333'  -- TechKids Milano · centro di prova
 )
    or is_test_fixture = true;

-- 2. Chi può simulare
create or replace function public.can_simulate_demo()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
  select coalesce(
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and (p.role = 'platform_admin' or lower(coalesce(p.email, '')) ~ '^faberx83(\+[^@]+)?@gmail\.com$')
    )
    or exists (
      select 1 from public.beta_cohort_memberships m
       where m.user_id = auth.uid()
         and m.cohort_key = 'internal-preview'
         and m.active
         and (m.expires_at is null or m.expires_at > now())
    ),
    false
  );
$$;
revoke all on function public.can_simulate_demo() from public, anon;
grant execute on function public.can_simulate_demo() to authenticated, service_role;

-- 3. Blocco nel database
create or replace function public.block_demo_requests()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
begin
  if auth.uid() is null then
    return new; -- client di servizio o script amministrativi
  end if;
  if exists (
    select 1 from public.activities a
      join public.centers c on c.id = a.center_id
     where a.id = new.activity_id
       and (c.is_demo or c.is_test_fixture)
  ) and not public.can_simulate_demo() then
    raise exception 'DEMO_NOT_ALLOWED: attività di prova, richiesta non consentita' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.block_demo_requests() from public, anon;

drop trigger if exists bookings_block_demo on public.bookings;
create trigger bookings_block_demo
  before insert on public.bookings
  for each row execute function public.block_demo_requests();

drop trigger if exists activity_inquiries_block_demo on public.activity_inquiries;
create trigger activity_inquiries_block_demo
  before insert on public.activity_inquiries
  for each row execute function public.block_demo_requests();

-- 4. Contatti fittizi dei centri di prova storici
update public.centers
   set contact_email = null, contact_phone = null, social_links = '{}'::jsonb
 where id in (
   '22222222-2222-2222-2222-222222222222',
   '44444444-4444-4444-4444-444444444444',
   '11111111-1111-1111-1111-111111111111',
   '55555555-5555-5555-5555-555555555555',
   '33333333-3333-3333-3333-333333333333'
 )
   and is_demo;
