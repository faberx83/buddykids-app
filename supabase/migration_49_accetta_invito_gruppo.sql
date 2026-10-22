-- TRAMA — Migration 49: accettare un invito a un gruppo
-- STATO: PREPARATA, NON APPLICATA
--
-- Secondo test UX del 22/10/2026 (UX-PARENT-016): il genitore invitato preme
-- "Accetta" e vede "Errore nella risposta all'invito"; l'invito resta in
-- attesa e il genitore non entra nel gruppo.
--
-- Causa (log del database, 22/10 alle 9:25 e alle 10:15):
--   column reference "group_id" is ambiguous
-- La funzione accept_group_invite restituisce una colonna chiamata group_id
-- e, nel controllo "è già membro?", legge group_members.group_id senza dire
-- di quale tabella: PostgreSQL non sa quale dei due usare e si ferma, sempre.
-- Il difetto c'è dalla migration 25; la 41 ha cambiato solo i permessi.
--
-- Cosa fa: riscrive la stessa funzione, stessa firma e stessi messaggi, con
--   - i nomi delle colonne sempre preceduti dalla tabella (gm., gi.);
--   - #variable_conflict use_column, così un nome uguale non la blocca più;
--   - "on conflict do nothing" sull'inserimento: due tocchi su Accetta non
--     creano un errore né un doppio ingresso (chiave group_id + parent_id);
--   - un invito già accettato dallo stesso genitore risponde "fatto" invece
--     di "Invito non trovato o già gestito" (secondo tocco, pagina ricaricata).
-- Nessuna tabella, colonna o regola di accesso cambia. Permessi identici
-- alla migration 41: solo utenti loggati.
--
-- Verifica dopo l'applicazione (sola lettura):
--   select prosrc ilike '%gm.group_id%' as corretta
--   from pg_proc where proname = 'accept_group_invite';
--
-- Ripiego: rieseguire il blocco "create or replace function
-- public.accept_group_invite" della migration 25 e le righe della 41 che
-- fissano search_path e permessi. Riporta però il difetto.

create or replace function public.accept_group_invite(p_invite_id uuid)
returns table (group_id uuid, error text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  v_invite record;
  v_user_email text;
  v_already_member boolean;
  v_group_id uuid;
begin
  select p.email into v_user_email from public.profiles p where p.id = auth.uid();

  select gi.* into v_invite
  from public.group_invites gi
  where gi.id = p_invite_id and gi.status in ('pending', 'sent');

  if v_invite.id is null then
    -- Secondo tocco su Accetta (o pagina ricaricata): se l'invito è già stato
    -- accettato da questo genitore, è un successo, non un errore.
    select gi.group_id into v_group_id
    from public.group_invites gi
    where gi.id = p_invite_id and gi.status = 'accepted' and gi.accepted_by = auth.uid();
    if v_group_id is not null then
      return query select v_group_id, null::text;
      return;
    end if;
    return query select null::uuid, 'Invito non trovato o già gestito'::text;
    return;
  end if;

  if lower(v_invite.invited_email) is distinct from lower(coalesce(v_user_email, '')) then
    return query select null::uuid, 'Questo invito è per un''altra email'::text;
    return;
  end if;

  select exists(
    select 1 from public.group_members gm
    where gm.group_id = v_invite.group_id and gm.parent_id = auth.uid()
  ) into v_already_member;

  if not v_already_member then
    insert into public.group_members as gm (group_id, parent_id)
    values (v_invite.group_id, auth.uid())
    on conflict do nothing;
  end if;

  update public.group_invites gi
  set status = 'accepted', accepted_by = auth.uid(), responded_at = now()
  where gi.id = v_invite.id;

  return query select v_invite.group_id, null::text;
end;
$$;

revoke execute on function public.accept_group_invite(uuid) from public, anon;
grant execute on function public.accept_group_invite(uuid) to authenticated, service_role;
