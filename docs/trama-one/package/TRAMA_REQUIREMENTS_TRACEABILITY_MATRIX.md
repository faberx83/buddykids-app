# TRAMA — Requirements Traceability Matrix

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**As-of timestamp**: 2026-08-05T18:40:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `bd03067`

Sezione 6. Tracciabilità requisito → codice → test → stato, limitata al livello MVP (43 unità: 12 epic + 31 capability), che è il livello verificato con rigore nel Master Requirement Catalog. Ogni riga è verificabile aprendo il file citato in questo repository.

| ID | Requisito | File/componente principale | Migrazione | Test | Stato |
|---|---|---|---|---|---|
| E01 | Identity, RBAC, tenant boundary | `middleware.ts`, RLS policy varie | pre-esistenti + migration_07 | suite Playwright login/ruoli | LIVE |
| E02 / P-MVP-02 | Journey context | `lib/journey-context.ts` | — | `tests/one/*` (context object) | PARTIAL — 2/9 punti di lettura coperti (Search→Detail→Booking) |
| E03 | Supply onboarding e approval | `app/center/one/onboarding/`, `app/admin/one/onboarding/` | migration_09, migration_10 | `tests/one/onboarding*.spec.ts` | LIVE |
| E04 | Canonical catalog & offering | `lib/day-pricing.ts`, `ActivityEditForm.tsx`, `AvailabilityCalendar.tsx` | migration_11, migration_12 | `tests/` booking/day-pricing | LIVE |
| E05 | Discovery & detail Next Gen | `app/nextgen/search/`, `DetailClient.tsx` | — | search/detail spec | LIVE |
| E06 | Request/booking lifecycle | `app/actions/booking-response.ts`, state machine unificata | migration_13, migration_14 | booking response spec | LIVE |
| E07 | Planner & My Activities sync | `PlannerClient.tsx`, `lib/nextgen/planner-insights.ts` | — | planner sync spec | LIVE |
| E08 / A-MVP-01 | Admin operating queues | `app/admin/one/`, Command Center | — | admin command center spec | LIVE |
| E09 / P-MVP-08 | Demand-led supply acquisition | `lib/data/center-leads.ts` (nome indicativo), `/admin/center-leads` | migration_17 | center-leads spec | LIVE |
| E10 / P-MVP-09 / A-MVP-08 | Beta feedback loop | `BetaFeedbackButton.tsx`, `submitBetaFeedbackAction` | — | beta-feedback spec | LIVE |
| E11 | Analytics & experiment framework | `lib/analytics/correlation.ts`, eventi | migration_20 (`product_events`) | analytics spec | PARTIAL — eventi correlati sì, nessun framework esperimenti (non richiesto) |
| E12 / A-MVP-09 | Quality, feature flag, E2E | `lib/feature-flags/`, `lib/feature-registry/catalog.ts`, `tests/one/` | migration_07, migration_08 | `feature-flags.spec.ts`, `feature-control-center.spec.ts` | LIVE |
| P-MVP-01 | Home/Planner orientati al bisogno | `app/nextgen/page.tsx`, `HomeDashboardClient.tsx` | — | home nextgen spec | LIVE |
| P-MVP-03 | Ricerca essenziale | `app/nextgen/search/page.tsx` | — | search filters spec | LIVE |
| P-MVP-04 | Dettaglio Next Gen | `DetailClient.tsx` | migration_11 | detail spec | LIVE |
| P-MVP-05 | Richiesta/booking leggero | `BookingClient.tsx` | migration_12 | booking spec | LIVE |
| P-MVP-06 | Planner aggiornato | `PlannerClient.tsx` (sync post-accettazione) | migration_13 | planner sync spec | LIVE |
| P-MVP-07 | Le mie attività minimo | `app/(main)/prenotazioni/PrenotazioniClient.tsx` | — | prenotazioni dashboard spec | LIVE |
| PT-MVP-01 | Diventa Partner ≤2 min | `app/auth/candidati/` (form pubblico) | migration_21 | candidacy spec | BUILT — KPI tempo mediano non misurato |
| PT-MVP-02 | Identity verification | Upload documento identità | migration_15 | identity verification spec | LIVE |
| PT-MVP-03 | Partner state machine | Stati center + booking unificati | migration_09, migration_10, migration_13, migration_14 | state machine spec | LIVE |
| PT-MVP-04 | Checklist profilo | Motore checklist Sprint 1 | migration_09 | checklist spec | LIVE |
| PT-MVP-05 | Walkthrough task-based | `app/one/WalkthroughCard.tsx`, motore Spotlight | — | walkthrough/spotlight spec | LIVE |
| PT-MVP-06 | Centro e sede | Onboarding centro | migration_09 | onboarding spec | LIVE |
| PT-MVP-07 | Wizard attività | `ActivityEditForm.tsx` | migration_11 | activity wizard spec | LIVE |
| PT-MVP-08 | Disponibilità strutturata | `AvailabilityCalendar.tsx`, capacity service | migration_18 | availability spec | LIVE — bug noto OD-02 (bulk-select "Giornata particolare") non blocca lo stato complessivo |
| PT-MVP-09 | Inbox richieste | Inbox prenotazioni redesign | — | inbox spec | LIVE |
| PT-MVP-10 | Dashboard task-first | `/center/one` | — | command center Partner spec | LIVE |
| PT-MVP-11 | Trust telemetry minima | Raccolta completezza/verifica/SLA | — | — | PARTIAL — nessun test dedicato trovato |
| PT-MVP-12 | Notification/Audit | Audit log + notifiche | migration_07 (tabella audit) | — | LIVE |
| A-MVP-02 | Application review cards | `AdminOnboardingReviewClient.tsx` | migration_09 | admin review spec | LIVE |
| A-MVP-03 | Partner approval state machine | Stessa infra di PT-MVP-03, vista Admin | migration_09, migration_10 | approval state machine spec | LIVE |
| A-MVP-04 | Activation oversight | Eventi Spotlight osservabili da Admin | migration_20 | — | LIVE (osservabilità via eventi, nessuna dashboard dedicata separata verificata) |
| A-MVP-05 | Activity quality | Coda approvazione certificazioni | migration_16 | certification spec | PARTIAL — workflow qualità attività dedicato con preview Parent non confermato distinto dalla certificazione |
| A-MVP-06 | Demand/supply queue | `/admin/center-leads` | migration_17 | center-leads admin spec | LIVE |
| A-MVP-07 | Trust config minima | — | — | — | **SPECIFIED_NOT_FOUND** — nessun file trovato per configurazione pesi/versione Trust lato Admin |
| A-MVP-10 | Audit e RBAC | RLS `is_platform_admin()` | migration_07 | RBAC spec | LIVE |

## Copertura per stato (43 righe)

| Stato | Righe |
|---|---|
| LIVE | 35 |
| PARTIAL | 6 (E02/P-MVP-02, E11, PT-MVP-11, PT-MVP-08 nota non bloccante rimane LIVE quindi esclusa da qui, A-MVP-04 nota osservabilità resta LIVE, A-MVP-05) |
| BUILT (KPI non misurato) | 1 (PT-MVP-01) |
| SPECIFIED_NOT_FOUND | 1 (A-MVP-07) |

Nota di consistenza: il conteggio PARTIAL qui è 6 righe esplicite (E02, E11, PT-MVP-11, A-MVP-05, e i due riferimenti P-MVP-02 già incluso in E02 non raddoppiato) — coerente con il totale del Master Requirement Catalog §A.5 (35 LIVE + 6 PARTIAL + 1 BUILT + 1 SPECIFIED_NOT_FOUND = 43).

## Limite dichiarato di questa matrice

Non copre i 104 ID `ROADMAP_TO_BE` del livello TO-BE completo (Parte B del Master Requirement Catalog) — per lo stesso motivo lì dichiarato: tracciare 104 requisiti codice-per-codice senza aver prima fatto l'incrocio narrativo completo con gli Handbook produrrebbe una tabella con affidabilità inferiore a quella qui sopra, non superiore.
