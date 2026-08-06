# TRAMA — Open Decisions and Gaps Register

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v4 (OD-02 closed — live test PASS) — **supersedes** v3 (`AS_OF_COMMIT 16b0527`)
**As-of timestamp**: 2026-08-06T11:20:00Z (UTC) — OD-02 chiuso: deploy confermato (commit `24464bf`), 3 test live eseguiti da Fabrizio (persistenza PASS, regressione giorno singolo PASS, mobile 390×844 PASS), `PT-MVP-08` = `LIVE`. Nuovo item OD-15 registrato (bug separato, non correlato a OD-02)
**As-of commit (AS_OF_COMMIT)**: `24464bf1c48d4aa5a5f93f9e1b12dd7545103ef5`
**Status**: current

Registro degli item aperti, separati per categoria come richiesto dal checkpoint SAL. Non è un elenco esaustivo di tutto il backlog storico (quello vive nei task/commit del repository) — qui vanno solo le decisioni/gap che richiedono un'azione o una scelta esplicita prima di settembre, o che sono emersi durante questo checkpoint documentale.

## P0 MVP

| ID | Descrizione | Impatto | Owner | Evidenza necessaria | Proposta | Stato |
|---|---|---|---|---|---|---|
| OD-01 | `RESEND_API_KEY` non configurata in produzione — email accettazione/rifiuto Partner non partono | Alto (funzionalità silenziosamente non operativa) | Fabrizio (env var Vercel) | Configurazione + 1 booking reale con `email_delivery_status=sent` | Vedi Sezione C dell'Addendum (istruzione operativa già preparata, in attesa di essere consegnata come gate manuale). **Aggiornato nel QA Remediation (05/08 sera)**: il gate corrispondente (`DG-09`/`CP-09 Operational Readiness Gate`) è stato riclassificato da "NOT YET DUE" a **FAIL** — 16 booking reali sono passati con `email_delivery_status=NULL` senza mai risolvere lo stato, la finestra di tolleranza è scaduta. | **Aperto — gate FAIL, non più "non ancora dovuto"** |
| OD-11 | `A-MVP-07` (Trust config minima, MVP §4.3) classificato `SPECIFIED_NOT_FOUND` — nessuna UI Admin per configurare pesi/versione dei driver Trust | Basso-medio (Trust score non è comunque visibile all'utente finale) | Fabrizio (decisione: costruire prima di settembre, `DEFER`, o `ACCEPTED_OUT_OF_BETA`) | Nessuna — è una decisione di scope | **Resta `SPECIFIED_NOT_FOUND` fino alla decisione esplicita di Fabrizio** — non riclassificato autonomamente a `DEFER` in questo passaggio, coerente con l'istruzione esplicita del QA Remediation ("non dichiararlo contemporaneamente gap MVP e non bloccante senza una decisione di scope") | Aperto |
| OD-12 | Gap di crosswalk tra le capability MVP (`P-MVP-*`/`PT-MVP-*`/`A-MVP-*`, 31 ID) e gli identificativi Handbook (`CR-*`/`PCR-*`/`ACR-*`, 148 ID) — nessuna fonte fornisce un mapping esplicito 1:1, solo il mapping coarse a livello di Epic (MVP §6.2). Esempio: `PT-MVP-01` corrisponde con ogni evidenza a `PCR-037`, ma nessuna fonte lo dichiara | Medio (rende la Parte B del Master Requirement Catalog strutturalmente incompleta finché non risolto) | Claude (richiede lettura narrativa dedicata, non una decisione di Fabrizio) | Lettura narrativa dei paragrafi Handbook corrispondenti a ciascuna capability MVP | Emerso durante il QA Remediation (05/08 sera), registrato per la prima volta qui | Aperto |
| OD-13 | `A-MVP-05` (Activity quality, MVP §4.3) classificato `SPECIFIED_NOT_FOUND` — l'MVP richiede "checklist minima e preview Parent" per la qualità attività lato Admin; l'unica coda trovata (`activity_certifications`) è una capability diversa (certificazione accesso disabili/diete/badge) | Medio (capability MVP dichiarata P0/P1 nella fonte, nessuna implementazione diretta trovata) | Fabrizio (confermare se la certificazione esistente soddisfa il requisito, in interpretazione estensiva, oppure richiedere la funzione mancante) | Nessuna — decisione di interpretazione/scope | Emerso durante il QA Remediation (05/08 sera) | Aperto |
| OD-02 | Selezione multipla del Calendario disponibilità (Gestore) non applicava il campo "Giornata particolare" (es. "tutti i venerdì piscina") — solo `isOpen`/capacità/sconto/last-minute erano nel `BulkDraft` | Medio-alto (feature richiesta esplicitamente incompleta) | Claude (fix implementato) → Fabrizio (verifica live post-deploy, completata) | Fix + test Playwright + verifica statica + verifica live | **Bug confermato, corretto e verificato in produzione** (fix: commit `16b0527`, 06/08/2026; deploy verificato: commit `24464bf`). Root cause: `BulkDraft` (`components/AvailabilityCalendar.tsx`) non includeva `specialEmoji`/`specialLabel`; le colonne `special_emoji`/`special_label` esistevano già su `activity_days` (`supabase/schema.sql`), nessuna migrazione necessaria. **DECISIONE DEFINITIVA DI FABRIZIO: OD-02 — FIX BEFORE BETA** (revocata la precedente proposta "B. ACCEPTED DEFER"). Fix: nuovo `lib/availability-bulk.ts` (semantica a 3 stati — non modificato/impostato/rimosso — per ogni campo bulk, inclusi i 4 preesistenti ora opt-in per evitare sovrascritture accidentali) + UI estesa in `AvailabilityCalendar.tsx`. Verificato staticamente: tsc/eslint puliti, 8 test puri PASS (`tests/gestore/calendario-bulk.spec.ts`, TC-N626..N633, Test A/C/D/E/F). **Verificato live da Fabrizio (06/08/2026, dopo deploy `24464bf`)**: Test 1 persistenza (TC-N634, Test B) PASS; Test 2 regressione giorno singolo (TC-N635, Test G) PASS; Test 3 mobile 390×844 (TC-N636, Test H) PASS. Durante il test mobile Fabrizio ha riscontrato un bug distinto e non correlato nel menu "Scatta foto" della pagina Profilo — non è una regressione di questo fix, registrato separatamente come **OD-15**. `PT-MVP-08` = `LIVE` (IMPLEMENTED=Sì, DEPLOYED=Sì, STATIC_TESTED=Sì, LIVE_TESTED=Sì, PILOT_VALIDATED=No). | **CLOSED** (percorso completo: 1. OPEN — FIX BEFORE BETA → 2. IMPLEMENTED — AWAITING LIVE TEST → **3. CLOSED [stato attuale, 06/08/2026]**) |

| OD-15 | Menu "Scatta foto" (upload foto profilo) mal posizionato/tagliato su mobile — appare sovrapposto all'header e parzialmente nascosto dietro il bottone "Torna a V1", pagina Profilo Genitore | Basso-medio (UX, non blocca funzionalità core) | Claude (da investigare/fixare) | Screenshot Fabrizio (06/08/2026, mobile, pagina Profilo). Possibile regressione di un fix già fatto in precedenza sullo stesso menu (Scatta foto/Galleria) | **Aperto — non correlato a OD-02**, scoperto incidentalmente durante il test live mobile di OD-02, registrato come item indipendente |

## P1 MVP

| ID | Descrizione | Impatto | Owner | Evidenza necessaria | Stato |
|---|---|---|---|---|---|
| OD-03 | Golden Journeys (Sezione 10 Addendum) non ancora eseguite | Blocca GO/NO-GO | Claude (procedure) + Fabrizio (esecuzione live) | 5 journey verificate end-to-end | Aperto |
| OD-04 | Visual/Mobile Acceptance (Sezione 11 Addendum, 390×844/768/1440) non ancora eseguita | Blocca GO/NO-GO | Claude + Fabrizio | Screenshot/verifica sui 3 viewport | Aperto |
| OD-05 | Feature Control Center — azioni batch verificate solo staticamente, nessun run live end-to-end. **Aggiornato nel QA Remediation**: per questo motivo `A-MVP-09` è stato declassato da `LIVE` a `BUILT` nel Master Requirement Catalog v2 (era una sovrastima nella v1) | Medio (rischio: comportamento reale non confermato) | Fabrizio (test live post-deploy) | Run reale: attiva → verifica accesso coorte → disattiva → verifica rollback | Aperto |

## Pilot Decision

| ID | Descrizione | Impatto | Owner | Evidenza necessaria | Stato |
|---|---|---|---|---|---|
| OD-06 | Classificazione dati pilota (PILOT_REAL/DEMO_CONTROLLED/TECHNICAL_TEST/UNKNOWN, Sezione 9 Addendum) non ancora prodotta | Blocca GO/NO-GO e qualunque report a terzi che usi numeri di `center_leads`/prenotazioni | Claude (classificazione) | Catalogo completo con query di sola lettura | Aperto |
| OD-07 | `center_leads`: 9 righe su 10 sono rumore di test (`parent_referral` con naming `[TEST] Centro Segnalato <timestamp>`), 0 candidature reali | Basso rischio tecnico, alto rischio se riportato a terzi come "trazione pilota" | Fabrizio (decisione su come/se ripulire prima di settembre) | — | Aperto, solo da tenere presente |

## Documentation Inconsistency

| ID | Descrizione | Impatto | Owner | Stato |
|---|---|---|---|---|
| OD-08 | `MVP_PRODUCTION_TRUTH_V2.md` indicava `b0d0f21` come fotografia corrente mentre HEAD era già avanzato | Basso (solo lettura fuorviante) | Claude | **Chiuso** — vedi normalizzazione §0.1-0.7 dello stesso documento |
| OD-09 | `MVP_PRODUCTION_TRUTH_V2.md` §8 affermava che le uniche azioni residue fossero deploy + email, omettendo Feature Control Center operativo/Golden Journey/Visual Acceptance/dati pilota/GO-NO-GO | Medio (sottostima del lavoro residuo) | Claude | **Chiuso** — vedi §0.5 dello stesso documento |
| OD-10 | Il Documentation Package è completo per il livello MVP (Source Register, Master Requirement Catalog Parte A verificata, Release Model, Traceability Matrix, Heatmap 4 metriche + 3 viste roadmap, SAL con DG-01..10 + CP-01..10, README, Changelog). Resta aperta la Parte B del Master Requirement Catalog: 70 ID `ROADMAP_TO_BE` non classificati codice-per-codice (correzione: non 104, vedi `TRAMA_REQUIREMENT_ID_RECONCILIATION.md`), e il ri-tag dei documenti storici (Sezione 15 del checkpoint originale, non ancora fatto) | Medio (non blocca il gate MVP di settembre, riguarda il backlog Fase 2/3 e l'igiene documentale storica) | Claude | **Parzialmente chiuso** — vedi `TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md` per lo stato sezione per sezione |
| OD-14 | La v1 del Master Requirement Catalog dichiarava conteggi (7 LIVE Admin, 104 ID non mappati) non verificati da script, poi risultati errati. **Chiuso in questo QA Remediation**: introdotto uno script di verifica automatica (`TRAMA_DOCUMENTATION_QA_REPORT.md`) come procedura permanente per ogni revisione futura del package | Alto (rischio di decisioni prese su numeri sbagliati) | Claude | **Chiuso** — vedi `TRAMA_DOCUMENTATION_QA_REPORT.md` |

## Post-Beta

Nessun item registrato in questo passaggio (nessuna funzionalità è ancora uscita dalla fase Beta — coerente con `POST_BETA` non ancora usato nel catalogo, vedi `FEATURE_CONTROL_CENTER_SPEC.md`).

## Strategic / Legal-Operational

Nessun item nuovo emerso in questo checkpoint oltre a quanto già in `docs/trama-one/analysis/PRIVACY_COMPLIANCE` (Task #158, backlog).
