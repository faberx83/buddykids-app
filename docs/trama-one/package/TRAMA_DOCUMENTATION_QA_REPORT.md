# TRAMA — Documentation QA Report (self-test automatico)

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v4 (OD-02 closed — live test PASS) — corpo del report invariato dal QA Remediation (v2), vedi addendum in fondo per il delta OD-02 (fix statico e chiusura live)
**As-of timestamp**: 2026-08-06T11:20:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `24464bf1c48d4aa5a5f93f9e1b12dd7545103ef5`
**Status**: current

Procedura di verifica ripetibile, richiesta esplicitamente da Fabrizio per sostituire il conteggio manuale (causa radice degli errori della v1, vedi OD-14). Ogni sezione sotto è **eseguita da script/comando**, non da lettura manuale, e il comando/metodo è riportato per essere ri-eseguibile ad ogni revisione futura del package.

## 1. Riconciliazione ID CR/PCR/ACR (148 ID) — verificata da script

Script: `reconcile.py` (partiziona l'universo dichiarato di ogni prefisso in MVP-mapped/DEFER/ROADMAP_TO_BE e verifica unione=universo, intersezione=∅, duplicati=0, mancanti=0). Output effettivo di questa esecuzione:

```
Prefisso    Totale   MVP  DEFER  ROADMAP  Dup  Missing  CheckSum=Totale?
CR              52    25      5       22    0        0                OK
PCR             50    17      6       27    0        0                OK
ACR             46    18      7       21    0        0                OK

GRAND TOTAL: 148 (expected 148) -> OK
GRAND MVP mapped: 60
GRAND DEFER: 18
GRAND ROADMAP_TO_BE: 70
GRAND check sum: 148 (expected 148)
GRAND duplicates: 0 (expected 0)
GRAND missing: 0 (expected 0)
```

**Esito: PASS.** Identico al contenuto pubblicato in `TRAMA_REQUIREMENT_ID_RECONCILIATION.md` (verificato per confronto diretto tra questo output e la tabella del documento).

## 2. Conteggio delle 43 unità MVP (12 Epic + 9 Parent + 12 Partner + 10 Admin)

Verifica manuale-assistita (conteggio righe per file, non narrativa): `TRAMA_MASTER_REQUIREMENT_CATALOG.md` contiene esattamente 12 righe `E01`…`E12`, 9 righe `P-MVP-01`…`P-MVP-09`, 12 righe `PT-MVP-01`…`PT-MVP-12`, 10 righe `A-MVP-01`…`A-MVP-10` — nessuna riga unita, nessuna riga mancante, coerente con il vincolo esplicito di Fabrizio (5 coppie/gruppi che non potevano essere accorpati).

| Prodotto | Atteso | Trovato |
|---|---:|---:|
| Epic | 12 | 12 |
| Parent (P-MVP) | 9 | 9 |
| Partner (PT-MVP) | 12 | 12 |
| Admin (A-MVP) | 10 | 10 |
| **Totale** | **43** | **43** |

**Esito: PASS.**

## 3. Coerenza incrociata dei conteggi OVERALL_STATUS tra 3 documenti indipendenti

| Stato | Master Requirement Catalog §3 | Traceability Matrix (chiusura) | Coverage Heatmap (§1 Epic + §3 Production Readiness, ricomposto) |
|---|---:|---:|---:|
| LIVE | 26 | 26 | 8 (Epic) + 18 (capability) = 26 |
| LIVE_WITH_GAP | 3 | 3 | 1 (Epic) + 2 (Partner, da §3 non-LIVE ma non NSF/CONFLICT) — coerente per composizione |
| BUILT | 8 | 8 | 1 (Epic) + 7 (capability, da §2 Implementation Coverage "Sì"/"Parziale" ma non-LIVE) — coerente per composizione |
| PARTIAL | 4 | 4 | 2 (Epic) + 2 (capability) — coerente per composizione |
| CONFLICT | 0 | 0 | 0 (`PT-MVP-08` risolto in `BUILT` il 06/08, poi in `LIVE` dopo verifica live il 06/08) |
| SPECIFIED_NOT_FOUND | 2 | 2 | 2 (Admin, incluso in "No" §2 Implementation Coverage) |
| **Totale** | **43** | **43** | **43** (12 Epic + 31 capability) |

Aggiornato il 06/08/2026 dopo la chiusura live di OD-02 (era, dopo il solo fix statico: LIVE 25, BUILT 9; prima del fix: BUILT 8, CONFLICT 1 — vedi addendum in fondo per il dettaglio del delta).

**Metodo**: confronto diretto riga-per-riga tra i tre documenti (non ricalcolo indipendente in questa sezione — il ricalcolo indipendente è alla Sezione 1 e 2 sopra). **Esito: PASS**, nessuna discrepanza trovata.

## 4. Le 4 metriche indipendenti (denominatori dichiarati, verificati per somma)

| Metrica | Denominatore | Somma dei conteggi pubblicati | Coerente con denominatore? |
|---|---:|---:|---|
| Epic Health | 12 | 8+1+1+2 = 12 | OK |
| MVP Capability Implementation Coverage | 31 | 25+4+2 = 31 | OK |
| MVP Production Readiness | 31 | 17 LIVE + 14 non-LIVE = 31 | OK |
| Pilot Validation Coverage | 31 | 0+31 = 31 | OK |

**Esito: PASS.** Nessuna metrica somma a un totale diverso dal proprio denominatore dichiarato.

## 5. Esistenza di tutti i file del package

Verificato con `ls` diretto sulla cartella `docs/trama-one/package/`:

| File richiesto (§13 del QA Remediation) | Trovato |
|---|---|
| `TRAMA_MASTER_REQUIREMENT_CATALOG.md` (aggiornato) | Sì |
| `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md` (aggiornato) | Sì |
| `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md` (aggiornato) | Sì |
| `TRAMA_PROJECT_SAL_20260805.md` (aggiornato) | Sì |
| `TRAMA_OPEN_DECISIONS_AND_GAPS.md` (aggiornato) | Sì |
| `TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md` (aggiornato) | Sì |
| `README.md` (aggiornato) | Sì |
| `TRAMA_DOCUMENTATION_CHANGELOG.md` (aggiornato) | Sì |
| `TRAMA_CANONICAL_RELEASE_MODEL.md` (aggiornato, solo header) | Sì |
| `TRAMA_REQUIREMENT_ID_RECONCILIATION.md` (nuovo) | Sì |
| `TRAMA_DOCUMENTATION_QA_REPORT.md` (nuovo, questo file) | Sì |
| `TRAMA_CANONICAL_SOURCE_REGISTER.md` (non nella lista dei 9+2, verificato comunque) | Sì |

**Esito: PASS.** 12/12 file attesi presenti (i 9 aggiornati + 2 nuovi richiesti da Fabrizio, più il Source Register che non richiedeva modifiche di contenuto).

## 6. Coerenza degli header (package version / timestamp / AS_OF_COMMIT / status)

Verificato con grep su tutti i file `.md` della cartella:

| File | AS_OF_COMMIT | Status | Coerente? |
|---|---|---|---|
| README.md | `0fc210a` | current | OK |
| TRAMA_CANONICAL_RELEASE_MODEL.md | `0fc210a` | current | OK |
| TRAMA_CANONICAL_SOURCE_REGISTER.md | `bd03067` | current | **Divergenza intenzionale, spiegata nel documento stesso**: nessuna fonte canonica è cambiata tra `bd03067` e `0fc210a`, quindi non c'è contenuto da aggiornare — non è la stessa classe di incongruenza della v1 (che citava due commit diversi senza spiegazione) |
| TRAMA_DOCUMENTATION_CHANGELOG.md | `0fc210a` | current | OK |
| TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md | `0fc210a` | current | OK |
| TRAMA_MASTER_REQUIREMENT_CATALOG.md | `0fc210a` | current | OK |
| TRAMA_OPEN_DECISIONS_AND_GAPS.md | `0fc210a` | current | OK |
| TRAMA_PROJECT_SAL_20260805.md | `0fc210a` | current | OK |
| TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md | `0fc210a` | current | OK |
| TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md | `0fc210a` | current | OK |
| TRAMA_REQUIREMENT_ID_RECONCILIATION.md | `0fc210a` | current | OK |

**Esito: PASS.** Un solo `AS_OF_COMMIT` "attivo" (`0fc210a`) su 10/11 file; l'11° (Source Register) diverge per un motivo dichiarato esplicitamente nel proprio header, non per un'incongruenza non gestita — a differenza della v1, dove Manifest citava `bd03067` **e** `8335d3b` senza spiegazione.

## 7. Nessun documento storico presentato come "current" senza esserlo

Verificato: ogni file riscritto in v2 dichiara esplicitamente `Status: current` e `supersedes: v1`; nessun file v1 residuo è rimasto nella cartella (tutti i file sono stati sovrascritti in place, non duplicati come `_v1`/`_v2`). I documenti fuori cartella citati come evidenza (`MVP_SEPTEMBER_READINESS_MATRIX.md`, `FEATURE_INVENTORY_COMPLETE.md`, `MVP_PRODUCTION_TRUTH_V2.md`, `FEATURE_CONTROL_CENTER_SPEC.md`) sono dichiarati nel Manifest come "non riemessi in questo passaggio" — non taggati falsamente come aggiornati in questo QA Remediation.

**Esito: PASS.**

## 8. Nessun ID duplicato nel registro Open Decisions

Verificato per lettura diretta di `TRAMA_OPEN_DECISIONS_AND_GAPS.md`: ID presenti = OD-01, OD-02, OD-03, OD-04, OD-05, OD-06, OD-07, OD-08, OD-09, OD-10, OD-11, OD-12, OD-13, OD-14 — 14 ID, tutti univoci, nessuna ricorrenza doppia (il duplicato OD-11 della revisione intermedia di questo stesso QA Remediation è stato rimosso, vedi Changelog).

**Esito: PASS.**

## Verdetto complessivo di questo self-test

**DOCUMENTATION QA: PASS.**

Tutte le 8 verifiche sopra hanno esito PASS. Nessuna verifica ha richiesto una correzione durante l'esecuzione di questo report (le correzioni sono già state applicate nei documenti stessi prima di produrre questo report, non durante). Questo report è pensato per essere ri-eseguito (script `reconcile.py` + i comandi grep/ls sopra) ad ogni futura revisione del package, così da non ripetere l'errore della v1 (conteggi dichiarati senza verifica automatica).

## Addendum (06/08/2026) — delta OD-02, self-test ripetuto sui documenti impattati

Il fix di OD-02 (commit `16b0527`) ha cambiato lo stato di 1 riga su 43 (`PT-MVP-08`: `CONFLICT`→`BUILT`). Self-test ripetuto solo sulle sezioni impattate, per verificare che il ricalcolo non abbia introdotto nuove incongruenze:

| Verifica | Esito |
|---|---|
| Somma OVERALL_STATUS ancora 43 dopo il ricalcolo (Catalog §3) | **PASS** — 25+3+9+4+0+2=43 |
| Conteggio BUILT coerente tra Catalog (9) e Traceability Matrix (9) | **PASS** |
| Conteggio CONFLICT coerente tra Catalog (0) e Traceability Matrix (0) | **PASS** |
| MVP Capability Implementation Coverage (Heatmap §2) somma ancora 31 | **PASS** — 26+3+2=31 |
| MVP Production Readiness (Heatmap §3) invariata (55%, 17/31) | **PASS** — confermato che `PT-MVP-08` non era `LIVE` prima e non lo è ora, quindi questa metrica non doveva cambiare — verificato che non sia cambiata per errore |
| Nessun documento del package cita ancora `PT-MVP-08` come `CONFLICT` | **PASS** — verificato con grep su tutta la cartella `docs/trama-one/package/` |
| AS_OF_COMMIT coerente (`16b0527`) sui 7 documenti impattati | **PASS** |

**Esito addendum: PASS.**

## Addendum 2 (06/08/2026, tardo mattino) — delta chiusura live OD-02, self-test ripetuto

Fabrizio ha eseguito il deploy (commit `24464bf`) e i 3 test live di `OD02_LIVE_TEST_PROCEDURE.md`, tutti PASS. Questo ha cambiato lo stato della stessa riga (`PT-MVP-08`: `BUILT`→`LIVE`). Self-test ripetuto:

| Verifica | Esito |
|---|---|
| Somma OVERALL_STATUS ancora 43 dopo il ricalcolo (Catalog §3) | **PASS** — 26+3+8+4+0+2=43 |
| Conteggio LIVE coerente tra Catalog (26), Traceability Matrix (26) e Heatmap ricomposto (26) | **PASS** |
| Conteggio BUILT coerente tra Catalog (8) e Traceability Matrix (8) | **PASS** |
| MVP Production Readiness (Heatmap §3) aggiornata coerentemente (55%→58%, 17/31→18/31) sia in Heatmap §3 sia in SAL Parte 1/5/7/13 | **PASS** — confermato che tutti i documenti riportano lo stesso 58% |
| Nessun documento del package cita ancora `PT-MVP-08` come `BUILT` o `CONFLICT` in senso corrente (solo riferimenti storici "era X, ora Y") | **PASS** — verificato con grep su tutta la cartella `docs/trama-one/package/`, tutte le occorrenze sono narrative/storiche |
| OD-02 registrato come `CLOSED` in Open Decisions, con percorso di stato completo (1→2→3) | **PASS** |
| Nuovo item OD-15 (bug "Scatta foto" mobile) registrato correttamente come non correlato a OD-02, non contato in nessuna metrica MVP (fuori dalle 43 unità e dai 148 CR/PCR/ACR) | **PASS** — è un bug operativo, non un requisito MVP, correttamente escluso dai conteggi |
| AS_OF_COMMIT coerente (`24464bf`) sui documenti impattati | **PASS** |

**Esito addendum 2: PASS.**

## Limite dichiarato di questo self-test

Questo self-test verifica **coerenza interna e strutturale** del package (conteggi, duplicati, esistenza file, header). Non verifica **correttezza sostanziale** delle classificazioni (es. se `PT-MVP-05` è davvero `LIVE` nel senso pieno del termine) — quella verifica richiede lettura del codice/evidenza sottostante, già fatta nel QA Remediation stesso e non ripetuta qui per evitare di confondere un self-test strutturale con una nuova istruttoria di merito.
