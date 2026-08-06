# TRAMA — Documentation Package `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`

**Package version**: v4 (OD-02 closed — live test PASS) — **supersedes** v3 (`AS_OF_COMMIT 16b0527`)
**As-of timestamp**: 2026-08-06T11:20:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `24464bf1c48d4aa5a5f93f9e1b12dd7545103ef5`
**Status**: current

Punto di ingresso unico al package prodotto dal SAL/Requirements Coverage Heatmap/Documentation Package Consolidation Checkpoint del 05/08/2026, corretto da un passaggio di QA Remediation (conteggi, metriche, stati, checkpoint) nello stesso giorno, poi aggiornato il 06/08/2026 dopo l'implementazione del fix OD-02 (Calendario disponibilità Partner, bulk "Giornata particolare"), e nuovamente il 06/08/2026 dopo la verifica live post-deploy. Questo file è puramente organizzativo/descrittivo: non implementa, non corregge gap applicativi, non anticipa nuovi sprint (regola esplicita del checkpoint) — l'unica eccezione è il fix OD-02, esplicitamente commissionato da Fabrizio con una decisione di scope separata (vedi `TRAMA_OPEN_DECISIONS_AND_GAPS.md`, OD-02).

## Cosa è cambiato nella v4 (chiusura live OD-02, 06/08/2026)

Fabrizio ha eseguito il deploy (commit `24464bf`) e i 3 test live richiesti (persistenza, regressione giorno singolo, mobile 390×844) — tutti PASS. `PT-MVP-08` passa da `BUILT` a `LIVE`; **OD-02 è CLOSED**. MVP Production Readiness sale da 55% a 58%. Durante il test mobile è emerso un bug distinto (menu "Scatta foto" su Profilo, mobile), registrato come nuovo item **OD-15**, non correlato a OD-02. Aggiornati: Master Requirement Catalog, Traceability Matrix, Coverage Heatmap, SAL, Open Decisions, Manifest.

## Cosa è cambiato nella v3 (fix OD-02, 06/08/2026)

`PT-MVP-08` (Disponibilità strutturata, Calendario Partner) passa da `CONFLICT` a `BUILT`: Fabrizio ha deciso **FIX BEFORE BETA**, il fix del bulk-select "Giornata particolare" è stato implementato (commit `16b0527`, nuovo `lib/availability-bulk.ts` + `AvailabilityCalendar.tsx` esteso), verificato staticamente (tsc/eslint puliti, 8 test puri PASS) e restava in attesa di verifica live post-deploy (ora completata, vedi v4 sopra). Aggiornati: Master Requirement Catalog, Traceability Matrix, Coverage Heatmap, SAL, Open Decisions. Nessun'altra parte del package è cambiata.

## Cosa è cambiato nella v2 (QA Remediation) rispetto alla v1

- I 43 requisiti MVP sono ora modellati su **7 dimensioni di stato** (SPECIFIED/IMPLEMENTED/DEPLOYED/STATIC_TESTED/LIVE_TESTED/PILOT_VALIDATED/OVERALL_STATUS), non un singolo stato aggregato.
- La copertura è misurata con **4 metriche indipendenti** (Epic Health ÷12, MVP Capability Implementation Coverage ÷31, MVP Production Readiness ÷31, Pilot Validation Coverage ÷31), non un unico KPI a denominatore 43.
- I 148 ID `CR-*`/`PCR-*`/`ACR-*` sono riconciliati **per intero e verificati da script** (0 duplicati, 0 mancanti) in un nuovo documento dedicato.
- I 10 checkpoint di sprint della v1 sono **rinominati `DG-01…DG-10`** (Delivery and Execution Gates, non eliminati); sono aggiunti 10 nuovi checkpoint documentali **`CP-01…CP-10`**.
- Il verdetto unico "MVP September Status" è sostituito da **3 verdetti separati**: Documentation Package Status, MVP Implementation Readiness, September Launch Decision.
- Corretto un errore di conteggio della v1 (Admin dichiarato "7/10 LIVE" nel testo con 8 righe `LIVE` nella tabella) e un errore di conteggio nella Parte B (v1 dichiarava 104 ID non mappati, ne elencava manualmente solo 85; il conteggio corretto verificato da script è 88).

Dettaglio completo in `TRAMA_DOCUMENTATION_CHANGELOG.md`.

## Come leggere questo package, in ordine

1. **`TRAMA_CANONICAL_SOURCE_REGISTER.md`** — quali documenti governano TRAMA ONE e in che ordine di prevalenza.
2. **`TRAMA_MASTER_REQUIREMENT_CATALOG.md`** — l'elenco di tutti i requisiti (43 unità MVP verificate su 7 dimensioni + 148 ID CR/PCR/ACR inventariati), con stato.
3. **`TRAMA_REQUIREMENT_ID_RECONCILIATION.md`** — riconciliazione a insiemi dei 148 ID (MVP/DEFER/ROADMAP_TO_BE), verificata da script.
4. **`TRAMA_CANONICAL_RELEASE_MODEL.md`** — come le sprint pianificate (4 numerazioni distinte) si mappano su quelle davvero eseguite.
5. **`TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md`** — requisito → file di codice → test → stato, per le 43 unità MVP.
6. **`TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md`** — 4 metriche indipendenti + 3 viste roadmap per prodotto (ogni CR/PCR/ACR come riga propria) + vista journey end-to-end.
7. **`TRAMA_PROJECT_SAL_20260805.md`** — stato avanzamento lavori, 3 scorecard per prodotto, `DG-01…DG-10`, `CP-01…CP-10`, 3 verdetti separati.
8. **`TRAMA_OPEN_DECISIONS_AND_GAPS.md`** — ogni decisione/gap aperto, per categoria, con owner (incluse le decisioni A/B richieste esplicitamente a Fabrizio).
9. **`TRAMA_DOCUMENTATION_QA_REPORT.md`** — self-test automatico del package (conteggi, duplicati, mancanti, coerenza header), procedura ripetibile per ogni revisione futura.
10. **`TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md`** — stato file-per-file di questo stesso package.
11. **`TRAMA_DOCUMENTATION_CHANGELOG.md`** — changelog di questo package.

Documenti fuori da questa cartella ma richiamati: `docs/trama-one/analysis/MVP_SEPTEMBER_READINESS_MATRIX.md` (evidenza live), `docs/trama-one/analysis/FEATURE_INVENTORY_COMPLETE.md` (inventario feature), `docs/trama-one/analysis/MVP_PRODUCTION_TRUTH_V2.md` (production truth normalizzata) e `docs/trama-one/analysis/FEATURE_CONTROL_CENTER_SPEC.md` (spec Feature Control Center).

## Cosa NON è questo package

- Non è un nuovo sprint di sviluppo: nessun file applicativo è stato modificato per produrlo (né nel passaggio iniziale né in questo QA Remediation).
- Non risolve in autonomia le incongruenze tra fonti né i conflitti tra requisiti e bug noti: li registra come `CONFLICT`/Open Decision con una decisione esplicita richiesta a Fabrizio, e implementa il fix solo dopo quella decisione (es. OD-02/PT-MVP-08, risolto il 06/08/2026 dopo la decisione FIX BEFORE BETA di Fabrizio).
- Non copre in modo verificato codice-per-codice gli 88 ID `DEFER`+`ROADMAP_TO_BE` del backlog Handbook completo (dichiarato esplicitamente nel Master Requirement Catalog, Parte B, e in `TRAMA_REQUIREMENT_ID_RECONCILIATION.md`).
- Non dichiara alcun commit come "confermato in produzione": nessuna credenziale Vercel è disponibile in questo ambiente, quindi `DEPLOYED` è sempre "presunto", mai "confermato" (caveat strutturale, vedi Master Requirement Catalog).

## Verdetti finali

Vedi `TRAMA_PROJECT_SAL_20260805.md`, Parte 13, per i 3 verdetti separati: **DOCUMENTATION PACKAGE STATUS: READY WITH CONDITIONS**, **MVP IMPLEMENTATION READINESS: READY WITH CONDITIONS**, **SEPTEMBER LAUNCH DECISION: NOT YET ASSESSABLE — ON TRACK**.
