# TRAMA — Pilot Observability & Coordination Resurfacing (Wave 1 + 2)

Fonte: `docs/trama-one/analysis/TRAMA_PILOT_ARCHITECTURE_REVIEW.md` (sez.8/9/2/4/12). Implementazione in un unico ciclo, nessuna migration, nessun deploy, nessuna modifica al routing Beta→NextGen (commit `35642bd`, già in produzione, invariato — verificato via `git diff` a fine lavoro: zero righe toccate su `app/auth/callback/route.ts`, `lib/auth/default-landing.ts`, `app/actions/navigation.ts`, `app/auth/login/LoginForm.tsx`).

## Correzione all'audit sorgente

La review originale (sez.4) concludeva che il dettaglio Gruppo NextGen-native e il Carpool non fossero ancora esposti su NextGen. Verifica più approfondita in questa wave ha trovato che **esistono già**: `app/nextgen/groups/[id]/page.tsx` (commit `5ffb6a3`, task #528, "chiude gli 8 rimandi legacy dentro NEXTGEN") riusa `components/GroupDetailClient.tsx` — lo stesso componente del Legacy, inclusa la tab "🚗 Accompagnamento" (carpool: `carpool_offers`/`carpool_requests`, matching, offerte/richieste). Il grep originale cercava `carpool` dentro `app/nextgen/` e non trovava nulla perché quel componente vive sotto `components/`, non sotto `app/nextgen/` — falso negativo dell'audit. Anche i deep-link sono già corretti (`PlannerGroupsView.tsx` → `/nextgen/groups/${group.id}`). Nessun lavoro necessario su questo punto: solo verifica (vedi `tests/one/coordination-resurfacing.spec.ts`, sezione "preservation, già esistente").

## WAVE 1 — Pilot Observability

**Cosa è stato riusato**: pattern RLS `is_platform_admin()` già presente su `profiles`/`beta_cohort_memberships`/`tutorial_progress`/`bookings`/`kids` (letti col client di sessione ordinario, mai service client); guardia Admin (`AdminLayout` → `DashboardLayout requiredRole="platform_admin"`) e gate `TRAMA_ONE_ENABLED` (`app/admin/one/layout.tsx`), ereditati automaticamente essendo la pagina sotto `/admin/one/*`; stile Command Center (`app/admin/one/page.tsx`, badge di stato) per la nuova pagina; whitelist `KNOWN_PRODUCT_EVENTS` + `persistProductEvent()` (già esistenti) per l'unico evento aggiuntivo persistito lato prenotazioni (`booking_created`, che già esisteva come `logTelemetryEvent()` solo-console).

**Cosa è stato aggiunto**:
- `lib/pilot/status.ts` — logica pura di derivazione dello stato sintetico (nessuna dipendenza I/O, stesso principio di `lib/command-center/priority.ts`/`lib/telemetry/known-events.ts`, testabile senza browser).
- `lib/data/pilot-users.ts` — `getPilotUsers()`: legge `beta_cohort_memberships` (chi è "nel pilota" oggi coincide con la Controlled Beta Cohort) e joina in memoria `profiles`, `tutorial_progress` (filtrato su `tutorial_key='parent_beta_onboarding'`), `bookings`, `kids` (tutti letti col client di sessione, bypass RLS admin già esistente) più `group_members` e `auth.users.last_sign_in_at` **via service client** (`createServiceClient()`, stesso helper già usato da `app/internal/beta-pipeline/route.ts`) — le uniche due fonti per cui l'RLS non ha un bypass admin (`group_members`) o che vivono fuori dallo schema `public` (`auth.users`). Se `SUPABASE_SERVICE_ROLE_KEY` non è configurata, la pagina funziona comunque senza quei due segnali (best-effort, mai un errore bloccante — banner esplicito in UI).
- `app/admin/one/pilot/page.tsx` + `PilotAdminClient.tsx` — tabella con filtro per stato, ordinata più recenti prima, empty state, nessun CRM/scoring/real-time.
- Link "Pilota — chi è entrato e sta usando TRAMA" aggiunto in `app/admin/one/page.tsx` (Command Center), non come coda con priorità/conteggio (non è un arretrato da smaltire).

### Admin Pilot Logic — regola di stato (documentata per evitare "precisione inventata")

1. Nessuna attività significativa ancora:
   - onboarding non iniziato → **INVITED_REGISTERED**
   - onboarding in corso → **ONBOARDING**
   - onboarding completato o saltato → **NOT_YET_ACTIVE** (ha finito il carousel ma non ha ancora fatto nulla — segnale di attenzione)
2. Almeno un'attività significativa (bambino aggiunto, prenotazione creata, o gruppo creato/aderito — il primo dei tre in ordine cronologico):
   - un accesso reale avvenuto almeno 1 giorno dopo quella prima attività → **RETURNING**
   - altrimenti → **ACTIVATED**

"Prima attività significativa" = il minimo tra `kids.created_at`, `bookings.created_at`, `group_members.joined_at` per quell'utente (non ogni click — solo le tre azioni operative già persistite indicate dall'audit). L'onboarding è il singolo step "carousel" del tutorial `parent_beta_onboarding` (`lib/walkthrough/registry.ts`) — un solo step, nessuna aggregazione multi-step necessaria.

### Event taxonomy aggiunta (nessuna migration — `product_events` già applicata)

`lib/telemetry/known-events.ts`: `booking_created` (già emesso come `logTelemetryEvent()` da Build Sprint 3, ora anche persistito), `group_created`, `group_joined`, `carpool_offer_created`, `carpool_request_created`. Nessun `user_id`/PII in nessun payload (scelta invariata, verificata anche da un test dedicato, PILOT-A08). `group_created`/`group_joined` emessi in `app/actions/groups.ts` (`createGroupAction`, `joinGroupAction`, `acceptGroupInviteAction`); `carpool_offer_created`/`carpool_request_created` SOLO alla prima creazione (pre-check di esistenza prima dell'upsert, per non contare ogni modifica di un'offerta già esistente come un nuovo evento).

**Non aggiunto** (scelta esplicita, documentata): `beta_invite_redeemed`. L'unico punto dove la redenzione è certa è il trigger DB `handle_new_user()` (migration_30, già chiusa) — emetterlo da `LoginForm.tsx` sarebbe stata solo un'approssimazione (tentativo, non redenzione garantita) e avrebbe richiesto toccare il flusso di signup Beta, esplicitamente fuori perimetro in questa wave. Il dato è comunque già visibile nella pagina Pilota tramite `beta_cohort_memberships` (fonte di verità reale).

### DB / Migration
Nessuna. Tutte le tabelle/colonne lette esistevano già.

### Test
`tests/one/pilot-observability.spec.ts` — 8 test `[no browser]` sulla logica pura di `computePilotStatus()` + whitelist eventi (tutti passati, vedi sotto), più un gruppo di test gated (`isRealDeployment`) per PILOT-A01/A02/A03/A04/A07/A00, che usano gli account Beta reali già verificati in produzione durante l'audit (`mariafpoli@gmail.com`) invece di fixture sintetiche.

## WAVE 2 — Coordination Resurfacing

**Cosa è stato riusato**: dettaglio Gruppo NextGen + Carpool (già esistenti, vedi correzione sopra, zero righe toccate); `getMyGroupInvites`/RPC `list_my_group_invites()` (migration_25, già applicata) per il segnale ad alta priorità; `getCommunityHomeSignal()` (invariata) come ramo a bassa priorità; stesso pattern visivo "una riga, un'icona, un link" già in Home.

**Cosa è stato aggiunto**:
- `lib/types.ts` — `CoordinationSignal`: union discriminata `community` (= `CommunityHomeSignal` esatto, invariato) | `group_invite_pending` | `group_request_accepted`.
- `lib/data/coordination-signal.ts` — `getCoordinationSignal()`: calcola UN SOLO segnale, con priorità AZIONE RICHIESTA (invito di gruppo pendente) > PROBLEMA/AGGIORNAMENTO ORGANIZZATIVO (richiesta gruppo accettata negli ultimi 14 giorni, finestra scelta per non mostrare per sempre un'accettazione vecchia senza introdurre un concetto di "letto/non letto" in questa wave) > AGGIORNAMENTO SOCIALE (Community, comportamento invariato). Ogni ramo esce con un `return` immediato — mai un array di segnali, il "solo uno mostrato" è strutturale, non un filtro applicato dopo.
- `app/nextgen/page.tsx`/`HomeDashboardClient.tsx` — `communitySignal` → `coordinationSignal`, tre varianti JSX (stesso contenitore/stile di prima, icona e colore diversi solo per la variante "alta priorità" — arancio invece di lilla, per farla risaltare senza introdurre un nuovo linguaggio visivo).

**Non implementato in questa wave** (per istruzione esplicita): bridge `week_responsibilities` ↔ `group_members` (`responsible_group_member_id`), nuova voce di bottom nav, redesign Community, notification center/push/digest/cron.

### DB / Migration
Nessuna.

### Test
`tests/one/coordination-resurfacing.spec.ts` — test gated (`isRealDeployment`) per COORD-G01/G02/G03..G06/H01/H02/H03/H04. COORD-G03/G04/G05/G06 (offerta/richiesta carpool esistente/creabile, matching) e COORD-H02 (due segnali contemporanei, priorità) richiedono uno scenario con più account nello stesso gruppo o due condizioni vere insieme per lo stesso utente — non riproducibile senza fixture dedicate: marcati esplicitamente **REQUIRES LIVE VALIDATION** nel test stesso, con nota su cosa è comunque già garantito a livello di codice (RLS invariata; priorità strutturale via `return` immediato, non un filtro).

## Limitazioni note

- Pagina Pilota: senza `SUPABASE_SERVICE_ROLE_KEY` configurata, "Ultimo accesso" e il segnale "gruppo" tra le attività significative non sono disponibili (banner esplicito, mai un errore).
- Stato "NOT_YET_ACTIVE" è un segnale di attenzione, non una certezza: un utente può aver usato TRAMA in modi non ancora tracciati come "significativi" (es. solo navigazione/ricerca).
- Il segnale "gruppo appena accettato" ha una finestra fissa di 14 giorni, non un vero stato letto/non letto — un secondo genitore che vede la Home il giorno 15 non vedrà più il segnale anche se non l'aveva mai notato prima.

## Future work esplicitamente escluso da questa wave

Push notification, notification center completo, email digest, cron/scheduled notifiche, `user_id_hash` in `product_events`, cancellazione account automatizzata, bridge accompagnamento↔gruppo, nuova voce bottom-nav, redesign Community, qualunque modifica al routing Beta.

## Verifica statica

`npx tsc --noEmit`: pulito. `npx eslint` sui file toccati: pulito. `npm run build`: completato senza errori, route `/admin/one/pilot` registrata. `npx playwright test --grep "no browser"`: 152/152 passati (intera suite, nessuna regressione sui test puri esistenti).
