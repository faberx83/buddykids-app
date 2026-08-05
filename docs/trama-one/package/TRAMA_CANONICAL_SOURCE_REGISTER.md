# TRAMA — Canonical Source Register

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**As-of timestamp**: 2026-08-05T18:40:00Z (UTC) / 2026-08-05 20:40 (Europe/Rome)
**As-of commit (AS_OF_COMMIT)**: `bd03067` (HEAD al momento della lettura integrale delle fonti per questo documento; nessuna modifica al repository è avvenuta durante la lettura)

Sezione 3 del checkpoint SAL/Documentation Package. Inventario di tutte le fonti che governano TRAMA ONE, il loro ruolo, la loro prevalenza reciproca e le incongruenze note tra di esse. Non ridefinisce nulla di nuovo: consolida in formato package `docs/trama-one/README.md`, `docs/trama-one/derived/SOURCE_REGISTER.md` e `docs/trama-one/derived/INDEX.md`, già esistenti e verificati in un passaggio precedente (20/07/2026) — questo documento aggiunge il tag `AS_OF_COMMIT` richiesto dal checkpoint e la vista consolidata a un unico posto.

## 1. Le 8 fonti, in ordine di prevalenza

| # | Fonte | Tipo | Ruolo | Canonica o derivata |
|---|---|---|---|---|
| 1 | Repository e database (`buddykids-app_v1`, progetto Supabase `eagsgfxunwyyxwwilldy`) | Codice/schema/dati | Verità dell'AS-IS tecnico — nessun documento la sostituisce | Fonte primaria, non un documento |
| 2 | `TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx` | Documento normativo | Scope, critical path e sequenza di lancio (28/09/2026) | Canonica (originale `.docx`) |
| 3 | `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx` (Handbook Parent) | Documento TO-BE | Architettura, journey e CR/DDL Parent | Canonica |
| 4 | `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx` (Handbook Partner) | Documento TO-BE | Architettura, journey e PCR/PDDL Partner | Canonica |
| 5 | `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx` (Handbook Admin) | Documento TO-BE | Architettura, journey e ACR/ADDL Admin | Canonica |
| 6 | `TRAMA_ONE_Architecture_Blueprint_v1.0.html` | Rappresentazione visuale | Vista condivisa di architettura/processi/stati/schermate | Canonica (nativa HTML) |
| 7 | `TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx` + `TRAMA_ONE_Claude_Master_Prompt_v1.0.md` | Metodo di lavoro | Gerarchia fonti, vincoli non negoziabili, output Fase A, template sprint, quality gate/DoD | Canoniche (rispettivamente `.docx` e `.md` nativo) |
| 8 | Product Requirements e sitemap storiche | Evidenza di supporto | Contesto, non prevalente | Non normativa |

Copie derivate in Markdown (`docs/trama-one/derived/*.md`) esistono per le fonti #2-5 e #7, generate con `pandoc -f docx -t gfm`, verificate byte-per-byte (SHA-256 dell'originale registrato) — usate **solo per ricerca full-text**, mai come riferimento normativo in caso di dubbio (regola 9 del README).

## 2. Regola di prevalenza in sintesi

1. Repository/DB > tutto: nessun documento stabilisce cosa esiste davvero oggi.
2. MVP Settembre 2026 > roadmap TO-BE: se una capability è esplicitamente fuori scope o dietro flag/shadow mode nell'MVP, non entra nella beta indipendentemente da quanto dettagliata sia negli Handbook.
3. Handbook aggiornati (Parent 1.2, Partner 1.1, Admin 1.1) > requisiti isolati o bozze precedenti.
4. Blueprint = rappresentazione visuale, non prevale su repository/Handbook in caso di divergenza.
5. Ambiguità non risolvibile con queste regole → Assumption Log, mai una decisione autonoma definitiva.

## 3. Incongruenze note tra fonti (non risolte, per costruzione)

Riportate identicamente al README (nessuna correzione autonoma è nel mandato):

1. **Versioni Handbook citate nell'MVP non coincidono con quelle consegnate.** L'MVP dichiara base "Parent 1.1, Partner 1.0, Admin 1.0"; le versioni reali in cartella sono Parent **1.2**, Partner **1.1**, Admin **1.1**. Non è specificato se l'MVP v1.1 incorpori già i contenuti aggiunti nelle revisioni successive (es. referral incentives, Parent 1.2).
2. **Versionamento asimmetrico tra Handbook**: Parent 1.2 vs Partner/Admin 1.1, senza indicazione se le novità Parent abbiano un corrispettivo pianificato lato Partner/Admin.
3. **Campo "Data" assente** nelle testate di Partner e Admin (presente in MVP e Parent).

## 4. Identificativi canonici — dove si trovano, non riprodotti qui

Per evitare duplicazione (e il rischio di trascrizione errata su ~150 ID), questo registro punta alle tabelle sorgente invece di copiarle; la lista completa classificata rispetto al codice è nel `TRAMA_MASTER_REQUIREMENT_CATALOG.md` di questo stesso package.

| Prefisso | Ambito | Range osservato | Fonte esatta |
|---|---|---|---|
| `CR-xxx` | Parent, cross-portale | CR-001…CR-052 | Handbook Parent, `## 11. Change Request Backlog` |
| `PCR-xxx` | Partner | PCR-001…PCR-050 | Handbook Partner, `# Backlog Change Request` |
| `ACR-xxx` | Admin | ACR-001…ACR-046 | Handbook Admin, `# Backlog Change Request` |
| `DDL-xxx` | Parent, design decision | DDL-001…DDL-026 | Handbook Parent |
| `PDDL-xxx` | Partner, design decision | PDDL-001…PDDL-022 | Handbook Partner, `# Design Decision Log` |
| `ADDL-xxx` | Admin, design decision | ADDL-001…ADDL-022 | Handbook Admin |
| `PJ01`…`PJ10` | Journey Partner | 10 journey | Handbook Partner, `3. Journey e processi Partner` |
| `AJ01`…`AJ10` | Journey Admin | 10 journey | Handbook Admin, `3. Journey e processi Admin` |
| `E01`…`E12` | Epic MVP cross-portale | 12 epic | MVP Settembre 2026, `6.1 Dodici epic cross-portale` |
| `P-MVP-01`…`09` | Capability Parent MVP | 9 capability | MVP Settembre 2026, `4.1 Parent MVP` |
| `PT-MVP-01`…`12` | Capability Partner MVP | 12 capability | MVP Settembre 2026, `4.2 Partner MVP` |
| `A-MVP-01`…`10` | Capability Admin MVP | 10 capability | MVP Settembre 2026, `4.3 Admin MVP` |

Grep rapidi già documentati in `docs/trama-one/derived/INDEX.md` (sezioni 4-6) — non ripetuti qui.

## 5. Sprint — tre numerazioni non compatibili (promemoria vincolante)

Ribadito da `INDEX.md` §7, vincolante per ogni documento di questo package:

1. **Sprint 0-5 build TRAMA ONE** (Master Prompt/Implementation Pack) — sequenza raccomandata dal metodo di lavoro.
2. **Sprint 6-12 + "Ecosystem S9-S10"** — numerazione del backlog CR/PCR/ACR interno agli Handbook (colonna "Sprint" delle tabelle backlog), riferita a un piano Parent/Partner/Admin-side.
3. **Sprint 0-6 + "Addendum Sezioni A-E" + "SAL Checkpoint"** — la cronologia reale già eseguita su questo repository (commit git), che non coincide numericamente con nessuna delle due sopra.

Il `TRAMA_CANONICAL_RELEASE_MODEL.md` di questo package mappa esplicitamente le tre numerazioni tra loro.

## 6. Stato di verifica di questo registro

- Le 7 fonti documentali sono state rilette integralmente (handbook Parent/Partner/Admin, MVP, Master Prompt, Implementation Pack) o silenziosamente meno rilevanti per questo registro (Blueprint, già letto in un passaggio precedente, contenuto visuale non testuale).
- Nessuna nuova incongruenza è stata trovata oltre alle 3 già registrate nel README.
- Nessun ID è stato inventato: ogni ID citato nei documenti di questo package proviene da una delle tabelle sopra, verificata da lettura diretta in questa sessione.
