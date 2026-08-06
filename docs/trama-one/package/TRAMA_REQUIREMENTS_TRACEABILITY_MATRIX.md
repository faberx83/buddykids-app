# TRAMA — Requirements Traceability Matrix

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v3 (OD-02 fix update) — **supersedes** v2 (`AS_OF_COMMIT 0fc210a`)
**As-of timestamp**: 2026-08-06T09:45:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `16b0527ba33222c63677735dca3bc57ed98221b3`
**Status**: current

Sezione 6, allineata al Master Requirement Catalog v2. Stessa base (43 unità), stessi conteggi (verificati per coerenza incrociata tra i due documenti, vedi `TRAMA_DOCUMENTATION_QA_REPORT.md`).

| ID | Requisito | File/componente principale | Migrazione | Test | LIVE_TESTED | OVERALL_STATUS |
|---|---|---|---|---|---|---|
| E01 | Identity, RBAC, tenant boundary | `middleware.ts`, RLS varie | pre-esistenti + migration_07 | suite login/ruoli | Sì | **LIVE** |
| E02 | Journey context | `lib/journey-context.ts` | — | `tests/one/*` | No | **PARTIAL** |
| E03 | Supply onboarding e approval | `app/center/one/onboarding/`, `app/admin/one/onboarding/` | migration_09, migration_10 | onboarding spec | Sì | **LIVE** |
| E04 | Canonical catalog & offering | `lib/day-pricing.ts`, `ActivityEditForm.tsx`, `AvailabilityCalendar.tsx` | migration_11, migration_12 | booking/day-pricing spec | Sì | **LIVE** |
| E05 | Discovery & detail Next Gen | `app/nextgen/search/`, `DetailClient.tsx` | — | search/detail spec | Sì | **LIVE** |
| E06 | Request/booking lifecycle | `app/actions/booking-response.ts` | migration_13, migration_14 | booking response spec | Sì (16 booking reali) | **LIVE** |
| E07 | Planner & My Activities sync | `PlannerClient.tsx`, `lib/nextgen/planner-insights.ts` | — | planner sync spec | Sì | **LIVE** |
| E08 | Admin operating queues | `app/admin/one/` | — | admin command center spec | Sì | **LIVE** |
| E09 | Demand-led supply acquisition | `lib/data/center-leads.ts`, `/admin/center-leads` | migration_17 | center-leads spec | Sì | **LIVE** |
| E10 | Beta feedback loop | `BetaFeedbackButton.tsx` | — | beta-feedback spec | No | **BUILT** |
| E11 | Analytics & experiment framework | `lib/analytics/correlation.ts` | migration_20 | analytics spec | No | **PARTIAL** |
| E12 | Quality, feature flag, E2E | `lib/feature-flags/`, `lib/feature-registry/catalog.ts` | migration_07, migration_08 | `feature-flags.spec.ts`, `feature-control-center.spec.ts` | Parziale (motore base sì, batch no) | **LIVE_WITH_GAP** |
| P-MVP-01 | Home/Planner orientati al bisogno | `app/nextgen/page.tsx` | — | home nextgen spec | Sì | **LIVE** |
| P-MVP-02 | Context object | `lib/journey-context.ts` | — | `tests/one/*` | No | **PARTIAL** |
| P-MVP-03 | Ricerca essenziale | `app/nextgen/search/page.tsx` | — | search filters spec | Sì | **LIVE** |
| P-MVP-04 | Dettaglio Next Gen | `DetailClient.tsx` | migration_11 | detail spec | Sì | **LIVE** |
| P-MVP-05 | Richiesta/booking leggero | `BookingClient.tsx` | migration_12 | booking spec | Sì | **LIVE** |
| P-MVP-06 | Planner aggiornato | `PlannerClient.tsx` | migration_13 | planner sync spec | Sì | **LIVE** |
| P-MVP-07 | Le mie attività minimo | `app/(main)/prenotazioni/PrenotazioniClient.tsx` | — | prenotazioni dashboard spec | Sì | **LIVE** |
| P-MVP-08 | Suggerisci un centro | `lib/data/center-leads.ts` | migration_17 | candidacy spec | Sì | **LIVE** |
| P-MVP-09 | Floating CTA beta | `BetaFeedbackButton.tsx` | — | beta-feedback spec | **No** — nessuna submission reale confermata | **BUILT** |
| PT-MVP-01 | Diventa Partner ≤2 min | `app/auth/candidati/` | migration_21 | candidacy spec | Sì (1 candidatura reale) | **LIVE_WITH_GAP** — KPI ≤2min non misurato |
| PT-MVP-02 | Identity verification | Upload documento | migration_15 | identity verification spec | No | **BUILT** |
| PT-MVP-03 | Partner state machine | Stati center + booking | migration_09, 10, 13, 14 | state machine spec | Sì | **LIVE** |
| PT-MVP-04 | Checklist profilo | Motore checklist | migration_09 | checklist spec | No | **BUILT** |
| PT-MVP-05 | Walkthrough task-based | `app/one/WalkthroughCard.tsx`, Spotlight | — | walkthrough/spotlight spec | Sì (test dal vivo Fabrizio) | **LIVE** |
| PT-MVP-06 | Centro e sede | Onboarding centro | migration_09 | onboarding spec | Sì | **LIVE** |
| PT-MVP-07 | Wizard attività | `ActivityEditForm.tsx` | migration_11 | activity wizard spec | No | **BUILT** |
| PT-MVP-08 | Disponibilità strutturata | `AvailabilityCalendar.tsx`, `lib/availability-bulk.ts` | migration_18 (nessuna nuova migrazione: colonne già esistenti) | availability spec + `tests/gestore/calendario-bulk.spec.ts` (8 test puri PASS) | No | **BUILT** — OD-02 risolto (decisione A, commit `16b0527`), in attesa di verifica live |
| PT-MVP-09 | Inbox richieste | Inbox prenotazioni | — | inbox spec | Sì (16 booking) | **LIVE** |
| PT-MVP-10 | Dashboard task-first | `/center/one` | — | command center Partner spec | Sì | **LIVE** |
| PT-MVP-11 | Trust telemetry minima | Raccolta completezza/verifica/SLA | — | — | No | **PARTIAL** |
| PT-MVP-12 | Notification/Audit | Audit log + notifiche | migration_07 | — | Parziale (audit sì, email no) | **LIVE_WITH_GAP** — `RESEND_API_KEY` assente, `email_delivery_status=NULL` su 16/16 |
| A-MVP-01 | Command center | `app/admin/one/` | — | command center spec | Sì | **LIVE** |
| A-MVP-02 | Application review cards | `AdminOnboardingReviewClient.tsx` | migration_09 | admin review spec | Sì | **LIVE** |
| A-MVP-03 | Partner approval state machine | Stessa infra PT-MVP-03 | migration_09, 10 | approval state machine spec | Sì | **LIVE** |
| A-MVP-04 | Activation oversight | Eventi Spotlight | migration_20 | — | **No** — nessuna evidenza di consultazione Admin reale | **BUILT** (declassato da LIVE v1) |
| A-MVP-05 | Activity quality | — | — | — | — | **SPECIFIED_NOT_FOUND** |
| A-MVP-06 | Demand/supply queue | `/admin/center-leads` | migration_17 | center-leads admin spec | Sì | **LIVE** |
| A-MVP-07 | Trust config minima | — | — | — | — | **SPECIFIED_NOT_FOUND** |
| A-MVP-08 | Feedback beta | — | — | — | No | **BUILT** |
| A-MVP-09 | Feature flags | `lib/feature-flags/`, Feature Control Center | migration_07 | `feature-control-center.spec.ts` | Parziale (motore base sì, batch no) | **BUILT** (declassato da LIVE v1) |
| A-MVP-10 | Audit e RBAC | RLS `is_platform_admin()` | migration_07 | RBAC spec | Sì | **LIVE** |

## Copertura per stato (43 righe)

| Stato | Righe |
|---|---:|
| LIVE | 25 |
| LIVE_WITH_GAP | 3 |
| BUILT | 9 |
| PARTIAL | 4 |
| CONFLICT | 0 |
| SPECIFIED_NOT_FOUND | 2 |
| **Totale** | **43** |

**Aggiornamento post-fix OD-02 (06/08/2026, commit `16b0527`)**: `PT-MVP-08` passa da `CONFLICT` a `BUILT` (CONFLICT: 1→0, BUILT: 8→9). Verifica di coerenza incrociata: questi conteggi sono identici a quelli in `TRAMA_MASTER_REQUIREMENT_CATALOG.md` §3 (aggiornato in parallelo) e alla riga "Totale" di `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md` §1-3 — verificato per confronto diretto, non per costruzione indipendente (evita la stessa classe di errore che ha prodotto l'incongruenza della v1).

## Limite dichiarato

Non copre gli 88 ID `DEFER`+`ROADMAP_TO_BE` del livello TO-BE completo — stesso limite dichiarato nel Master Requirement Catalog Parte B, per lo stesso motivo (nessuna lettura narrativa integrale ancora fatta).
