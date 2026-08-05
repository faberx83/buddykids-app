# TRAMA — Open Decisions and Gaps Register

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**As-of timestamp**: 2026-08-05T16:26:14Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `8335d3b920b3694ba0b15cc8be45c17db89dfd0b`

Registro degli item aperti, separati per categoria come richiesto dal checkpoint SAL. Non è un elenco esaustivo di tutto il backlog storico (quello vive nei task/commit del repository) — qui vanno solo le decisioni/gap che richiedono un'azione o una scelta esplicita prima di settembre, o che sono emersi durante questo checkpoint documentale.

## P0 MVP

| ID | Descrizione | Impatto | Owner | Evidenza necessaria | Proposta | Stato |
|---|---|---|---|---|---|---|
| OD-01 | `RESEND_API_KEY` non configurata in produzione — email accettazione/rifiuto Partner non partono | Alto (funzionalità silenziosamente non operativa) | Fabrizio (env var Vercel) | Configurazione + 1 booking reale con `email_delivery_status=sent` | Vedi Sezione C dell'Addendum (istruzione operativa già preparata, in attesa di essere consegnata come gate manuale) | Aperto |
| OD-02 | Selezione multipla del Calendario disponibilità (Gestore) non applica il campo "Giornata particolare" (es. "tutti i venerdì piscina") — solo `isOpen`/capacità/sconto/last-minute sono nel `BulkDraft` | Medio-alto (feature richiesta esplicitamente incompleta) | Claude (fix applicativo) | Fix + test Playwright + verifica statica | **Bug confermato da Claude durante questo checkpoint** (screenshot Fabrizio, 05/08). Root cause: `BulkDraft` (`components/AvailabilityCalendar.tsx`) non include `specialEmoji`/nota; il pannello bulk non espone il selettore "Giornata particolare" che invece esiste nel pannello a giorno singolo. **Non corretto in questo passaggio** per rispetto esplicito della regola del checkpoint corrente ("non correggere gap applicativi durante questo checkpoint") — da programmare come primo item dopo la chiusura del package. | Aperto, registrato, fix rimandato |

## P1 MVP

| ID | Descrizione | Impatto | Owner | Evidenza necessaria | Stato |
|---|---|---|---|---|---|
| OD-03 | Golden Journeys (Sezione 10 Addendum) non ancora eseguite | Blocca GO/NO-GO | Claude (procedure) + Fabrizio (esecuzione live) | 5 journey verificate end-to-end | Aperto |
| OD-04 | Visual/Mobile Acceptance (Sezione 11 Addendum, 390×844/768/1440) non ancora eseguita | Blocca GO/NO-GO | Claude + Fabrizio | Screenshot/verifica sui 3 viewport | Aperto |
| OD-05 | Feature Control Center — azioni batch verificate solo staticamente, nessun run live end-to-end | Medio (rischio: comportamento reale non confermato) | Fabrizio (test live post-deploy) | Run reale: attiva → verifica accesso coorte → disattiva → verifica rollback | Aperto |

## Pilot Decision

| ID | Descrizione | Impatto | Owner | Evidenza necessaria | Stato |
|---|---|---|---|---|---|
| OD-06 | Classificazione dati pilota (PILOT_REAL/DEMO_CONTROLLED/TECHNICAL_TEST/UNKNOWN, Sezione 9 Addendum) non ancora prodotta | Blocca GO/NO-GO e qualunque report a terzi che usi numeri di `center_leads`/prenotazioni | Claude (classificazione) | Catalogo completo con query di sola lettura | Aperto |
| OD-07 | `center_leads`: 9 righe su 10 sono rumore di test (`parent_referral` con naming `[TEST] Centro Segnalato <timestamp>`), 0 candidature reali | Basso rischio tecnico, alto rischio se riportato a terzi come "trazione pilota" | Fabrizio (decisione su come/se ripulire prima di settembre) | — | Aperto, solo da tenere presente |

## Documentation Inconsistency

| ID | Descrizione | Impatto | Owner | Stato |
|---|---|---|---|---|
| OD-08 | `MVP_PRODUCTION_TRUTH_V2.md` indicava `b0d0f21` come fotografia corrente mentre HEAD era già avanzato | Basso (solo lettura fuorviante) | Claude | **Chiuso in questo checkpoint** — vedi normalizzazione §0.1-0.7 dello stesso documento |
| OD-09 | `MVP_PRODUCTION_TRUTH_V2.md` §8 affermava che le uniche azioni residue fossero deploy + email, omettendo Feature Control Center operativo/Golden Journey/Visual Acceptance/dati pilota/GO-NO-GO | Medio (sottostima del lavoro residuo) | Claude | **Chiuso in questo checkpoint** — vedi §0.5 dello stesso documento |
| OD-10 | Il Documentation Package richiesto da Fabrizio (Source Register, Master Requirement Catalog, Release Model, Traceability Matrix, Heatmap a 4 viste, SAL, 10 Checkpoint CP-01..CP-10) non è stato completato in questo passaggio — richiede la lettura integrale di ~10 documenti canonici esistenti (Handbook Parent/Partner/Admin, Architecture Blueprint, MVP Settembre, Master Prompt, Implementation Pack) per evitare di inventare requisiti o mappature | Alto (il package resta parziale) | Claude | Aperto — vedi `TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md` per lo stato sezione per sezione |

## Post-Beta

Nessun item registrato in questo passaggio (nessuna funzionalità è ancora uscita dalla fase Beta — coerente con `POST_BETA` non ancora usato nel catalogo, vedi `FEATURE_CONTROL_CENTER_SPEC.md`).

## Strategic / Legal-Operational

Nessun item nuovo emerso in questo checkpoint oltre a quanto già in `docs/trama-one/analysis/PRIVACY_COMPLIANCE` (Task #158, backlog).
