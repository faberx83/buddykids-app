# TRAMA — Documentation Changelog

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v2 (QA Remediation)
**As-of commit (AS_OF_COMMIT)**: `0fc210a7da8abd98bbbfd64a0bb97eef2c26c2b3`
**Status**: current

## 2026-08-05 (sera) — v2 (QA Remediation)

Correzione richiesta da Fabrizio dopo revisione della v1: "TRAMA — DOCUMENTATION QA REMEDIATION — COUNT RECONCILIATION, ROADMAP COVERAGE AND ASSURANCE GATES". Solo documentazione — nessun file `.ts`/`.tsx`/`.sql` toccato (verificato con `git status --short`).

**Errori corretti (root cause + fix)**:
1. **Admin scorecard incoerente**: v1 dichiarava "7/10 LIVE" nel testo con 8 righe `LIVE` nella tabella. Causa: conteggio manuale non validato. Fix: conteggio automatico dalla tabella (§3 del Catalog v2) + rivalutazione più severa (A-MVP-04, A-MVP-09 declassati da LIVE a BUILT per assenza di evidenza reale) → conteggio finale corretto: **5/10 LIVE**, non 7 né 8.
2. **Parte B Master Requirement Catalog**: v1 dichiarava "104 ID non mappati" ma ne elencava manualmente solo 85, senza cross-check. Causa: il numero di sintesi non era stato verificato contro l'elenco. Fix: script di riconciliazione a insiemi (`TRAMA_REQUIREMENT_ID_RECONCILIATION.md`) su universo 148 = 60 MVP-mapped (da MVP §6.2) + 88 non mappati (18 `DEFER` + 70 `ROADMAP_TO_BE`), verificato: unione=universo, intersezione=∅, 0 duplicati, 0 mancanti.
3. **Heatmap Vista 3**: v1 non produceva una riga per ogni singolo CR/PCR/ACR (sintesi aggregata). Fix: 3 viste per prodotto con tutte le 148 righe individuali (§5 della Heatmap v2).
4. **Collisione di naming CP-01…CP-10**: v1 usava questa etichetta per i checkpoint di sprint/delivery. Fix: rinominati `DG-01…DG-10` (Delivery and Execution Gates, non eliminati); nuovo set distinto `CP-01…CP-10` per i gate documentali.
5. **KPI unico a denominatore 43**: sostituito con 4 metriche indipendenti a denominatore dichiarato (Epic Health ÷12, MVP Capability Implementation Coverage ÷31, MVP Production Readiness ÷31, Pilot Validation Coverage ÷31).
6. **Stato singolo per requisito**: sostituito con 7 dimensioni (SPECIFIED/IMPLEMENTED/DEPLOYED/STATIC_TESTED/LIVE_TESTED/PILOT_VALIDATED/OVERALL_STATUS), incluso il nuovo stato `LIVE_WITH_GAP` per capability funzionanti con un gap puntuale noto.
7. **OD-02/PT-MVP-08**: incoerenza interna (PT-MVP-08 = LIVE nel Catalog v1 mentre OD-02 lo descrive P0/incompleto) non era registrata esplicitamente. Fix: registrato come `CONFLICT`, decisione A/B richiesta a Fabrizio (Parte 8 del SAL v2).
8. **Manifest v1**: citava contemporaneamente `AS_OF_COMMIT bd03067` e `8335d3b`, e dichiarava "non creato" documenti nel frattempo prodotti. Fix: Manifest v2 con un solo `AS_OF_COMMIT` (`0fc210a`) su ogni riga, e supersedes/superseded-by espliciti.

**File riscritti per intero (v2)**:
- `TRAMA_MASTER_REQUIREMENT_CATALOG.md`
- `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md`
- `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md`
- `TRAMA_PROJECT_SAL_20260805.md`
- `TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md`
- `README.md`

**File aggiornati in place**:
- `TRAMA_OPEN_DECISIONS_AND_GAPS.md` — OD-02 formalizzato come CONFLICT+decisione A/B, OD-11 sharpened (A-MVP-07), nuovi OD-12 (gap crosswalk) e OD-13 (A-MVP-05), OD-14 (chiusura del meta-problema conteggi non validati), corretta una riga tabella malformata sotto OD-10.
- `TRAMA_CANONICAL_RELEASE_MODEL.md` — solo header (versione/timestamp/AS_OF_COMMIT), contenuto invariato.

**File nuovi**:
- `TRAMA_REQUIREMENT_ID_RECONCILIATION.md` — riconciliazione a insiemi dei 148 ID, verificata da script.
- `TRAMA_DOCUMENTATION_QA_REPORT.md` — self-test automatico ripetibile del package.

**Cosa NON è stato fatto in questo QA Remediation, dichiarato esplicitamente**: ri-tag dei documenti storici (Sezione 15 del checkpoint originale, OD-10), classificazione narrativa completa (non solo keyword-matching) degli 88 ID `DEFER`+`ROADMAP_TO_BE`, risoluzione del gap di crosswalk MVP-capability↔Handbook-ID (OD-12, nuovo).

**Nessuna modifica applicativa**: nessun file `.ts`/`.tsx`/`.sql` toccato in questo QA Remediation.

## 2026-08-05 — v1 (checkpoint SAL iniziale)

Creato l'intero package in risposta al checkpoint "TRAMA — PROJECT SAL, REQUIREMENTS COVERAGE HEATMAP AND DOCUMENTATION PACKAGE CONSOLIDATION" richiesto da Fabrizio.

**Precondizione** (completata prima di iniziare il package): fix TC-N609 verificato e committato (`79fcb63`), delta HEAD/origin registrato, `TRAMA_ONE_MVP_RC1` assegnato = `79fcb63ed66ece29fd5d345e3f980d78035a88d2`.

**File creati in questo package**:
- `README.md`
- `TRAMA_CANONICAL_SOURCE_REGISTER.md`
- `TRAMA_MASTER_REQUIREMENT_CATALOG.md`
- `TRAMA_CANONICAL_RELEASE_MODEL.md`
- `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md`
- `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md`
- `TRAMA_PROJECT_SAL_20260805.md`
- `TRAMA_OPEN_DECISIONS_AND_GAPS.md`
- `TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md`
- `TRAMA_DOCUMENTATION_CHANGELOG.md` (questo file)

**File modificati fuori da questa cartella, stesso checkpoint**:
- `docs/trama-one/analysis/MVP_PRODUCTION_TRUTH_V2.md` — normalizzato in un unico blocco §0.1-0.7, contenuto storico preservato sotto "PARTE STORICA"; corretta la claim obsoleta "uniche azioni residue = deploy + email".
- `docs/trama-one/analysis/FEATURE_CONTROL_CENTER_SPEC.md` — aggiunta sezione §5-bis (tabella Requisito/Previsto/Implementato/Verificato/Gap).

**Cosa NON è stato fatto in questo giro, e perché** (vedi Manifest per il dettaglio): la classificazione codice-per-codice dei 104 ID `ROADMAP_TO_BE` del backlog Handbook completo, i 10 documenti esistenti elencati alla Sezione 15 del checkpoint originale non sono stati ri-taggati con `status`/`superseded-by`/`valid-as-of` in questo giro (rimandato, vedi Open Decisions OD-10).

**Nessuna modifica applicativa**: nessun file `.ts`/`.tsx`/`.sql` è stato toccato durante la produzione di questo package.
