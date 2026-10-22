-- TRAMA — Migration 51: chi accompagna per passaggio (Fase B della settimana tipo)
-- STATO: PREPARATA, NON APPLICATA
--
-- Fabrizio, 22/10/2026 (Planner, venerdì di Noemi): "gli spostamenti sono 4:
-- a/r da scuola e a/r palestra… uscita da scuola e ingresso in palestra
-- potrebbero essere lo stesso passaggio ma va indicato". Oggi chi accompagna
-- si salva in week_responsibilities: UNA andata e UN ritorno per figlio e
-- giorno, solo dal lunedì al venerdì. Uscita da scuola e ingresso in palestra
-- non hanno un posto, il sabato non esiste.
-- Iniziativa: claude/INIZIATIVA_planner_routine_settimanale.md (Fase B),
-- approvata da Fabrizio il 22/10/2026.
--
-- Cosa fa: una tabella NUOVA accanto a week_responsibilities, che resta
-- com'è e continua a valere come ripiego (vedi lib/nextgen/passages.ts):
--   - una riga = chi porta (andata) o chi ritira (ritorno) per UN passaggio
--     di UN figlio in UNA data: "school" (entrata/uscita da scuola),
--     "booking:<id>" (prenotazione TRAMA), "external:<id>" (impegno del Planner);
--   - qualunque giorno, sabato e domenica compresi;
--   - stesse persone di week_responsibilities (io, partner, nonno, nonna,
--     tata, altro + family_people).
-- Regole di accesso come week_responsibilities: ogni genitore vede e gestisce
-- solo le proprie righe.
--
-- Additiva e reversibile. Nessun dato esistente cambia. Ripiego:
--   spegnere la release "chi-accompagna-per-passaggio" (si torna al per-giorno);
--   per togliere anche la tabella: drop table if exists public.passage_responsibilities;

create table if not exists public.passage_responsibilities (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  date date not null,
  passage_key text not null check (passage_key ~ '^(school|booking:[0-9a-f-]{36}|external:[0-9a-f-]{36})$'),
  moment text not null check (moment in ('andata', 'ritorno')),
  responsible text not null check (responsible in ('io', 'partner', 'nonno', 'nonna', 'tata', 'altro')),
  responsible_label text check (responsible_label is null or char_length(responsible_label) <= 80),
  family_person_id uuid references public.family_people(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (parent_id, kid_id, date, passage_key, moment)
);

comment on table public.passage_responsibilities is
  'Chi porta / chi ritira per singolo passaggio (scuola, prenotazione, impegno del Planner) e data, sabato e domenica compresi. Se manca, vale week_responsibilities del giorno. Migration 51, 22/10/2026.';

create index if not exists idx_passage_responsibilities_parent_date
  on public.passage_responsibilities (parent_id, date);

alter table public.passage_responsibilities enable row level security;

drop policy if exists "Passaggi: il genitore gestisce le proprie righe" on public.passage_responsibilities;
create policy "Passaggi: il genitore gestisce le proprie righe"
  on public.passage_responsibilities for all
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

grant select, insert, update, delete on public.passage_responsibilities to authenticated;
