-- TRAMA — Migration 54: messaggi con il centro come conversazione
-- STATO: PREPARATA, NON APPLICATA
--
-- Fabrizio, 27/10/2026: "non avevamo detto che i messaggi con il centro
-- dovessero mantenere il contesto? cioè un botta e risposta e non n messaggi
-- diversi?". Sì: approvato il 15/10/2026 e rimasto in coda
-- (AUDIT_SOTTOPAGINE_FLUSSI_20261015.md: "Messaggi ai centri come
-- conversazione — nuova tabella messaggi (migrazione additiva), primi
-- messaggi = domanda + risposta esistenti, lato centro incluso").
--
-- Oggi activity_inquiries è un ticket: un messaggio del genitore, UNA
-- risposta del centro (che sovrascrive la precedente). Per scrivere ancora
-- il genitore apre un'altra richiesta: il contesto si perde.
--
-- Cosa fa (additiva, nessuna colonna esistente cambia significato):
--   1. activity_inquiries resta la "conversazione" (una per famiglia e
--      attività): stato, letto/non letto, ultima risposta in "reply" — così
--      Admin SLA, cruscotto beta, badge e notifiche continuano a funzionare;
--      in più last_message_at per ordinare per ultimo messaggio;
--   2. nuova tabella inquiry_messages: i messaggi della conversazione, uno
--      per riga, da famiglia o centro, mai modificati né cancellati;
--   3. regole di accesso: vede i messaggi chi vede la conversazione (stesse
--      regole di activity_inquiries); scrive come famiglia solo il genitore
--      della conversazione, come centro solo un gestore del centro
--      dell'attività (o un Admin);
--   4. le richieste di oggi diventano i primi messaggi: domanda (alla data
--      della richiesta) e, se c'è, la risposta (alla data della risposta).
--
-- Ripiego: drop table if exists public.inquiry_messages;
--          alter table public.activity_inquiries drop column if exists last_message_at;
-- (l'app torna al ticket: domanda e ultima risposta restano in activity_inquiries).

alter table public.activity_inquiries
  add column if not exists last_message_at timestamptz;

update public.activity_inquiries
   set last_message_at = coalesce(replied_at, created_at, now())
 where last_message_at is null;

create table if not exists public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.activity_inquiries(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_side text not null check (author_side in ('parent', 'center')),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists idx_inquiry_messages_thread on public.inquiry_messages (inquiry_id, created_at);

comment on table public.inquiry_messages is
  'TRAMA 27/10/2026 — messaggi di una conversazione famiglia↔centro (activity_inquiries = la conversazione). Mai UPDATE/DELETE dall''app: si aggiunge soltanto.';

alter table public.inquiry_messages enable row level security;

drop policy if exists "Messaggi: li vede chi vede la conversazione" on public.inquiry_messages;
create policy "Messaggi: li vede chi vede la conversazione"
  on public.inquiry_messages for select
  using (exists (select 1 from public.activity_inquiries i where i.id = inquiry_messages.inquiry_id));

drop policy if exists "Messaggi: il genitore scrive nelle proprie" on public.inquiry_messages;
create policy "Messaggi: il genitore scrive nelle proprie"
  on public.inquiry_messages for insert
  with check (
    author_id = auth.uid()
    and author_side = 'parent'
    and exists (
      select 1 from public.activity_inquiries i
      where i.id = inquiry_messages.inquiry_id and i.parent_id = auth.uid()
    )
  );

drop policy if exists "Messaggi: il centro scrive in quelle delle sue attività" on public.inquiry_messages;
create policy "Messaggi: il centro scrive in quelle delle sue attività"
  on public.inquiry_messages for insert
  with check (
    author_id = auth.uid()
    and author_side = 'center'
    and exists (
      select 1
      from public.activity_inquiries i
      join public.activities a on a.id = i.activity_id
      where i.id = inquiry_messages.inquiry_id
        and (a.center_id = public.current_center_id() or public.is_platform_admin())
    )
  );

-- Le richieste di oggi diventano i primi messaggi (solo se la conversazione
-- non ha ancora messaggi: rieseguibile senza doppioni).
insert into public.inquiry_messages (inquiry_id, author_id, author_side, body, created_at)
select i.id, i.parent_id, 'parent', i.message, coalesce(i.created_at, now())
from public.activity_inquiries i
where btrim(coalesce(i.message, '')) <> ''
  and not exists (select 1 from public.inquiry_messages m where m.inquiry_id = i.id);

insert into public.inquiry_messages (inquiry_id, author_id, author_side, body, created_at)
select i.id, i.replied_by, 'center', i.reply, coalesce(i.replied_at, i.created_at, now())
from public.activity_inquiries i
where btrim(coalesce(i.reply, '')) <> ''
  and not exists (
    select 1 from public.inquiry_messages m where m.inquiry_id = i.id and m.author_side = 'center'
  );

-- Verifica (sola lettura):
--   select (select count(*) from public.activity_inquiries) as conversazioni,
--          (select count(*) from public.inquiry_messages) as messaggi;
