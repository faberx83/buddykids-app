-- Migrazione 21 — "Candidati come centro" (Fabrizio: "il registrati deve
-- essere un 'candidati' per cui deve far partire processo di onboarding").
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase (nessuna migrazione applicata da
-- Claude, per governance del progetto).
--
-- ════════════════════════════════════════════════════════════════
-- Contesto e scelta di design
-- ════════════════════════════════════════════════════════════════
-- Root cause del bug segnalato da Fabrizio (DEC-76): il form "Registrati"
-- sul login Partner era lo STESSO form del tenant famiglia — creava sempre
-- un account con role='parent' di default (handle_new_user()), senza alcun
-- collegamento a un centro. Non è mai esistita una registrazione
-- self-service per diventare gestore: l'unico punto di creazione era
-- createCenterAndAssignAction (Admin, /admin/centers), che richiede che il
-- gestore si sia GIÀ registrato normalmente e comunica solo un warning se
-- non lo trova (nessuna creazione automatica di account).
--
-- Questa migrazione costruisce il flusso "Candidati" concordato con
-- Fabrizio, riusando il più possibile l'infrastruttura già esistente invece
-- di introdurne una parallela:
--
--   1) Il form "Candidati" (pubblico, NESSUN account creato a questo punto)
--      scrive una riga in public.center_leads — la stessa tabella già usata
--      per le segnalazioni dei genitori (Sprint 5) — con un nuovo campo
--      lead_type='self_candidacy' che la distingue da 'parent_referral'
--      (i genitori). L'inserimento avviene lato server con la
--      service_role key (lib/supabase/service.ts, già esistente, usata
--      finora solo dall'endpoint interno /internal/beta-pipeline) perché il
--      candidato non ha ancora un profilo autenticato a cui agganciare
--      suggested_by (reso nullable qui sotto, SOLO per questo caso: le
--      segnalazioni genitore continuano a richiederlo tramite la RLS di
--      insert esistente, invariata).
--   2) Admin vede la candidatura nella stessa coda /admin/center-leads (già
--      esistente) e, se approva, crea il centro vero (stessa
--      createCenterAndAssignAction già esistente, prefillata) — la riga
--      viene marcata status='claimed' + claimed_center_id, stesso significato
--      già in uso per il claim dei referral genitore ("collegato a un
--      centro reale"), nessun nuovo stato introdotto.
--   3) NESSUNA creazione di account via Admin API (niente
--      supabase.auth.admin.createUser/inviteUserByEmail — capacità nuova,
--      non necessaria): il candidato si registra quando vuole con la STESSA
--      email indicata in candidatura, usando il normalissimo form
--      email+password che esiste già. Il trigger handle_new_user() qui
--      sotto viene esteso per riconoscere, al momento della registrazione,
--      che quell'email ha una candidatura già approvata — e in quel caso il
--      profilo nasce DIRETTAMENTE con role='center_admin' e center_id
--      valorizzato, invece del default 'parent'. Zero passaggi manuali
--      aggiuntivi per Admin dopo l'approvazione.
-- ════════════════════════════════════════════════════════════════

begin;

-- 1) Nuove colonne su center_leads: distinguere il tipo di lead e i dati di
-- contatto strutturati di un'autocandidatura (suggested_contact resta come
-- testo libero per i referral genitore, non riusato qui per poter fare un
-- match esatto case-insensitive sull'email nel trigger sotto).
alter table public.center_leads
  add column if not exists lead_type text not null default 'parent_referral'
    check (lead_type in ('parent_referral', 'self_candidacy'));

alter table public.center_leads
  add column if not exists candidate_email text;

alter table public.center_leads
  add column if not exists candidate_phone text;

-- 2) suggested_by nullable: SOLO le autocandidature (lead_type=
-- 'self_candidacy') lo lasciano null (nessun profilo esiste ancora quando
-- vengono create). Le segnalazioni genitore continuano a valorizzarlo
-- sempre — invariato lato applicativo (suggestCenterLeadAction già lo
-- passa), la RLS di insert esistente per i genitori resta identica e
-- continua a bloccare comunque un insert genitore senza suggested_by
-- valorizzato (with check suggested_by = auth.uid()).
alter table public.center_leads
  alter column suggested_by drop not null;

-- Vincolo esplicito: un'autocandidatura non ha (e non deve avere) un
-- suggested_by, un referral genitore lo ha sempre. Evita righe ambigue in
-- futuro per errore applicativo.
alter table public.center_leads
  add constraint center_leads_type_suggested_by_chk
  check (
    (lead_type = 'self_candidacy' and suggested_by is null)
    or (lead_type = 'parent_referral' and suggested_by is not null)
  );

create index if not exists idx_center_leads_lead_type on public.center_leads(lead_type);
create index if not exists idx_center_leads_candidate_email on public.center_leads(lower(candidate_email));

-- 3) Estende handle_new_user(): se esiste una autocandidatura già approvata
-- (status='claimed', quindi il centro è già stato creato da Admin) con
-- questa stessa email, il nuovo profilo nasce già come center_admin di
-- quel centro invece che come 'parent'. Se ce ne fosse più di una (edge
-- case: la stessa email ha candidato più di un centro nel tempo), vince la
-- più recente approvata.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_invite_code text;
  v_candidacy_center_id uuid;
begin
  v_invite_code := new.raw_user_meta_data->>'invite_code';

  select claimed_center_id into v_candidacy_center_id
  from public.center_leads
  where lead_type = 'self_candidacy'
    and status = 'claimed'
    and claimed_center_id is not null
    and candidate_email is not null
    and lower(candidate_email) = lower(new.email)
  order by claimed_at desc nulls last
  limit 1;

  insert into public.profiles (id, email, full_name, invited_by_code, role, center_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    v_invite_code,
    case when v_candidacy_center_id is not null then 'center_admin' else 'parent' end,
    v_candidacy_center_id
  );

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

  return new;
end;
$$ language plpgsql security definer;

-- Trigger già esistente (on_auth_user_created), la funzione è cambiata: non
-- serve ricreare il trigger, solo la funzione (già fatto sopra con
-- create or replace). Nessun drop/create trigger necessario qui.

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, post-check, rollback. Mai eseguiti insieme al blocco
-- sopra.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA del blocco
-- begin;/commit; sopra. Solo lettura.
-- ════════════════════════════════════════════════════════════════

-- 1. Confermare che center_leads esiste già e non ha già queste colonne
--    (atteso: 0 righe per lead_type/candidate_email/candidate_phone):
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='center_leads'
--   and column_name in ('lead_type','candidate_email','candidate_phone');

-- 2. Nessuna riga esistente ha suggested_by null (atteso: 0 righe — se
--    questa query restituisce righe, capire perché PRIMA di procedere):
-- select id from public.center_leads where suggested_by is null;

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query
-- alla volta.
-- ════════════════════════════════════════════════════════════════

-- 3. Le 3 nuove colonne esistono (atteso: 3 righe):
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='center_leads'
--   and column_name in ('lead_type','candidate_email','candidate_phone');

-- 4. Le righe esistenti (segnalazioni genitore già presenti) hanno
--    lead_type='parent_referral' di default (atteso: uguale al conteggio
--    totale di righe preesistenti, 0 righe con lead_type diverso):
-- select lead_type, count(*) from public.center_leads group by lead_type;

-- 5. Test funzionale end-to-end (richiede il deploy col codice applicativo
--    di questa stessa sprint, non solo questa migrazione):
--    a) Form "Candidati" su /auth/candidati (portale Partner) -> invia con
--       una email di test -> deve comparire in /admin/center-leads come
--       autocandidatura, senza aver fatto alcun login.
--    b) Admin approva e crea il centro -> la riga passa a status='claimed'
--       con claimed_center_id valorizzato.
--    c) Registrarsi su /auth/login (portale Partner o principale, stessa
--       email) -> il profilo deve nascere DIRETTAMENTE con
--       role='center_admin' e center_id corretto (verificabile con:
--       select role, center_id from public.profiles where email = '...');
--       — login su partner.* deve funzionare subito, senza redirect al
--       dominio famiglia.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- begin;
-- -- Ripristina la versione precedente della funzione (senza candidatura):
-- create or replace function public.handle_new_user()
-- returns trigger as $$
-- declare
--   v_invite_code text;
-- begin
--   v_invite_code := new.raw_user_meta_data->>'invite_code';
--   insert into public.profiles (id, email, full_name, invited_by_code)
--   values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_invite_code);
--   if v_invite_code is not null then
--     update public.invites
--     set registered_parent_id = new.id, registered_at = now(), status = 'registered'
--     where invite_code = v_invite_code and active = true
--       and (promo_expires_at is null or promo_expires_at >= current_date)
--       and registered_parent_id is null;
--   end if;
--   return new;
-- end;
-- $$ language plpgsql security definer;
--
-- alter table public.center_leads drop constraint if exists center_leads_type_suggested_by_chk;
-- alter table public.center_leads alter column suggested_by set not null; -- SOLO se 0 righe con suggested_by null (vedi pre-check 2 sopra)
-- drop index if exists idx_center_leads_candidate_email;
-- drop index if exists idx_center_leads_lead_type;
-- alter table public.center_leads drop column if exists candidate_phone;
-- alter table public.center_leads drop column if exists candidate_email;
-- alter table public.center_leads drop column if exists lead_type;
-- commit;
