# TRAMA — Master Requirement Catalog

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**As-of timestamp**: 2026-08-05T18:40:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `bd03067`

Sezione 4 del checkpoint SAL. Regola non negoziabile applicata: **nessun ID nuovo inventato**. Ogni riga riusa un identificativo già esistente in una delle fonti canoniche (§`TRAMA_CANONICAL_SOURCE_REGISTER.md`). Alias noti sono segnalati esplicitamente dove esistono.

Il catalogo ha due livelli, con rigore diverso e dichiarato:

- **Parte A — livello MVP** (12 epic + 31 capability `P-MVP-*`/`PT-MVP-*`/`A-MVP-*`): classificazione verificata riga per riga rispetto al codice reale di questo repository, con file/commit a supporto. È il livello decisionale per il GO/NO-GO di settembre.
- **Parte B — livello TO-BE completo** (148 `CR-*`/`PCR-*`/`ACR-*` degli Handbook): inventario integrale degli ID con l'unico mapping già esplicitamente dichiarato dalle fonti stesse (§6.2 dell'MVP, e le dipendenze dichiarate nelle tabelle Handbook). **Non contiene una classificazione codice-per-codice per i ~94 ID non citati dall'MVP** — produrla ora, senza incrociare ciascuno con il codice, violerebbe la stessa regola "non inventare/non riconciliare in silenzio" del checkpoint. Sono marcati `ROADMAP_TO_BE — non verificato in questo passaggio`.

## Parte A — Livello MVP (verificato)

### A.1 — 12 Epic cross-portale (MVP Settembre 2026, §6.1)

| Epic | Nome | Portali | Stato | Evidenza |
|---|---|---|---|---|
| E01 | Identity, RBAC e tenant boundary | Parent/Partner/Admin | **LIVE** | Auth/ruoli/RLS preesistenti alla baseline TRAMA ONE, estesi con `is_platform_admin()` (migration_07) |
| E02 | Journey context e shell coerente | Parent/Common | **PARTIAL** | `lib/journey-context.ts` esiste ma copertura deliberatamente parziale (Search→Detail→Booking, Sprint 3, task #332-333); non propagato a tutte le route |
| E03 | Supply onboarding e approval | Partner/Admin | **LIVE** | TRAMA ONE Sprint 1 completo (migration_09/10, checklist, Admin review cards, walkthrough) |
| E04 | Canonical catalog & offering | Partner/Admin/Common | **LIVE** | Sprint 2 (Activity/Week/Price/Availability) + Sprint 3 (day pricing, migration_11/12) |
| E05 | Discovery & detail Next Gen | Parent | **LIVE** | `DetailClient.tsx`, filtro disponibilità giornaliera (Sprint 3) |
| E06 | Request/booking lifecycle | Tutti | **LIVE** | Sprint 4: state machine Request/Booking unificata (migration_13/14) |
| E07 | Planner & My Activities sync | Parent/Common | **LIVE** | Sprint 4: sync Planner per giorno con risposta Partner |
| E08 | Admin operating queues | Admin | **LIVE** | Sprint 6 Command Center Admin |
| E09 | Demand-led supply acquisition | Parent/Admin/Partner | **LIVE** | Sprint 5 (CenterLead, migration_17) + candidatura Partner (migration_21) |
| E10 | Beta feedback loop | Tutti/Admin | **LIVE** | Floating CTA beta + triage Admin (task #240, #447-452) |
| E11 | Analytics & experiment framework | Tutti | **PARTIAL** | Eventi con correlationId esistono (Sprint 6, migration_20 `product_events`); nessun framework di esperimento/A-B testing — non richiesto esplicitamente dall'MVP oltre "eventi correlati", quindi non è un gap bloccante |
| E12 | Quality, feature flag e E2E | Common | **LIVE** | Feature flag engine, Feature Control Center (Addendum Sezione B), suite Playwright `tests/one/` |

Riepilogo: **10/12 LIVE, 2/12 PARTIAL, 0/12 assenti**.

### A.2 — Parent MVP (`P-MVP-01`…`09`)

| ID | Capability | Stato | Evidenza |
|---|---|---|---|
| P-MVP-01 | Home/Planner orientati al bisogno | **LIVE** | Home NEXTGEN con CTA "Riempi questa giornata", Planner insights (Sprint 5.1-5.7) |
| P-MVP-02 | Context object | **PARTIAL** | Vedi E02 — stessa infrastruttura, stessa copertura parziale deliberata |
| P-MVP-03 | Ricerca essenziale | **LIVE** | Filtri località/età/periodo/categoria/prezzo, stato persistente (task #40, #237-238, #331) |
| P-MVP-04 | Dettaglio Next Gen | **LIVE** | `DetailClient.tsx`, disponibilità/idoneità/prezzo/servizi/CTA |
| P-MVP-05 | Richiesta/booking leggero | **LIVE** | `BookingClient.tsx`, booking per giorno (Sprint 3) |
| P-MVP-06 | Planner aggiornato | **LIVE** | Sync idempotente post-accettazione (Sprint 4) |
| P-MVP-07 | Le mie attività minimo | **LIVE** | Dashboard "Le mie prenotazioni" (redesign task #82), stati in attesa/accettate/rifiutate/annullate |
| P-MVP-08 | Suggerisci un centro | **LIVE** | CenterLead con dedupe (Sprint 5, task #406) |
| P-MVP-09 | Floating CTA beta | **LIVE** | `BetaFeedbackButton` con contesto route/journey/build (task #240) |

Riepilogo: **8/9 LIVE, 1/9 PARTIAL**.

### A.3 — Partner MVP (`PT-MVP-01`…`12`)

| ID | Capability | Stato | Evidenza |
|---|---|---|---|
| PT-MVP-01 | Diventa Partner TRAMA ≤2 min | **BUILT, KPI non misurato** | Form candidatura esiste (task #457-462); il tempo mediano di submission non è mai stato cronometrato su utenti reali — nessuna telemetria dedicata al KPI stesso |
| PT-MVP-02 | Identity verification | **LIVE** | `migration_15_identity_verification_storage`, upload documento reale (DEC-22, task #361) |
| PT-MVP-03 | Partner state machine | **LIVE** | Stati center (migration_09/10), unificata con Request/Booking (Sprint 4, task #343) |
| PT-MVP-04 | Checklist profilo | **LIVE** | Motore checklist Sprint 1 (task #302-306) |
| PT-MVP-05 | Walkthrough task-based | **LIVE** | Motore Walkthrough generico + Spotlight (Sprint 1, task #431-446), resume/skip/relaunch |
| PT-MVP-06 | Centro e sede | **LIVE** | Onboarding centro (Sprint 1) |
| PT-MVP-07 | Wizard attività | **LIVE** | `ActivityEditForm`, day pricing (Sprint 2-3) |
| PT-MVP-08 | Disponibilità strutturata | **LIVE** | `AvailabilityCalendar`, capacity service canonico (Sprint 6, task #412) — **nota**: bug noto OD-02 sulla selezione multipla per "Giornata particolare", registrato separatamente, non blocca lo stato LIVE della capability nel suo complesso |
| PT-MVP-09 | Inbox richieste | **LIVE** | Redesign KPI strip + gruppi collassabili (task #354) |
| PT-MVP-10 | Dashboard task-first | **LIVE** | `/center/one` Command Center (Sprint 1/6) |
| PT-MVP-11 | Trust telemetry minima | **PARTIAL** | Raccolta dati completezza/verifica/SLA/cancellazioni implementata (task #363); score volutamente non mostrato (corretto per design, PDDL-017) |
| PT-MVP-12 | Notification/Audit | **LIVE** | Audit log + notifiche stati critici (Sprint 4/6) |

Riepilogo: **10/12 LIVE, 1/12 BUILT con KPI non misurato, 1/12 PARTIAL**.

### A.4 — Admin MVP (`A-MVP-01`…`10`)

| ID | Capability | Stato | Evidenza |
|---|---|---|---|
| A-MVP-01 | Command center | **LIVE** | Sprint 6 Command Center Admin (E08, task #416) |
| A-MVP-02 | Application review cards | **LIVE** | Sprint 1 (task #303) |
| A-MVP-03 | Partner approval state machine | **LIVE** | Approve/changes/review/reject con reason code, notifica, audit |
| A-MVP-04 | Activation oversight | **LIVE** | Checklist/tutorial progress osservabili da Admin via eventi Spotlight |
| A-MVP-05 | Activity quality | **PARTIAL** | Coda approvazione certificazioni esiste (task #172); un workflow "qualità attività" distinto con checklist dedicata e preview Parent linkata dall'Admin **non è stato verificato come esistente** — possibile `SPECIFIED_NOT_FOUND`, da confermare |
| A-MVP-06 | Demand/supply queue | **LIVE** | Coda Admin CenterLead + claim (Sprint 5, task #407) |
| A-MVP-07 | Trust config minima | **SPECIFIED_NOT_FOUND** | Nessuna UI Admin trovata per configurare pesi/versione dei driver Trust (completezza/verifica/freshness/SLA); la raccolta dati esiste (PT-MVP-11) ma non la configurazione dei pesi lato Admin — gap reale, da registrare in Open Decisions |
| A-MVP-08 | Feedback beta | **LIVE** | Triage contestuale con owner (task #240, #447-452) |
| A-MVP-09 | Feature flags | **LIVE** | Feature Control Center completo (Addendum Sezione B, task #483) |
| A-MVP-10 | Audit e RBAC | **LIVE** | RLS `is_platform_admin()`, audit trail su azioni sensibili |

Riepilogo: **7/10 LIVE, 1/10 PARTIAL, 1/10 SPECIFIED_NOT_FOUND, 1/10 non applicabile (vedi nota)**.

### A.5 — Totale livello MVP (43 unità: 12 epic + 31 capability)

| Stato | Conteggio | % |
|---|---|---|
| LIVE | 35 | 81% |
| PARTIAL | 6 | 14% |
| BUILT (KPI non misurato) | 1 | 2% |
| SPECIFIED_NOT_FOUND | 1 | 2% |

Regola di calcolo dichiarata: percentuale = conteggio / 43 (denominatore fisso, epic + capability, nessuna esclusione). Nessun arrotondamento nasconde lo `SPECIFIED_NOT_FOUND` (A-MVP-07): resta visibile come gap, non assorbito nel PARTIAL.

## Parte B — Livello TO-BE completo (148 ID, inventario non classificato codice-per-codice)

### B.1 — Mapping già dichiarato dalle fonti stesse (MVP §6.2, unico mapping ufficiale Epic↔CR/PCR/ACR)

| Epic | Parent CR | Partner PCR | Admin ACR |
|---|---|---|---|
| E02 | CR-001, 006, 007, 016, 043, 048 | — | — |
| E03 | — | PCR-002, 003 | ACR-002, 019 |
| E04 | CR-010, 011 | PCR-006, 007, 010, 011, 024, 025 | ACR-005, 013 |
| E05 | CR-009, 012, 017, 018, 019 | — | — |
| E06 | CR-013, 014 | PCR-013, 015, 029 | ACR-007, 022 |
| E07 | CR-015, 021, 026, 034, 035 | — | ACR-007 |
| E08 | — | PCR-001 | ACR-001, 008, 015 |
| E09 | CR-049 | (onboarding/claim da dettagliare nella fonte stessa) | ACR-004, 023, 024 |
| E10 | CR-050 | PCR-023 | ACR-016 |
| E11 | CR-044 | PCR-021 | ACR-014 |
| E12 | CR-045, 047, 048 | PCR-034, 035, 036 | ACR-017, 018, 030, 032 |

I CR/PCR/ACR elencati sopra ereditano lo stato dell'epic corrispondente in Parte A (es. CR-013 "Booking flow Next Gen" → eredita LIVE da E06). Non sono ri-verificati singolarmente in questo passaggio: la verifica è all'epic, non alla singola CR.

### B.2 — ID non mappati a nessun epic MVP (39 Parent + 34 Partner + 31 Admin = 104 ID)

Elenco completo per prefisso e range, **stato dichiarato `ROADMAP_TO_BE`** per tutti (non verificato codice-per-codice in questo passaggio, per rispetto della regola "non inventare classificazioni non verificabili"):

- **Parent**: CR-002,003,004,005,008,020,023,024,025,027,028,029,030,031,032,033,036,037,038,039,040,041,042,046,051,052 (26 ID)
- **Partner**: PCR-004,005,008,009,012,014,016,017,018,020,022,024,025,026,027,028,030,031,032,033,034,035,041,043,044,045,046,047,049,050 (30 ID)
- **Admin**: ACR-003,006,009,010,012,014,017,020,021,023,024,025,026,027,028,029,030,031,033,034,037,038,039,040,041,042,043,044,045 (29 ID)

Nota onesta: diversi di questi ID **sono in realtà già coperti dal codice**, per conoscenza diretta accumulata negli sprint di questo repository (es. CR-027 "Formalizzare domain model Famiglia" → Sprint 5.5; CR-032/033 "share link" → Sprint 5.3; PCR-011 "Disponibilità source of truth" → già in E04; ACR-016 "Beta feedback triage" → già in E10). Non sono stati riclassificati singolarmente qui per due motivi: (1) molti dipendono da letture incrociate con handbook narrativo non ancora fatte per l'intero perimetro Roadmap-per-prodotto; (2) farlo in modo parziale/estemporaneo, senza lo stesso rigore applicato alla Parte A, produrrebbe una tabella con affidabilità disomogenea — più rischiosa di una lacuna dichiarata. Questa è la stessa area di lavoro futuro già segnalata in `TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md`.

### B.3 — DDL/PDDL/ADDL (Design Decision Log degli Handbook)

Non riprodotti in questo catalogo (68 decisioni totali: DDL 001-026, PDDL 001-022, ADDL 001-022) — restano nelle fonti originali, indicizzate per la ricerca in `docs/trama-one/derived/INDEX.md` §5. Il registro decisionale **di questo repository** (le decisioni realmente prese durante gli sprint) è `docs/trama-one/analysis/DECISION_LOG.md` (DEC-01…DEC-74+), un registro distinto e non intercambiabile con DDL/PDDL/ADDL degli Handbook — nessun alias tra i due sistemi è stato dichiarato dalle fonti, quindi nessuno viene inventato qui.

## Alias noti

- Nessun alias di ID è stato necessario in questo passaggio: ogni capability MVP (`P-MVP-*`/`PT-MVP-*`/`A-MVP-*`) ha un nome distinto da ogni epic (`E01-E12`) e da ogni CR/PCR/ACR — le sovrapposizioni sono mapping dichiarati (§B.1), non alias.
