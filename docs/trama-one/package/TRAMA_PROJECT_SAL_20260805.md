# TRAMA — Project SAL (Stato Avanzamento Lavori) — 05/08/2026

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**As-of timestamp**: 2026-08-05T18:40:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `bd03067`

Sezioni 10-11 e 13 del checkpoint SAL. Nota di metodo: la richiesta originale specifica una struttura a 24 parti. Questo documento copre il contenuto sostanziale richiesto (scope, stato per prodotto, rischi, checkpoint, gate finale) organizzato in parti numerate coerenti col contenuto reale disponibile; non sono state create suddivisioni artificiali solo per raggiungere il numero 24 quando non c'era altro da dire in quella sezione — dove una parte è vuota di contenuto reale lo dichiara esplicitamente invece di riempirla.

## Parte 1 — Executive summary

TRAMA ONE è in **anticipo sulla costruzione del codice** rispetto alla roadmap calendarizzata (vedi `TRAMA_CANONICAL_RELEASE_MODEL.md` §3): il contenuto funzionale delle 4 fasi MVP (Sprint 0-4, sistema D) è per l'81% già `LIVE` al 5 agosto, con 6 settimane di anticipo sulla data di lancio pianificata (28 settembre 2026). Questo **non equivale a pronto per il lancio**: restano aperti 4 gate non di codice (Golden Journeys dal vivo, Visual/Mobile Acceptance, `RESEND_API_KEY`, classificazione dati pilota) che richiedono azioni di Fabrizio, non ulteriore sviluppo.

## Parte 2 — Perimetro coperto da questo SAL

Copre lo stato del programma **TRAMA ONE** (Parent/Partner/Admin, journey cross-portale), non il backlog storico BuddyKids V1/NextGen pre-TRAMA (quello resta tracciato nei task del repository, fuori perimetro di un SAL specifico su TRAMA ONE).

## Parte 3 — Fonte di verità per questo SAL

`TRAMA_MASTER_REQUIREMENT_CATALOG.md` (Parte A, 43 unità verificate) e `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md`, entrambi in questo package, stesso `AS_OF_COMMIT`.

## Parte 4 — Scorecard Parent

| Metrica | Valore |
|---|---|
| Capability MVP (`P-MVP-*`) | 9 |
| LIVE | 8 (89%) |
| PARTIAL | 1 (11%) — Context object, copertura deliberata parziale |
| NSF | 0 |
| Epic condivisi rilevanti | E02 (PART), E05 (LIVE), E06 (LIVE), E07 (LIVE), E09 (LIVE) |
| Gap aperto principale | Nessuno bloccante; il Context Object incompleto è un rischio di continuità UX minore, non un blocco funzionale |

## Parte 5 — Scorecard Partner

| Metrica | Valore |
|---|---|
| Capability MVP (`PT-MVP-*`) | 12 |
| LIVE | 10 (83%) |
| BUILT (KPI non misurato) | 1 (8%) — tempo mediano richiesta ≤2 min mai cronometrato |
| PARTIAL | 1 (8%) — Trust telemetry minima |
| Gap aperto principale | OD-02 (bug bulk-select "Giornata particolare" su `AvailabilityCalendar`) — registrato, deliberatamente non corretto in questo checkpoint |

## Parte 6 — Scorecard Admin

| Metrica | Valore |
|---|---|
| Capability MVP (`A-MVP-*`) | 10 |
| LIVE | 7 (70%) |
| PARTIAL | 1 (10%) — Activity quality workflow dedicato non confermato distinto dalla certificazione |
| SPECIFIED_NOT_FOUND | 1 (10%) — Trust config minima (A-MVP-07), nessuna UI Admin per pesi/versione trovata |
| Gap aperto principale | A-MVP-07 — da decidere se costruire prima di settembre o dichiarare esplicitamente fuori scope (il Trust score non è comunque visibile all'utente, quindi il rischio è di governance interna, non di prodotto esposto) |

## Parte 7 — Epic trasversali (non attribuibili a un solo prodotto)

E01 (Identity/RBAC) LIVE, E02 (Journey context) PART, E11 (Analytics) PART, E12 (Quality/flags/E2E) LIVE — dettaglio in `TRAMA_MASTER_REQUIREMENT_CATALOG.md` §A.1.

## Parte 8 — Rischi aperti (rimando a Open Decisions, non duplicati qui)

Vedi `TRAMA_OPEN_DECISIONS_AND_GAPS.md` per il registro completo con owner ed evidenza necessaria. Sintesi: OD-01 (`RESEND_API_KEY`), OD-02 (bulk-select bug), OD-03 (Golden Journeys), OD-04 (Visual/Mobile Acceptance), OD-05 (batch actions Feature Control Center non verificate dal vivo), OD-06/OD-07 (dati pilota), OD-10 (parti del documentation package non completate).

## Parte 9 — Checkpoint di programma (CP-01…CP-10)

| Checkpoint | Ambito | Verdetto | Evidenza |
|---|---|---|---|
| CP-01 | Sprint 0 Foundation (sistema C) | **PASS** | `AUDIT_CHECKPOINT_SPRINT_0.md` |
| CP-02 | Sprint 1 Supply Activation | **PASS** | `AUDIT_CHECKPOINT_SPRINT_1.md` + remediation chiusa (task #308-315) |
| CP-03 | Sprint 2 Catalogo | **PASS** | `AUDIT_CHECKPOINT_SPRINT_2.md` |
| CP-04 | Integration Audit Sprint 1-4 | **PASS WITH CONDITIONS** | `AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md` — gap P0 trovati (email Partner, verifica identità, booking ops queue) e chiusi in passaggi successivi (task #360-363) |
| CP-05 | Beta Release Gate | **PASS WITH CONDITIONS** | `AUDIT_CHECKPOINT_BETA_RELEASE.md`, `TRAMA_ONE_CONTROLLED_BETA_GATE_FINAL.md` — condizioni: Visual Acceptance mai chiuso con screenshot reali (DEC-61) |
| CP-06 | RC1 / Addendum Sezione A | **PASS** | `TRAMA_ONE_MVP_RC1` = `79fcb63`, TC-N609 fix verificato e committato |
| CP-07 | Feature Control Center / Addendum Sezione B | **PASS WITH CONDITIONS** | Costruito e verificato staticamente; nessun run live end-to-end (batch activate/deactivate, conferma scope globale) |
| CP-08 | SAL / Documentation Package Checkpoint (questo) | **PASS WITH CONDITIONS** | Parti A (livello MVP) complete e verificate; Parte B (livello TO-BE completo, 104 ID) esplicitamente non classificata — vedi Manifest |
| CP-09 | Gate manuale `RESEND_API_KEY` / email transazionali | **NOT YET DUE** | Richiede azione di Fabrizio (configurazione + 1 booking reale), mai eseguita — OD-01 |
| CP-10 | Golden Journeys + Visual/Mobile Acceptance + GO/NO-GO finale | **NOT YET DUE** | Bloccato su OD-03/OD-04, non eseguibili da questo ambiente (richiedono browser reale e dispositivi/viewport) |

## Parte 10 — Perché CP-09 e CP-10 sono "NOT YET DUE" e non "FAIL"

Nessuno dei due checkpoint ha un criterio di accettazione violato: semplicemente non sono ancora stati eseguiti, perché richiedono un'azione che questo ambiente non può compiere (invio email reale con chiave di produzione, screenshot su dispositivi/browser reali, arruolamento di un centro pilota reale). Marcarli `FAIL` implicherebbe un tentativo fallito; non è il caso — è un'azione non ancora tentata, per costruzione riservata a Fabrizio secondo la governance del progetto.

## Parte 11 — Confronto con lo stato dichiarato nella vecchia Sezione 8 di `MVP_PRODUCTION_TRUTH.md` (v1)

La v1 del documento (`MVP_PRODUCTION_TRUTH.md`, non v2) dichiarava, alla sua ultima sezione, che le uniche azioni residue per Fabrizio fossero "deploy ed email". Questo SAL, insieme a `MVP_PRODUCTION_TRUTH_V2.md` §0.5, corregge esplicitamente quella claim: le azioni residue reali comprendono anche CP-09 e CP-10 per intero (Golden Journeys, Visual Acceptance, classificazione dati pilota, GO/NO-GO), non solo deploy ed email.

## Parte 12 — Cosa NON è in questo SAL (onestamente)

- Non contiene una valutazione finanziaria/commerciale (fuori perimetro tecnico-documentale).
- Non contiene una nuova stima di effort residuo in giornate/persona — la stima esistente (`TRAMA_MVP_Settembre_2026...`, §7.3, 45-70 giornate) non è stata ri-validata in questo passaggio.
- Non ricalcola KPI di prodotto (Supply Activation Rate, ecc., MVP §4.2) — richiedono dati da un pilota reale, non ancora arruolato.

## Verdetto MVP September Status (sintesi di questo SAL)

**READY WITH CONDITIONS.** Il codice è pronto per l'81% delle unità MVP verificate (35/43 `LIVE`); le condizioni residue sono tutte azioni manuali di Fabrizio (CP-09, CP-10) o item di lavoro futuro esplicitamente non bloccanti per il codice esistente (OD-02, A-MVP-07). Nessuna condizione qui elencata richiede un nuovo sprint di sviluppo prima di poter eseguire le verifiche dal vivo mancanti.
