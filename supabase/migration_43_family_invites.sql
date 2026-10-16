-- Migrazione 43 — Inviti famiglia per email (family_invites).
--
-- STATO: PREPARATA, NON APPLICATA
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito da Fabrizio
-- nello SQL Editor di Supabase (progetto TRAMA).
--
-- Perché (15/10/2026): "Invita l'altro genitore" in "La tua famiglia" ha
-- mostrato "Could not find the table 'public.family_invites'". La tabella e
-- le due funzioni erano in supabase/schema.sql ma non sono mai state create
-- sul database di produzione. Nel frattempo il codice ripiega sull'invito
-- con il codice della famiglia (nessun blocco); con questa migrazione torna
-- anche l'invito per email con link personale.
--
-- Additiva e idempotente: crea solo ciò che manca (tabella, indici,
-- politiche RLS, due funzioni). Nessun dato esistente viene toccato.
-- Dipende da: families, family_members, profiles, is_family_member(),
-- is_family_admin() — già presenti (verificato in sola lettura il 15/10).
--
-- ROLLBACK (solo se necessario):
--   drop function if exists public.accept_family_invite(text);
--   drop function if exists public.get_family_invite_preview(text);
--   drop table if exists public.family_invites;
--
-- POST-CHECK:
--   select count(*) from public.family_invites;            -- 0, nessun errore
--   select proname from pg_proc where proname in ('get_family_invite_preview','accept_family_invite'); -- 2 righe

create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade not null,
  invited_email text not null,
  token text unique not null,
  status text default 'pending' check (status in ('pending', 'sent', 'accepted', 'expired')),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  email_sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

alter table public.family_invites enable row level security;

create index if not exists idx_family_invites_family on public.family_invites(family_id);
create index if not exists idx_family_invites_token on public.family_invites(token);

-- Solo i membri della famiglia vedono gli inviti in corso (per mostrare "in
-- attesa di risposta" nella UI); solo un admin/creatore può crearne di nuovi.
drop policy if exists "Family invites: i membri vedono gli inviti della propria famiglia" on public.family_invites;
create policy "Family invites: i membri vedono gli inviti della propria famiglia"
  on public.family_invites for select
  using (public.is_family_member(family_id));

drop policy if exists "Family invites: un admin invita per email" on public.family_invites;
create policy "Family invites: un admin invita per email"
  on public.family_invites for insert
  with check (public.is_family_admin(family_id) and invited_by = auth.uid());

-- Nessuna policy di UPDATE generica: l'unica scrittura dopo la creazione
-- (segnare "sent", o accettare) passa da funzioni security definer qui
-- sotto, per evitare che un genitore invitato (che non è ancora membro,
-- quindi non passerebbe is_family_member) possa alterare altri campi.

-- Anteprima pubblica dell'invito (mostrata anche a chi non è ancora loggato,
-- arrivando dal link nell'email) — stesso principio di get_invite_preview():
-- espone solo nome famiglia + chi ha invitato, mai altri dati della famiglia.
create or replace function public.get_family_invite_preview(p_token text)
returns table (family_name text, inviter_name text, invited_email text, valid boolean)
language plpgsql security definer
as $$
begin
  return query
    select
      f.name,
      p.full_name,
      fi.invited_email,
      (fi.status in ('pending', 'sent'))
    from public.family_invites fi
    join public.families f on f.id = fi.family_id
    left join public.profiles p on p.id = fi.invited_by
    where fi.token = p_token;
end;
$$;

grant execute on function public.get_family_invite_preview(text) to anon, authenticated;

-- Accetta l'invito: crea la riga family_members per l'utente loggato (deve
-- avere la STESSA email dell'invito, controllo case-insensitive — evita che
-- un link inoltrato per errore aggiunga una persona diversa alla famiglia) e
-- marca l'invito come accettato. Security definer perché l'utente invitato
-- non è ancora membro della famiglia quando accetta.
create or replace function public.accept_family_invite(p_token text)
returns table (family_id uuid, family_name text, error text)
language plpgsql security definer
as $$
declare
  v_invite record;
  v_user_email text;
  v_already_member boolean;
begin
  select email into v_user_email from public.profiles where id = auth.uid();

  select fi.* into v_invite
  from public.family_invites fi
  where fi.token = p_token and fi.status in ('pending', 'sent');

  if v_invite.id is null then
    return query select null::uuid, null::text, 'Invito non trovato o già utilizzato';
    return;
  end if;

  if lower(v_invite.invited_email) is distinct from lower(coalesce(v_user_email, '')) then
    return query select null::uuid, null::text, 'Questo invito è per un''altra email — accedi con l''indirizzo a cui è stato inviato';
    return;
  end if;

  select exists(select 1 from public.family_members where parent_id = auth.uid()) into v_already_member;
  if v_already_member then
    return query select null::uuid, null::text, 'Fai già parte di una famiglia — esci prima di accettarne un''altra';
    return;
  end if;

  insert into public.family_members (family_id, parent_id, role)
  values (v_invite.family_id, auth.uid(), 'membro');

  update public.family_invites
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = v_invite.id;

  return query select v_invite.family_id, f.name, null::text from public.families f where f.id = v_invite.family_id;
end;
$$;

grant execute on function public.accept_family_invite(text) to authenticated;
