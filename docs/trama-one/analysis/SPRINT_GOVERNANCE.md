# TRAMA ONE — Sprint Governance

Governo operativo della sequenza TRAMA ONE Build Sprint 0-6 (convenzione DEC-01 in `DECISION_LOG.md`). Ogni sprint futuro deve rispettare questa struttura: scope, fuori scope, prerequisiti, artefatti obbligatori, test gate, local verification gate, rollback gate, Definition of Done. Nessuno sprint successivo al Sprint 0 può iniziare senza il comando esplicito "AVVIA TRAMA ONE — SPRINT N" (Master Prompt).

## Sequenza Sprint 0-6

### TRAMA ONE Build Sprint 0 — Foundation

**Scope**: route shell `/one` nei tre portali (`app/one/`, `app/center/one/`, `app/admin/one/`); Feature Flag Engine (registry + override, RLS `platform_admin`-only, resolver server-only via `createServiceClient()`); telemetry/correlationId minimo; Transition Register e Assumption Log nel repository; smoke test Legacy/NextGen/TRAMA ONE; adattamento `deploy.sh`/`test-deploy.sh` (rimozione `|| true` di default, `ONLY_SITEMAP` intercettato precocemente, `TEST_SCOPE`/`ALLOW_TEST_FAILURES`/`SITEMAP_OPEN_BROWSER`).

**Fuori scope**: onboarding Partner completo; migrazione di qualunque pagina esistente; modifiche al modello dati oltre la foundation approvata (nessuna tabella `locations`/`offerings`/`planner_items`); rimozione di codice Legacy; refactor non collegati allo sprint; UI Admin per il Feature Flag Engine.

**Prerequisiti**: Impact Assessment + Addendum 1 + Addendum tecnico finale approvati (fatto); branch `feature/trama-one-foundation` pulito e aggiornato; CLAUDE.md committato.

**Artefatti obbligatori**: i 5 file di questa cartella `docs/trama-one/analysis/`; Transition Register (nuovo, da creare durante lo sprint); file elencati in `TRAMA_ONE_Impact_Assessment_v1.0.md` §11 (lista file Sprint 0).

**Test gate**: typecheck/lint/build puliti; smoke Legacy, NextGen e TRAMA ONE (i tre portali) eseguiti almeno per la parte `request`-fixture (no browser) in questo ambiente; suite booking Legacy/NextGen invariata (nessuna riga toccata in questo sprint, quindi nessuna regressione attesa ma verifica comunque dovuta).

**Local verification gate**: i test che richiedono browser reale vanno classificati "pending local verification" con comandi completi forniti a Fabrizio; lo sprint non è verificato definitivamente finché il log locale non è ricevuto e analizzato (CLAUDE.md §3).

**Rollback gate**: route `/one` e Feature Flag Engine sono additivi (nuove cartelle, nuova tabella) — rollback = revert del branch/commit, nessun impatto su Legacy/NextGen; flag `TRAMA_ONE_ENABLED` a `false` di default = comportamento AS-IS invariato per tutti gli utenti.

**Definition of Done**: compatibilità Legacy/NextGen verificata (nessuna route/tabella/test toccati); flag e rollback disponibili; RBAC/RLS verificati sulla nuova tabella `feature_flag_overrides`; happy/alternative/negative path del resolver testati (unit); build e lint superati; CR/DDL/Transition Register aggiornati; nessun dato test in produzione.

---

### TRAMA ONE Build Sprint 1 — Partner onboarding, Admin Review e Walkthrough foundation

**Scope**: state machine Center (LEAD→CLAIMED→SUBMITTED→CHANGES_REQUESTED→APPROVED→SUSPENDED); verifica identità; checklist; Admin review cards; audit; feature flag per questa capability specifica; motore Walkthrough generico (progresso persistito, benvenuto/completamento profilo, interrompi/riprendi/salta/rilancia, Admin visibility minima).

**Fuori scope**: pubblicazione attività/catalogo (Sprint 2); Giorni spot; qualunque capability Parent-facing.

**Prerequisiti**: Sprint 0 chiuso con Definition of Done soddisfatta; **matrice pagina-per-pagina/route-per-route dedicata alle capability di questo sprint prodotta** (Feature Preservation Gate, obbligatoria prima dell'avvio per esplicita decisione — vedi `TRAMA_ONE_Impact_Assessment_v1.0.md` §9 e `ASSUMPTION_LOG.md` V5); Feature Flag Engine operativo da Sprint 0.

**Artefatti obbligatori**: matrice pagina-per-pagina/route-per-route del prerequisito sopra; schema tabella `TutorialProgress`/checklist (additiva); aggiornamento Transition Register.

**Test gate**: regressione onboarding Partner Legacy/NextGen esistente (`tests/gestore/attivita.spec.ts`, `profilo-centro.spec.ts`) verde prima e dopo; nuovi test per state machine Center e motore Walkthrough.

**Local verification gate**: come Sprint 0.

**Rollback gate**: state machine Center additiva (nuova colonna stato, non sostituzione); flag `TRAMA_ONE_ENABLED` disattivabile per singolo utente/coorte senza impatto sugli altri.

**Definition of Done**: come da template Master Prompt (compatibilità Legacy/NextGen, source of truth unica, RBAC/RLS, happy/alternative/negative path, stati loading/empty/error/retry, eventi analytics e correlationId, test aggiornati, build/lint superati, nessun dato test in produzione, flag e rollback disponibili, CR/DDL/schema/Transition Register aggiornati).

---

### TRAMA ONE Build Sprint 2 — Catalogo, prezzo, capacità, Giorni spot e Walkthrough attività

**Scope**: decisione finale Offering (entità separata o estensione `activities`/`activity_weeks`, DEC-05); wizard attività; disponibilità/prezzo; Giorni spot lato Partner (modalità settimana/giornaliera/mista, giorni, capacità, prezzo, minimo giorni, servizi, regole di cancellazione); preview Parent; step Walkthrough attività (crea attività/configura settimane/prezzi/Giorni spot/pubblica/dashboard).

**Fuori scope**: ricerca/selezione giorni lato Parent (Sprint 3); fulfilment/accettazione (Sprint 4).

**Prerequisiti**: Sprint 1 chiuso; matrice pagina-per-pagina/route-per-route estesa alle route coinvolte in questo sprint (regola generale, ogni sprint la estende).

**Artefatti obbligatori**: decisione Offering documentata in `DECISION_LOG.md` (nuova voce, non sovrascrittura); eventuale migrazione additiva se la decisione richiede nuove colonne/tabelle.

**Test gate**: regressione wizard attività/disponibilità/prezzo Partner esistente verde; nuovi test Giorni spot Partner.

**Local verification gate**: come sopra.

**Rollback gate**: qualunque nuova colonna/tabella Offering additiva e reversibile; feature flag per Giorni spot indipendente da quello del catalogo base.

**Definition of Done**: come template Master Prompt.

---

### TRAMA ONE Build Sprint 3 — Parent discovery e selezione giorni

**Scope**: context object (source/week/child/filters/correlationId); ricerca/dettaglio Next Gen adattati a Offering; richiesta; filtro Parent per disponibilità giornaliera; selezione giorni nel dettaglio; calcolo costo dinamico; selezione servizi per giorno; mantenimento del context durante la navigazione.

**Fuori scope**: risposta Partner e Booking (Sprint 4).

**Prerequisiti**: Sprint 2 chiuso, decisione Offering presa; matrice pagina-per-pagina/route-per-route estesa; **verifica V2 di `ASSUMPTION_LOG.md`** (mapping CR↔capability riga-per-riga per l'epic E06) completata prima dell'avvio, essendo l'epic a rischio Alto.

**Artefatti obbligatori**: esito della verifica V2; suite di regressione booking Legacy/NextGen eseguita e verde come precondizione esplicita (condizione GO WITH CONDITIONS #3).

**Test gate**: regressione ricerca/dettaglio/richiesta Legacy+NextGen esistente verde; nuovi test discovery/selezione giorni TRAMA ONE.

**Local verification gate**: come sopra.

**Rollback gate**: context object e nuova UI dietro `TRAMA_ONE_ENABLED`; nessuna modifica alle tabelle `activity_inquiries`/`bookings` esistenti oltre estensioni additive.

**Definition of Done**: come template Master Prompt.

---

### TRAMA ONE Build Sprint 4 — Partner response, Booking e Planner Sync

**Scope**: risposta Partner; unificazione state machine Request (WRAP su `activity_inquiries`+`bookings`, DEC-15/E06); sync Planner; accettazione completa/parziale per giorno; proposta alternativa; capacità per giorno; notifiche; cancellazioni e rimborsi per giorno; **decisione finale PlannerItem** (DEC-06, persistenza dedicata sì/no).

**Fuori scope**: CenterLead/referral (Sprint 5); command center Admin (Sprint 6).

**Prerequisiti**: Sprint 3 chiuso; suite di regressione booking Legacy/NextGen verde **immediatamente prima** dell'avvio (non basta averla verificata a Sprint 3, va rieseguita); matrice pagina-per-pagina/route-per-route estesa.

**Artefatti obbligatori**: decisione PlannerItem documentata in `DECISION_LOG.md`; report di regressione booking allegato allo sprint.

**Test gate**: **gate più severo della sequenza** — nessun merge su questo sprint senza suite di regressione booking Legacy/NextGen verde, per il rischio Alto già identificato nell'Impact Assessment; nuovi test Request/Booking unificato, Planner Sync per giorno.

**Local verification gate**: come sopra, con priorità assoluta sui test booking.

**Rollback gate**: adapter (WRAP) non distruttivo — in caso di problema, disattivazione del flag riporta al comportamento `activity_inquiries`/`bookings` separati as-is, senza perdita dati.

**Definition of Done**: come template Master Prompt, con l'aggiunta esplicita: "suite di regressione booking Legacy/NextGen verde" come criterio non negoziabile.

---

### TRAMA ONE Build Sprint 5 — CenterLead, referral e incentivi

**Scope**: suggerimento centro non iscritto; CenterLead (nuova tabella additiva); dedupe; claim; reward/commission in shadow mode/manuale (mai automatico prima del ledger reale, coerente con lo scope MVP).

**Fuori scope**: qualunque automazione economica reale (pagamenti, ledger).

**Prerequisiti**: Sprint 4 chiuso; matrice estesa.

**Artefatti obbligatori**: nessuno strutturale oltre lo schema `center_leads`.

**Test gate**: nuovi test CenterLead/dedupe; nessuna regressione attesa su `invites` (tabella distinta, non toccata).

**Local verification gate**: come sopra.

**Rollback gate**: tabella `center_leads` additiva e indipendente, rollback = drop sicuro.

**Definition of Done**: come template Master Prompt.

---

### TRAMA ONE Build Sprint 6 — Beta, analytics e hardening

**Scope**: command center Admin (E08); feedback industrializzato (riuso `beta_feedback`/pipeline esistente, CR-050); sistema eventi analytics con correlationId (E11, affianca senza sostituire `lib/analytics.ts`); hardening walkthrough (analytics funnel, microcopy, drop-off, accessibilità, performance).

**Fuori scope**: qualunque nuova capability di business non già pianificata negli sprint precedenti.

**Prerequisiti**: Sprint 5 chiuso; matrice estesa a tutte le route Admin coinvolte.

**Artefatti obbligatori**: nessuno strutturale oltre lo schema eventi (additivo).

**Test gate**: regressione Admin esistente (`tests/admin/*`) verde; nuovi test command center/analytics/walkthrough hardening.

**Local verification gate**: come sopra.

**Rollback gate**: Command Center e sistema eventi additivi, pagine Admin esistenti restano accessibili in parallelo finché non verificati in produzione (coerente con classificazione ADAPT in `FEATURE_PARITY_MATRIX.md`, righe 21-22).

**Definition of Done**: come template Master Prompt, più: go-live checklist verde, reward/incentive ancora solo shadow mode (coerente con scope MVP settembre 2026).

## Regole trasversali a tutti gli sprint (non ripetute per ciascuno, valide sempre)

- Ogni sprint deve chiudere una vertical slice cross-portale (regola di delivery del documento MVP §6.3): mai tre roadmap indipendenti Parent/Partner/Admin nello stesso sprint.
- Ogni sprint aggiorna insieme codice, test, documentazione, business rule e DDL (CLAUDE.md §4).
- Nessuna capability fuori dall'MVP settembre 2026 senza autorizzazione esplicita (CLAUDE.md §2, §5).
- Ogni nuova capability protetta da `TRAMA_ONE_ENABLED`; a flag disattivato il comportamento resta AS-IS invariato.
- Nessuna riga della Feature Parity Matrix passa a `REPLACE_AFTER_PARITY` senza le cinque condizioni elencate in `DECISION_LOG.md` (DEC-15).
- Qualunque perdita anche temporanea di funzionalità è un BLOCKER, non un difetto minore: blocca lo sprint fino a risoluzione.
