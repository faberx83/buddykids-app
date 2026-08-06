# TRAMA — Project SAL (Stato Avanzamento Lavori) — 05/08/2026

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v2 (QA Remediation) — **supersedes** v1 (`AS_OF_COMMIT bd03067`)
**As-of timestamp**: 2026-08-05T20:10:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `0fc210a7da8abd98bbbfd64a0bb97eef2c26c2b3`
**Status**: current

Versione corretta dopo il QA Remediation. Cambia rispetto alla v1: le 3 scorecard prodotto sono ricalcolate dal Master Requirement Catalog v2; i vecchi 10 checkpoint di sprint sono rinominati `DG-01…DG-10` (Delivery and Execution Gates) senza essere eliminati; sono aggiunti 10 nuovi checkpoint documentali `CP-01…CP-10`; il verdetto unico "MVP September Status" è sostituito da 3 verdetti separati.

## Parte 1 — Executive summary

Il codice TRAMA ONE è avanti sulla costruzione rispetto alla roadmap calendarizzata, ma la rivalutazione con criteri più severi (Sezione 3 del QA Remediation) mostra una **MVP Production Readiness reale del 55%** (17/31 capability `LIVE` in senso stretto — deployate, testate dal vivo, senza gap noti), non l'81% riportato nella v1 (che misurava `IMPLEMENTED`, non `LIVE`). Nessuna capability è ancora stata validata da un pilota reale (`Pilot Validation Coverage = 0%`).

## Parte 2-3 — Perimetro e fonte di verità

Invariati dalla v1: perimetro TRAMA ONE, fonte `TRAMA_MASTER_REQUIREMENT_CATALOG.md` v2 + `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md` v2, stesso `AS_OF_COMMIT`.

## Parte 4 — Scorecard Parent

| Metrica | Valore |
|---|---|
| Capability MVP (`P-MVP-*`) | 9 |
| LIVE | 7 (78%) |
| PARTIAL | 1 (11%) — Context object |
| BUILT | 1 (11%) — Floating CTA beta (P-MVP-09), nessuna submission reale confermata |
| Gap aperto principale | Nessuno bloccante a livello di codice; il Context Object incompleto resta un rischio di continuità UX minore |

## Parte 5 — Scorecard Partner

| Metrica | Valore |
|---|---|
| Capability MVP (`PT-MVP-*`) | 12 |
| LIVE | 5 (42%) |
| LIVE_WITH_GAP | 2 (17%) — PT-MVP-01 (KPI ≤2min non misurato), PT-MVP-12 (e-mail transazionali non confermate) |
| BUILT | 3 (25%) — PT-MVP-02, 04, 07 (nessun run live confermato) |
| PARTIAL | 1 (8%) — Trust telemetry minima |
| CONFLICT | 1 (8%) — PT-MVP-08, vedi Parte 8 |

## Parte 6 — Scorecard Admin

**Corretta rispetto alla v1** (che dichiarava "7/10 LIVE" nel testo con 8 righe `LIVE` nella propria tabella — incongruenza riconosciuta) **e ulteriormente rivalutata** con la regola `LIVE` più severa:

| Metrica | Valore |
|---|---|
| Capability MVP (`A-MVP-*`) | 10 |
| **LIVE** | **5 (50%)** — A-MVP-01, 02, 03, 06, 10 |
| BUILT | 3 (30%) — A-MVP-04 (declassato da LIVE: nessuna evidenza di uso reale), 08, 09 (declassato da LIVE: Feature Control Center batch actions mai verificate in produzione) |
| SPECIFIED_NOT_FOUND | 2 (20%) — A-MVP-05, A-MVP-07 |
| Gap aperto principale | 2 NSF su 10 capability è la quota più alta tra i 3 prodotti — richiede decisione di scope da Fabrizio su entrambi |

## Parte 7 — Metriche aggregate (rimando)

Vedi `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md` per Epic Health (67% LIVE su 12), MVP Capability Implementation Coverage (81% su 31), MVP Production Readiness (55% su 31), Pilot Validation Coverage (0% su 31) — 4 metriche indipendenti, non sommate in una sola.

## Parte 8 — OD-02 / PT-MVP-08: CONFLICT non risolto, decisione richiesta

`PT-MVP-08` (Disponibilità strutturata) non può restare classificato `LIVE` mentre `OD-02` lo descrive come "feature esplicitamente incompleta" e "P0". Registrato come `CONFLICT` nel Master Requirement Catalog. **Decisione richiesta a Fabrizio** (non presa autonomamente):

- **A. FIX BEFORE BETA**: `PT-MVP-08` resta `PARTIAL` finché il fix del bulk-select "Giornata particolare" non è completato e verificato; il fix diventa lavoro pianificato prima della Beta.
- **B. ACCEPTED DEFER**: "Giornata particolare" in modalità multiselezione viene rimossa esplicitamente dagli acceptance criteria della Beta di settembre, pianificata post-Beta; `PT-MVP-08` torna `LIVE` con una nota di scope ridotto.

Fino alla decisione, `PT-MVP-08` resta `CONFLICT` in ogni documento di questo package.

## Parte 9 — A-MVP-07 e A-MVP-05: classificazione e decisione

- `A-MVP-05` (Activity quality): `SPECIFIED_NOT_FOUND`, univoco. Nessuna evidenza di un workflow qualità-attività+preview distinto dalla coda certificazioni. Fabrizio può confermare se la certificazione esistente soddisfa il requisito (riclassificazione esplicita, non automatica) o richiedere la costruzione della funzione mancante.
- `A-MVP-07` (Trust config minima): `SPECIFIED_NOT_FOUND`, resta tale finché Fabrizio non decide `DEFER`/`ACCEPTED_OUT_OF_BETA` per questa specifica capability (OD-11).

## Parte 10 — Checkpoint di programma: DG-01…DG-10 (Delivery and Execution Gates)

**Rinominati dalla v1** (erano `CP-01…CP-10` nella v1, causando ambiguità col nuovo set di checkpoint documentali sotto — non eliminati, solo rinominati):

| DG | Ambito | Verdetto | Evidenza |
|---|---|---|---|
| DG-01 | Sprint 0 Foundation | **PASS** | `AUDIT_CHECKPOINT_SPRINT_0.md` |
| DG-02 | Sprint 1 Supply Activation | **PASS** | `AUDIT_CHECKPOINT_SPRINT_1.md` + remediation chiusa |
| DG-03 | Sprint 2 Catalogo | **PASS** | `AUDIT_CHECKPOINT_SPRINT_2.md` |
| DG-04 | Integration Audit Sprint 1-4 | **PASS WITH CONDITIONS** | `AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md` |
| DG-05 | Beta Release Gate | **PASS WITH CONDITIONS** | Visual Acceptance mai chiuso con screenshot reali (DEC-61) |
| DG-06 | RC1 / Addendum Sezione A | **PASS** | `TRAMA_ONE_MVP_RC1` = `79fcb63` |
| DG-07 | Feature Control Center / Addendum Sezione B | **PASS WITH CONDITIONS → declassato**: vedi A-MVP-09 in Parte 6, il declassamento a `BUILT` in questo QA Remediation implica che DG-07 non può restare "PASS WITH CONDITIONS" leggero — la condizione (run live) è più pesante di quanto la v1 comunicasse | Nessun run live end-to-end delle azioni batch |
| DG-08 | SAL / Documentation Package Checkpoint v1 | **PASS WITH CONDITIONS** | Condizioni risolte in gran parte da questo QA Remediation (v2) |
| DG-09 | Gate manuale `RESEND_API_KEY` / e-mail transazionali | **FAIL** (aggiornato da NOT YET DUE: la finestra per una condizione "non ancora dovuta" è più stretta ora che 16 booking reali sono passati senza mai risolvere lo stato e-mail) | OD-01, 16/16 `email_delivery_status=NULL` |
| DG-10 | Golden Journeys + Visual/Mobile Acceptance + GO/NO-GO finale | **NOT YET DUE** | OD-03/OD-04, richiede azione Fabrizio |

## Parte 11 — Checkpoint documentali: CP-01…CP-10 (nuovi, richiesti da questo QA Remediation)

| CP | Nome | Criterio | Verdetto | Evidenza | Condizione | Owner | Data limite |
|---|---|---|---|---|---|---|---|
| CP-01 | Source Baseline Gate | Fonti canoniche identificate, hash verificati, `AS_OF_COMMIT` assegnato univocamente | **PASS** | `TRAMA_CANONICAL_SOURCE_REGISTER.md`, `AS_OF_COMMIT` v2 = `0fc210a` | — | Claude | — |
| CP-02 | Requirements Completeness Gate | Tutti i 43 ID MVP + tutti i 148 CR/PCR/ACR inventariati, zero mancanti/duplicati | **PASS** | Script di verifica, `TRAMA_REQUIREMENT_ID_RECONCILIATION.md` | — | Claude | — |
| CP-03 | Traceability Gate | Ogni unità MVP ha file/test/stato tracciato con le 7 dimensioni | **PASS WITH CONDITIONS** | `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md` v2 | 3 stati restano aperti per decisione di scope (`PT-MVP-08` CONFLICT, `A-MVP-05`/`A-MVP-07` NSF) | Fabrizio (decisione) | Prima della Beta |
| CP-04 | Release Alignment Gate | Le 4 numerazioni di sprint riconciliate | **PASS** | `TRAMA_CANONICAL_RELEASE_MODEL.md` | — | Claude | — |
| CP-05 | Documentation Consistency Gate | Nessun `AS_OF_COMMIT` contraddittorio, nessun conteggio manuale non validato da script | **PASS WITH CONDITIONS** | Corretto in questo passaggio (v2); il rischio strutturale (conteggi manuali senza validazione automatica) è mitigato ma non eliminato per i documenti futuri | Applicare il self-test (`TRAMA_DOCUMENTATION_QA_REPORT.md`) ad ogni revisione futura del package | Claude | Ad ogni revisione |
| CP-06 | Production Truth Gate | Stato del commit live in produzione confermato | **NOT YET DUE** | `MVP_SEPTEMBER_READINESS_MATRIX.md` §6: nessuna credenziale Vercel in questo ambiente, mai risolto | Fabrizio deve confermare il commit live dopo il prossimo deploy | Fabrizio | Prossimo deploy |
| CP-07 | MVP Evidence Gate | Evidenza live/pilota per le capability critiche | **PASS WITH CONDITIONS** | Production Readiness 55%, Pilot Validation 0% | Nessuna capability è pilot-validated; condizione strutturale, non blocca da sola un DG ma blocca CP-10/DG-10 | Fabrizio (arruolamento pilota) + Claude (procedure) | Prima del GO/NO-GO |
| CP-08 | Cross-Portal Contract Gate | I contratti Parent↔Partner↔Admin (state machine condivise, eventi) sono coerenti | **PASS** | E06/E07/E08/E09 tutti `LIVE`, state machine unificata confermata (migration_13/14) | — | Claude | — |
| CP-09 | Operational Readiness Gate | Email transazionali e gate manuali configurati | **FAIL** | `RESEND_API_KEY` non confermata, 16/16 booking con `email_delivery_status=NULL` | Fabrizio deve configurare la chiave e testare un ciclo reale | Fabrizio | Prima della Beta |
| CP-10 | Roadmap Integrity Gate | I 148 ID TO-BE sono classificati senza ID persi/duplicati/non assegnati senza motivo | **PASS** | Script di verifica, 0 duplicati, 0 mancanti, ogni ID classificato MVP/DEFER/ROADMAP_TO_BE con metodo dichiarato | — | Claude | — |

**Perché CP-09/DG-09 sono `FAIL` e non `NOT YET DUE`**: a differenza della v1, che trattava il gate e-mail come "non ancora dovuto", la condizione è ormai **scaduta come finestra di tolleranza**: 16 booking reali sono passati senza mai risolvere lo stato, e nessuna azione risulta programmata. È un gate dovuto e fallito, non un gate futuro.

## Parte 12 — Ownership (corretta: non tutto è di Fabrizio)

**Claude (owner)**:
- Preparazione procedure Golden Journey (scrittura degli scenari verificabili, non l'esecuzione dal vivo).
- Checklist Visual/Mobile Acceptance (preparazione, non l'esecuzione con browser reale).
- Classificazione dati pilota (query di sola lettura, catalogazione).
- Correzioni documentali (come questo stesso passaggio).
- Eventuale fix di OD-02, solo dopo la decisione A/B di Fabrizio.
- Aggiornamento della heatmap e delle metriche ad ogni nuovo commit rilevante.
- Runbook operativi.
- Triage dei risultati di test/verifica (non l'esecuzione dal vivo stessa).

**Fabrizio (owner)**:
- Configurazione `RESEND_API_KEY`.
- Deploy (`bash deploy.sh`).
- Esecuzione browser live (Golden Journeys, Visual Acceptance).
- Selezione degli utenti pilota reali.
- Approvazione di qualunque cleanup dati.
- Decisione A-MVP-07 (DEFER / ACCEPTED_OUT_OF_BETA / mantenere NSF).
- Decisione OD-02 (FIX BEFORE BETA / ACCEPTED DEFER).
- Decisione finale di business (GO/NO-GO settembre).

## Parte 13 — Verdetti separati (sostituiscono l'unico "MVP September Status" della v1)

### DOCUMENTATION PACKAGE STATUS: **READY WITH CONDITIONS**
Il livello MVP (43 unità) è completo, verificato da script dove possibile, e internamente coerente tra Master Requirement Catalog / Traceability Matrix / Heatmap / SAL (stessi conteggi in tutti e 4). Condizione residua: Parte B (88 ID TO-BE non-MVP) resta inventariata ma non classificata codice-per-codice (OD-10), e il gap di crosswalk MVP-capability↔Handbook-ID resta aperto (OD-12).

### MVP IMPLEMENTATION READINESS: **READY WITH CONDITIONS**
55% delle capability MVP sono `LIVE` in senso stretto (deployate-presunte, live-testate, senza gap). Le condizioni: `DG-09`/`CP-09` `FAIL` (e-mail), `PT-MVP-08` `CONFLICT` (decisione richiesta), 2 `NSF` Admin (decisione richiesta), 0% Pilot Validation (nessun pilota reale ancora arruolato — atteso a questo stadio, non un difetto).

### SEPTEMBER LAUNCH DECISION: **NOT YET ASSESSABLE — ON TRACK**
Finché Golden Journey (OD-03) e Visual/Mobile Acceptance (OD-04) non sono eseguite dal vivo, questo verdetto non può essere né GO né NO-GO — sarebbe una dichiarazione anticipata non supportata da evidenza. "ON TRACK" riflette che nessuna delle condizioni aperte oggi (email, OD-02, A-MVP-05/07) richiede nuovo sviluppo sostanziale prima di poter eseguire quelle verifiche: sono azioni, non blocchi architetturali.
