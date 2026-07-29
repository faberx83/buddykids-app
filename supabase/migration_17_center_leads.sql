-- Migrazione 17 — TRAMA ONE Build Sprint 5 (CenterLead, referral e incentivi).
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase (nessuna migrazione applicata da
-- Claude, per governance del progetto).
--
-- ════════════════════════════════════════════════════════════════
-- Scope e riduzione deliberata rispetto alla fonte di design
-- ════════════════════════════════════════════════════════════════
-- `docs/trama-one/derived/TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_
-- Referral_Incentives.md` (§9, §B.2, §B.4) definisce un modello di dominio
-- completo con 8 entità separate (CenterLead, DemandContext,
-- CenterInvitation, CenterClaim, ReferralAttribution, ReferralReward,
-- PartnerIncentive, IncentiveRuleVersion) e una state machine economica
-- reale. `SPRINT_GOVERNANCE.md` (Sprint 5) riduce deliberatamente questo
-- scope a UNA SOLA tabella additiva ("Artefatti obbligatori: nessuno
-- strutturale oltre lo schema center_leads") con reward/commission "in
-- shadow mode/manuale, mai automatico prima del ledger reale" — coerente con
-- §B.5 della fonte stessa: "CR-049 può essere implementata in forma minima
-- (suggestion + CenterLead + stato)... CR-051/052 restano feature-flagged e
-- preferibilmente in shadow mode". Questa migrazione implementa quella forma
-- minima: DemandContext diventa una colonna jsonb (non una tabella a sé),
-- CenterInvitation/CenterClaim diventano stati+colonne sulla stessa riga
-- (non entità separate), ReferralAttribution è implicita nel
-- first-qualified su dedupe_key, ReferralReward/PartnerIncentive/
-- IncentiveRuleVersion diventano campi manuali di sola annotazione (nessun
-- calcolo automatico, nessun pagamento reale).
--
-- ════════════════════════════════════════════════════════════════
-- Cosa fa
-- ════════════════════════════════════════════════════════════════
-- Crea public.center_leads: un genitore segnala un centro non ancora
-- iscritto (nome + località indicativa + contesto domanda automatico);
-- l'Admin dedupliica (dedupe_key normalizzato lato applicativo, non SQL:
-- nessuna estensione unaccent installata in questo progetto, vedi
-- lib/data/center-leads.ts::normalizeDedupeKey), qualifica, segna
-- contattato, e se il centro completa l'onboarding reale (state machine
-- center_onboarding_state esistente, invariata) collega il lead al centro
-- con claimed_center_id. Reward/commission restano campi manuali di
-- annotazione (reward_status/reward_note), mai calcolati né erogati da
-- codice: nessuna automazione economica reale, come da scope esplicito.
-- ════════════════════════════════════════════════════════════════

begin;

create table if not exists public.center_leads (
  id uuid primary key default gen_random_uuid(),

  -- Dati minimi della segnalazione (Must, §B.2.2 della fonte di design).
  suggested_name text not null,
  suggested_locality text, -- città/zona indicativa, non un indirizzo verificato

  -- Contatto SOLO se già noto alla famiglia (Optional/controlled, §B.2.2) —
  -- mai raccolto in automatico, mai obbligatorio.
  suggested_contact text,

  -- DemandContext minimizzato: route sorgente, area, periodo, filtri,
  -- categoria/età se disponibili — raccolto automaticamente lato client,
  -- mai testo libero arbitrario. jsonb, non tabella dedicata (riduzione di
  -- scope Sprint 5 rispetto a DemandContext come entità separata).
  demand_context jsonb not null default '{}'::jsonb,

  -- Dedupe (Must, §B.2.2): normalizzato lato applicativo da nome+località
  -- (lower/trim/rimozione punteggiatura, vedi lib/data/center-leads.ts).
  -- Non unique: due segnalazioni con lo stesso dedupe_key sono aggregate
  -- come domanda ("i DemandContext vengono aggregati", AC-049-04) ma solo
  -- la prima qualificata mantiene l'attribution economica (first-qualified,
  -- vedi referrer_profile_id sotto + policy applicativa in
  -- lib/data/center-leads.ts, non enforced da un constraint SQL perché
  -- richiede una query, non un vincolo statico).
  dedupe_key text not null,

  -- Stati minimi (§9.2 della fonte di design, semplificati): la fonte
  -- propone "suggested -> deduplicated -> qualified -> invited/contacted ->
  -- claimed | rejected | expired". Qui si comprime deduplicated/qualified in
  -- un solo stato "qualified" (l'Admin li tratta come lo stesso passo
  -- operativo in questa fase MVP) e si tiene invited/contacted come un solo
  -- stato "contacted" (CenterInvitation come entità a sé è fuori scope
  -- Sprint 5, vedi sopra).
  status text not null default 'suggested'
    check (status in ('suggested', 'qualified', 'contacted', 'claimed', 'rejected', 'expired')),

  -- Merge esplicito di un duplicato verso il lead "canonico" (quello che
  -- mantiene l'attribution) — self-reference, mai un ciclo (enforced lato
  -- applicativo: un lead già duplicate_of non può ricevere a sua volta
  -- duplicati).
  duplicate_of uuid references public.center_leads(id) on delete set null,

  -- Chi ha segnalato (sempre un utente autenticato in questa app — nessuna
  -- segnalazione anonima prevista).
  suggested_by uuid references public.profiles(id) on delete set null not null,

  -- Note libere dell'Admin durante triage/outreach (mai visibili al
  -- genitore, AC-049-05 — enforced lato applicativo: la select per il
  -- genitore in lib/data/center-leads.ts non include questa colonna, pur
  -- essendo la RLS a livello di riga non di colonna).
  admin_note text,

  -- Claim: valorizzato SOLO quando il centro segnalato completa l'onboarding
  -- reale (center_onboarding_state) ed è collegato manualmente dall'Admin a
  -- questo lead. Non è una seconda via di pubblicazione (DDL-023): il centro
  -- diventa pubblico/prenotabile tramite l'onboarding esistente invariato,
  -- questo campo è solo il collegamento a posteriori per misurare
  -- l'attribution/conversione del canale referral.
  claimed_center_id uuid references public.centers(id) on delete set null,
  claimed_at timestamptz,

  -- Reward/commission: SOLO annotazione manuale, mai un calcolo automatico
  -- né un pagamento reale (scope esplicito Sprint 5 — "shadow mode/manuale,
  -- mai automatico prima del ledger reale"). Nessun constraint di importo:
  -- il valore economico (es. "10% fino a 25 euro", "commissione 3% anziché
  -- 5%") resta descrittivo in reward_note, non un campo numerico calcolato.
  reward_status text not null default 'not_applicable'
    check (reward_status in ('not_applicable', 'pending_manual_review', 'marked_eligible_manual', 'marked_paid_manual_offline')),
  reward_note text,
  reward_marked_by uuid references public.profiles(id) on delete set null,
  reward_marked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.center_leads enable row level security;

create index if not exists idx_center_leads_status on public.center_leads(status);
create index if not exists idx_center_leads_dedupe_key on public.center_leads(dedupe_key);
create index if not exists idx_center_leads_suggested_by on public.center_leads(suggested_by);
create index if not exists idx_center_leads_duplicate_of on public.center_leads(duplicate_of);

-- Il genitore vede le PROPRIE segnalazioni (per sapere lo stato, AC-049-05:
-- "vede condizioni e stati del referral ma non dati riservati" — la
-- riservatezza di admin_note è garantita lato applicativo, non da questa
-- policy di riga). L'admin piattaforma vede tutto.
create policy "Center leads: il genitore vede le proprie segnalazioni, l'admin tutte"
  on public.center_leads for select
  using (suggested_by = auth.uid() or public.is_platform_admin());

-- Il genitore crea la propria segnalazione, sempre in stato "suggested"
-- (non può auto-qualificarsi/auto-claimare) e sempre con reward_status
-- iniziale 'not_applicable' (non può auto-assegnarsi un reward).
create policy "Center leads: il genitore crea la propria segnalazione (sempre suggested)"
  on public.center_leads for insert
  with check (
    suggested_by = auth.uid()
    and status = 'suggested'
    and reward_status = 'not_applicable'
  );

-- Solo l'Admin piattaforma modifica una segnalazione (triage, dedupe,
-- claim, reward manuale). Il genitore non ha alcuna policy di update: una
-- volta inviata, la segnalazione non è più modificabile dal mittente
-- (coerente con "audit trail", Must in §B.2.2).
create policy "Center leads: solo l'admin piattaforma modifica (triage/claim/reward)"
  on public.center_leads for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Solo l'Admin piattaforma elimina (es. segnalazione palesemente spam/test).
create policy "Center leads: solo l'admin piattaforma elimina"
  on public.center_leads for delete
  using (public.is_platform_admin());

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, post-check, rollback. Mai eseguiti insieme al blocco
-- sopra.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA del blocco
-- begin;/commit; sopra. Solo lettura.
-- ════════════════════════════════════════════════════════════════

-- 1. Confermare che la tabella non esiste già (atteso: 0 righe):
-- select table_name from information_schema.tables
--   where table_schema='public' and table_name='center_leads';

-- 2. Gli helper riusati esistono già (atteso: 1 riga):
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname = 'is_platform_admin';

-- 3. Nessuna tabella "center_leads" preesistente con dati da preservare
--    (ridondante con #1, verifica esplicita per governance): 0 righe attese.

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query
-- alla volta.
-- ════════════════════════════════════════════════════════════════

-- 4. La tabella esiste con RLS abilitata:
-- select relname, relrowsecurity from pg_class where relname = 'center_leads';
-- -- atteso: 1 riga, relrowsecurity = true.

-- 5. Le 4 policy esistono:
-- select policyname from pg_policies
--   where schemaname = 'public' and tablename = 'center_leads';
-- -- atteso: 4 righe.

-- 6. Test funzionale: da un account genitore, inviare "Suggerisci un
--    centro" -> deve comparire subito in stato "Segnalato" nella propria
--    lista. Da /admin/center-leads (platform_admin), la segnalazione deve
--    comparire nella coda con tutti i dati (incluso admin_note editabile).

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — sicuro finché non ci sono ancora segnalazioni reali salvate
-- (nessun'altra tabella referenzia center_leads con FK in ingresso).
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists "Center leads: solo l'admin piattaforma elimina" on public.center_leads;
-- drop policy if exists "Center leads: solo l'admin piattaforma modifica (triage/claim/reward)" on public.center_leads;
-- drop policy if exists "Center leads: il genitore crea la propria segnalazione (sempre suggested)" on public.center_leads;
-- drop policy if exists "Center leads: il genitore vede le proprie segnalazioni, l'admin tutte" on public.center_leads;
-- drop table if exists public.center_leads;
-- commit;
