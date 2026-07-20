# TRAMA ONE — Transition Register

Registro degli adapter/ponti tra AS-IS (Legacy, Next Gen, modelli dati esistenti) e TRAMA ONE, richiesto come output esplicito di TRAMA ONE Build Sprint 0 dal Master Prompt ("aggiungi Transition Register e Assumption Log nel repository"). Ogni riga documenta un punto in cui TRAMA ONE si appoggia temporaneamente o permanentemente a un meccanismo AS-IS invece di sostituirlo.

**Stato in Build Sprint 0**: nessun vero adapter creato in questo sprint — nessuna capability di business (Request lifecycle, Booking, Offering, PlannerItem) è nello scope Sprint 0, quindi non c'è ancora nulla da "adattare". Questo registro era predisposto vuoto/scaffolded, in attesa di essere popolato a partire da Build Sprint 1.

**Stato in Build Sprint 1**: la state machine di onboarding Center (`center_onboarding_state` e tabelle satellite, `supabase/migration_09_center_onboarding.sql`) NON è un adapter nel senso Master Prompt (non traduce uno stato di business preesistente): prima di Sprint 1 non esisteva alcun concetto di stato onboarding per un Centro, quindi non c'è nulla da "tradurre" — è una capability puramente NEW. L'unico collegamento con l'AS-IS è la lettura in sola lettura di `centers.id`/`profiles.center_id` via chiave esterna (per sapere a quale centro appartiene una riga), mai una scrittura o traduzione di stato su quelle tabelle. Registrato comunque qui sotto per completezza, seguendo la stessa convenzione.

## Convenzione per le righe future

Ogni adapter registrato qui deve indicare: nome/scopo, sprint di introduzione, asset AS-IS coinvolti (tabelle/servizi), asset TRAMA ONE coinvolti, tipo di ponte (sola lettura / scrittura duale / traduzione di stato), condizione di rimozione (quando l'adapter potrà essere eliminato, non prima della parità dimostrata — vedi `analysis/DECISION_LOG.md` DEC-15), rischio residuo.

| Nome adapter | Sprint di introduzione | AS-IS coinvolto | TRAMA ONE coinvolto | Tipo di ponte | Condizione di rimozione | Rischio |
|---|---|---|---|---|---|---|
| Onboarding state ↔ Center | Build Sprint 1 | `public.centers` (id), `public.profiles` (center_id, role) | `center_onboarding_state`, `center_onboarding_checklist_completions`, `center_identity_verifications`, `center_onboarding_audit_log` | Sola lettura (FK verso centers/profiles, nessuna scrittura su quelle tabelle) — non è una traduzione di stato preesistente, è una capability nuova | Non applicabile (non c'è uno stato AS-IS da cui migrare via — nessuna rimozione prevista) | Basso — nessuna riga esistente in `centers`/`profiles` è mai scritta da questo adapter |

## Collegamenti già stabiliti in Build Sprint 0 (non adapter di business, solo riuso infrastrutturale)

Questi non sono "adapter" nel senso Master Prompt (non traducono uno stato di business), ma sono i punti di riuso diretto dell'infrastruttura AS-IS su cui il Feature Flag Engine e le route `/one` si appoggiano, per completezza di riferimento:

- **Auth/sessione**: `lib/supabase/server.ts` (client anon, RLS-bound) riusato as-is nei tre layout `/one` per identificare utente/ruolo — nessuna traduzione, stesso meccanismo di Legacy/NextGen.
- **Tenant/rewrite**: `proxy.ts`/`lib/tenant.ts` riusati as-is, non modificati — le route `/one` ereditano gate tenant/ruolo esistente senza alcun ponte dedicato.
- **Toggle Legacy/NextGen** (`bk_version`, `lib/version-preference.ts`): resta un meccanismo indipendente dal Feature Flag Engine (`TRAMA_ONE_ENABLED`) — nessun collegamento tra i due in questo sprint (Assumption Log D3).

Aggiunti in Build Sprint 1:

- **RLS reuse**: le nuove tabelle di `migration_09_center_onboarding.sql` riusano `public.is_platform_admin()` e `public.current_center_id()` (helper esistenti, non ridefiniti) nelle proprie policy — stesso principio "reuse-first" già applicato in Sprint 0 (DEC-21/DECISION_LOG.md).
- **Checklist onboarding**: `lib/onboarding/checklist-registry.ts` linka `/center/profile` (pagina AS-IS) per l'item "Profilo centro completo" — solo un link di navigazione, nessuna lettura/scrittura diretta di quella pagina da parte del nuovo codice.

## Prossimo aggiornamento previsto

Alla chiusura di TRAMA ONE Build Sprint 2 (Offering/Giorni spot) — se quello sprint introduce un qualunque ponte verso `activities`/`activity_weeks` esistenti diverso da un semplice ADAPT, va registrato qui.
