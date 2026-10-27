-- TRAMA — Migration 52: la candidatura del centro torna a creare il gestore
-- STATO: PREPARATA, NON APPLICATA
--
-- Trovato il 27/10/2026 (audit Partner/Admin, prova del "Centro di prova"
-- candidato dal form di tramapp.it/benvenuto → "Candidati come partner").
--
-- Il percorso previsto da migration_21 è:
--   1. il centro compila /auth/candidati → riga center_leads (self_candidacy);
--   2. Admin → Segnalazioni centri → "Approva e crea centro";
--   3. il centro si registra con la STESSA email → il profilo nasce già
--      center_admin di quel centro (ramo aggiunto a handle_new_user()).
-- Il passo 3 oggi NON funziona: migration_30 (codici invito beta) ha
-- riscritto handle_new_user() partendo dalla versione di schema.sql, senza il
-- ramo della candidatura. Verificato in sola lettura sulla funzione in
-- produzione: nessun riferimento a candidate_email. Chi si registra dopo
-- l'approvazione resta "genitore" e non vede l'area centro.
-- (Se invece si registra PRIMA dell'approvazione, funziona già: l'approvazione
-- trova il profilo e gli assegna il ruolo. È il ripiego da usare finché
-- questa migration non è applicata.)
--
-- Cosa fa: ricrea handle_new_user() con TUTTI e tre i rami — invito-sconto
-- centro e codice beta copiati identici dalla versione in produzione, più il
-- ramo candidatura di migration_21. Il ramo candidatura è dentro un blocco a
-- prova di errore come quello beta: non può mai far fallire una
-- registrazione (nel caso peggiore il profilo nasce "parent", come oggi).
-- Stesse impostazioni di sicurezza di migration_41 (security definer,
-- search_path fisso).
--
-- Nessun dato esistente cambia. Ripiego: rieseguire il blocco
-- "create or replace function public.handle_new_user()" di
-- migration_30_beta_invite_codes.sql seguito dall'"alter function … set
-- search_path" di migration_41 (cioè la versione di oggi).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_invite_code text;
  v_beta_code text;
  v_cohort_key text;
  v_candidacy_center_id uuid;
begin
  v_invite_code := new.raw_user_meta_data->>'invite_code';
  v_beta_code := new.raw_user_meta_data->>'beta_invite_code';

  -- Ramo candidatura centro (migration_21, ripristinato): se Admin ha già
  -- approvato un'autocandidatura con questa email, il profilo nasce gestore
  -- di quel centro. Più candidature approvate con la stessa email: vince la
  -- più recente. Qualunque errore → si prosegue come genitore.
  begin
    select claimed_center_id into v_candidacy_center_id
    from public.center_leads
    where lead_type = 'self_candidacy'
      and status = 'claimed'
      and claimed_center_id is not null
      and candidate_email is not null
      and lower(candidate_email) = lower(new.email)
    order by claimed_at desc nulls last
    limit 1;
  exception when others then
    v_candidacy_center_id := null;
  end;

  insert into public.profiles (id, email, full_name, invited_by_code, beta_invited_by_code, role, center_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    v_invite_code,
    v_beta_code,
    case when v_candidacy_center_id is not null then 'center_admin' else 'parent' end,
    v_candidacy_center_id
  );

  -- Ramo invito-sconto centro: identico alla versione in produzione.
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

  -- Ramo codice beta: identico alla versione in produzione.
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
      null; -- la registrazione procede comunque
    end;
  end if;

  return new;
end;
$function$;

-- Verifica dopo l'applicazione (sola lettura, atteso: true):
--   select position('candidate_email' in pg_get_functiondef('public.handle_new_user'::regproc)) > 0;
