-- TRAMA — Migration 48: uscire da un gruppo, eliminare un gruppo
-- STATO: PREPARATA, NON APPLICATA
--
-- Ritest del 22/10/2026 (Fabrizio): "manca la possibilità di cancellare
-- gruppi o di uscire dal gruppo". Oggi le regole di accesso (RLS) non
-- permettono né l'una né l'altra cosa: group_members e groups non hanno una
-- regola DELETE. Iniziativa: claude/INIZIATIVA_parent_ux_fix_2110.md.
--
-- Cosa fa (solo due regole nuove, nessuna tabella né colonna):
--   1. un genitore può togliere SE STESSO da un gruppo (uscire);
--   2. chi ha creato un gruppo può eliminarlo. Le righe collegate (membri,
--      bambini, aggregazioni, inviti, passaggi, richieste) si cancellano già
--      da sole (on delete cascade dal 2026); interest_signals resta, con il
--      riferimento al gruppo vuoto (on delete set null).
--
-- Le azioni dell'app aggiungono due protezioni: chi ha creato il gruppo non
-- può uscire (lo elimina), e un gruppo con una richiesta al centro in attesa
-- o accettata non si elimina dall'app.
--
-- Ripiego:
--   drop policy if exists "Group members: un genitore esce dal gruppo" on public.group_members;
--   drop policy if exists "Groups: il creatore elimina il gruppo" on public.groups;

drop policy if exists "Group members: un genitore esce dal gruppo" on public.group_members;
create policy "Group members: un genitore esce dal gruppo"
  on public.group_members
  for delete
  using (auth.uid() = parent_id);

drop policy if exists "Groups: il creatore elimina il gruppo" on public.groups;
create policy "Groups: il creatore elimina il gruppo"
  on public.groups
  for delete
  using (created_by = auth.uid());
