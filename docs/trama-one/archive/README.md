# Archivio docs/trama-one — indice di orientamento

Questa cartella raccoglie documenti di `docs/trama-one/` che, al 23/09/2026, fotografano stati/verbali/gate ormai chiusi o versioni superate da un documento più recente dello stesso tipo. Sono stati spostati con `git mv` (mai cancellati: recuperabili in qualunque momento con `git log --follow` / `git show <commit>:<path>`), **non** riscritti né riassunti.

**Cosa NON è in questo archivio**: i 3 TO-BE Handbook normativi, il Master Prompt, il Decision Log, lo Sprint Governance, l'Impact Assessment, l'Implementation Pack, l'Assumption Log, il Transition Register, il README di `docs/trama-one/`, tutto `derived/` e `design-input/`, e l'intero `package/` (incluso l'Addendum di stato corrente del 08/09/2026 e il Final Pre-Freeze Report) — questi restano dove sono perché normativi, fondativi, o perché sono loro stessi il riferimento "più recente" che rende superati i documenti qui sotto. Vedi la nota in fondo su `package/`.

Per ciascun gruppo: perché è stato archiviato, cosa lo sostituisce (se esiste un successore esplicito), data.

## 1. `sprint-audit-checkpoints/` — verbali di sprint/gate TRAMA ONE Build Sprint 0-6, ormai chiusi

Checkpoint di continuità interna e gate formali per i Build Sprint 0-6 (luglio 2026), tutti con verdetto già chiuso (READY / READY FOR CONTINUATION) nel testo stesso del documento. Sostituiti concettualmente dallo stato corrente del prodotto (v. `package/TRAMA_CURRENT_STATE_ADDENDUM_2026-09-08.md` e `TRAMA_FINAL_PREFREEZE_REPORT_2026-09-08.md`), che descrivono lo sviluppo di oltre un mese successivo.

| File | Motivo | Data doc |
|---|---|---|
| `AUDIT_CHECKPOINT_SPRINT_0.md` | Gate Sprint 0 (Foundation) — stato READY, chiuso | ~20-21/07/2026 |
| `AUDIT_CHECKPOINT_SPRINT_1.md` | Remediation Sprint 1, 3 condizioni chiuse — READY FOR CONTINUATION | ~22/07/2026 |
| `AUDIT_CHECKPOINT_SPRINT_2.md` | Checkpoint interno Sprint 2 (no audit esterno richiesto) | ~23/07/2026 |
| `AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md` | Unico audit esterno formale Sprint 1-4, `TEST_SCOPE=all` — superato da run successivi | 27/07/2026 |
| `AUDIT_CHECKPOINT_BETA_RELEASE.md` | Gate finale Sprint 5-6 | fine luglio 2026 |
| `SPRINT_0_ACTIVATION_RUNBOOK.md` | Runbook di attivazione Sprint 0, azioni già eseguite | Sprint 0 |
| `SPRINT_0_TECH_NOTES.md` | Note tecniche implementative Sprint 0 | Sprint 0 |
| `SPRINT_1_FEATURE_PRESERVATION_MATRIX.md` … `SPRINT_5_FEATURE_PRESERVATION_MATRIX.md` | Matrici pagina-per-pagina prerequisite a ciascuno sprint, sprint ormai completati | Sprint 1-5 |
| `GATE_C_TRIAGE_20260728.md` | Triage di un run di test del 28/07/2026, causa radice già chiusa/corretta | 28/07/2026 |
| `PRE_EXISTING_TEST_FAILURE_BASELINE.md` | Baseline fallimenti test preesistenti, legata all'Integration Gate Sprint 1-4 | 27/07/2026 |

**Sostituito da**: nessun documento singolo — lo stato di sviluppo è avanzato per molti sprint successivi; per lo stato attuale vedere `package/TRAMA_CURRENT_STATE_ADDENDUM_2026-09-08.md` e il codice/repository stesso.

## 2. `superseded-versions/` — versioni precedenti di un documento, sostituite da una versione più recente con lo stesso scopo

| File | Motivo | Sostituito da |
|---|---|---|
| `MVP_PRODUCTION_TRUTH.md` | Prima versione (05/08/2026) della riconciliazione repository/produzione/DB | `analysis/MVP_PRODUCTION_TRUTH_V2.md` (rimasto in `analysis/`, dichiara esplicitamente di avere "una sola fotografia corrente" nelle proprie §0.1-0.5) |

## 3. `controlled-beta-gate-agosto/` — sezioni del gate "Controlled Beta Experience, Publication and Readiness Gate" (§1-20), chiuso

Sette documenti che coprono singole sezioni (§9, §15, §16-17, §19, route release matrix, catalogo pilota) di un unico gate a più sezioni, consolidato nel verdetto finale "GO WITH CONDITIONS" del documento di chiusura stesso. L'intero gate è concluso; le condizioni residue erano azioni manuali di Fabrizio (screenshot live, browser reale) precedenti al Micro Pilot e al lavoro di settembre.

| File | Sezione del gate | Data |
|---|---|---|
| `TRAMA_ONE_CATALOGO_PILOTA.md` | §9 — Catalogo Pilota, chiude OD-06 | 24/08/2026 |
| `TRAMA_ONE_CONTROLLED_BETA_GATE_FINAL.md` | §20 — Output finale, verdetto GO WITH CONDITIONS | — |
| `TRAMA_ONE_CONTROLLED_PUBLICATION.md` | §16-17 — Procedura di pubblicazione | — |
| `TRAMA_ONE_PRODUCTION_HYGIENE.md` | §19 — Igiene dati produzione | 03/08/2026 |
| `TRAMA_ONE_ROUTE_RELEASE_MATRIX.md` | §2 — Inventario route TRAMA ONE Sprint 1-6 | — |
| `TRAMA_ONE_VISUAL_ACCEPTANCE.md` | §15 — Checklist visiva (da eseguire da Fabrizio) | — |
| `TRAMA_ONE_VISUAL_CONFORMANCE.md` | §4-6 — Audit conformità visiva/brand | — |

**Sostituito da**: nessuno esplicitamente — il gate è chiuso; per lo stato attuale delle route/UI vedere il codice e gli addenda di settembre.

## 4. `micro-pilot-launch-agosto/` — gate e piano del Micro Pilot (1 centro + 3 famiglie), lanciato e chiuso

Il Micro Pilot dell'agosto 2026 (24-26/08) ha un percorso di chiusura esplicito: `PRE_MICRO_PILOT_GATE_STATUS.md` registra la decisione finale "TECHNICAL GATE CLOSURE & MICRO PILOT LAUNCH PREPARATION" (DEC-82, 26/08/2026). Il lavoro descritto negli addenda di settembre (Dashboard Partner, Il mio centro, onboarding) è successivo a questo pilot.

| File | Motivo | Data |
|---|---|---|
| `GATE_RESEND_API_KEY.md` | Gate manuale email, MUST BEFORE MICRO PILOT | 24-25/08/2026 |
| `MICRO_PILOT_RUNBOOK.md` | Runbook operativo del pilot 1+1+3 | 24/08/2026 |
| `PRE_MICRO_PILOT_GATE_STATUS.md` | Stato gate pre-pilot, chiuso con DEC-82 | 25-26/08/2026 |
| `TRAMA_MICRO_PILOT_LAUNCH_PLAN.md` | Piano di esecuzione del lancio | 26/08/2026 |

**Sostituito da**: nessuno esplicitamente — pilot concluso, prodotto avanzato oltre; vedere gli addenda di settembre per lo stato corrente.

## 5. `prelaunch-360-audit-agosto/` — pacchetto "PRE-LAUNCH 360° AUDIT" del 24-25/08/2026

Il pacchetto di audit esplicitamente citato nel contesto di questo riordino: fotografia AS_OF_COMMIT `6d7b102`/`976c395` (24-25/08/2026), oltre un mese prima dell'HEAD attuale del repository. Include l'audit principale, l'heatmap, il risk register, il remediation backlog, i gap di compliance, e i documenti "AUDIT ONLY" collegati (platform truth, route/legacy matrix, legacy exit plan, manual ops map, capability completeness matrix).

| File | Motivo | AS_OF |
|---|---|---|
| `TRAMA_PRELAUNCH_360_AUDIT.md` | Audit principale | commit `6d7b102`, 24/08/2026 |
| `TRAMA_PRELAUNCH_360_HEATMAP.md` | Heatmap per dominio | commit `976c395`, 24/08/2026 |
| `TRAMA_PRELAUNCH_RISK_REGISTER.md` | Registro rischi P0-P3 | commit `976c395`, 24/08/2026 |
| `TRAMA_PRELAUNCH_REMEDIATION_BACKLOG.md` | Backlog di remediation (RB-01…) | 24/08/2026 |
| `TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md` | Gap legali/regolatori | 24/08/2026 |
| `TRAMA_PLATFORM_PRODUCT_TRUTH.md` | "Final Platform Product Truth" audit | 25/08/2026 |
| `TRAMA_ROUTE_LEGACY_MATRIX.md` | Inventario route e redirect legacy | 25/08/2026 (deploy `6d7b102`) |
| `TRAMA_LEGACY_EXIT_PLAN.md` | Piano di uscita dipendenze legacy | 25/08/2026 |
| `TRAMA_MANUAL_OPS_MAP.md` | Mappa operazioni manuali | 25/08/2026 |
| `TRAMA_CAPABILITY_COMPLETENESS_MATRIX.md` | Matrice completezza capability (FIVE TRUTHS) | 25/08/2026 |

**Sostituito da**: `package/TRAMA_CURRENT_STATE_ADDENDUM_2026-09-08.md` e `package/TRAMA_FINAL_PREFREEZE_REPORT_2026-09-08.md` coprono lo stato repository/produzione molto più recente (08/09/2026) — ma **non ricalcolano** le metriche/i verdetti di questo pacchetto di agosto, quindi eventuali item P0/P1 ancora aperti nel Risk Register/Remediation Backlog qui archiviati andrebbero riverificati contro il codice attuale prima di assumerli chiusi o ancora validi.

## 6. `package-v4-agosto-closed-items/` — singola procedura di test chiusa dentro il Documentation Package v4

| File | Motivo | Data |
|---|---|---|
| `OD02_LIVE_TEST_PROCEDURE.md` | Procedura di test live per OD-02 (bulk "Giornata particolare"), item ormai **CLOSED** (vedi `package/TRAMA_OPEN_DECISIONS_AND_GAPS.md`, OD-02, e `package/TRAMA_DOCUMENTATION_CHANGELOG.md`) | 06/08/2026 |

Nota: il resto di `package/` (README, Canonical Release Model, Canonical Source Register, Master Requirement Catalog, Requirements Traceability Matrix, Requirements Coverage Heatmap, Open Decisions and Gaps, Documentation Changelog, Documentation Package Manifest, Documentation QA Report, Project SAL, Requirement ID Reconciliation, e i due addenda di settembre) **non è stato archiviato**: questi documenti dichiarano esplicitamente se stessi come riferimento ancora valido — l'Addendum di settembre dice testualmente che il package v4 "resta il documento di riferimento" e va letto insieme, non al posto. Solo questa singola procedura di test, relativa a un item ormai chiuso, è stata spostata qui.

---

## File esplicitamente NON archiviati nonostante siano "fotografie di stato" — vedi report di categorizzazione

Un ampio sottoinsieme di `analysis/` (spec di feature, implementazioni Planner/onboarding/notifiche, roadmap esterna, contratto prodotto Beta, ecc.) **non** è stato spostato qui perché non è emersa una prova sufficientemente esplicita di superamento — sono elencati come "VERIFICARE MANUALMENTE" nel report di consegna di questo riordino, non in questo archivio.
