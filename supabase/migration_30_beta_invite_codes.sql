-- Migrazione 30 — Codici invito Beta (auto-iscrizione alla Controlled Beta
-- Cohort per chi arriva da un link di invito esplicito di Fabrizio, es.
-- condiviso via WhatsApp: https://.../auth/login?beta=CODICE).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, DOPO migration_08_beta_cohort_memberships.sql
-- (già applicata in produzione — questa migrazione dipende dalla tabella
-- public.beta_cohort_memberships che crea). Non modifica migration_08.
--
-- ════════════════════════════════════════════════════════════════
-- CONTESTO E PROBLEMA RISOLTO
-- ════════════════════════════════════════════════════════════════
-- Oggi (vedi DECISION_LOG / conversazione 27/08) l'unico modo per far
-- risultare un nuovo genitore "in Beta" (TRAMA_ONE_ENABLED risolto true,
-- quindi Spotlight + Onboarding Carousel visibili) è un INSERT manuale in
-- beta_cohort_memberships fatto da Fabrizio via SQL, riga per riga, DOPO
-- che la persona si è già registrata — un genitore invitato via WhatsApp
-- che si registra oggi NON entra automaticamente in Beta.
--
-- Questa migrazione chiude il gap con lo STESSO pattern già esistente per
-- gli inviti-sconto dei centri (public.invites, vedi supabase/schema.sql
-- righe ~1050-1181): un codice nell'URL di registrazione (?beta=CODICE)
-- viene passato come user_metadata a supabase.auth.signUp(), letto dal
-- trigger già esistente handle_new_user() (AFTER INSERT ON auth.users) e
-- usato per iscrivere automaticamente il nuovo profilo alla cohort, PRIMA
-- che qualunque pagina dell'app venga mai caricata — zero step manuali,
-- zero finestra temporale in cui il genitore è "beta ma non ancora
-- iscritto".
--
-- ════════════════════════════════════════════════════════════════
-- ANALISI DEL PUNTO DI INSERIMENTO (unico canale possibile)
-- ════════════════════════════════════════════════════════════════
-- A differenza di public.centers (migration_10, 4 canali diversi), righe in
-- auth.users possono nascere SOLO tramite Supabase Auth stesso
-- (supabase.auth.signUp() lato client, o l'Admin API con service role) —
-- non esiste un INSERT diretto applicativo su auth.users in questo
-- repository. Il trigger on_auth_user_created -> handle_new_user() è quindi
-- l'UNICO punto che vede OGNI nuovo utente, indipendentemente dal canale di
-- registrazione (form normale, link invito sconto, link invito Beta,
-- import futuro) — motivo per cui si ESTENDE quel trigger esistente invece
-- di aggiungerne uno nuovo su una tabella diversa.
--
-- ════════════════════════════════════════════════════════════════
-- SICUREZZA: perché il ramo Beta qui sotto è avvolto in un blocco
-- BEGIN/EXCEPTION interno (non presente nel ramo invite_code esistente)
-- ════════════════════════════════════════════════════════════════
-- handle_new_user() è la funzione a più alto rischio dell'intera app: se
-- solleva un'eccezione non gestita, l'INSERT su auth.users fallisce e
-- NESSUNO può registrarsi, per NESSUN motivo (bug della feature Beta
-- incluso). Il ramo beta_invite_codes qui sotto è quindi avvolto in un
-- sotto-blocco "begin ... exception when others then null; end;": qualunque
-- problema sulla tabella/riga beta (inesistente, corrotta, constraint
-- inatteso) viene silenziosamente ignorato — la registrazione dell'utente
-- PROCEDE SEMPRE, nel peggiore dei casi semplicemente senza l'iscrizione
-- automatica alla cohort (recuperabile a mano dopo, come oggi). Il ramo
-- invite_code esistente (sconto centro) resta INVARIATO, stesso identico
-- comportamento pre-esistente — non è la parte nuova, quindi non si tocca
-- la sua logica di errore per non introdurre regressioni.
--
-- Colto anche l'occasione per irrobustire la funzione con
-- "set search_path = public, pg_catalog" (convenzione più recente già usata
-- in migration_09/migration_10, assente nella versione originale di questa
-- funzione, molto più vecchia) — ogni riferimento a tabella qui dentro è già
-- interamente qualificato (public.xxx), quindi additivo e a rischio zero.
--
-- ════════════════════════════════════════════════════════════════
-- Transazionalità: DDL sotto interamente in BEGIN/COMMIT, nessuna richiede
-- CONCURRENTLY. O applicata tutta, o (in caso di errore) nessuna parte.
--
-- NOTA su supabase/schema.sql: la tabella beta_invite_codes NON viene
-- ripiegata in schema.sql (stessa scelta esplicita di migration_08 per
-- beta_cohort_memberships — "fold-in deferred to Fabrizio"). La sostituzione
-- di handle_new_user() invece riguarda una funzione GIÀ presente in
-- schema.sql: lì è stato aggiunto solo un commento-puntatore a questo file
-- (non l'intero nuovo corpo, per non rischiare disallineamenti in un file
-- di riferimento di 1200+ righe) — la versione vivente e corretta della
-- funzione, per un ambiente su cui questa migrazione è stata applicata, è
-- SEMPRE quella qui sotto, mai quella in schema.sql.
-- ════════════════════════════════════════════════════════════════

begin;

-- Colonna informativa (mai usata per logica, solo audit/debug) — stesso
-- ruolo di profiles.invited_by_code già esistente per gli inviti-sconto,
-- nome diverso per non confondere i due sistemi.
alter table public.profiles add column if not exists beta_invited_by_code text;

create table if not exists public.beta_invite_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  cohort_key        text not null default 'trama-one-controlled-beta',
  label             text, -- es. "WhatsApp genitori Beta agosto 2026" (solo per Fabrizio, mai mostrato all'invitato)
  active            boolean not null default true,
  max_redemptions   int, -- null = illimitato
  redeemed_count    int not null default 0,
  expires_at        timestamptz,
  created_by        uuid references public.profiles(id) on delete set null,
  updated_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chk_beta_invite_codes_max_redemptions check (max_redemptions is null or max_redemptions > 0),
  constraint chk_beta_invite_codes_redeemed_count check (redeemed_count >= 0)
);

comment on table public.beta_invite_codes is
  'Codici invito per auto-iscrizione alla Beta Cohort (link ?beta=CODICE condiviso manualmente da Fabrizio, es. WhatsApp). Letti SOLO da handle_new_user() (security definer) al momento della registrazione — mai da query client-side dirette (RLS admin-only sotto), stessa filosofia di beta_cohort_memberships. redeemed_count incrementato atomicamente dentro handle_new_user(), mai da codice applicativo separato (evita race condition tra check e incremento).';

create index if not exists idx_beta_invite_codes_code on public.beta_invite_codes(code);

create or replace function public.set_beta_invite_codes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_beta_invite_codes_updated_at on public.beta_invite_codes;
create trigger trg_beta_invite_codes_updated_at
  before update on public.beta_invite_codes
  for each row execute function public.set_beta_invite_codes_updated_at();

alter table public.beta_invite_codes enable row level security;

-- Stessa filosofia di beta_cohort_memberships (migration_08): nessuna
-- policy per l'utente che si registra — la lettura/validazione del codice
-- durante il signup passa SEMPRE dalla funzione security definer
-- get_beta_invite_preview() sotto (espone solo "valido sì/no" + un'etichetta
-- pubblica), mai da una query diretta su questa tabella.
drop policy if exists beta_invite_codes_select_admin on public.beta_invite_codes;
create policy beta_invite_codes_select_admin
  on public.beta_invite_codes for select
  using (public.is_platform_admin());

drop policy if exists beta_invite_codes_insert_admin on public.beta_invite_codes;
create policy beta_invite_codes_insert_admin
  on public.beta_invite_codes for insert
  with check (public.is_platform_admin());

drop policy if exists beta_invite_codes_update_admin on public.beta_invite_codes;
create policy beta_invite_codes_update_admin
  on public.beta_invite_codes for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists beta_invite_codes_delete_admin on public.beta_invite_codes;
create policy beta_invite_codes_delete_admin
  on public.beta_invite_codes for delete
  using (public.is_platform_admin());

-- Anteprima pubblica (chiamabile da chi NON è ancora loggato, form di
-- registrazione con ?beta=CODICE nell'URL) — SOLO valido sì/no + etichetta
-- pubblica opzionale, MAI redeemed_count/cohort_key/created_by (altrimenti
-- servirebbe una policy di lettura pubblica sull'intera tabella). Stesso
-- pattern di public.get_invite_preview già esistente per gli inviti-sconto.
create or replace function public.get_beta_invite_preview(p_code text)
returns table (valid boolean, public_label text)
language plpgsql security definer
set search_path = public, pg_catalog
as $$
begin
  return query
    select
      (
        bic.active
        and (bic.expires_at is null or bic.expires_at >= now())
        and (bic.max_redemptions is null or bic.redeemed_count < bic.max_redemptions)
      ),
      'Invito Beta privata TRAMA'::text
    from public.beta_invite_codes bic
    where bic.code = p_code;
end;
$$;

grant execute on function public.get_beta_invite_preview(text) to anon, authenticated;

-- Sostituisce handle_new_user() con una versione che, oltre al comportamento
-- ESISTENTE E INVARIATO (creazione profilo + collegamento invito-sconto
-- centro via invite_code), aggiunge un terzo ramo per beta_invite_code — in
-- un sotto-blocco a prova di eccezione (vedi nota sicurezza sopra): un
-- problema qui non blocca MAI la registrazione dell'utente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_invite_code text;
  v_beta_code text;
  v_cohort_key text;
begin
  v_invite_code := new.raw_user_meta_data->>'invite_code';
  v_beta_code := new.raw_user_meta_data->>'beta_invite_code';

  insert into public.profiles (id, email, full_name, invited_by_code, beta_invited_by_code)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_invite_code, v_beta_code);

  -- Ramo ESISTENTE, INVARIATO (invito-sconto centro) — identico bit per bit
  -- alla versione precedente della funzione (supabase/schema.sql).
  if v_invite_code is not null then
    update public.invites
    set registered_parent_id = new.id,
        registered_at = now(),
        status = 'registered'
    where invite_code = v_invite_code
      and active = true
      and (promo_expires_at is null or promo_expires_at >= current_date)
      and registered_parent_id is null;
  end if;

  -- Ramo NUOVO (auto-iscrizione Beta Cohort) — avvolto in blocco a prova di
  -- eccezione: vedi nota sicurezza in cima al file, MAI deve poter far
  -- fallire una registrazione.
  if v_beta_code is not null then
    begin
      update public.beta_invite_codes
      set redeemed_count = redeemed_count + 1
      where code = v_beta_code
        and active = true
        and (expires_at is null or expires_at >= now())
        and (max_redemptions is null or redeemed_count < max_redemptions)
      returning cohort_key into v_cohort_key;

      if v_cohort_key is not null then
        insert into public.beta_cohort_memberships (user_id, cohort_key, active)
        values (new.id, v_cohort_key, true)
        on conflict (user_id, cohort_key) do nothing;
      end if;
    exception when others then
      null; -- silenziosamente ignorato, la registrazione procede comunque
    end;
  end if;

  return new;
end;
$$;

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, post-check, rollback. Mai eseguiti insieme al blocco
-- DDL.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA di applicare il
-- blocco begin;/commit; sopra. Solo lettura.
-- ════════════════════════════════════════════════════════════════

-- 1. Dipendenze obbligatorie presenti:
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('profiles', 'invites', 'beta_cohort_memberships');
-- -- atteso: 3 righe. Se beta_cohort_memberships manca: applicare prima
-- -- migration_08_beta_cohort_memberships.sql, STOP altrimenti.

-- 2. IMPORTANTISSIMO — salva la definizione ATTUALE di handle_new_user()
--    PRIMA di sovrascriverla (serve per un rollback affidabile se la
--    produzione fosse diversa da quanto assunto qui, copia-incollala in un
--    posto sicuro):
-- select pg_get_functiondef('public.handle_new_user()'::regprocedure);
-- -- atteso: corpo IDENTICO (a meno di spazi) a quello riportato nel blocco
-- -- ROLLBACK in fondo a questo file. Se risulta diverso, FERMARSI e capire
-- -- perché prima di sostituirla.

-- 3. Nessun oggetto con lo stesso nome già esistente (ambiente pulito):
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name = 'beta_invite_codes';
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('set_beta_invite_codes_updated_at', 'get_beta_invite_preview');
-- -- atteso su ambiente pulito: 0 righe per entrambe.

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query alla
-- volta.
-- ════════════════════════════════════════════════════════════════

-- 4. Tabella, RLS, policy, funzioni, trigger presenti:
-- select relrowsecurity from pg_class where relname = 'beta_invite_codes'; -- atteso: true
-- select policyname from pg_policies where tablename = 'beta_invite_codes'; -- atteso: 4 righe
-- select proname, prosecdef from pg_proc where proname in ('get_beta_invite_preview', 'handle_new_user'); -- atteso: prosecdef = true per entrambe

-- 5. Crea IL codice reale che userai su WhatsApp (sostituisci il codice e
--    l'etichetta, created_by = il tuo user_id platform_admin):
-- insert into public.beta_invite_codes (code, label, created_by)
--   values ('TRAMABETA26', 'Link WhatsApp Beta privata', '<tuo user_id platform_admin>')
--   returning id, code;

-- 6. Anteprima pubblica (simula la chiamata che fa il form di registrazione,
--    da ruolo anon):
-- select * from public.get_beta_invite_preview('TRAMABETA26');
-- -- atteso: valid = true, public_label = 'Invito Beta privata TRAMA'.
-- select * from public.get_beta_invite_preview('CODICE-INESISTENTE');
-- -- atteso: 0 righe (nessun leak sull'esistenza del codice).

-- 7. TEST END-TO-END REALE (consigliato prima di condividere il link):
--    a) vai su https://buddykids-app.vercel.app/auth/login?beta=TRAMABETA26
--       con un browser in incognito;
--    b) registrati con un account di test nuovo (es. faberx83+betatest@gmail.com,
--       stessa convenzione già in uso per gli altri account di test);
--    c) verifica:
-- select user_id, cohort_key, active from public.beta_cohort_memberships
--   where user_id = (select id from public.profiles where email = 'faberx83+betatest@gmail.com');
-- -- atteso: 1 riga, cohort_key = 'trama-one-controlled-beta', active = true.
-- select code, redeemed_count from public.beta_invite_codes where code = 'TRAMABETA26';
-- -- atteso: redeemed_count incrementato di 1 rispetto a prima del test.
--    d) fai login con quell'account su /nextgen: il carousel di onboarding
--       deve apparire alla prima visita (stesso comportamento già verificato
--       per gli account già in cohort).

-- 8. Disattivare il codice quando la fase di invito WhatsApp è conclusa
--    (non cancella le iscrizioni già avvenute, impedisce solo nuovi usi):
-- update public.beta_invite_codes set active = false where code = 'TRAMABETA26';

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (eseguire come blocco separato). ATTENZIONE: ripristina
-- handle_new_user() alla versione PRECEDENTE (identica a quella in
-- supabase/schema.sql prima di questa migrazione) — copia-incolla ESATTO,
-- verificato contro il pre-check punto 2. Se il pre-check punto 2 avesse
-- mostrato una definizione diversa da questa, usa QUELLA salvata, non
-- questa.
-- ════════════════════════════════════════════════════════════════
-- begin;
--
-- create or replace function public.handle_new_user()
-- returns trigger as $$
-- declare
--   v_invite_code text;
-- begin
--   v_invite_code := new.raw_user_meta_data->>'invite_code';
--
--   insert into public.profiles (id, email, full_name, invited_by_code)
--   values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_invite_code);
--
--   if v_invite_code is not null then
--     update public.invites
--     set registered_parent_id = new.id,
--         registered_at = now(),
--         status = 'registered'
--     where invite_code = v_invite_code
--       and active = true
--       and (promo_expires_at is null or promo_expires_at >= current_date)
--       and registered_parent_id is null;
--   end if;
--
--   return new;
-- end;
-- $$ language plpgsql security definer;
--
-- drop trigger if exists trg_beta_invite_codes_updated_at on public.beta_invite_codes;
-- drop function if exists public.set_beta_invite_codes_updated_at();
-- drop function if exists public.get_beta_invite_preview(text);
-- drop table if exists public.beta_invite_codes;
-- alter table public.profiles drop column if exists beta_invited_by_code;
--
-- commit;
--
-- NOTA: questo rollback rimuove il meccanismo e la tabella dei codici, e
-- ripristina la funzione precedente. NON cancella le righe già create in
-- beta_cohort_memberships da eventuali iscrizioni Beta già avvenute prima
-- del rollback (restano attive finché non rimosse esplicitamente, stesso
-- principio del rollback di migration_10).
