-- TRAMA — Migration 57: il centro può aprire una conversazione con una famiglia
-- STATO: PREPARATA, NON APPLICATA
--
-- Fabrizio (30/10/2026): "perché scrivi alla famiglia è con mail e non con i
-- messaggi conversazione?". Oggi una conversazione (activity_inquiries) la
-- apre solo il genitore: la regola di inserimento è "auth.uid() = parent_id".
-- Dal foglio di una prenotazione, se la famiglia non aveva mai scritto, il
-- portale centri poteva solo aprire l'email.
--
-- Cosa fa:
--   1. opened_by su activity_inquiries ('parent' | 'center', default 'parent'):
--      chi ha aperto la conversazione. Le righe esistenti restano 'parent'.
--   2. una regola di inserimento in più: il gestore (o l'Admin) apre una
--      conversazione SOLO su un'attività del proprio centro e SOLO con una
--      famiglia che ha una prenotazione su quell'attività. Nessun contatto a
--      freddo, nessun accesso a famiglie di altri centri.
-- I messaggi (inquiry_messages) usano le regole di sempre (migration 54): il
-- centro scrive nelle conversazioni delle sue attività.
--
-- Codice: app/actions/inquiries.ts#startConversationWithFamilyAction. Prima di
-- questa migration l'inserimento fallisce e il portale offre l'email come oggi.
--
-- Additiva e reversibile. Ripiego:
--   drop policy if exists "Richieste: il centro scrive a chi ha prenotato" on public.activity_inquiries;
--   alter table public.activity_inquiries drop constraint if exists activity_inquiries_opened_by_check;
--   alter table public.activity_inquiries drop column if exists opened_by;

alter table public.activity_inquiries add column if not exists opened_by text not null default 'parent';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'activity_inquiries_opened_by_check' and conrelid = 'public.activity_inquiries'::regclass
  ) then
    alter table public.activity_inquiries
      add constraint activity_inquiries_opened_by_check check (opened_by in ('parent', 'center'));
  end if;
end $$;

comment on column public.activity_inquiries.opened_by is 'Chi ha aperto la conversazione: parent (genitore) o center (gestore, solo con famiglie che hanno prenotato). Migration 57, 03/11/2026.';

drop policy if exists "Richieste: il centro scrive a chi ha prenotato" on public.activity_inquiries;
create policy "Richieste: il centro scrive a chi ha prenotato"
  on public.activity_inquiries
  for insert
  to authenticated
  with check (
    opened_by = 'center'
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.activities a
        where a.id = activity_inquiries.activity_id
          and a.center_id = public.current_center_id()
      )
    )
    and exists (
      select 1 from public.bookings b
      where b.parent_id = activity_inquiries.parent_id
        and b.activity_id = activity_inquiries.activity_id
    )
  );
