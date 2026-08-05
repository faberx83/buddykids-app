# TRAMA — Documentation Package Manifest

**Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**As-of timestamp**: 2026-08-05T16:26:14Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `8335d3b920b3694ba0b15cc8be45c17db89dfd0b`

Fabrizio ha richiesto un checkpoint documentale completo (SAL, Requirements Coverage Heatmap, Documentation Package Consolidation) in 19 sezioni. Questo manifest è onesto sullo stato: alcune sezioni sono chiuse in questo passaggio, altre richiedono un lavoro dedicato successivo — elencato esplicitamente sotto, non nascosto.

## File di questo package

| File | Ruolo | Stato | As-of commit | Owner | Dipendenze | Prossimo aggiornamento |
|---|---|---|---|---|---|---|
| `docs/trama-one/analysis/MVP_PRODUCTION_TRUTH_V2.md` | Production Truth (repository/DB/deploy/RC) — normalizzato a una sola fotografia corrente | **Fatto** (§1 Snapshot, §2 Normalizzazione) | `8335d3b` | Claude | — | Ad ogni nuovo deploy confermato o nuova evidenza DB |
| `TRAMA_OPEN_DECISIONS_AND_GAPS.md` (questa cartella) | Registro decisioni/gap aperti, incluso il bug bulk-select segnalato oggi | **Fatto** (§16) | `8335d3b` | Claude | MVP_PRODUCTION_TRUTH_V2.md | Ad ogni item chiuso/aperto |
| `docs/trama-one/analysis/FEATURE_CONTROL_CENTER_SPEC.md` | Spec Feature Control Center | **Fatto** in un passaggio precedente (Addendum Sezione B) — **non ancora aggiornato con la tabella Requisito/Previsto/Implementato/Verificato/Gap richiesta da §12** | `8335d3b` | Claude | — | Vedi §12 sotto |
| `TRAMA_CANONICAL_SOURCE_REGISTER.md` | Inventario fonti canoniche (§3) | **Non fatto** | — | Claude | Lettura integrale di ~8 documenti .docx/.html in `docs/trama-one/` | Prossimo passaggio |
| `TRAMA_MASTER_REQUIREMENT_CATALOG.md` | Catalogo unico requisiti con ID canonici (§4) | **Non fatto** | — | Claude | Source Register | Prossimo passaggio |
| `TRAMA_CANONICAL_RELEASE_MODEL.md` | Mapping release/sprint/roadmap (§5) | **Non fatto** | — | Claude | Master Requirement Catalog | Prossimo passaggio |
| `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md` | Tracciabilità requisito→codice→test→stato (§6) | **Non fatto** | — | Claude | Master Requirement Catalog | Prossimo passaggio |
| `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md` | Heatmap 4 viste (§7-9) | **Non fatto** | — | Claude | Traceability Matrix | Prossimo passaggio |
| `TRAMA_PROJECT_SAL_20260805.md` | Stato avanzamento lavori, 3 schede prodotto (§10-11) | **Non fatto** | — | Claude | Tutti i documenti sopra | Prossimo passaggio |
| `README.md` (questa cartella) | Ingresso unico al package (§14) | **Non fatto** | — | Claude | Tutti i documenti sopra | Prossimo passaggio |
| `TRAMA_DOCUMENTATION_CHANGELOG.md` | Changelog del package (§14) | **Non fatto** | — | Claude | — | Prossimo passaggio |

## Perché non tutto è stato completato in questo passaggio

Le Sezioni 3-11 e 14 richiedono, per essere fatte correttamente (senza inventare requisiti, senza riconciliazioni silenziose — regole esplicite §§4, 17 del checkpoint), la lettura integrale di:

- `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx`
- `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx`
- `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx`
- `TRAMA_ONE_Architecture_Blueprint_v1.0.html`
- `TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx`
- `TRAMA_ONE_Claude_Master_Prompt_v1.0.md`
- `TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx`
- più i documenti già letti in passaggi precedenti (`TRANSITION_REGISTER.md`, `DECISION_LOG.md`, `ASSUMPTION_LOG.md`, `SPRINT_1_FEATURE_PRESERVATION_MATRIX.md`, ecc.)

incrociandoli con l'inventario reale del codice (`FEATURE_INVENTORY_COMPLETE.md`, `lib/feature-registry/catalog.ts`) per assegnare correttamente ogni requisito a `COVERED`/`PARTIAL`/`NOT COVERED`/`IMPLEMENTED_NOT_SPECIFIED`/`SPECIFIED_NOT_FOUND`. Fabbricare questi documenti senza quella lettura produrrebbe esattamente il rischio che il checkpoint stesso vieta: requisiti inventati o classificazioni non verificabili.

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
