-- TRAMA — Migration 62: segnalazioni "Problemi ad accedere?" senza account
-- STATO: PREPARATA, NON APPLICATA
--
-- Lotto P0 Beta Readiness (16/11/2026). Fabrizio: "Aggiungi nella schermata
-- di login un link 'Problemi ad accedere?'… Deve usare il sistema di
-- feedback esistente, funzionare senza autenticazione".
--
-- Cosa fa (solo struttura, nessuna riga esistente cambia):
--   1. beta_feedback.parent_id diventa facoltativo: una segnalazione dalla
--      pagina di accesso non ha un account dietro.
--   2. app_source ammette 'accesso' (oltre a 'genitori' e 'gestore').
--   3. contact_email (facoltativa): l'email lasciata per la risposta.
--   4. Vincolo: parent_id può mancare SOLO per app_source = 'accesso'.
-- Le politiche RLS non cambiano: un genitore continua a vedere e creare
-- solo righe con il proprio parent_id; le righe 'accesso' le scrive solo il
-- server (client di servizio, app/actions/access-problem.ts) e le vede solo
-- l'admin piattaforma.
--
-- Prima di applicarla: il link e la pagina ci sono già, l'invio risponde
-- "scrivici a privacy@tramapp.it" e non salva nulla.
--
-- Rientro (solo se non ci sono righe 'accesso'):
--   delete from public.beta_feedback where app_source = 'accesso';
--   alter table public.beta_feedback drop constraint if exists beta_feedback_parent_or_access_check;
--   alter table public.beta_feedback drop column if exists contact_email;
--   alter table public.beta_feedback drop constraint if exists beta_feedback_app_source_check;
--   alter table public.beta_feedback add constraint beta_feedback_app_source_check check (app_source in ('genitori', 'gestore'));
--   alter table public.beta_feedback alter column parent_id set not null;
--
-- Verifica dopo l'applicazione:
--   select is_nullable from information_schema.columns
--    where table_name = 'beta_feedback' and column_name = 'parent_id';   -- YES
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname in ('beta_feedback_app_source_check', 'beta_feedback_parent_or_access_check');   -- 2 righe

alter table public.beta_feedback alter column parent_id drop not null;

alter table public.beta_feedback drop constraint if exists beta_feedback_app_source_check;
alter table public.beta_feedback add constraint beta_feedback_app_source_check
  check (app_source in ('genitori', 'gestore', 'accesso'));

alter table public.beta_feedback add column if not exists contact_email text;

alter table public.beta_feedback drop constraint if exists beta_feedback_contact_email_check;
alter table public.beta_feedback add constraint beta_feedback_contact_email_check
  check (contact_email is null or (length(contact_email) <= 254 and contact_email like '%_@_%'));

alter table public.beta_feedback drop constraint if exists beta_feedback_parent_or_access_check;
alter table public.beta_feedback add constraint beta_feedback_parent_or_access_check
  check (parent_id is not null or app_source = 'accesso');

create index if not exists idx_beta_feedback_access_recent
  on public.beta_feedback (created_at desc) where app_source = 'accesso';
