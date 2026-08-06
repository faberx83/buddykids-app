# TRAMA — Requirement ID Reconciliation

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v2 (QA Remediation)
**As-of timestamp**: 2026-08-05T20:10:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `0fc210a7da8abd98bbbfd64a0bb97eef2c26c2b3`
**Status**: current (documento nuovo, nessuna versione precedente da sostituire)

Prodotto in risposta al QA Remediation: la v1 del Master Requirement Catalog dichiarava "104 ID non mappati" ma ne elencava 85, senza separare `DEFER` da `ROADMAP_TO_BE`, e non era verificata da uno script — errore riconosciuto. Questo documento ricalcola l'intero universo `CR-001…052` + `PCR-001…050` + `ACR-001…046` (148 ID) tramite verifica insiemistica automatica, non a mano.

## Metodo

1. **Universo**: i range dichiarati dalle fonti stesse (Handbook Parent §11, Partner "Backlog Change Request", Admin "Backlog Change Request") — CR 1-52, PCR 1-50, ACR 1-46.
2. **MVP mapped**: esclusivamente gli ID citati nella tabella §6.2 del documento MVP ("Mapping con gli handbook esistenti", Epic↔CR/PCR/ACR) — l'unico crosswalk esplicito fornito da una fonte canonica. Nessun ID è stato aggiunto a questa categoria per somiglianza semantica (vedi nota sul gap di crosswalk, sotto).
3. **DEFER**: ID il cui titolo/area corrisponde in modo riconoscibile a una delle categorie esplicitamente elencate come OUT of scope nel documento MVP §2.4 (Pagamenti e finanza, Operations avanzate, Servizi extra, Promozioni avanzate, Logistica avanzata, Marketplace nazionale, Integrazioni, Migrazione totale Legacy, Trust avanzato e AI, Gamification e livelli visibili, Referral automatico economico). **Metodo dichiarato**: corrispondenza per parola chiave sul titolo/area della CR, senza lettura narrativa integrale della sezione handbook che descrive quella singola CR — quindi è una classificazione "best-effort, verificabile" ma non equivalente a una verifica narrativa riga per riga. Ogni assegnazione è elencata sotto con la motivazione.
4. **ROADMAP_TO_BE**: tutto il resto — non è né esplicitamente in scope MVP né esplicitamente fuori scope per corrispondenza diretta con la tabella §2.4; richiede lettura narrativa dedicata per essere classificato con certezza.
5. **Verifica automatica**: script Python (`/tmp/trama_qa/reconcile.py` in sandbox, non incluso nel repository — è uno strumento di verifica, non un artefatto del prodotto) che calcola unione, intersezione e differenza tra i tre insiemi per ciascun prefisso e verifica `MVP ∪ DEFER ∪ ROADMAP_TO_BE = universo`, `MVP ∩ DEFER = ∅`, nessun ID fuori range, nessun duplicato.

## Tabella di riconciliazione (output dello script, verificato)

| Prefisso | Totale | MVP mapped | DEFER | ROADMAP_TO_BE | Duplicati | Mancanti |
|---|---:|---:|---:|---:|---:|---:|
| CR | 52 | 25 | 5 | 22 | 0 | 0 |
| PCR | 50 | 17 | 6 | 27 | 0 | 0 |
| ACR | 46 | 18 | 7 | 21 | 0 | 0 |
| **Totale** | **148** | **60** | **18** | **70** | **0** | **0** |

Verifica vincoli richiesti: unione delle 3 categorie = universo completo (verificato per ciascun prefisso, somma = totale riga). Intersezione tra categorie = zero (verificato: nessun ID compare in più di una categoria). Totale complessivo = 148 (verificato). Nessun ID mancante, nessun ID duplicato (verificato dallo script, non a mano).

## CR — Parent (52)

**MVP mapped (25)**: 001, 006, 007, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 021, 026, 034, 035, 043, 044, 045, 047, 048, 049, 050

**DEFER (5)**, con motivazione:
| ID | Titolo | Categoria OUT-of-scope corrispondente |
|---|---|---|
| CR-030 | Definire contratto travel time e fallback | Logistica avanzata: "Travel time real-time" |
| CR-031 | Implementare regole promemoria e quiet hours | Logistica avanzata: "reminder intelligenti e quiet hours" |
| CR-036 | Migrare presenze e collegarle a booking/bambino | Operations avanzate: "presenze giornaliere" |
| CR-051 | Introdurre attribution, eligibility e reward per il referral di centri | Referral automatico economico: "settembre usa shadow mode" (CR-051 è la parte reward "piena", distinta dalla parte shadow già in scope come CR-049) |
| CR-052 | Mostrare stato referral e reward al Genitore | Stessa categoria di CR-051, dipendenza diretta |

**ROADMAP_TO_BE (22)**: 002, 003, 004, 005, 008, 020, 022, 023, 024, 025, 027, 028, 029, 032, 033, 037, 038, 039, 040, 041, 042, 046

## PCR — Partner (50)

**MVP mapped (17)**: 001, 002, 003, 006, 007, 010, 011, 013, 015, 021, 023, 024, 025, 029, 034, 035, 036

**DEFER (6)**, con motivazione:
| ID | Titolo | Categoria OUT-of-scope corrispondente |
|---|---|---|
| PCR-016 | Roster gruppi derivato da booking | Operations avanzate: "gruppi" |
| PCR-017 | Integrazione presenze-booking | Operations avanzate: "presenze giornaliere" |
| PCR-019 | Marketplace servizi extra | Servizi extra: "catering, navette e supplier marketplace: solo modello futuro" |
| PCR-020 | Regole promozioni | Promozioni avanzate: "dynamic pricing, coupon, family discount engine" |
| PCR-046 | Partnership Level comportamentali | Gamification e livelli visibili: "Partnership Level in UI dopo la baseline" |
| PCR-050 | Commissione ridotta condizionata a target di qualità e volume | Referral automatico economico: "commission ledger e settlement completi... settembre usa shadow mode" |

**ROADMAP_TO_BE (27)**: 004, 005, 008, 009, 012, 014, 018, 022, 026, 027, 028, 030, 031, 032, 033, 037, 038, 039, 040, 041, 042, 043, 044, 045, 047, 048, 049

**Nota su PCR-037…042, 047, 048**: corrispondono con ogni evidenza alle capability `PT-MVP-01…05, 12` (rispettivamente: richiesta ≤2min, identity verification, state machine, walkthrough, resume/skip, checklist, notification center, audit log) — ma nessuna fonte fornisce quel crosswalk esplicitamente, quindi restano `ROADMAP_TO_BE` qui per rigore metodologico, non perché considerati davvero "fuori scope" (vedi Parte A del Master Requirement Catalog, dove le stesse capability sono classificate `LIVE`/`LIVE_WITH_GAP`/`BUILT`). Questo è il gap di crosswalk registrato come OD-12.

## ACR — Admin (46)

**MVP mapped (18)**: 001, 002, 004, 005, 007, 008, 013, 014, 015, 016, 017, 018, 019, 022, 023, 024, 030, 032

**DEFER (7)**, con motivazione:
| ID | Titolo | Categoria OUT-of-scope corrispondente |
|---|---|---|
| ACR-010 | Commercial ledger | Pagamenti e finanza: "commission ledger reale" |
| ACR-011 | Piattaforma servizi extra | Servizi extra: "solo modello futuro, non delivery settembre" |
| ACR-012 | Supplier model | Stessa categoria di ACR-011 (dipendenza diretta) |
| ACR-027 | Commission versioning | Pagamenti e finanza: "commission ledger reale" |
| ACR-028 | Supplier SLA monitoring | Stessa categoria di ACR-011/012 |
| ACR-042 | Partnership Level e ranking governance | Gamification e livelli visibili |
| ACR-045 | Reward Genitore e commission incentive eligibility/ledger | Referral automatico economico: "settembre usa shadow mode" |

**ROADMAP_TO_BE (21)**: 003, 006, 009, 020, 021, 025, 026, 029, 031, 033, 034, 035, 036, 037, 038, 039, 040, 041, 043, 044, 046

**Nota su ACR-035…041, 043**: stesso fenomeno di crosswalk mancante osservato per Partner — corrispondono con ogni evidenza a `A-MVP-01…04, 07` — restano `ROADMAP_TO_BE` per lo stesso motivo (OD-12).

## Confronto esplicito con la v1 (errore riconosciuto)

| Metrica | v1 (errata) | v2 (verificata da script) |
|---|---|---|
| ID non mappati dichiarati | "104" | — |
| ID non mappati effettivamente elencati | 85 (26 Parent + 30 Partner + 29 Admin) | — |
| ID non mappati corretti (`DEFER` + `ROADMAP_TO_BE`) | — | **88** (27 Parent + 33 Partner + 28 Admin) |
| Separazione DEFER / ROADMAP_TO_BE | Assente | Presente, con motivazione per ogni `DEFER` |
| Verifica automatica | Assente | Script Python, unione/intersezione verificate |

La causa dell'errore v1: i conteggi "26/30/29" erano stati scritti a mano contando le righe di una lista compilata manualmente, senza un secondo controllo insiemistico contro il totale dichiarato (52/50/46) e senza sottrarre esplicitamente gli ID già mappati. Il numero "104" era un arrotondamento comunicato a voce nel testo, mai ricalcolato dalla lista stessa — la lista e il numero riassuntivo erano quindi due fonti indipendenti, mai riconciliate tra loro. Questo passaggio corregge esattamente quel tipo di errore introducendo una verifica automatica come procedura permanente (vedi `TRAMA_DOCUMENTATION_QA_REPORT.md`, self-test).
