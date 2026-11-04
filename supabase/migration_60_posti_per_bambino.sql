-- TRAMA — Migration 60: un posto per ogni bambino (quanti posti ha preso una riga)
-- STATO: PREPARATA, NON APPLICATA
--
-- QA in produzione del 04/11/2026, EXTRA-02 (HIGH): due bambini nella stessa
-- prenotazione consumavano un solo posto. Causa verificata nel codice:
-- lib/capacity/service.ts toglieva sempre 1 posto per riga booking_days /
-- booking_weeks, qualunque fosse il numero di bambini (booking_kids). In
-- produzione (sola lettura, 04/11): 17 giorni accettati, 2 con due bambini
-- (UX DEMO 3 novembre, 7 e 8 dicembre), 0 settimane accettate.
--
-- Cosa fa (solo struttura, nessun posto cambia):
--   1. booking_days.capacity_units e booking_weeks.capacity_units: quanti
--      posti quella riga ha davvero tolto. Serve per restituire esattamente
--      quei posti in caso di annullamento o modifica (anche per le righe
--      vecchie, che ne hanno tolto 1).
--   2. le righe già accettate (capacity_decremented = true) ricevono 1, cioè
--      quello che è successo davvero; le altre 0.
-- Il codice nuovo toglie un posto per bambino (capacity_units = numero di
-- bambini) e restituisce capacity_units.
--
-- NON corregge i 2 giorni demo già sottocontati: quello è il piano di
-- riconciliazione separato, supabase/riconciliazione_60_posti_per_bambino.sql,
-- da approvare prima.
--
-- Additiva e reversibile. Ripiego (il codice nuovo tollera la colonna assente
-- e torna a 1 posto per riga):
--   alter table public.booking_days drop constraint if exists booking_days_capacity_units_ok;
--   alter table public.booking_weeks drop constraint if exists booking_weeks_capacity_units_ok;
--   alter table public.booking_days drop column if exists capacity_units;
--   alter table public.booking_weeks drop column if exists capacity_units;

alter table public.booking_days add column if not exists capacity_units smallint not null default 0;
alter table public.booking_weeks add column if not exists capacity_units smallint not null default 0;

update public.booking_days set capacity_units = 1 where capacity_decremented and capacity_units = 0;
update public.booking_weeks set capacity_units = 1 where capacity_decremented and capacity_units = 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'booking_days_capacity_units_ok') then
    alter table public.booking_days add constraint booking_days_capacity_units_ok check (capacity_units >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'booking_weeks_capacity_units_ok') then
    alter table public.booking_weeks add constraint booking_weeks_capacity_units_ok check (capacity_units >= 0);
  end if;
end $$;

comment on column public.booking_days.capacity_units is 'Posti tolti da activity_days.spots_left per questa riga (uno per bambino; 1 per le righe accettate prima del 04/11/2026). Migration 60.';
comment on column public.booking_weeks.capacity_units is 'Posti tolti da activity_weeks.spots_left per questa riga (uno per bambino; 1 per le righe accettate prima del 04/11/2026). Migration 60.';
