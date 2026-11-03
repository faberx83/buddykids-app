-- TRAMA — Migration 59: il centro può sospendere le nuove richieste di un'attività
-- STATO: PREPARATA, NON APPLICATA
--
-- Test browser del 03/11/2026 e report del 30/10 (UX-PARTNER-004): "Crea
-- l'attività" la rende subito pubblica senza dirlo, e non esiste un modo per
-- smettere di ricevere richieste senza cancellare nulla. Verificato prima:
-- nessun controllo di sospensione per attività (solo lo stato del centro,
-- gestito dall'Admin).
--
-- Cosa fa:
--   1. activities.requests_paused_at: quando il centro ha sospeso le nuove
--      richieste (null = riceve richieste). Le righe esistenti restano null.
--   2. un controllo nel database: con le richieste sospese una NUOVA
--      prenotazione su quell'attività viene rifiutata (bookings, INSERT).
--      Prenotazioni esistenti, risposte del centro, annullamenti e modifiche
--      non sono toccati: sospendere non cancella niente.
-- Il centro aggiorna la colonna con le regole di sempre sulle proprie
-- attività. Codice: app/actions/center-activities-v2.ts#setActivityRequestsPausedAction.
-- Prima di questa migration il pulsante "Sospendi" risponde che non è ancora
-- disponibile; il resto funziona come oggi.
--
-- Additiva e reversibile. Ripiego:
--   drop trigger if exists bookings_rifiuta_attivita_sospesa on public.bookings;
--   drop function if exists public.bookings_rifiuta_attivita_sospesa();
--   alter table public.activities drop column if exists requests_paused_at;

alter table public.activities add column if not exists requests_paused_at timestamptz;

comment on column public.activities.requests_paused_at is 'Quando il centro ha sospeso le nuove richieste (null = riceve richieste). Le prenotazioni esistenti restano. Migration 59, 03/11/2026.';

create or replace function public.bookings_rifiuta_attivita_sospesa()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
begin
  if exists (select 1 from public.activities a where a.id = new.activity_id and a.requests_paused_at is not null) then
    raise exception 'Il centro ha sospeso le nuove richieste per questa attività.'
      using errcode = 'P0001', hint = 'requests_paused';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_rifiuta_attivita_sospesa on public.bookings;
create trigger bookings_rifiuta_attivita_sospesa
  before insert on public.bookings
  for each row execute function public.bookings_rifiuta_attivita_sospesa();
