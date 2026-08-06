# TRAMA — Documentation Package Manifest

**Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v4 (OD-02 closed — live test PASS) — **supersedes** v3 (`AS_OF_COMMIT 16b0527`)
**As-of timestamp**: 2026-08-06T11:20:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `24464bf1c48d4aa5a5f93f9e1b12dd7545103ef5`
**Status**: current

Punto di ingresso file-per-file al package. Questo file elenca lo stato di ogni documento con un `AS_OF_COMMIT` unico e coerente in tutto il package — la v1 di questo Manifest citava contemporaneamente `bd03067` e `8335d3b` e dichiarava "non creato" alcuni documenti poi effettivamente prodotti; entrambe le incongruenze sono corrette dal QA Remediation (v2, vedi `TRAMA_DOCUMENTATION_CHANGELOG.md` per il dettaglio). Questa v4 aggiorna solo i documenti impattati dalla chiusura live di OD-02 (06/08/2026, deploy `24464bf`) — non un nuovo checkpoint completo.

## File di questo package

| File | Ruolo | Package version | As-of timestamp | AS_OF_COMMIT | Status | Supersedes | Superseded by |
|---|---|---|---|---|---|---|---|
| `TRAMA_CANONICAL_SOURCE_REGISTER.md` | Inventario fonti canoniche e ordine di prevalenza | v1 (invariato) | 2026-08-05T18:40:00Z | `0fc210a` (fonti esterne immutate, vedi nota nel documento) | current | — | — |
| `TRAMA_MASTER_REQUIREMENT_CATALOG.md` | Catalogo unico requisiti — 43 unità MVP (7 dimensioni di stato) + 148 ID CR/PCR/ACR | **v4** (OD-02 chiuso: `PT-MVP-08` BUILT→LIVE) | 2026-08-06T11:20:00Z | `24464bf` | current | v3 (`16b0527`) | — |
| `TRAMA_REQUIREMENT_ID_RECONCILIATION.md` | Riconciliazione a insiemi dei 148 ID CR/PCR/ACR (MVP/DEFER/ROADMAP_TO_BE), verificata da script | v1 (invariato) | 2026-08-05T20:10:00Z | `0fc210a` | current | — | — |
| `TRAMA_CANONICAL_RELEASE_MODEL.md` | Mapping delle 4 numerazioni di sprint (A/B/C/D) | v2 (invariato) | 2026-08-05T20:10:00Z | `0fc210a` | current | v1 (`bd03067`) | — |
| `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md` | Requisito→file/componente→test→stato, 43 righe | **v4** (OD-02 chiuso) | 2026-08-06T11:20:00Z | `24464bf` | current | v3 (`16b0527`) | — |
| `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md` | 4 metriche indipendenti + 3 viste roadmap per prodotto (148 righe) + journey view | **v4** (OD-02 chiuso: §3 Production Readiness 55%→58%) | 2026-08-06T11:20:00Z | `24464bf` | current | v3 (`16b0527`) | — |
| `TRAMA_PROJECT_SAL_20260805.md` | SAL — 3 scorecard prodotto, `DG-01…DG-10`, `CP-01…CP-10`, 3 verdetti separati | **v4** (OD-02 chiuso: Parte 1/5/7/8/11/12/13 aggiornate) | 2026-08-06T11:20:00Z | `24464bf` | current | v3 (`16b0527`) | — |
| `TRAMA_OPEN_DECISIONS_AND_GAPS.md` | Registro decisioni/gap aperti (OD-01…OD-15) | **v4** (OD-02: CLOSED; nuovo OD-15) | 2026-08-06T11:20:00Z | `24464bf` | current | v3 (`16b0527`) | — |
| `TRAMA_DOCUMENTATION_QA_REPORT.md` | Self-test automatico del package (conteggi, duplicati, mancanti, coerenza header) | v1 + addendum OD-02 chiusura live | 2026-08-06T11:20:00Z | `24464bf` | current | — | — |
| `README.md` (questa cartella) | Ingresso unico al package | **v4** | 2026-08-06T11:20:00Z | `24464bf` | current | v3 (`16b0527`) | — |
| `TRAMA_DOCUMENTATION_CHANGELOG.md` | Changelog del package | **v4** | 2026-08-06T11:20:00Z | `24464bf` | current | v3 (`16b0527`) | — |
| `OD02_LIVE_TEST_PROCEDURE.md` | Procedura di test live post-deploy per OD-02 | v1 (eseguita, esito registrato in OD-02) | 2026-08-06T09:45:00Z | `16b0527` | current — eseguita | — | — |

Documenti fuori da questa cartella ma richiamati (non fanno parte di questo package, letti come evidenza — freschezza dichiarata separatamente):

| File | Ruolo | Evidenza-as-of | Nota di freschezza |
|---|---|---|---|
| `docs/trama-one/analysis/MVP_SEPTEMBER_READINESS_MATRIX.md` | Evidenza live (booking, feature flag, center_leads) usata per `LIVE_TESTED` | Letto in questo QA Remediation | Non riemesso in questo passaggio — nessuna modifica al suo contenuto, solo citato come fonte |
| `docs/trama-one/analysis/FEATURE_INVENTORY_COMPLETE.md` | Inventario feature nascoste/mock | Letto in questo QA Remediation | Idem — non riemesso |
| `docs/trama-one/analysis/MVP_PRODUCTION_TRUTH_V2.md` | Production Truth normalizzata | Non riletto in questo QA Remediation (già "Fatto" nel passaggio precedente) | Potenzialmente disallineata rispetto a `0fc210a` se sono seguiti commit successivi — non verificato qui, registrato come limite |
| `docs/trama-one/analysis/FEATURE_CONTROL_CENTER_SPEC.md` | Spec Feature Control Center | Non riletto in questo QA Remediation | Idem |

## Stato delle sezioni del checkpoint originale (19 sezioni)

Tutte le sezioni Parte A (livello MVP, decisionale per settembre) sono **complete e verificate incrociatamente** in questo QA Remediation: Source Register, Master Requirement Catalog Parte A (43 unità, 7 dimensioni), Release Model, Traceability Matrix, Coverage Heatmap (4 metriche + 3 viste roadmap + journey), SAL (3 scorecard + `DG-01…10` + `CP-01…10` + 3 verdetti), Open Decisions, Manifest, README, Changelog, QA Report.

**Resta esplicitamente aperto** (non bloccante per il gate MVP di settembre):

1. **Ri-tag documenti storici** (Sezione 15 del checkpoint originale: `FEATURE_PARITY_MATRIX.md`, `TRANSITION_REGISTER.md`, `DECISION_LOG.md`, `ASSUMPTION_LOG.md`, `CONTROLLED_BETA_OPERATING_MODEL.md`/`RUNBOOK.md`/`GO_NO_GO.md` con `status`/`superseded-by`/`valid-as-of`) — **non fatto**, registrato come parte di OD-10.
2. **Classificazione codice-per-codice degli 88 ID `DEFER`+`ROADMAP_TO_BE`** (Master Requirement Catalog Parte B) — l'universo dei 148 ID è riconciliato per intero e verificato da script (0 duplicati, 0 mancanti), ma la classificazione DEFER/ROADMAP_TO_BE usa un metodo dichiarato di keyword-matching contro MVP §2.4, non una lettura narrativa integrale dei 3 Handbook — registrato come limite in `TRAMA_REQUIREMENT_ID_RECONCILIATION.md`.
3. **Gap di crosswalk MVP-capability↔Handbook-ID** (OD-12, nuovo in questo QA Remediation) — nessuna fonte fornisce un mapping esplicito 1:1 tra i 31 ID `P-MVP-*`/`PT-MVP-*`/`A-MVP-*` e i 148 ID `CR-*`/`PCR-*`/`ACR-*`.
4. **Classificazione dati pilota** (OD-06), **Golden Journeys/Visual Acceptance dal vivo** (OD-03/OD-04) — richiedono azioni di Fabrizio non eseguibili da questo ambiente.

## Self-test documentale

Vedi `TRAMA_DOCUMENTATION_QA_REPORT.md` per il self-test automatico completo (metodologia a script, non a conteggio manuale — la v1 di questo Manifest usava conteggio manuale, causa radice degli errori corretti in questo QA Remediation).

## Verdetti finali di questo checkpoint

Vedi `TRAMA_PROJECT_SAL_20260805.md` Parte 13 per i 3 verdetti separati (**DOCUMENTATION PACKAGE STATUS**, **MVP IMPLEMENTATION READINESS**, **SEPTEMBER LAUNCH DECISION**) — non riprodotti qui per evitare una quarta copia soggetta a disallineamento; questo Manifest rimanda al documento che ne è proprietario.
