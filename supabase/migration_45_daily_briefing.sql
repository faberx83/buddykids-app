-- Migrazione 45 — "Il buongiorno di TRAMA": preferenze del riepilogo del mattino.
--
-- STATO: PREPARATA, NON APPLICATA
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito da Fabrizio
-- (deploy.sh lo propone e chiede APPLICA, oppure SQL Editor di Supabase).
--
-- Perché (20/10/2026, Fabrizio: "possiamo impostare un briefing giornaliero
-- alle 8? che arrivi come notifica… vorrei anche vedere una mail… e andrebbe
-- messa come personalizzazione nel profilo"): due scelte per genitore, sul
-- telefono e per email, spente di default. Le legge il cron
-- /api/cron/daily-briefing; le scrive il genitore da Profilo → Impostazioni →
-- Preferenze (le politiche RLS esistenti su profiles lasciano già aggiornare
-- solo il proprio profilo).
--
-- ADAPT (alternative valutate): notify_push / notify_email restano gli
-- interruttori generali e vengono comunque rispettati; servono due colonne
-- dedicate perché il buongiorno è facoltativo e spento di default, mentre
-- notify_* sono accese di default per tutte le altre notifiche.
--
-- Additiva e idempotente: due colonne con default false, nessun dato toccato.
--
-- ROLLBACK (solo se necessario):
--   alter table public.profiles drop column if exists daily_briefing_push;
--   alter table public.profiles drop column if exists daily_briefing_email;
--
-- POST-CHECK:
--   select count(*) from public.profiles where daily_briefing_push or daily_briefing_email;  -- 0

alter table public.profiles add column if not exists daily_briefing_push boolean not null default false;
alter table public.profiles add column if not exists daily_briefing_email boolean not null default false;
