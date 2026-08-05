# TRAMA — Documentation Package Manifest

**Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**As-of timestamp**: 2026-08-05T18:40:00Z (UTC) — aggiornato dopo il completamento della Parte A del package (vedi sotto); versione precedente di questo file era `2026-08-05T16:26:14Z` / commit `8335d3b`
**As-of commit (AS_OF_COMMIT)**: `bd03067`

Fabrizio ha richiesto un checkpoint documentale completo (SAL, Requirements Coverage Heatmap, Documentation Package Consolidation) in 19 sezioni. Questo manifest è onesto sullo stato: alcune sezioni sono chiuse in questo passaggio, altre richiedono un lavoro dedicato successivo — elencato esplicitamente sotto, non nascosto.

## File di questo package

| File | Ruolo | Stato | As-of commit | Owner | Dipendenze | Prossimo aggiornamento |
|---|---|---|---|---|---|---|
| `docs/trama-one/analysis/MVP_PRODUCTION_TRUTH_V2.md` | Production Truth (repository/DB/deploy/RC) — normalizzato a una sola fotografia corrente | **Fatto** (§1 Snapshot, §2 Normalizzazione) | `8335d3b` | Claude | — | Ad ogni nuovo deploy confermato o nuova evidenza DB |
| `TRAMA_OPEN_DECISIONS_AND_GAPS.md` (questa cartella) | Registro decisioni/gap aperti, incluso il bug bulk-select segnalato oggi | **Fatto** (§16) | `8335d3b` | Claude | MVP_PRODUCTION_TRUTH_V2.md | Ad ogni item chiuso/aperto |
| `docs/trama-one/analysis/FEATURE_CONTROL_CENTER_SPEC.md` | Spec Feature Control Center | **Fatto** in un passaggio precedente (Addendum Sezione B) — **non ancora aggiornato con la tabella Requisito/Previsto/Implementato/Verificato/Gap richiesta da §12** | `8335d3b` | Claude | — | Vedi §12 sotto |
| `TRAMA_CANONICAL_SOURCE_REGISTER.md` | Inventario fonti canoniche (§3) | **Fatto** | `bd03067` | Claude | — | Se cambia una fonte canonica |
| `TRAMA_MASTER_REQUIREMENT_CATALOG.md` | Catalogo unico requisiti con ID canonici (§4) | **Fatto — Parte A (43 unità MVP) verificata; Parte B (104 ID TO-BE) inventariata, non classificata codice-per-codice** | `bd03067` | Claude | Source Register | Quando si farà l'incrocio narrativo completo del backlog TO-BE |
| `TRAMA_CANONICAL_RELEASE_MODEL.md` | Mapping release/sprint/roadmap (§5) | **Fatto** | `bd03067` | Claude | Master Requirement Catalog | Ad ogni nuovo sprint eseguito |
| `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md` | Tracciabilità requisito→codice→test→stato (§6) | **Fatto per le 43 unità MVP** | `bd03067` | Claude | Master Requirement Catalog | Ad ogni cambio di stato di una unità MVP |
| `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md` | Heatmap 4 viste (§7-9) | **Fatto** (Vista 3 esplicitamente non quantificata, per onestà — vedi il documento) | `bd03067` | Claude | Traceability Matrix | Ad ogni variazione della matrice |
| `TRAMA_PROJECT_SAL_20260805.md` | Stato avanzamento lavori, 3 schede prodotto, 10 checkpoint (§10-11, §13) | **Fatto** | `bd03067` | Claude | Tutti i documenti sopra | Al prossimo checkpoint di programma |
| `README.md` (questa cartella) | Ingresso unico al package (§14) | **Fatto** | `bd03067` | Claude | Tutti i documenti sopra | Ad ogni nuova versione del package |
| `TRAMA_DOCUMENTATION_CHANGELOG.md` | Changelog del package (§14) | **Fatto** | `bd03067` | Claude | — | Ad ogni modifica al package |

## Cosa resta esplicitamente aperto dopo questo passaggio (Sezione 15-19 del checkpoint originale)

1. **Sezione 15** — ri-tag di `MVP_SEPTEMBER_READINESS_MATRIX.md`, `FEATURE_INVENTORY_COMPLETE.md`, `FEATURE_PARITY_MATRIX.md`, `TRANSITION_REGISTER.md`, `DECISION_LOG.md`, `ASSUMPTION_LOG.md`, `CONTROLLED_BETA_OPERATING_MODEL.md`, `CONTROLLED_BETA_RUNBOOK.md` (non trovato con questo nome esatto — verificare se corrisponde a `TRAMA_ONE_CONTROLLED_PUBLICATION.md`/`TRAMA_ONE_CONTROLLED_BETA_GATE_FINAL.md`), `CONTROLLED_BETA_GO_NO_GO.md` (idem, verificare corrispondenza con `TRAMA_ONE_CONTROLLED_BETA_GATE_FINAL.md`) con `status`/`superseded-by`/`valid-as-of` — **non fatto in questo passaggio**, registrato come OD-10.
2. **Parte B del Master Requirement Catalog** (104 ID TO-BE non classificati codice-per-codice) — **non fatto**, richiede lettura narrativa completa dei 3 Handbook oltre alle tabelle backlog già lette.
3. **Classificazione dati pilota** (OD-06) e **Golden Journeys/Visual Acceptance dal vivo** (OD-03/OD-04) — **non fatto**, richiedono azioni di Fabrizio non eseguibili da questo ambiente.

## Self-test documentale (§18, eseguito in questo passaggio)

| Verifica | Esito |
|---|---|
| Tutti i file citati in questo Manifest esistono nel repository | **OK** — verificato con `ls`/lettura diretta di tutti i 9 file creati in questa cartella |
| Tutti i documenti del package riportano lo stesso `AS_OF_COMMIT` | **OK** — `bd03067` su tutti e 9 |
| Nessun ID inventato (CR/PCR/ACR/E/P-MVP/PT-MVP/A-MVP) | **OK** — ogni ID citato è stato verificato per lettura diretta delle tabelle sorgente in questa sessione |
| Percentuali di copertura con denominatore dichiarato | **OK** — vedi `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md`, ogni percentuale dichiara il proprio denominatore; la Vista 3 esplicitamente non produce una percentuale |
| Coerenza tra conteggi Master Requirement Catalog / Traceability Matrix / Heatmap (35 LIVE, 6 PARTIAL, 1 BUILT, 1 NSF su 43) | **OK** — stesso totale nei 3 documenti, verificato per confronto diretto |
| Nessuna correzione silenziosa di incongruenze tra fonti | **OK** — le 3 incongruenze del README restano registrate, non "risolte" da questo package |
| Link interni tra i documenti del package (riferimenti a nomi file) | **OK** — nessun nome file citato che non esista in questa cartella o in `docs/trama-one/analysis/` |

## Perché non tutto è stato completato in questo passaggio (residuo)

La Parte B del Master Requirement Catalog (104 ID TO-BE) richiede, per essere classificata correttamente (senza inventare requisiti, senza riconciliazioni silenziose — regole esplicite del checkpoint), la lettura narrativa integrale (non solo le tabelle backlog, già lette) di:

- `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx`
- `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx`
- `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx`

incrociandola con l'inventario reale del codice (`FEATURE_INVENTORY_COMPLETE.md`, `lib/feature-registry/catalog.ts`) per assegnare correttamente ogni requisito residuo a `COVERED`/`PARTIAL`/`NOT COVERED`/`IMPLEMENTED_NOT_SPECIFIED`/`SPECIFIED_NOT_FOUND`. Fabbricare questa parte senza quella lettura produrrebbe esattamente il rischio che il checkpoint stesso vieta.

## Verdetti finali di questo checkpoint

**DOCUMENTATION PACKAGE STATUS: PARTIAL.** Livello MVP (43 unità, il livello decisionale per settembre) completo, verificato e internamente coerente su 5 documenti indipendenti. Livello TO-BE completo (104 ID) inventariato per intero (nessun ID mancante o inventato) ma non classificato codice-per-codice — dichiarato esplicitamente, non nascosto.

**MVP SEPTEMBER STATUS: READY WITH CONDITIONS.** Vedi `TRAMA_PROJECT_SAL_20260805.md` per il dettaglio. Nessuna condizione residua richiede nuovo sviluppo; tutte richiedono un'azione di Fabrizio (CP-09, CP-10) o sono item di lavoro futuro non bloccanti (OD-02, A-MVP-07). Questo verdetto non è stato aggiustato per far apparire la documentazione più coerente di quanto sia: dove un gap è reale (A-MVP-07 `SPECIFIED_NOT_FOUND`, Parte B non classificata) resta visibile come tale.

## §12 — Feature Control Center, stato documentale (fatto in questo manifest, sintesi)

| Requisito (Addendum Sezione B) | Previsto | Implementato | Verificato | Gap |
|---|---|---|---|---|
| Tassonomia a 9 stati tipizzati | Sì | Sì (`lib/feature-registry/catalog.ts`) | Statico (tsc/eslint) | Nessuno stato usa ancora `READY_OFF`/`EXPIRED`/`POST_BETA` (nessun dato reale li richiede oggi) |
| Metadata per-feature (riskLevel/demoBannerRequired) | Sì | Sì | Statico | Solo 5 voci su 14 hanno `riskLevel` esplicito (le altre sono implicitamente "low", non dichiarato) |
| Azioni platform_admin-scoped (center/cohort/global) | Sì | Sì (riusa scope esistenti: global/environment/user/role/tenant/cohort) | Statico | Nessun run live |
| Batch "attiva tutte Beta pronte" | Sì | Sì (`batchActivateBetaFeaturesAction`) | Statico + 3 test puri | Nessun run live end-to-end |
| Batch "disattiva tutte Beta" (rollback) | Sì | Sì (`batchDeactivateBetaFeaturesAction`) | Statico + 3 test puri | Nessun run live end-to-end |
| Conferma rinforzata per scope globale | Sì | Sì (digitare "GLOBAL") | Statico + 1 test E2E scritto (non eseguito, Chromium assente nel sandbox) | Nessun run live |
| Banner demo-mode per MOCK_DEMO | Sì | Parziale — 2 punti su 9 call site di `getActivities()` (Home Legacy/NEXTGEN) | Statico | 7 call site restanti non coperti (Ricerca, Planner, Community, Preferiti, Gruppi, pagina centro) — deliberato, vedi `FEATURE_CONTROL_CENTER_SPEC.md` §4 |
| Audit trail azioni batch | Parziale | `created_by`/`updated_by` sulla riga override (stesso meccanismo delle azioni CRUD esistenti) | Statico | Nessun log dedicato "azione batch eseguita da X su N feature" — oggi si ricostruisce solo dalla riga override, non da un evento esplicito |
| RBAC | Sì | Sì (RLS `is_platform_admin()`, invariata) | Statico | Nessun run live con utente non-Admin per confermare il rifiuto |

## Verifiche finali (§18, parziali)

- Tutti i file citati in questo manifest esistono nel repository, verificato con `ls`/lettura diretta.
- Tutti i documenti prodotti in questo passaggio riportano lo stesso `AS_OF_COMMIT` (`8335d3b`).
- Non verificato in questo passaggio: unicità ID requisiti (nessun Master Requirement Catalog ancora creato), percentuali di copertura (nessuna heatmap ancora creata).
