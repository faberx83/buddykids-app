# TRAMA ONE — Assumption Log

Elenco delle ambiguità rilevate durante l'Impact Assessment (Fase A) e i due Addendum. Per ciascuna: stato, scelta applicata, e sprint nel quale va riverificata (se non è definitiva). Nessuna voce di questo log è una decisione irrevocabile: ogni assunzione "differita" o "da verificare" può essere rivista quando arriva l'evidenza indicata, senza che questo costituisca una regressione del processo.

## Assunzioni approvate (confermate da Fabrizio, applicate come base di lavoro)

| # | Assunzione | Origine | Sprint di applicazione |
|---|---|---|---|
| A1 | Convenzione Sprint unica: "TRAMA ONE Build Sprint 0-6" per il lavoro TRAMA ONE; "Historical Legacy/NextGen Sprint" per la cronologia repository già eseguita | Addendum 1 | Da subito, tutte le comunicazioni future |
| A2 | Location: una sola sede operativa per Centro nel pilot settembre 2026, riuso di `centers.address`, nessuna tabella `locations` in Sprint 0-1 | Addendum 1 | Build Sprint 0-1 (multi-sede resta possibile in futuro senza vincoli tecnici) |
| A3 | Feature Flag Engine con Alternativa A (registry TypeScript + override persistiti), client `createServiceClient()` service-role, RLS `platform_admin`-only, resolver `server-only` | Addendum 1 + Addendum tecnico finale | Build Sprint 0, prerequisito hard |
| A4 | `proxy.ts` resta scope invariato (tenant/auth/ruolo/rewrite), nessuna query a `feature_flag_overrides` al suo interno; gate `TRAMA_ONE_ENABLED` nei layout server-side dei tre portali `/one` | Addendum tecnico finale | Build Sprint 0 |
| A5 | `ONLY_SITEMAP=1` va intercettato prima di push/deploy/alias/cleanup/suite ordinaria, nessun nuovo deploy prodotto | Addendum tecnico finale | Build Sprint 0 (adattamento `deploy.sh`/`test-deploy.sh`) |
| A6 | Motore Walkthrough generico anticipato a Build Sprint 1 (non più opzionale/differibile a Sprint 6), come parte dell'MVP Partner | Addendum tecnico finale | Build Sprint 1 |
| A7 | Giorni spot esplicitamente distribuiti su Build Sprint 2 (Partner/configurazione), 3 (Parent/selezione), 4 (fulfilment/accettazione parziale) | Addendum 1 | Build Sprint 2-4 |
| A8 | Deploy/test: `deploy.sh`/`test-deploy.sh` riclassificati ADAPT (non REUSE_AS_IS); rimozione del comportamento `|| true` incondizionato sui test come correzione dovuta indipendentemente da TRAMA ONE | Addendum 1 | Build Sprint 0 |

## Assunzioni differite (decisione strutturale rinviata a uno sprint successivo, per esplicita scelta)

| # | Assunzione | Motivo del rinvio | Sprint di verifica/decisione finale |
|---|---|---|---|
| D1 | Offering come entità distinta da Activity, o solo stato aggiuntivo su `activities`/`activity_weeks` | **RISOLTA (Build Sprint 2, DEC-32)** — nessuna nuova entità: `activities`/`activity_weeks`/`activity_days` coprono già quasi per intero la capability Giorni spot; estensione additiva di 2 colonne (`booking_mode`, `min_days_per_booking`) | Build Sprint 2 — chiusa |
| D2 | Persistenza dedicata per PlannerItem (tabella o estensione leggera) vs proiezione calcolata attuale | Decisione dipende da: state machine Request (Sprint 3), comportamento Booking, idempotenza eventi, accettazioni parziali per giorno | Build Sprint 4 |
| D3 | Eventuale confluenza del toggle `bk_version` (Legacy/NextGen) nel nuovo Feature Flag Engine | Non necessaria per Sprint 0-6, i due meccanismi restano indipendenti nel perimetro attuale | Fuori dal perimetro Sprint 0-6, da riconsiderare solo se emerge un bisogno esplicito |
| D4 | Multi-sede per Centro (tabella `locations`) | Deferita per l'intero pilot (A2); nessun vincolo tecnico bloccante per introdurla dopo | Da riconsiderare solo se un centro reale del pilot dichiara più sedi |

## Assunzioni da verificare (richiedono conferma o evidenza specifica prima di procedere oltre)

| # | Assunzione | Cosa verificare | Sprint entro cui verificare |
|---|---|---|---|
| V1 | Nessun centro del pilot beta (5-10 centri attesi) ha più di una sede reale | Conferma operativa con Fabrizio/team commerciale sui centri selezionati per il pilot | Prima di Build Sprint 2 |
| V2 | Le 20 CR "MVP-blocking" individuate nel testo del documento MVP (§2.4/§6) coincidono esattamente con le capability P0 delle tabelle 4.1-4.3 dello stesso documento | Verifica riga-per-riga CR↔capability, non ancora fatta in dettaglio in questa Fase A (la matrice prodotta è a livello di epic) | Prima di Build Sprint 3 (l'epic più esposto, E06) |
| V3 | Lo stesso ambiente Vercel/Supabase condiviso da Legacy/NextGen/beta feedback è idoneo anche per TRAMA ONE (nessun ambiente separato) | Conferma esplicita che non serva un ambiente beta isolato per TRAMA ONE | Prima di Build Sprint 0 |
| V4 | Il pattern `TutorialProgress` previsto nel domain model MVP è sufficiente come base schema per il motore Walkthrough, senza bisogno di colonne aggiuntive non ancora previste | Verifica schema esatto degli step Walkthrough quando si progetta la tabella | Build Sprint 1 |
| V5 | La matrice pagina-per-pagina/route-per-route richiesta dal Feature Preservation Gate (vedi `FEATURE_PARITY_MATRIX.md`) copre davvero tutte le capability toccate da Build Sprint 1 | **VERIFICATA** — prodotta in `SPRINT_1_FEATURE_PRESERVATION_MATRIX.md` (2026-07-20): nessuna capability AS-IS a rischio, tutte le nuove tabelle/route sono additive e interne alle shell `/one` | Prima dell'avvio di Build Sprint 1 — chiusa |
| V6 | La convenzione "riga assente = APPROVED" (migration_09) non impedisce ai centri genuinamente nuovi di avviare l'onboarding reale | **VERIFICATA (gap trovato e chiuso)** — durante la ri-verifica del fix DEC-23 è emerso che nessun meccanismo creava una riga LEAD per i centri nuovi (DEC-25); chiuso con `migration_10_center_onboarding_auto_lead.sql` (trigger `AFTER INSERT` su `public.centers`, DEC-26), verificato via `tests/one/onboarding-remediation.spec.ts` (TC-N407/N408) | Audit Remediation Sprint 1 (2026-07-20) — chiusa in attesa di applicazione migration_10 (Gate 1) |

## Nota

Questo log va aggiornato — non riscritto — ogni volta che un'assunzione passa di stato (da "da verificare" ad "approvata" o "differita", o quando una decisione differita viene presa). Ogni aggiornamento deve riportare la data e lo sprint in cui è avvenuto, senza cancellare la storia delle assunzioni precedenti.
