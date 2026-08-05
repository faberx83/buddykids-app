# TRAMA — Documentation Changelog

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`

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
