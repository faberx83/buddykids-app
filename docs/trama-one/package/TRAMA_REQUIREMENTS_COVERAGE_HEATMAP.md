# TRAMA — Requirements Coverage Heatmap

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**As-of timestamp**: 2026-08-05T18:40:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `bd03067`

Sezioni 7-9. Quattro viste della stessa base di verità (`TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md`), ciascuna con un denominatore diverso e dichiarato esplicitamente. Legenda non basata solo sul colore (ogni cella porta un codice testuale).

## Legenda (codici, non colori)

| Codice | Significato |
|---|---|
| `LIVE` | In produzione, verificato staticamente, funzionante per il perimetro dichiarato |
| `BUILT` | Codice scritto e funzionante, ma un criterio di accettazione specifico (es. un KPI) non è ancora misurato |
| `PART` | Parziale — infrastruttura esiste, copertura deliberatamente incompleta o sotto-dimensione rispetto al requisito pieno |
| `MOCK` | Funziona solo su dati demo/fallback, non su dati reali |
| `READY_OFF` | Pronto ma spento per tutti (nessuna voce del catalogo usa questo stato oggi) |
| `BLOCK` | Bloccato strutturalmente e volutamente (non temporaneo) |
| `PLAN` | Pianificato, non ancora iniziato |
| `DEFER` | Esplicitamente rinviato a Fase 2/3, fuori scope MVP per regola di prevalenza |
| `NSF` | `SPECIFIED_NOT_FOUND` — richiesto da una fonte canonica, nessuna evidenza di implementazione trovata |
| `INS` | `IMPLEMENTED_NOT_SPECIFIED` — esiste nel codice, nessuna fonte canonica lo richiede esplicitamente (valore aggiunto o debito da giustificare) |
| `N/A` | Fuori perimetro della vista (non applicabile a quel prodotto/quella riga) |
| `CONFLICT` | Fonti in conflitto sullo stato atteso, non risolto silenziosamente (vedi Open Decisions) |

## Vista 1 — Executive (12 epic, sintesi per il management)

| Epic | Stato | Nota in una riga |
|---|---|---|
| E01 Identity/RBAC | `LIVE` | Fondamenta pre-esistenti, estese |
| E02 Journey context | `PART` | Copertura 2/9 punti, deliberata |
| E03 Supply onboarding | `LIVE` | Completo Sprint 1 |
| E04 Canonical catalog | `LIVE` | Completo Sprint 2-3 |
| E05 Discovery/detail | `LIVE` | Completo |
| E06 Request/booking | `LIVE` | State machine unificata Sprint 4 |
| E07 Planner sync | `LIVE` | Completo Sprint 4 |
| E08 Admin queues | `LIVE` | Command Center Sprint 6 |
| E09 Supply acquisition | `LIVE` | CenterLead + candidatura |
| E10 Feedback loop | `LIVE` | Completo |
| E11 Analytics | `PART` | Eventi sì, framework esperimenti no (non richiesto) |
| E12 Quality/flags/E2E | `LIVE` | Feature Control Center completo |

**Calcolo percentuale copertura Executive**: (epic `LIVE`) / (12 epic totali) = 10/12 = **83%**. Regola: `PART` non conta come mezza unità arbitraria — resta segnalato separatamente, non mediato nella percentuale.

## Vista 2 — MVP Settembre (43 unità: 12 epic + 31 capability)

| Fascia | Conteggio | % su 43 |
|---|---|---|
| `LIVE` | 35 | 81% |
| `BUILT` | 1 | 2% |
| `PART` | 6 | 14% |
| `NSF` | 1 | 2% |

Denominatore: 43, fisso,= le unità della Parte A del Master Requirement Catalog. Nessuna unità è stata esclusa dal conteggio per far apparire la percentuale più alta (in particolare `A-MVP-07` resta `NSF`, non riclassificato come `PART` per arrotondare verso l'alto).

Dettaglio per portale:

| Portale | LIVE | BUILT | PART | NSF | Totale |
|---|---|---|---|---|---|
| Parent (9 capability + quota epic) | 8 | 0 | 1 | 0 | 9 |
| Partner (12 capability) | 10 | 1 | 1 | 0 | 12 |
| Admin (10 capability) | 7 | 0 | 1 | 1 | 10 |
| Epic condivisi (12, già contati sopra dove specifici di portale, qui i trasversali) | 10 | 0 | 2 | 0 | 12 |

Nota: la riga "Epic condivisi" e le righe per-portale si sovrappongono parzialmente per costruzione (un epic come E06 è anche alla base di P-MVP-05/PT-MVP-09); il totale 43 della vista principale (non questa scomposizione) resta l'unico numero autorevole per il gate GO/NO-GO — questa tabella per-portale è illustrativa, non un secondo denominatore.

## Vista 3 — Roadmap per prodotto (148 CR/PCR/ACR, TO-BE completo)

| Prodotto | In scope MVP (mappati, §B.1) | Fuori scope MVP dichiarato (`DEFER`) | Non ancora classificato (`ROADMAP_TO_BE`, non `DEFER` né verificato) |
|---|---|---|---|
| Parent (CR-001…052) | 13 | Le capability esplicitamente elencate come OUT OF SCOPE nell'MVP §2.4 (pagamenti, operations avanzate, servizi extra, promozioni avanzate, logistica avanzata, marketplace nazionale, integrazioni complete, trust avanzato/AI, gamification, referral economico automatico) | 26 |
| Partner (PCR-001…050) | 16 | Idem (sottoinsieme corrispondente lato Partner: Trust Score visibile, Partnership Level, marketplace servizi) | 30 |
| Admin (ACR-001…046) | 15 | Idem lato Admin (commercial ledger reale, servizi extra piattaforma, livelli/ranking) | 29 |

**Questa vista non assegna una percentuale di copertura.** Farlo richiederebbe classificare i 104+X ID "non ancora classificato" come coperti o non coperti — esattamente il lavoro dichiarato non fatto (Master Requirement Catalog §B.2). Una percentuale calcolata solo sul sottoinsieme mappato (44/148 = 30%) sarebbe fuorviante: non significa che il 70% del backlog TO-BE sia scoperto, significa che il 70% non è stato verificato in questo passaggio. La cella corretta per l'intera vista 3 resta `CONFLICT`-free ma esplicitamente **non quantificata**, per non produrre un numero che sembri preciso senza esserlo.

## Vista 4 — Journey end-to-end

Journey primaria MVP (§2.3 del documento MVP): *Partner richiede accesso → verifica identità → Admin approva → walkthrough/checklist → Partner pubblica → Parent scopre un bisogno → invia richiesta → Partner risponde → Planner si aggiorna → Admin monitora*.

| Tappa journey | Stato codice | Stato verificato dal vivo |
|---|---|---|
| Partner richiede accesso | `LIVE` | `BUILT` — mai eseguito da un centro pilota reale (solo test tecnico, OD-07) |
| Verifica identità | `LIVE` | `BUILT` — stesso motivo |
| Admin approva | `LIVE` | `BUILT` — stesso motivo |
| Walkthrough/checklist | `LIVE` | `LIVE` — verificato staticamente + E2E parziale |
| Partner pubblica offerta | `LIVE` | `BUILT` — nessuna pubblicazione reale da un centro pilota |
| Parent scopre un bisogno | `LIVE` | `LIVE` |
| Invia richiesta | `LIVE` | `LIVE` |
| Partner risponde | `LIVE` | `LIVE` (16 booking reali con risposta, ma `email_delivery_status` sempre `NULL` — OD-01) |
| Planner si aggiorna | `LIVE` | `LIVE` |
| Admin monitora | `LIVE` | `PART` — Command Center esiste, nessun run di monitoraggio su dati pilota reali (nessun pilota reale ancora arruolato) |

**Sintesi Vista 4**: la journey è **`LIVE` a livello di codice su tutte le 10 tappe**, ma **`BUILT`/non ancora verificata dal vivo end-to-end con un centro e una famiglia reali** su almeno 4 delle 10 tappe. Questo è esattamente l'oggetto delle Golden Journeys (OD-03, ancora aperte) — la heatmap qui non le sostituisce, le rende visibili come gap distinto da un problema di codice.

## Nota di metodo comune alle 4 viste

Nessuna percentuale in questo documento è stata calcolata includendo o escludendo righe per far apparire un numero "più pulito". Ogni percentuale dichiara il proprio denominatore nella riga immediatamente sopra o accanto. Dove un calcolo onesto non è possibile senza lavoro non ancora fatto (Vista 3), non è stato prodotto un numero.
