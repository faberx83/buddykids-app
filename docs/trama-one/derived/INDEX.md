# INDEX — Copie derivate TRAMA ONE (ricercabili)

Questo indice aiuta a **localizzare** contenuti nelle copie derivate Markdown di questa cartella. Non è normativo e non sostituisce i documenti originali (vedi `../README.md`, sezione "Prevalenza documentale"). Le copie derivate sono testo integrale non riassunto: questo indice punta a dove cercare, non riproduce il contenuto.

Tutti i file qui sono ricercabili con `grep`/ricerca full-text del tuo editor. I pattern grep suggeriti sotto funzionano da questa cartella (`docs/trama-one/derived/`).

## 1. Documento sorgente → file derivato

| Documento sorgente (canonico) | File derivato | Ruolo |
|---|---|---|
| `TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx` | `TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.md` | MVP Settembre 2026 |
| `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx` | `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.md` | TO-BE Parent |
| `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx` | `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.md` | TO-BE Partner |
| `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx` | `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.md` | TO-BE Admin |
| `TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx` | `TRAMA_ONE_Claude_Implementation_Pack_v1.0.md` | Metodo di lavoro con Claude |

(`TRAMA_ONE_Claude_Master_Prompt_v1.0.md` e `TRAMA_ONE_Architecture_Blueprint_v1.0.html` sono già in Markdown/HTML nativo: non hanno copia derivata, si consultano direttamente in `../`.)

## 2. Portale

| Portale | Documento TO-BE | Sezione journey | Prefisso Journey | Prefisso CR portale | Prefisso DDL portale |
|---|---|---|---|---|---|
| **Parent** (Genitore) | Handbook Parent 1.2 | `5.x` — audit pagina per pagina (27 sotto-sezioni, una per pagina AS-IS, es. `5.1 Home Next Gen`, `5.2 Planner - Organizzazione`...) | — (nessun prefisso *Jnn* dedicato: la struttura journey del Parent è organizzata per pagina, non per journey nominata come Partner/Admin) | `CR-xxx` (lista cross-portale, vedi §4) | `DDL-xxx` |
| **Partner** (Gestore) | Handbook Partner 1.1 | `3. Journey e processi Partner` → `PJ01`…`PJ10` | `PJ` | `PCR-xxx` | `PDDL-xxx` |
| **Admin** | Handbook Admin 1.1 | `3. Journey e processi Admin` → `AJ01`…`AJ10` | `AJ` | `ACR-xxx` | `ADDL-xxx` |

Grep rapido per aprire una journey: `grep -n "^# PJ0" TRAMA_Partner_*.md` oppure `grep -n "^# AJ0" TRAMA_Admin_*.md`.

## 3. Journey

| ID | Titolo | File | Nota |
|---|---|---|---|
| PJ01 | Onboarding e approvazione centro | Handbook Partner | |
| PJ02 | Creazione e pubblicazione attività | Handbook Partner | |
| PJ03 | Gestione disponibilità e capienza | Handbook Partner | |
| PJ04 | Gestione richieste | Handbook Partner | |
| PJ05 | Gestione prenotazioni | Handbook Partner | |
| PJ06 | Gruppi e presenze | Handbook Partner | |
| PJ07 | Servizi extra | Handbook Partner | |
| PJ08 | Promozioni e saturazione | Handbook Partner | |
| PJ09 | Comunicazioni operative | Handbook Partner | |
| PJ10 | Supporto Partner contestuale | Handbook Partner | |
| AJ01 | Approva e attiva partner | Handbook Admin | |
| AJ02 | Governance qualità attività | Handbook Admin | |
| AJ03 | Gestione booking anomali | Handbook Admin | |
| AJ04 | Pipeline domanda non servita | Handbook Admin | |
| AJ05 | Servizi extra e fornitori | Handbook Admin | |
| AJ06 | Supporto unificato | Handbook Admin | |
| AJ07 | Tassonomie e catalogo | Handbook Admin | |
| AJ08 | Commercial governance | Handbook Admin | |
| AJ09 | Feature flags e configurazioni | Handbook Admin | |
| AJ10 | Audit e sicurezza interna | Handbook Admin | |
| — | Journey primaria del MVP (§2.3) | MVP Settembre 2026 | Journey cross-portale unica di riferimento per il lancio, non numerata PJ/AJ |
| — | Audit pagina-per-pagina §5.1–5.27 | Handbook Parent | Ogni sotto-sezione copre una pagina AS-IS + regole/gap correlati |

Ogni sotto-sezione journey (`## Diagramma AS-IS`, `## Diagramma TO-BE`, `## Business Rules`) è annidata sotto l'heading dell'ID journey — cerca l'ID per arrivare a tutte e tre.

## 4. Change Request (CR)

Esistono **tre liste distinte**, non intercambiabili:

| Prefisso | Ambito | Range osservato | Dove si trova la tabella completa |
|---|---|---|---|
| `CR-xxx` | Cross-portale / globale, principalmente Parent-facing | CR-001 … CR-052 (50 righe) | Handbook Parent, sezione `11. Change Request Backlog` |
| `PCR-xxx` | Solo Partner | PCR-001 … PCR-050 | Handbook Partner, backlog CR Partner |
| `ACR-xxx` | Solo Admin | ACR-001 … ACR-046 | Handbook Admin, backlog CR Admin |

Colonne della tabella CR (Handbook Parent): **ID · Titolo · Area · Prio (P0/P1) · Size (S/M/L/XL) · Owner · Dipendenze · Sprint**. Le dipendenze possono attraversare le liste (es. `CR-051` dipende anche da `Partner PCR-049/050` e `Admin ACR-044/045`) — segno che le tre liste sono collegate ma vanno lette insieme per capire l'impatto cross-portale di una CR.

L'MVP Settembre 2026 cita esplicitamente solo un sottoinsieme delle CR globali (9 ID distinti trovati: cercare `grep -oE "CR-[0-9]{3}" TRAMA_MVP_*.md | sort -u`) — sono le CR che compongono il perimetro bloccante del pilot; le altre CR esistono nell'Handbook ma non sono necessariamente nello scope MVP (vedi README, "Prevalenza documentale", punto 4).

Grep per una CR specifica: `grep -n "CR-009\b" *.md`

## 5. Design Decision (DDL)

Anche qui tre registri paralleli, uno per portale:

| Prefisso | Portale | Range osservato |
|---|---|---|
| `DDL-xxx` | Parent | DDL-001 … DDL-026 |
| `PDDL-xxx` | Partner | PDDL-001 … PDDL-022 |
| `ADDL-xxx` | Admin | ADDL-001 … ADDL-022 |

Ogni DDL/PDDL/ADDL è una riga di tabella con principio, motivazione e alternativa scartata (es. `PDDL-017 | Trust Score interno e non visibile | Evitare effetto pagella e gaming | Score pubblico / guidance positiva`).

Grep: `grep -n "PDDL-005\b" TRAMA_Partner_*.md`

## 6. Business Rule

Non hanno un ID dedicato univoco: sono sezioni `## Business Rules` annidate sotto ciascuna journey (Partner/Admin) o sotto ciascuna pagina audita (Parent, sezioni 5.x). Occorrenze della stringa "Business Rule" per file:

| File | Occorrenze (righe) |
|---|---|
| Handbook Parent | 22 |
| Handbook Partner | 10 |
| Handbook Admin | 10 |
| Implementation Pack | 3 |
| MVP Settembre 2026 | 0 (l'MVP non definisce business rule proprie, rimanda agli Handbook) |

Grep: `grep -n "Business Rule" TRAMA_Admin_*.md`

## 7. Sprint — ATTENZIONE, due numerazioni diverse e non compatibili

1. **Sprint 0–5 (build sequence TRAMA ONE)**: definita nel Master Prompt (`../TRAMA_ONE_Claude_Master_Prompt_v1.0.md`, sezione "FASE B") e nell'Implementation Pack (sezione 7, "Sequenza di implementazione raccomandata"). È la sequenza dei prossimi sprint da eseguire per costruire TRAMA ONE, quella rilevante per il lavoro futuro su questo repository.
2. **Sprint 6–12 ed "Ecosystem S9-S10" (colonna "Sprint" della CR Backlog, Handbook Parent)**: numerazione del backlog prodotto interno all'Handbook Parent, riferita a un piano di sviluppo Parent-side che NON coincide con gli sprint 0-5 del Master Prompt né con la cronologia sprint già eseguita su questo repository (Sprint 1…8 documentati nei commit git del progetto TRAMA/BuddyKids).

Prima di usare la parola "Sprint N" in qualunque comunicazione o commit, specificare sempre a quale delle tre numerazioni ci si riferisce (build TRAMA ONE, backlog Handbook Parent, o cronologia sprint già eseguita sul repository).

## 8. Capability

Valori osservati nella colonna "Area" della CR Backlog (Handbook Parent), usabili come tassonomia di capability cross-portale: *Architecture*, *Supply Acquisition*, *Parent / Engagement*, ed altre — elenco completo con `awk -F'|' 'NR>2408 {print $3}' TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.md | sort -u`. Per la capability map narrativa vedi Handbook Parent, sezione `4. Principi e capability map`.

## 9. Come cercare in queste copie

```bash
# Aprire una CR/PCR/ACR specifica ovunque compaia (definizione + dipendenze incrociate)
grep -rn "CR-009\b" .

# Aprire una journey Partner/Admin per intero (dall'ID fino al prossimo ID)
grep -n "^# PJ" TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.md

# Elencare tutte le Business Rule di un documento
grep -n "Business Rule" TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.md

# Elencare tutte le CR con priorità P0
grep -n "| P0 " TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.md
```
