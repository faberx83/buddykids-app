-- Migrazione 03 — genere del bambino (facoltativo) per il profilo genitore.
-- Esegui questo file UNA VOLTA nello SQL Editor di Supabase.

alter table public.kids
  add column if not exists gender text check (gender in ('M', 'F', 'altro'));
