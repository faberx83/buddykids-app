-- Migrazione 02 — colonne aggiuntive per collegare Home e Cerca ai dati reali.
-- Esegui questo file UNA VOLTA nello SQL Editor di Supabase (dopo aver già
-- eseguito supabase/schema.sql). Aggiunge solo le colonne mancanti: è sicuro
-- da eseguire anche se qualche colonna esistesse già ("if not exists").

alter table public.centers
  add column if not exists gradient text default 'linear-gradient(135deg,#E8F6FD,#E3F9F5)';

alter table public.activities
  add column if not exists img_gradient text default 'linear-gradient(135deg,#E8F6FD,#E3F9F5)',
  add column if not exists days text,
  add column if not exists hours text,
  add column if not exists distance_km numeric(4, 1) default 0,
  add column if not exists spots_left int,
  add column if not exists weeks_available text default '',
  add column if not exists pills jsonb default '[]',
  add column if not exists badges jsonb default '[]';
