# TRAMA — Canonical Release Model

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v2 (QA Remediation) — contenuto invariato rispetto a v1, solo header aggiornato per coerenza `AS_OF_COMMIT` con il resto del package
**As-of timestamp**: 2026-08-05T20:10:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `0fc210a7da8abd98bbbfd64a0bb97eef2c26c2b3`
**Status**: current

Sezione 5. Mappa le **tre numerazioni di sprint non compatibili** (`INDEX.md` §7) tra loro e con la roadmap MVP a 5 fasi, così che ogni riferimento futuro a "Sprint N" specifichi sempre a quale delle tre si riferisce.

## 1. Le tre numerazioni

| Sistema | Fonte | Cosa numera |
|---|---|---|
| **A — Build sequence TRAMA ONE (0-5)** | Master Prompt §"FASE B", Implementation Pack §7 | La sequenza di sprint raccomandata per costruire TRAMA ONE dal metodo di lavoro Claude |
| **B — Backlog Handbook (S6-S12 + Ecosystem S9-S10)** | Colonna "Sprint" delle tabelle CR/PCR/ACR Backlog, nei 3 Handbook | Un piano di sviluppo prodotto interno agli Handbook, con la propria numerazione (continua da S6, come se S0-S5 fossero già "consumati" da un'ipotetica fase precedente non descritta nel repository) |
| **C — Cronologia reale del repository** | Commit git di questo progetto | Gli sprint effettivamente eseguiti: TRAMA ONE Sprint 0-6, poi Addendum Sezioni A-E, poi SAL Checkpoint (05/08) |
| **D — Roadmap 5 fasi MVP Settembre** | MVP Settembre 2026 §7.1 | Sprint 0-4, calendarizzati (20 luglio - 25 settembre 2026) |

Sono **4 sistemi**, non 3: l'MVP stesso introduce una propria numerazione a 5 fasi (D), distinta sia dal Master Prompt (A) sia dal backlog Handbook (B). Questo checkpoint la aggiunge esplicitamente perché rilevante per il gate di settembre.

## 2. Mapping A ↔ C (build sequence pianificata vs eseguita)

| Sistema A (pianificato) | Obiettivo pianificato | Sistema C (eseguito) | Esito |
|---|---|---|---|
| Sprint 0 — Foundation | Route /one, feature flag, telemetry, gap analysis | TRAMA ONE Sprint 0 (commit luglio) | **Eseguito**, AUDIT_CHECKPOINT_SPRINT_0.md |
| Sprint 1 — Supply activation | Partner request, Admin review, checklist, walkthrough | TRAMA ONE Sprint 1 + remediation | **Eseguito**, AUDIT_CHECKPOINT_SPRINT_1.md |
| Sprint 2 — Catalog core | Activity, weeks, prices, availability | TRAMA ONE Sprint 2 | **Eseguito**, AUDIT_CHECKPOINT_SPRINT_2.md |
| Sprint 3 — Demand slice | Planner gap, search, detail, request | TRAMA ONE Sprint 3 (+ day pricing) | **Eseguito** |
| Sprint 4 — Fulfilment | Partner response, Parent status, Planner sync | TRAMA ONE Sprint 4 | **Eseguito** |
| Sprint 5 — Learning | Feedback CTA, CenterLead shadow, analytics, hardening | TRAMA ONE Sprint 5 | **Eseguito** |
| *(non previsto in A)* | — | TRAMA ONE Sprint 6 (Command Center Admin E08, capacity service, feature flag expiry) | Eseguito **oltre** il piano A originario — estensione, non deviazione: chiude gap emersi durante l'Integration Audit (`AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md`) |
| *(non previsto in A)* | — | Addendum Sezioni A-E (RC1, Feature Control Center, onboarding NextGen) | Eseguito in risposta a gap identificati post-Sprint 6, non pianificato ex-ante in A |
| *(non previsto in A)* | — | SAL Checkpoint 05/08/2026 (questo package) | Documentale, non sviluppo — per esplicita istruzione del checkpoint stesso |

**Conclusione**: il sistema A (6 sprint pianificati) è stato eseguito per intero, più 1 sprint aggiuntivo (Sprint 6) e un ciclo di remediation/addendum non previsto nel piano originario ma reso necessario da gap reali trovati in corso d'opera. Nessuno sprint pianificato è stato saltato.

## 3. Mapping D ↔ C (roadmap calendarizzata MVP vs cronologia reale)

| Sistema D (MVP, calendarizzato) | Date pianificate | Contenuto pianificato | Stato reale (05/08/2026) |
|---|---|---|---|
| Sprint 0 | 20-31 luglio | Baseline, scope freeze, design pack | **Fatto** (coincide temporalmente con TRAMA ONE Sprint 0, sistema C) |
| Sprint 1 | 3-14 agosto | Trust entry foundation | **In corso/quasi completo** — Partner request, identity verification, state machine, Admin review, audit e feature flag sono tutti LIVE (vedi Master Requirement Catalog, Parte A) alla data odierna (05/08), **in anticipo** sulla finestra pianificata (3-14 agosto) |
| Sprint 2 | 17-28 agosto | Activation e supply publish | **Contenuto già costruito** (checklist, walkthrough, centro/sede, attività, settimane, prezzo, preview Parent) — **in anticipo** sulla finestra pianificata |
| Sprint 3 | 31 agosto-11 settembre | Demand → request → response | **Contenuto già costruito** (search/detail/request, SLA queue, availability/state sync) — **in anticipo** |
| Sprint 4 | 14-25 settembre | Planner sync, learning, hardening | **Contenuto in gran parte costruito** (Planner/My Activities, feedback beta, analytics, CenterLead); **non ancora eseguiti**: Golden Journeys dal vivo, Visual/Mobile Acceptance sui 3 breakpoint, hardening finale, "Go-live checklist verde" |

**Osservazione onesta**: la costruzione applicativa (codice) ha superato in velocità la roadmap calendarizzata D — il contenuto funzionale delle 4 fasi è in gran parte già scritto al 5 agosto, con settimane di anticipo sulle date pianificate. Questo **non equivale** a "pronto per il lancio": la roadmap D lega ogni fase anche a criteri di uscita (`exit criteria`) che includono verifica dal vivo, non solo scrittura di codice — es. Sprint 4 richiede "Go-live checklist verde", non ancora prodotta. Il codice essere scritto in anticipo non sposta la data di verifica reale (Golden Journeys, Visual Acceptance, GO/NO-GO), che restano gating separati.

## 4. Mapping B (backlog Handbook) — perimetro, non sequenza eseguita

Il sistema B (S6-S12 + Ecosystem S9-S10) descrive un backlog di prodotto molto più ampio del perimetro MVP (148 CR/PCR/ACR totali, di cui solo 44 mappati a un epic MVP — vedi Master Requirement Catalog §B.1-B.2). Non è una sequenza che questo repository sta eseguendo 1:1: **il perimetro MVP (sistema D) seleziona un sottoinsieme** del backlog B, e quel sottoinsieme è già in gran parte costruito. Il resto del backlog B (104 ID) è TO-BE per fasi successive (Fase 2/3), esplicitamente fuori scope per il beta di settembre 2026 per regola di prevalenza del README (`docs/trama-one/README.md`, "L'MVP Settembre 2026 prevale sul perimetro della roadmap futura").

## 5. Regola per riferimenti futuri

Ogni futuro commit, documento o comunicazione che usi la parola "Sprint N" deve specificare il sistema (A/B/C/D). Esempio corretto: "Sprint 6 (sistema C, cronologia repository) ha implementato il Command Center Admin, corrispondente all'epic E08 (sistema D) e ad ACR-001 (sistema B)". Questa regola era già enunciata in `INDEX.md` §7 per i sistemi A/B/C; questo documento la estende includendo D.
