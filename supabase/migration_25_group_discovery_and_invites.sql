-- ═════════════════════════════════════════════════════════════════════════
-- Migrazione 25 — Gruppi: "Scopri" (gruppi pubblici) + "Inviti" (inviti reali)
-- ═════════════════════════════════════════════════════════════════════════
-- Gap segnalato da Fabrizio (analisi approfondita 24/08/2026): le tab
-- "Scopri" e "Inviti" in components/GroupsClient.tsx erano placeholder
-- statici ("funzionalità in arrivo"), mai costruiti. Root cause verificata:
--   1) i gruppi non avevano alcun concetto di pubblico/privato, e la RLS su
--      public.groups permette la lettura SOLO ai membri/creatore — "Scopri"
--      era strutturalmente impossibile senza una migrazione.
--   2) non esisteva alcuna tabella di inviti per i gruppi — un "invito" era
--      solo condividere il link /groups/join/[id] (chiunque abbia il link
--      può unirsi, vedi joinGroupAction).
-- Fabrizio ha scelto (AskUserQuestion) la versione completa per entrambe:
-- colonna is_public + policy RLS dedicata per "Scopri", e una vera tabella
-- group_invites (stesso pattern collaudato di family_invites, supabase/
-- schema.sql righe 1875-1979) per "Inviti".
--
-- Additiva al 100%: nessuna colonna/tabella/policy esistente viene rimossa o
-- modificata, solo aggiunte. Non applicata da Claude (governance): Fabrizio
-- esegue questo file su Supabase quando pronto.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1) "Scopri": colonna is_public + policy RLS di lettura pubblica
-- ─────────────────────────────────────────────

alter table public.groups add column if not exists is_public boolean not null default false;

-- Postgres OR-a tra loro le policy permissive per lo stesso comando (SELECT):
-- questa si aggiunge a "Groups: lettura per i membri" già esistente, non la
-- sostituisce. Un gruppo is_public=true diventa leggibile da QUALSIASI
-- utente autenticato (non solo membri/creatore) — necessario per "Scopri".
create policy "Groups: lettura pubblica per i gruppi scopribili"
  on public.groups for select
  to authenticated
  using (is_public = true);

-- Aggiornare la visibilità è un'azione del solo creatore (stessa policy di
-- "Groups: il creatore collega l'attività target", già esistente per
-- l'update di activity_id — qui basta l'aggiunta della colonna, la policy di
-- UPDATE esistente copre già "created_by = auth.uid()" per QUALUNQUE
-- colonna, is_public incluso, nessuna nuova policy di UPDATE necessaria).

-- Elenco "Scopri" — funzione security definer perché deve calcolare il
-- conteggio famiglie leggendo group_members anche per gruppi di cui il
-- chiamante non è membro (la RLS di group_members resta invariata: solo i
-- membri vedono le righe grezze, qui esponiamo solo un conteggio aggregato,
-- mai i parent_id reali). Esclude i gruppi di cui il chiamante è già membro
-- (semantica "scopri gruppi NUOVI").
create or replace function public.list_public_groups()
returns table (
  id uuid,
  name text,
  discount_percent numeric,
  activity_name text,
  activity_emoji text,
  activity_gradient text,
  center_name text,
  city text,
  family_count bigint
)
language sql security definer stable
as $$
  select
    g.id,
    g.name,
    g.discount_percent,
    a.name,
    a.emoji,
    a.img_gradient,
    c.name,
    a.city,
    (select count(*) from public.group_members gm where gm.group_id = g.id)
  from public.groups g
  left join public.activities a on a.id = g.activity_id
  left join public.centers c on c.id = a.center_id
  where g.is_public = true
    and not exists (
      select 1 from public.group_members gm2
      where gm2.group_id = g.id and gm2.parent_id = auth.uid()
    )
  order by g.created_at desc;
$$;

grant execute on function public.list_public_groups() to authenticated;

-- ─────────────────────────────────────────────
-- 2) "Inviti": tabella group_invites (stesso pattern di family_invites)
-- ─────────────────────────────────────────────

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  invited_email text not null,
  token text unique not null,
  status text default 'pending' check (status in ('pending', 'sent', 'accepted', 'declined', 'expired')),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  email_sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz default now()
);

alter table public.group_invites enable row level security;

create index if not exists idx_group_invites_group on public.group_invites(group_id);
create index if not exists idx_group_invites_token on public.group_invites(token);
create index if not exists idx_group_invites_email on public.group_invites(lower(invited_email));

-- Solo i membri del gruppo vedono gli inviti in corso (per mostrare "in
-- attesa di risposta" nella UI del gruppo); solo un membro del gruppo può
-- crearne di nuovi (stesso perimetro di InviteButton/"Invita famiglie",
-- non solo il creatore).
create policy "Group invites: i membri vedono gli inviti del proprio gruppo"
  on public.group_invites for select
  using (public.is_group_member(group_id));

create policy "Group invites: un membro invita per email"
  on public.group_invites for insert
  with check (public.is_group_member(group_id) and invited_by = auth.uid());

-- Nessuna policy di UPDATE generica: l'invitato (che non è ancora membro,
-- quindi non passerebbe is_group_member) accetta/rifiuta tramite le funzioni
-- security definer qui sotto — stesso motivo di family_invites.

-- Elenco "I miei inviti" per la tab "Inviti" del genitore loggato — non
-- richiede un token/link email: mostra direttamente ogni invito il cui
-- invited_email combacia (case-insensitive) con l'email dell'utente loggato.
create or replace function public.list_my_group_invites()
returns table (
  invite_id uuid,
  group_id uuid,
  group_name text,
  activity_name text,
  center_name text,
  discount_percent numeric,
  inviter_name text,
  created_at timestamptz
)
language plpgsql security definer stable
as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where id = auth.uid();
  if v_email is null then
    return;
  end if;

  return query
    select
      gi.id,
      g.id,
      g.name,
      a.name,
      c.name,
      g.discount_percent,
      p.full_name,
      gi.created_at
    from public.group_invites gi
    join public.groups g on g.id = gi.group_id
    left join public.activities a on a.id = g.activity_id
    left join public.centers c on c.id = a.center_id
    left join public.profiles p on p.id = gi.invited_by
    where lower(gi.invited_email) = lower(v_email)
      and gi.status in ('pending', 'sent')
    order by gi.created_at desc;
end;
$$;

grant execute on function public.list_my_group_invites() to authenticated;

-- Accetta l'invito: crea la riga group_members per l'utente loggato (deve
-- avere la STESSA email dell'invito, controllo case-insensitive) e marca
-- l'invito come accettato. Security definer perché l'invitato non è ancora
-- membro del gruppo quando accetta (non passerebbe is_group_member).
create or replace function public.accept_group_invite(p_invite_id uuid)
returns table (group_id uuid, error text)
language plpgsql security definer
as $$
declare
  v_invite record;
  v_user_email text;
  v_already_member boolean;
begin
  select email into v_user_email from public.profiles where id = auth.uid();

  select gi.* into v_invite
  from public.group_invites gi
  where gi.id = p_invite_id and gi.status in ('pending', 'sent');

  if v_invite.id is null then
    return query select null::uuid, 'Invito non trovato o già gestito';
    return;
  end if;

  if lower(v_invite.invited_email) is distinct from lower(coalesce(v_user_email, '')) then
    return query select null::uuid, 'Questo invito è per un''altra email';
    return;
  end if;

  select exists(
    select 1 from public.group_members where group_id = v_invite.group_id and parent_id = auth.uid()
  ) into v_already_member;
  if v_already_member then
    update public.group_invites set status = 'accepted', accepted_by = auth.uid(), responded_at = now() where id = v_invite.id;
    return query select v_invite.group_id, null::text;
    return;
  end if;

  insert into public.group_members (group_id, parent_id) values (v_invite.group_id, auth.uid());

  update public.group_invites
  set status = 'accepted', accepted_by = auth.uid(), responded_at = now()
  where id = v_invite.id;

  return query select v_invite.group_id, null::text;
end;
$$;

grant execute on function public.accept_group_invite(uuid) to authenticated;

-- Rifiuta l'invito: solo marca lo stato, nessuna scrittura su group_members.
create or replace function public.decline_group_invite(p_invite_id uuid)
returns table (error text)
language plpgsql security definer
as $$
declare
  v_invite record;
  v_user_email text;
begin
  select email into v_user_email from public.profiles where id = auth.uid();

  select gi.* into v_invite
  from public.group_invites gi
  where gi.id = p_invite_id and gi.status in ('pending', 'sent');

  if v_invite.id is null then
    return query select 'Invito non trovato o già gestito';
    return;
  end if;

  if lower(v_invite.invited_email) is distinct from lower(coalesce(v_user_email, '')) then
    return query select 'Questo invito è per un''altra email';
    return;
  end if;

  update public.group_invites
  set status = 'declined', responded_at = now()
  where id = v_invite.id;

  return query select null::text;
end;
$$;

grant execute on function public.decline_group_invite(uuid) to authenticated;
