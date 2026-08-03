-- Script (TEMPLATE) — TRAMA ONE Controlled Beta: arruolare centri/famiglie
-- pilota REALI nella coorte 'trama-one-controlled-beta'.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, progetto eagsgfxunwyyxwwilldy,
-- SOLO quando il Visual Acceptance Gate (§15, TRAMA_ONE_VISUAL_ACCEPTANCE.md)
-- è chiuso e si è deciso di espandere la Controlled Beta oltre i 2 account
-- di test (parent/center_admin) e l'accesso permanente platform_admin già
-- attivi da DEC-57/script_controlled_beta_flag_cohort.sql.
--
-- Questo è un TEMPLATE, non una lista già compilata: nessun centro o
-- famiglia pilota reale è stato scelto o inserito qui — per esplicita
-- decisione di Fabrizio al momento di DEC-57 ("nessuna aggiunta, per ora,
-- di famiglie o centri pilot reali"). Sostituire i placeholder <...> con
-- gli id/email reali prima di eseguire.
--
-- Non crea nuovi utenti: presuppone che ogni Partner/Parent pilota abbia già
-- un account (public.profiles) esistente — questo script si limita ad
-- ARRUOLARLI nella coorte, non a crearli o promuoverli di ruolo.


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 1 — PRE-CHECK (sola lettura — esegui e leggi PRIMA di procedere)
-- ════════════════════════════════════════════════════════════════

-- 1a. Stato attuale della coorte 'trama-one-controlled-beta' — verifica che
-- l'override cohort esista ancora e non sia scaduto (DEC-57, 60 giorni da
-- 2026-08-03 -> scade 2026-10-02) prima di aggiungere membership che
-- dipendono da quell'override per avere effetto.
select id, scope_type, scope_value, enabled, expires_at
from public.feature_flag_overrides
where flag_name = 'TRAMA_ONE_ENABLED' and scope_type = 'cohort' and scope_value = 'trama-one-controlled-beta';

-- 1b. Membership correnti della coorte — non duplicare chi è già dentro.
select user_id, active, expires_at, created_at
from public.beta_cohort_memberships
where cohort_key = 'trama-one-controlled-beta'
order by created_at;

-- 1c. Risolvi gli id reali dai profili (email -> id) — sostituisci la lista
-- con le email reali dei Partner/Parent pilota da arruolare in questo giro.
select id, email, role, center_id
from public.profiles
where email in (
  '<email-partner-pilota-1@esempio.it>',
  '<email-parent-pilota-1@esempio.it>'
  -- aggiungere altre righe secondo necessità
)
order by email;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 2 — ARRUOLAMENTO (blocco transazionale: tutto o niente)
-- ════════════════════════════════════════════════════════════════

begin;

-- 2a. Inserisce le membership per gli id verificati in 1c. Stessa scadenza
-- della coorte (allineata a scope='cohort' in feature_flag_overrides, non
-- una scadenza indipendente per utente — un solo posto da rinnovare, stesso
-- principio già scelto per i 2 account di test in DEC-57).
-- SOSTITUIRE i placeholder <uuid-...> con gli id reali letti in 1c.
insert into public.beta_cohort_memberships (user_id, cohort_key, active, expires_at)
values
  ('<uuid-partner-pilota-1>', 'trama-one-controlled-beta', true, now() + interval '60 days'),
  ('<uuid-parent-pilota-1>', 'trama-one-controlled-beta', true, now() + interval '60 days')
on conflict (user_id, cohort_key)
do update set active = true, expires_at = excluded.expires_at;

commit;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 3 — POST-CHECK (sola lettura — esegui subito dopo il commit)
-- ════════════════════════════════════════════════════════════════

-- 3a. Conferma che ogni id atteso è presente, active=true, con la scadenza
-- corretta — confronta riga per riga col numero di persone arruolate in
-- questo giro (non un conteggio approssimativo).
select bcm.user_id, p.email, p.role, bcm.active, bcm.expires_at
from public.beta_cohort_memberships bcm
join public.profiles p on p.id = bcm.user_id
where bcm.cohort_key = 'trama-one-controlled-beta'
order by bcm.created_at;


-- ════════════════════════════════════════════════════════════════
-- SEZIONE 4 — ROLLBACK (disattiva le membership appena aggiunte, non tocca
-- l'override di coorte né i 2 account di test originari)
-- ════════════════════════════════════════════════════════════════

-- Rollback mirato: disattiva SOLO gli id elencati qui (sostituire con quelli
-- realmente inseriti in questo giro), non l'intera coorte.
-- update public.beta_cohort_memberships
-- set active = false
-- where cohort_key = 'trama-one-controlled-beta'
--   and user_id in ('<uuid-partner-pilota-1>', '<uuid-parent-pilota-1>');
