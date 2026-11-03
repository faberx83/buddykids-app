-- TRAMA — Migration 58: posti dei giorni e delle settimane sempre coerenti
-- STATO: PREPARATA, NON APPLICATA
--
-- Test browser del 03/11/2026 (HIGH): in "Date e posti" un giorno con posti
-- totali 2 e posti liberi 3 veniva salvato; dopo il refresh restava 2/3 e il
-- grafico mostrava occupazione −25%. Il codice ora lo impedisce in pagina e
-- nel salvataggio (lib/capacity/day-inventory.ts, saveActivityDaysAction).
-- Questa migration chiude anche la porta del database: qualunque scrittura
-- futura con posti negativi o liberi oltre i totali viene rifiutata.
--
-- Verificato in sola lettura il 03/11/2026: 305 giorni e 35 settimane, nessuna
-- riga fuori regola (quindi i vincoli si applicano a tutte le righe).
-- Le prenotazioni non si toccano. Il vincolo "non sotto i confermati" resta
-- nel codice (dipende da booking_days, non si esprime con un CHECK).
--
-- Additiva e reversibile. Ripiego:
--   alter table public.activity_days drop constraint if exists activity_days_posti_coerenti;
--   alter table public.activity_weeks drop constraint if exists activity_weeks_posti_coerenti;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activity_days_posti_coerenti' and conrelid = 'public.activity_days'::regclass) then
    alter table public.activity_days
      add constraint activity_days_posti_coerenti check (capacity >= 0 and spots_left >= 0 and spots_left <= capacity);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activity_weeks_posti_coerenti' and conrelid = 'public.activity_weeks'::regclass) then
    alter table public.activity_weeks
      add constraint activity_weeks_posti_coerenti check (capacity >= 0 and spots_left >= 0 and spots_left <= capacity);
  end if;
end $$;
