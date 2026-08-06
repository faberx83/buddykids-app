# TRAMA — Documentation Changelog

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v3 (OD-02 fix update)
**As-of commit (AS_OF_COMMIT)**: `16b0527ba33222c63677735dca3bc57ed98221b3`
**Status**: current

## 2026-08-06 — v3 (OD-02 fix update)

Decisione di Fabrizio: "TRAMA — REVISIONE DECISIONE OD-02: FIX PRIMA DELLA BETA". Revoca la precedente ipotesi "B. ACCEPTED DEFER" (proposta nella v2 come una delle due opzioni A/B); decisione definitiva: **A. FIX BEFORE BETA**.

**Root cause confermata prima del fix**: `BulkDraft` (`components/AvailabilityCalendar.tsx`) non includeva `specialEmoji`/`specialLabel` e sovrascriveva incondizionatamente `isOpen`/`capacity`/`discountPercent`/`lastMinute` su tutti i giorni selezionati. Le colonne `special_emoji`/`special_label` esistevano già su `activity_days` (`supabase/schema.sql`): nessuna migrazione necessaria, confermato prima di scrivere codice.

**Fix implementato (commit `16b0527`)**:
- `lib/availability-bulk.ts` (nuovo) — logica pura del bulk draft, testabile senza browser. Semantica esplicita a 3 stati per ogni campo (campo non modificato / valore impostato / valore esplicitamente rimosso), estesa anche ai 4 campi preesistenti (ora opt-in per giorno via checkbox "Includi"), per evitare la sovrascrittura accidentale di capacità/sconto/last-minute quando il Partner vuole cambiare solo la Giornata particolare.
- `components/AvailabilityCalendar.tsx` — pannello bulk esteso con i toggle "Includi" e il nuovo blocco Giornata particolare (azioni Non modificare/Imposta/Rimuovi, stesso set di emoji del pannello a giorno singolo, riepilogo "valore attuale"/"misto"). Nessuna modifica al pannello a giorno singolo, a `handleSaveAll`, a Booking/JourneyContext/state machine/Feature Control Center/Trust Score.
- `tests/gestore/calendario-bulk.spec.ts` (nuovo) — 8 test puri (TC-N626..N633, Test A/C/D/E/F richiesti da Fabrizio), eseguiti con successo in questo sandbox; 3 test E2E (TC-N634..N636, Test B/G/H — persistenza/regressione giorno singolo/mobile), skippati per assenza di deploy/credenziali, verificabili da Fabrizio col prossimo deploy.

**Verifiche statiche**: tsc --noEmit pulito, eslint pulito sui file toccati, 107 test "no browser" dell'intero progetto verdi (nessuna regressione).

**File del package documentale aggiornati**:
- `TRAMA_MASTER_REQUIREMENT_CATALOG.md` (v3) — `PT-MVP-08` CONFLICT→BUILT, §3 conteggi ricalcolati (BUILT 8→9, CONFLICT 1→0), §4 riscritta.
- `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md` (v3) — riga PT-MVP-08 e tabella di chiusura aggiornate.
- `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md` (v3) — §2 MVP Capability Implementation Coverage ricalcolata (Sì 25→26, Parziale 4→3); §3 Production Readiness invariata (PT-MVP-08 non era LIVE prima, non lo è ora).
- `TRAMA_PROJECT_SAL_20260805.md` (v3) — Parte 5 (scorecard Partner), Parte 8 (OD-02), Parte 11 (CP-03), Parte 12 (ownership), Parte 13 (verdetto MVP Implementation Readiness) aggiornate.
- `TRAMA_OPEN_DECISIONS_AND_GAPS.md` (v3) — OD-02 avanzato a stato "IMPLEMENTED — AWAITING LIVE TEST".
- `TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md`, `README.md`, questo file — coerenza header (`AS_OF_COMMIT 16b0527`, package version v3).

**File non modificati in questo passaggio** (nessun impatto): `TRAMA_CANONICAL_SOURCE_REGISTER.md`, `TRAMA_REQUIREMENT_ID_RECONCILIATION.md`, `TRAMA_CANONICAL_RELEASE_MODEL.md`.

**Residuo per Fabrizio**: eseguire il prossimo deploy e i 3 test E2E (TC-N634..N636) per chiudere OD-02 (stato 3, CLOSED) e valutare se `PT-MVP-08` può diventare `LIVE`.

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
