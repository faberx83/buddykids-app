-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION 27 — Privacy Notice / Termini / Consensi (BOZZA, NON APPLICATA)
-- ═══════════════════════════════════════════════════════════════════════
--
-- PRE-LAUNCH REMEDIATION WAVE 1 — R-546/C-01/C-02/C-03 (decisione Fabrizio,
-- 24/08/2026). Vedi docs/trama-one/analysis/PRIVACY_TERMS_TECHNICAL_DESIGN.md
-- per il ragionamento completo dietro ogni scelta qui sotto.
--
-- STATO: bozza tecnica, NON eseguita su Supabase. Fabrizio applica dopo aver
-- confermato (a) i nomi/valori di versione reali per Termini/Privacy Notice
-- (oggi solo segnaposto "v0-draft-2026-08-24") e (b) di voler procedere con
-- questo modello dati. Additiva al 100%: nessuna tabella/colonna esistente
-- viene toccata, alterata o rimossa.
--
-- MODELLO A DUE LIVELLI (motivato nel documento di design):
--   1. public.profiles — 6 nuove colonne: SOLO lo stato CORRENTE di
--      accettazione (rapido da leggere per qualunque gate applicativo,
--      es. "blocca la prenotazione finché tos_accepted_at è nullo").
--   2. public.consent_events — nuova tabella APPEND-ONLY: la storia
--      completa di ogni consenso dato/ritirato, con versione e timestamp —
--      è questo il "registro delle attività di trattamento" richiesto in
--      caso di verifica (Garante Privacy) o di controversia con un utente,
--      non le 6 colonne di stato (che raccontano solo "adesso", non "chi ha
--      accettato quale versione quando").
--
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Stato corrente su profiles (additivo, tutte le colonne nullable) ──

alter table public.profiles
  add column if not exists tos_version text,
  add column if not exists tos_accepted_at timestamptz,
  add column if not exists privacy_notice_version text,
  add column if not exists privacy_notice_accepted_at timestamptz,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_updated_at timestamptz;

-- Nessuna RLS nuova richiesta qui: queste colonne vivono sulla riga
-- "profiles" già esistente, coperta dalla policy "Profiles: un utente
-- vede/modifica il proprio profilo" (migration_22, verificata APPLICATA
-- live il 24/08/2026 — vedi Production Truth, Wave 1 #1) — un utente può
-- già leggere/scrivere solo la propria riga, is_platform_admin() vede tutte.

-- ── 2. Registro consensi append-only (nuova tabella) ─────────────────────

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms', 'privacy_notice', 'marketing')),
  version text not null, -- es. "v0-draft-2026-08-24" — vedi lib/legal/consent.ts
  action text not null check (action in ('accepted', 'declined', 'withdrawn')),
  -- Contesto minimo per un'eventuale verifica (NON per profilazione): utile
  -- a distinguere "accettato al signup" da "ritirato dopo, da Impostazioni".
  source text, -- es. "signup", "settings_withdraw"
  created_at timestamptz not null default now()
);

alter table public.consent_events enable row level security;

-- Un utente vede SOLO la propria storia di consensi.
create policy "Consent events: un utente vede i propri consensi"
  on public.consent_events for select
  using (auth.uid() = user_id or public.is_platform_admin());

-- Un utente può registrare SOLO un proprio evento di consenso (mai per
-- conto di un altro user_id) — nessun UPDATE/DELETE per nessuno: il
-- registro è append-only per costruzione, coerente con il suo scopo di
-- audit (una riga scritta per errore si "corregge" scrivendone una nuova,
-- non modificando/cancellando la precedente).
create policy "Consent events: un utente registra i propri consensi"
  on public.consent_events for insert
  with check (auth.uid() = user_id);

create index if not exists idx_consent_events_user_id on public.consent_events(user_id);
create index if not exists idx_consent_events_type on public.consent_events(consent_type);

-- ═══════════════════════════════════════════════════════════════════════
-- FINE MIGRATION 27 — Verifica pre-applicazione consigliata (sola lettura):
--   select column_name from information_schema.columns
--   where table_name = 'profiles' and column_name like 'tos_%' or column_name like '%consent%';
--   -- atteso: 0 righe PRIMA di applicare questo file.
-- ═══════════════════════════════════════════════════════════════════════
