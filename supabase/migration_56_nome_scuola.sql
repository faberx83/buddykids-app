-- TRAMA — Migration 56: il nome (e l'indirizzo) della scuola anche senza orari
-- STATO: PREPARATA, NON APPLICATA
--
-- Test UX del 29/10/2026 (UX-PARENT-023, "Il nome scuola manuale scompare
-- dopo refresh"): nella scheda del figlio, con "Orari della scuola" spento,
-- il nome scritto ("Scuola Demo Retest 29 ottobre") si perdeva. Causa: il
-- nome viveva SOLO nel titolo dell'impegno ricorrente "scuola" (gli orari);
-- spegnendo gli orari l'impegno si cancella e il nome con lui.
-- kid_school_profiles teneva solo Regione e Comune.
--
-- Cosa fa: due colonne facoltative su kid_school_profiles, scritte insieme a
-- Regione e Comune (app/actions/school-calendar.ts):
--   school_name    — il nome scelto dalla ricerca o scritto a mano;
--   school_address — l'indirizzo, solo se appartiene a quel nome (cambiando
--                    nome l'indirizzo vecchio si toglie, come prima).
-- Le regole di accesso della tabella restano quelle di oggi (ogni genitore
-- le righe dei propri figli). Nessun dato esistente cambia.
--
-- Prima di questa migration il codice salva Regione e Comune come oggi e
-- dice chiaramente che il nome senza orari non si può ancora conservare.
--
-- Additiva e reversibile. Ripiego:
--   alter table public.kid_school_profiles drop column if exists school_name;
--   alter table public.kid_school_profiles drop column if exists school_address;

alter table public.kid_school_profiles add column if not exists school_name text;
alter table public.kid_school_profiles add column if not exists school_address text;

comment on column public.kid_school_profiles.school_name is 'Nome della scuola (facoltativo), anche senza orari. UX-PARENT-023, 29/10/2026.';
comment on column public.kid_school_profiles.school_address is 'Indirizzo della scuola (facoltativo), solo se appartiene a school_name.';
