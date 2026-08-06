# TRAMA — Master Requirement Catalog

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v3 (OD-02 fix update) — **supersedes** v2 (`AS_OF_COMMIT 0fc210a`)
**As-of timestamp**: 2026-08-06T09:45:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `16b0527ba33222c63677735dca3bc57ed98221b3` (fix OD-02, applicativo — vedi `TRAMA_DOCUMENTATION_CHANGELOG.md` per il delta completo)
**Status**: current

Sezione 4 del checkpoint, versione corretta dopo il QA Remediation richiesto da Fabrizio. Regola non negoziabile: **nessun ID nuovo inventato**. Ogni riga riusa un identificativo esistente.

## Cosa cambia rispetto alla v1

1. **43 righe autonome**, una per ID — nessuna riga condivisa tra Epic e capability (v1 accorpava E02/P-MVP-02, E08/A-MVP-01, E09/P-MVP-08, E10/P-MVP-09/A-MVP-08, E12/A-MVP-09 in narrativa, anche se le tabelle erano già separate; qui la separazione è resa esplicita e strutturale, con colonna `Related requirement`).
2. **Scorecard Admin ricontata da zero**: la v1 dichiarava "7/10 LIVE" in un punto e mostrava 8 righe `LIVE` nella propria tabella nello stesso documento — incongruenza reale, confermata. Dopo la ricostruzione **and** la rivalutazione con la regola LIVE più severa richiesta in questo passaggio, il numero corretto di capability Admin `LIVE` è **5/10** (non 7 né 8) — vedi §3 sotto per il perché il numero è sceso ulteriormente.
3. **7 dimensioni di stato per requisito** invece di un singolo stato, con una regola esplicita su quando `LIVE` non è ammesso.
4. **Metriche separate** (Epic Health / MVP Capability Implementation Coverage / MVP Production Readiness / Pilot Validation Coverage) al posto dell'unica percentuale su 43.

## 1. Le 7 dimensioni di stato

| Dimensione | Significato |
|---|---|
| `SPECIFIED` | Il requisito è dichiarato in una fonte canonica (sempre `Sì` in questo catalogo, altrimenti l'ID non sarebbe qui) |
| `IMPLEMENTED` | Codice scritto che realizza il requisito: `Sì` / `Parziale` / `No` |
| `DEPLOYED` | Il commit che contiene l'implementazione è confermato nel commit live di produzione: `Confermato` / `Presunto (non riconfermato in questo passaggio)` / `No — bloccato da configurazione assente` |
| `STATIC_TESTED` | tsc/eslint/build puliti sui file coinvolti, e/o test Playwright scritti: `Sì` / `No` |
| `LIVE_TESTED` | Il percorso reale è stato eseguito almeno una volta su un ambiente deployato, anche con account di test: `Sì` / `No` |
| `PILOT_VALIDATED` | Il percorso è stato eseguito da una famiglia o un centro pilota reale (non un account di test di Fabrizio/Claude): `Sì` / `No` — oggi **sempre `No`**, nessun pilota reale è ancora arruolato (OD-06/OD-07) |
| `OVERALL_STATUS` | Sintesi, vedi regola sotto |

**Regola `OVERALL_STATUS`** (applicata rigorosamente, non solo alle 6 unità esplicitamente segnalate per rivalutazione):

- `LIVE` — `IMPLEMENTED=Sì`, `DEPLOYED≠No`, `STATIC_TESTED=Sì`, `LIVE_TESTED=Sì`, nessun gap noto che impedisca l'acceptance criterion dichiarato dalla fonte.
- `LIVE_WITH_GAP` — come sopra, ma un componente specifico e nominato del requisito non soddisfa il proprio acceptance criterion (es. l'e-mail transazionale non parte).
- `BUILT` — `IMPLEMENTED=Sì`, `STATIC_TESTED=Sì`, ma `LIVE_TESTED=No` (mai eseguito su un ambiente reale, nemmeno con account di test).
- `PARTIAL` — `IMPLEMENTED=Parziale` per scelta deliberata e documentata (copertura volutamente incompleta).
- `CONFLICT` — le fonti/i sotto-componenti del requisito si contraddicono sullo stato (es. OD-02): non risolto silenziosamente, richiede una decisione di scope.
- `SPECIFIED_NOT_FOUND` (`NSF`) — nessuna implementazione trovata per l'acceptance criterion specifico dichiarato dalla fonte.

**Nota di onestà sulla dimensione `DEPLOYED`**: nessun commit di questo repository è verificabile come "il commit live in produzione" da questo ambiente (nessuna credenziale Vercel — confermato in `MVP_SEPTEMBER_READINESS_MATRIX.md` §6, mai risolto da allora). Per questo `DEPLOYED` è quasi sempre `Presunto`, mai `Confermato`, per **tutte** le 43 righe — non solo per quelle rivalutate. Questo è un gap trasversale, non specifico di una capability: è registrato una sola volta qui invece di ripetuto 43 volte, e riportato come condizione strutturale nel verdetto finale.

## 2. Parte A — 43 unità, una riga per ID

### 2.1 — Epic (12)

| ID | Nome | Related requirement | IMPLEMENTED | DEPLOYED | STATIC_TESTED | LIVE_TESTED | PILOT_VALIDATED | OVERALL_STATUS |
|---|---|---|---|---|---|---|---|---|
| E01 | Identity, RBAC, tenant boundary | — | Sì | Presunto | Sì | Sì | No | **LIVE** |
| E02 | Journey context e shell coerente | P-MVP-02 | Parziale (2/9 punti) | Presunto | Sì | No | No | **PARTIAL** |
| E03 | Supply onboarding e approval | PT-MVP-01..06, A-MVP-02/03 | Sì | Presunto | Sì | Sì (1 candidatura reale processata) | No | **LIVE** |
| E04 | Canonical catalog & offering | PT-MVP-07/08 | Sì | Presunto | Sì | Sì | No | **LIVE** |
| E05 | Discovery & detail Next Gen | P-MVP-03/04 | Sì | Presunto | Sì | Sì | No | **LIVE** |
| E06 | Request/booking lifecycle | P-MVP-05, PT-MVP-09 | Sì | Presunto | Sì | Sì (16 booking reali con risposta) | No | **LIVE** |
| E07 | Planner & My Activities sync | P-MVP-06/07 | Sì | Presunto | Sì | Sì (stessa evidenza di E06) | No | **LIVE** |
| E08 | Admin operating queues | A-MVP-01 | Sì | Presunto | Sì | Sì | No | **LIVE** |
| E09 | Demand-led supply acquisition | P-MVP-08, A-MVP-06 | Sì | Presunto | Sì | Sì (CenterLead reale creato/processato) | No | **LIVE** |
| E10 | Beta feedback loop | P-MVP-09, A-MVP-08 | Sì | Presunto | Sì | **No** — nessuna evidenza citata di un feedback reale inviato e processato in coda | No | **BUILT** |
| E11 | Analytics & experiment framework | CR-044 | Parziale (eventi sì, framework esperimenti no — non richiesto) | Presunto | Sì | No | No | **PARTIAL** |
| E12 | Quality, feature flag e E2E | A-MVP-09 | Sì | Presunto | Sì | Parziale (motore flag base sì, Feature Control Center batch actions **no** — vedi A-MVP-09) | No | **LIVE_WITH_GAP** |

### 2.2 — Parent MVP (9)

| ID | Capability | Related requirement | IMPLEMENTED | LIVE_TESTED | PILOT_VALIDATED | OVERALL_STATUS |
|---|---|---|---|---|---|---|
| P-MVP-01 | Home/Planner orientati al bisogno | E01 | Sì | Sì | No | **LIVE** |
| P-MVP-02 | Context object | E02 | Parziale | No | No | **PARTIAL** |
| P-MVP-03 | Ricerca essenziale | E05 | Sì | Sì | No | **LIVE** |
| P-MVP-04 | Dettaglio Next Gen | E05 | Sì | Sì | No | **LIVE** |
| P-MVP-05 | Richiesta/booking leggero | E06 | Sì | Sì (16 booking reali) | No | **LIVE** |
| P-MVP-06 | Planner aggiornato | E07 | Sì | Sì | No | **LIVE** |
| P-MVP-07 | Le mie attività minimo | E07 | Sì | Sì | No | **LIVE** |
| P-MVP-08 | Suggerisci un centro | E09 | Sì | Sì (CenterLead reale) | No | **LIVE** |
| P-MVP-09 | Floating CTA beta | E10 | Sì | **No** — nessuna submission reale confermata | No | **BUILT** |

### 2.3 — Partner MVP (12)

| ID | Capability | Related requirement | IMPLEMENTED | LIVE_TESTED | PILOT_VALIDATED | OVERALL_STATUS |
|---|---|---|---|---|---|---|
| PT-MVP-01 | Diventa Partner TRAMA ≤2 min | E03 | Sì | Sì (1 candidatura reale) | No | **LIVE_WITH_GAP** — il meccanismo funziona ed è stato usato, ma l'acceptance criterion specifico ("≤2 minuti") non è mai stato misurato: nessuna telemetria sul tempo di submission |
| PT-MVP-02 | Identity verification | E03 | Sì | **No** — meccanismo di upload esiste (migration_15), nessuna evidenza citata di un documento reale caricato ed elaborato end-to-end | No | **BUILT** |
| PT-MVP-03 | Partner state machine | E03 | Sì | Sì (transizione reale candidatura→claimed→centro) | No | **LIVE** |
| PT-MVP-04 | Checklist profilo | E03 | Sì | **No** — nessuna evidenza citata di un run live | No | **BUILT** |
| PT-MVP-05 | Walkthrough task-based | E03 | Sì | Sì (testato dal vivo da Fabrizio, DEC-69…DEC-74) | No | **LIVE** |
| PT-MVP-06 | Centro e sede | E03/E04 | Sì | Sì (centro reale creato) | No | **LIVE** |
| PT-MVP-07 | Wizard attività | E04 | Sì | **No** — nessuna evidenza citata di un run live distinto | No | **BUILT** |
| PT-MVP-08 | Disponibilità strutturata | E04 | Sì | No | No | **BUILT** — vedi §4. OD-02 risolto: Fabrizio ha scelto **A. FIX BEFORE BETA** (revocando la precedente ipotesi B), il fix bulk "Giornata particolare" è implementato e verificato staticamente (commit `16b0527`), non ancora deployato né testato dal vivo |
| PT-MVP-09 | Inbox richieste | E06 | Sì | Sì (16 booking reali risposti) | No | **LIVE** |
| PT-MVP-10 | Dashboard task-first | E08 | Sì | Sì (uso continuativo) | No | **LIVE** |
| PT-MVP-11 | Trust telemetry minima | — | Parziale (per design, score non mostrato) | No | No | **PARTIAL** |
| PT-MVP-12 | Notification/Audit | E12 | Sì | Parziale — audit log sì (evidenza in DEC-log), **e-mail transazionali no**: 16/16 booking hanno `email_delivery_status=NULL`, `RESEND_API_KEY` mai confermata configurata | No | **LIVE_WITH_GAP** |

### 2.4 — Admin MVP (10)

| ID | Capability | Related requirement | IMPLEMENTED | LIVE_TESTED | PILOT_VALIDATED | OVERALL_STATUS |
|---|---|---|---|---|---|---|
| A-MVP-01 | Command center | E08 | Sì | Sì | No | **LIVE** |
| A-MVP-02 | Application review cards | E03/E08 | Sì | Sì (candidatura reale revisionata) | No | **LIVE** |
| A-MVP-03 | Partner approval state machine | E03 | Sì | Sì | No | **LIVE** |
| A-MVP-04 | Activation oversight | E03 | Sì | **No** — eventi Spotlight esistono, nessuna evidenza citata di un Admin che ha davvero consultato checklist/tutorial-progress di un Partner reale tramite una superficie UI dedicata | No | **BUILT** (declassato da LIVE della v1: la v1 assumeva "osservabilità = uso", non verificato) |
| A-MVP-05 | Activity quality | E04 | **No** per l'acceptance criterion specifico | No | No | **SPECIFIED_NOT_FOUND** — l'MVP richiede "checklist minima e preview Parent" per la qualità attività lato Admin; l'unica coda trovata (`activity_certifications`, migration_16) è una capability diversa (certificazione accesso disabili/diete/badge), non una checklist di qualità generica con preview collegata dall'Admin. Nessuna evidenza di quella specifica funzione |
| A-MVP-06 | Demand/supply queue | E09 | Sì | Sì (CenterLead reale processato) | No | **LIVE** |
| A-MVP-07 | Trust config minima | — | **No** | No | No | **SPECIFIED_NOT_FOUND** — nessuna UI Admin per pesi/versione dei driver Trust; resta NSF finché Fabrizio non decide DEFER/ACCEPTED_OUT_OF_BETA (vedi §5) |
| A-MVP-08 | Feedback beta | E10 | Sì | **No** — stessa mancanza di evidenza di E10 | No | **BUILT** |
| A-MVP-09 | Feature flags | E12 | Sì (motore base) / **No** (batch activate/deactivate) | Parziale — il motore singolo-flag è live-tested (resolver verificato dal vivo su 5 contesti, `MVP_SEPTEMBER_READINESS_MATRIX.md` §2-3); le azioni batch e la conferma rinforzata scope-globale **non sono mai state eseguite in produzione** | No | **BUILT** (declassato da LIVE della v1, per istruzione esplicita: "Feature Control Center non può essere LIVE finché batch activate/deactivate, RBAC e rollback non sono verificati in produzione") |
| A-MVP-10 | Audit e RBAC | E01 | Sì | Sì (uso continuativo `is_platform_admin()`) | No | **LIVE** |

## 3. Conteggi automatici (regola: non aggiornare percentuali prima di validare i conteggi)

| OVERALL_STATUS | Epic (12) | Parent (9) | Partner (12) | Admin (10) | Totale (43) |
|---|---:|---:|---:|---:|---:|
| LIVE | 8 | 7 | 5 | 5 | **25** |
| LIVE_WITH_GAP | 1 | 0 | 2 | 0 | **3** |
| BUILT | 1 | 1 | 4 | 3 | **9** |
| PARTIAL | 2 | 1 | 1 | 0 | **4** |
| CONFLICT | 0 | 0 | 0 | 0 | **0** |
| SPECIFIED_NOT_FOUND | 0 | 0 | 0 | 2 | **2** |
| **Somma** | **12** | **9** | **12** | **10** | **43** |

Verifica: 25+3+9+4+0+2 = 43. ✓ Somma per prodotto: 12+9+12+10 = 43. ✓ Nessun ID contato due volte (verificato per costruzione: ogni riga di §2.1-2.4 è un solo ID).

**Aggiornamento post-fix OD-02 (06/08/2026)**: `PT-MVP-08` passa da `CONFLICT` a `BUILT` (commit `16b0527`) — la riga `CONFLICT` resta a 0 per tracciabilità, non rimossa. `BUILT` sale da 8 a 9 (Partner: 3→4). Nessun'altra riga cambia.

**Scorecard Admin corretta**: **5 `LIVE`** su 10 (non 7 né 8). Il numero è sceso rispetto a entrambe le cifre precedenti perché la rivalutazione con la regola `LIVE` più severa ha declassato A-MVP-04 e A-MVP-09 da `LIVE` a `BUILT` (nessuna evidenza di uso reale/produzione verificata), non per un semplice errore di conta — la v1 aveva sia un errore di conta (7 vs 8 nella narrativa) sia una classificazione troppo permissiva (8 vs 5 dopo la rivalutazione).

## 4. OD-02 / PT-MVP-08 — CONFLICT risolto, fix implementato, in attesa di verifica live

**Decisione di Fabrizio (06/08/2026): OD-02 — FIX BEFORE BETA.** Revoca la precedente ipotesi "B. ACCEPTED DEFER". Il `CONFLICT` è chiuso: `PT-MVP-08` non è più in stato contraddittorio, perché il gap che lo causava (bulk "Giornata particolare" non applicata) è stato implementato.

Root cause confermata prima del fix: `BulkDraft` (`components/AvailabilityCalendar.tsx`) non includeva `specialEmoji`/`specialLabel`, e sovrascriveva incondizionatamente `isOpen`/`capacity`/`discountPercent`/`lastMinute` su tutti i giorni selezionati. Le colonne `special_emoji`/`special_label` esistevano già su `activity_days` (`supabase/schema.sql`) — nessuna migrazione necessaria, confermato prima di scrivere codice.

Fix (commit `16b0527`): nuovo `lib/availability-bulk.ts` con semantica esplicita a 3 stati per ogni campo del bulk draft (campo non modificato / valore impostato / valore esplicitamente rimosso), applicata sia alla Giornata particolare sia ai 4 campi preesistenti (ora opt-in per giorno, risolvendo anche la sovrascrittura accidentale). UI in `components/AvailabilityCalendar.tsx` estesa di conseguenza. Nessuna modifica a Booking/JourneyContext/state machine/Feature Control Center/Trust Score.

Stato attuale: `IMPLEMENTED=Sì`, `DEPLOYED=No`, `STATIC_TESTED=Sì` (tsc/eslint puliti, 8 test puri PASS in `tests/gestore/calendario-bulk.spec.ts` — Test A/C/D/E/F richiesti da Fabrizio), `LIVE_TESTED=No`, `PILOT_VALIDATED=No` → `OVERALL_STATUS = BUILT`, non `LIVE`, per istruzione esplicita di Fabrizio ("non dichiararlo LIVE prima del test in produzione"). 3 test E2E aggiuntivi (persistenza, regressione giorno singolo, mobile) sono scritti e in attesa del prossimo deploy per l'esecuzione. Percorso di stato OD-02: 1. OPEN — FIX BEFORE BETA (chiuso) → **2. IMPLEMENTED — AWAITING LIVE TEST (stato attuale)** → 3. CLOSED (solo dopo verifica live).

## 5. A-MVP-05 e A-MVP-07 — classificazione univoca

- **A-MVP-05**: `SPECIFIED_NOT_FOUND`, univoco, non condizionale. Se Fabrizio conferma che la certificazione esistente soddisfa il requisito (interpretazione estensiva dell'acceptance criterion), la riclassificazione a `LIVE`/`PARTIAL` richiede una decisione esplicita, registrata come nuova voce in Open Decisions — non fatta qui d'iniziativa.
- **A-MVP-07**: resta `SPECIFIED_NOT_FOUND` come requisito MVP dichiarato (è nella tabella ufficiale A-MVP del documento MVP, priorità P1, non marcato opzionale dalla fonte). Diventa `DEFER`/`ACCEPTED_OUT_OF_BETA` solo dopo una decisione esplicita di scope di Fabrizio (OD-11).

## Parte B — Livello TO-BE completo (148 ID), ricalcolato con script

Vedi `TRAMA_REQUIREMENT_ID_RECONCILIATION.md` per il dettaglio completo, la metodologia di classificazione `DEFER` e l'output dello script di verifica. Sintesi:

| Prefisso | Totale | MVP mapped (§6.2, esplicito) | DEFER (keyword-match contro MVP §2.4 OUT-of-scope) | ROADMAP_TO_BE (non classificato) | Duplicati | Mancanti |
|---|---:|---:|---:|---:|---:|---:|
| CR (Parent) | 52 | 25 | 5 | 22 | 0 | 0 |
| PCR (Partner) | 50 | 17 | 6 | 27 | 0 | 0 |
| ACR (Admin) | 46 | 18 | 7 | 21 | 0 | 0 |
| **Totale** | **148** | **60** | **18** | **70** | **0** | **0** |

**Correzione rispetto alla v1**: la v1 dichiarava "104 ID non mappati" ma ne elencava 85, e non separava `DEFER` da `ROADMAP_TO_BE` — errore riconosciuto. Il numero corretto di ID non mappati a un epic MVP è **88** (18 `DEFER` + 70 `ROADMAP_TO_BE`), verificato per costruzione insiemistica (script Python, unione = universo completo, intersezione = zero, riportato integralmente in `TRAMA_REQUIREMENT_ID_RECONCILIATION.md`).

## Gap di documentazione onestamente registrato (nuovo in questo passaggio)

I 60 ID `MVP mapped` di Parte B derivano **esclusivamente** dalla tabella §6.2 del documento MVP (Epic↔CR/PCR/ACR), l'unico crosswalk esplicito fornito dalle fonti. Le capability `P-MVP-*`/`PT-MVP-*`/`A-MVP-*` di Parte A **non hanno un proprio crosswalk dichiarato verso CR/PCR/ACR** — es. `PT-MVP-01` "Diventa Partner ≤2 min" corrisponde con ogni evidenza a `PCR-037`, ma nessuna fonte lo dichiara esplicitamente, quindi `PCR-037` resta `ROADMAP_TO_BE` in Parte B invece di essere collegato a `PT-MVP-01`. Collegarli d'iniziativa sarebbe un'invenzione di mapping non fornito dalla fonte. Registrato come nuova voce OD-12 in Open Decisions.
