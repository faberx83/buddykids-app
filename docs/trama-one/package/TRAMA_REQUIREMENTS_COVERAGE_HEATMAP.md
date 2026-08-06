# TRAMA — Requirements Coverage Heatmap

**Documentation Package**: `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1`
**Package version**: v4 (OD-02 closed — live test PASS) — **supersedes** v3 (`AS_OF_COMMIT 16b0527`)
**As-of timestamp**: 2026-08-06T11:20:00Z (UTC)
**As-of commit (AS_OF_COMMIT)**: `24464bf1c48d4aa5a5f93f9e1b12dd7545103ef5`
**Status**: current

Sezioni 7-9, versione corretta. La v1 usava un'unica percentuale "12 Epic + 31 capability = 43" come KPI primario — errore riconosciuto: Epic e capability si sovrappongono (un epic è realizzato *attraverso* le sue capability), quindi sommarli in un solo denominatore conta lo stesso lavoro due volte. Questa versione separa 4 metriche indipendenti, ciascuna con un proprio denominatore esplicito, e sostituisce la "Vista 3" generica con 3 viste per prodotto (Parent/Partner/Admin) che elencano ogni singolo CR/PCR/ACR.

## Legenda (invariata dalla v1, codici non colori)

| Codice | Significato |
|---|---|
| `LIVE` | Deployato (presunto), verificato staticamente, testato dal vivo, funzionante senza gap noti sull'acceptance criterion |
| `LIVE_WITH_GAP` | Come sopra, ma un componente nominato non soddisfa il proprio acceptance criterion |
| `BUILT` | Implementato e testato staticamente, mai eseguito su un ambiente reale |
| `PARTIAL` | Copertura deliberatamente incompleta |
| `CONFLICT` | Stati contraddittori nelle fonti, non risolto silenziosamente |
| `NSF` | `SPECIFIED_NOT_FOUND` |
| `DEFER` | Fuori scope MVP per corrispondenza esplicita con una categoria OUT-of-scope della fonte |
| `UNASSIGNED` | Release non determinabile dalla fonte, non inventata |

## 1. Epic Health

**Denominatore: 12 Epic.** Nessuna capability inclusa in questo conteggio.

| Stato | Conteggio | % (÷12) |
|---|---:|---:|
| LIVE | 8 | 67% |
| LIVE_WITH_GAP | 1 | 8% |
| BUILT | 1 | 8% |
| PARTIAL | 2 | 17% |

Somma: 8+1+1+2=12. ✓

## 2. MVP Capability Implementation Coverage

**Denominatore: 31 capability** (`P-MVP`+`PT-MVP`+`A-MVP`). Misura `IMPLEMENTED` (codice scritto e funzionante), non `DEPLOYED`/`LIVE_TESTED`.

| Stato IMPLEMENTED | Conteggio | % (÷31) |
|---|---:|---:|
| Sì | 26 | 84% |
| Parziale | 3 | 10% |
| No | 2 | 6% |

Somma: 26+3+2=31. ✓ I 2 "No" sono `A-MVP-05` e `A-MVP-07` (entrambi `SPECIFIED_NOT_FOUND`). **Aggiornamento post-fix OD-02 (06/08/2026, commit `16b0527`)**: `PT-MVP-08` passa da `IMPLEMENTED=Parziale` a `IMPLEMENTED=Sì` (Sì: 25→26, Parziale: 4→3) — il gap bulk "Giornata particolare" è chiuso.

## 3. MVP Production Readiness

**Denominatore: 31 capability**, valutate su `OVERALL_STATUS = LIVE` in senso stretto (deployato-presunto + live-tested + nessun gap) — esclude `LIVE_WITH_GAP`, `BUILT`, `PARTIAL`, `CONFLICT`, `NSF`.

| Prodotto | LIVE | Non-LIVE | Denominatore | % LIVE |
|---|---:|---:|---:|---:|
| Parent | 7 | 2 | 9 | 78% |
| Partner | 6 | 6 | 12 | 50% |
| Admin | 5 | 5 | 10 | 50% |
| **Totale** | **18** | **13** | **31** | **58%** |

**Aggiornamento post-verifica live OD-02 (06/08/2026, deploy `24464bf`)**: `PT-MVP-08` passa da `BUILT` a `LIVE` (Partner LIVE: 5→6, Non-LIVE: 7→6; Totale LIVE: 17→18, 55%→58%) — è la prima e unica riga di questa tabella che cambia in questo passaggio.

Questa è la metrica più severa e la più rilevante per un GO/NO-GO tecnico: misura "quante capability funzionano oggi, dal vivo, senza condizioni", non "quante hanno codice scritto".

## 4. Pilot Validation Coverage

**Denominatore: 31 capability** (tutte richiedono comportamento reale di Parent/Partner/Admin per essere validate secondo l'acceptance criterion della fonte — nessuna esclusione, per scelta metodologica dichiarata).

| Stato PILOT_VALIDATED | Conteggio | % (÷31) |
|---|---:|---:|
| Sì (famiglia/centro pilota reale) | 0 | 0% |
| No | 31 | 100% |

**0%.** Nessuna capability è stata validata da una famiglia o un centro pilota reale — coerente con OD-06/OD-07 (nessun pilota reale ancora arruolato). Questo numero non è un giudizio negativo sul codice: è la fotografia onesta di uno stadio del programma (pre-pilota), non un difetto di implementazione.

## 5. Le 3 viste Roadmap per prodotto (sostituiscono la "Vista 3" generica della v1)

Ogni CR/PCR/ACR ha una riga propria. Colonne: Release (MVP Beta Settembre / UNASSIGNED con motivo — nessuna release Post-Beta/Fase2/Fase3/Post-roadmap è mai stata determinabile dalle fonti lette finora, quindi nessuna riga usa quei valori: dichiarato esplicitamente, non forzato), Implementazione attuale, Evidenza, Decisione/gap.

**Nota di metodo**: per i 60 ID `MVP mapped`, "Implementazione attuale" rimanda all'epic corrispondente (già verificato in `TRAMA_MASTER_REQUIREMENT_CATALOG.md`). Per i 18 `DEFER` e i 70 `ROADMAP_TO_BE`, "Implementazione attuale" è dichiarata `Non verificato in questo passaggio` — per costruzione, non per omissione: verificarli individualmente richiederebbe la stessa profondità di lettura già dichiarata mancante nel Master Requirement Catalog Parte B.

### Parent — tutti i CR-001…052

| ID | Titolo | Release | Implementazione attuale | Evidenza | Decisione/gap |
|---|---|---|---|---|---|
| CR-001 | Definire IA e navigazione primaria TO-BE | MVP Beta Settembre | Vedi epic E02 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E02 | — |
| CR-002 | Creare macro-area "Le mie attività" | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-003 | Rendere Famiglia una capability autonoma | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-004 | Rifocalizzare Profilo su identità e configurazione | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-005 | Integrare Calendario come modalità del Planner | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-006 | Introdurre context object di journey | MVP Beta Settembre | Vedi epic E02 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E02 | — |
| CR-007 | Applicare una shell Next Gen unica a tutte le route target | MVP Beta Settembre | Vedi epic E02 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E02 | — |
| CR-008 | Gestire redirect e deep link delle route Legacy | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-009 | Realizzare dettaglio attività Next Gen | MVP Beta Settembre | Vedi epic E05 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E05 | — |
| CR-010 | Definire content contract del dettaglio attività | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| CR-011 | Integrare disponibilità e capacità nel dettaglio | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| CR-012 | Integrare selezione bambino e verifica idoneità | MVP Beta Settembre | Vedi epic E05 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E05 | — |
| CR-013 | Realizzare booking flow Next Gen | MVP Beta Settembre | Vedi epic E06 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E06 | — |
| CR-014 | Realizzare conferma, riepilogo ed esito prenotazione | MVP Beta Settembre | Vedi epic E06 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E06 | — |
| CR-015 | Aggiornare automaticamente il Planner dopo conferma/cambio booking | MVP Beta Settembre | Vedi epic E07 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E07 | — |
| CR-016 | Contestualizzare Scopri quando aperto dal Planner | MVP Beta Settembre | Vedi epic E02 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E02 | — |
| CR-017 | Standardizzare filtri, ordinamento e stato lista/mappa | MVP Beta Settembre | Vedi epic E05 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E05 | — |
| CR-018 | Ridisegnare gerarchia informativa delle card risultato | MVP Beta Settembre | Vedi epic E05 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E05 | — |
| CR-019 | Uniformare preferiti/salvati tra card, dettaglio e lista | MVP Beta Settembre | Vedi epic E05 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E05 | — |
| CR-020 | Integrare contatto gestore/richiesta contestuale | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-021 | Formalizzare modello di copertura del Planner | MVP Beta Settembre | Vedi epic E07 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E07 | — |
| CR-022 | Unificare stato Organizzazione/Calendario | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-023 | Implementare viste settimana, mese e bambino | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-024 | Chiarire responsabilità e regole della vista Budget | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-025 | Definire collocazione e ownership dei Gruppi | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-026 | Progettare empty state e next best action del Planner | MVP Beta Settembre | Vedi epic E07 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E07 | — |
| CR-027 | Formalizzare domain model Famiglia/Bambino/Membership | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-028 | Implementare inviti, ruoli, scadenza e revoca membership | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-029 | Migrare gestione indirizzi in Famiglia > Logistica | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-030 | Definire contratto travel time e fallback | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Logistica avanzata (travel time real-time) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| CR-031 | Implementare regole promemoria e quiet hours | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Logistica avanzata (reminder/quiet hours) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| CR-032 | Implementare link piano read-only per periodo | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-033 | Implementare scadenza, revoca e rigenerazione share link | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-034 | Migrare elenco prenotazioni Next Gen | MVP Beta Settembre | Vedi epic E07 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E07 | — |
| CR-035 | Realizzare dettaglio prenotazione Next Gen | MVP Beta Settembre | Vedi epic E07 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E07 | — |
| CR-036 | Migrare presenze e collegarle a booking/bambino | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Operations avanzate (presenze giornaliere) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| CR-037 | Migrare richieste in inbox/thread contestuale | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-038 | Migrare Preferiti in Scopri > Salvati | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-039 | Migrare Preferenze Next Gen | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-040 | Migrare Sicurezza Next Gen con re-auth e feedback | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-041 | Migrare Privacy/account lifecycle Next Gen | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-042 | Evolvere segnalazioni in workflow Feedback | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-043 | Standardizzare label, CTA e content design | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| CR-044 | Implementare tassonomia eventi analytics end-to-end | MVP Beta Settembre | Vedi epic E11 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E11 | — |
| CR-045 | Costruire suite Playwright per journey critiche | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| CR-046 | Definire e verificare baseline accessibilità WCAG | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| CR-047 | Standardizzare performance, error handling e dati test | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| CR-048 | Introdurre feature flag e telemetria migrazione Legacy | MVP Beta Settembre | Vedi epic E12/E02 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12/E02 | — |
| CR-049 | Definire/realizzare processo di suggerimento/invito centri non iscritti | MVP Beta Settembre | Vedi epic E09 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E09 | — |
| CR-050 | Industrializzare la floating CTA beta e il workflow di feedback | MVP Beta Settembre | Vedi epic E10 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E10 | — |
| CR-051 | Introdurre attribution, eligibility e reward per il referral di centri | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Referral automatico economico (shadow mode a settembre) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| CR-052 | Mostrare stato referral e reward al Genitore | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Referral automatico economico (dipende da CR-051) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |

### Partner — tutti i PCR-001…050

| ID | Titolo | Release | Implementazione attuale | Evidenza | Decisione/gap |
|---|---|---|---|---|---|
| PCR-001 | Dashboard task-oriented con priorità operative | MVP Beta Settembre | Vedi epic E08 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E08 | — |
| PCR-002 | Wizard onboarding centro | MVP Beta Settembre | Vedi epic E03 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E03 | — |
| PCR-003 | Salvataggio bozza onboarding | MVP Beta Settembre | Vedi epic E03 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E03 | — |
| PCR-004 | Separazione dati pubblici/amministrativi | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-005 | Modello sede come entità autonoma | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-006 | Activity status board | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| PCR-007 | Wizard creazione attività | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| PCR-008 | Versioning attività e audit modifiche | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-009 | Calendario come vista operativa | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-010 | Standard week model | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| PCR-011 | Disponibilità source of truth | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| PCR-012 | Pricing components | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-013 | Unified booking state | MVP Beta Settembre | Vedi epic E06 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E06 | — |
| PCR-014 | Permessi dettaglio prenotazione | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-015 | Coda richieste con SLA | MVP Beta Settembre | Vedi epic E06 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E06 | — |
| PCR-016 | Roster gruppi derivato da booking | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Operations avanzate (gruppi) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| PCR-017 | Integrazione presenze-booking | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Operations avanzate (presenze giornaliere) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| PCR-018 | Messaggistica strutturata | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-019 | Marketplace servizi extra | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Servizi extra (marketplace, solo modello futuro) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| PCR-020 | Regole promozioni | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Promozioni avanzate (dynamic pricing/coupon) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| PCR-021 | Analytics Partner actionable | MVP Beta Settembre | Vedi epic E11 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E11 | — |
| PCR-022 | Ruoli Partner granulari | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-023 | Supporto Partner contestuale | MVP Beta Settembre | Vedi epic E10 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E10 | — |
| PCR-024 | Preview Parent scheda attività | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| PCR-025 | Completezza attività obbligatoria | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| PCR-026 | Alert disponibilità stale | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-027 | Waitlist per attività piene | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-028 | Export operativo prenotazioni | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-029 | Notifiche Partner su nuove richieste | MVP Beta Settembre | Vedi epic E06 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E06 | — |
| PCR-030 | Template comunicazioni famiglia | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-031 | Saturazione settimanale e suggerimenti | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-032 | Gestione servizi propri vs servizi TRAMA | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-033 | Audit trail azioni staff | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-034 | Feature flag beta Partner | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| PCR-035 | Pulizia dati test e demo | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| PCR-036 | Playwright journey Partner | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| PCR-037 | Nuovo ingresso "Diventa Partner TRAMA" ≤2 minuti | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| PCR-038 | Verifica identità minima, fonte pubblica | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| PCR-039 | State machine Partner con permessi/notifiche/storico | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| PCR-040 | Product Walkthrough contestuale e task-based | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| PCR-041 | Persistenza, resume, skip e relaunch tutorial | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| PCR-042 | Checklist profilo e motore di completezza | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| PCR-043 | Trust Score interno 0-100 e storico | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-044 | Pesi Trust configurabili e versionati | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-045 | Layer di suggerimenti positivi e azionabili | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-046 | Partnership Level comportamentali | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Gamification e livelli visibili (Partnership Level) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| PCR-047 | Notification Center cross-state | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| PCR-048 | Audit Log Partner/Admin | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| PCR-049 | Attribuzione referral da CenterLead a Partner | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| PCR-050 | Commissione ridotta condizionata a target qualità/volume | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Referral automatico economico (commission ledger) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |

### Admin — tutti gli ACR-001…046

| ID | Titolo | Release | Implementazione attuale | Evidenza | Decisione/gap |
|---|---|---|---|---|---|
| ACR-001 | Admin command center operativo | MVP Beta Settembre | Vedi epic E08 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E08 | — |
| ACR-002 | Workflow approvazione Partner | MVP Beta Settembre | Vedi epic E03 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E03 | — |
| ACR-003 | Partner 360 | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-004 | Registry centri e lead dedupe | MVP Beta Settembre | Vedi epic E09 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E09 | — |
| ACR-005 | Activity quality workflow | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| ACR-006 | Modifiche governate attività | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-007 | Booking operations queue | MVP Beta Settembre | Vedi epic E06 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E06 | — |
| ACR-008 | Code domanda e supply | MVP Beta Settembre | Vedi epic E08 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E08 | — |
| ACR-009 | Permessi supporto famiglie | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-010 | Commercial ledger | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Pagamenti e finanza (commission ledger reale) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| ACR-011 | Piattaforma servizi extra | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Servizi extra (solo modello futuro) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| ACR-012 | Supplier model | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Servizi extra (dipendenza diretta da ACR-011) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| ACR-013 | Taxonomy governance | MVP Beta Settembre | Vedi epic E04 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E04 | — |
| ACR-014 | Ecosystem analytics | MVP Beta Settembre | Vedi epic E11 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E11 | — |
| ACR-015 | Unified support queue | MVP Beta Settembre | Vedi epic E08 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E08 | — |
| ACR-016 | Beta feedback triage | MVP Beta Settembre | Vedi epic E10 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E10 | — |
| ACR-017 | Configurazione controllata e rollback | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| ACR-018 | Audit log e ruoli Admin | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| ACR-019 | Checklist qualità centro | MVP Beta Settembre | Vedi epic E03 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E03 | — |
| ACR-020 | Reason code richieste integrazione | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-021 | Scoring marketplace health | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-022 | SLA engine richieste/prenotazioni | MVP Beta Settembre | Vedi epic E06 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E06 | — |
| ACR-023 | Lead supply outreach tracking | MVP Beta Settembre | Vedi epic E09 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E09 | — |
| ACR-024 | Center claim process | MVP Beta Settembre | Vedi epic E09 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E09 | — |
| ACR-025 | Cohort beta management | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-026 | Incident management operativo | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-027 | Commission versioning | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Pagamenti e finanza (commission ledger reale) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| ACR-028 | Supplier SLA monitoring | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Servizi extra (dipendenza da ACR-011/012) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| ACR-029 | Data access minimization | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-030 | Admin feature flags | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| ACR-031 | Report settimanale pilot | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-032 | Playwright Admin journeys | MVP Beta Settembre | Vedi epic E12 nel Master Requirement Catalog | Mappato esplicitamente in MVP §6.2 a E12 | — |
| ACR-033 | Data retention policies | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-034 | Cross-portal event catalog | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-035 | Dashboard candidature con card/quick actions/SLA | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| ACR-036 | State machine Partner, permessi, reason code | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| ACR-037 | Modello fonti/documenti verifica futura | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| ACR-038 | Oversight checklist/completezza/first publish | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| ACR-039 | Oversight tutorial progress e re-engagement | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-12 |
| ACR-040 | Trust Score engine interno e history | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-041 | Configurazione pesi/soglie Trust versionata | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10/OD-11 |
| ACR-042 | Partnership Level e ranking governance | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Gamification e livelli visibili (Partnership Level) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| ACR-043 | Notification Center e template stati Partner | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-044 | Referral attribution, dedupe, anti-abuso | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |
| ACR-045 | Reward Genitore e commission incentive | UNASSIGNED — fonte dichiara solo "fuori scope MVP", nessuna fase Post-Beta/Fase2/Fase3 specificata | Non verificato in questo passaggio | Referral automatico economico (shadow mode a settembre) | Nessuna decisione richiesta — corrisponde a categoria esplicitamente fuori scope MVP |
| ACR-046 | Audit esteso per trust/review/livelli/incentivi | UNASSIGNED — non ancora classificato | Non verificato in questo passaggio | Nessuna — non ancora incrociato con lettura narrativa handbook/codice | Gap di classificazione, OD-10 |

## 6. Vista Journey end-to-end (invariata nel metodo, aggiornata con gli stati corretti)

Journey primaria MVP (§2.3): *Partner richiede accesso → verifica identità → Admin approva → walkthrough/checklist → Partner pubblica → Parent scopre un bisogno → invia richiesta → Partner risponde → Planner si aggiorna → Admin monitora*.

| Tappa journey | OVERALL_STATUS (da Master Requirement Catalog) | Note |
|---|---|---|
| Partner richiede accesso | `LIVE_WITH_GAP` (PT-MVP-01) | Funziona, KPI ≤2min mai misurato |
| Verifica identità | `BUILT` (PT-MVP-02) | Meccanismo esiste, nessun run live confermato |
| Admin approva | `LIVE` (A-MVP-02/03) | Candidatura reale revisionata e approvata |
| Walkthrough/checklist | `LIVE` (PT-MVP-05) / `BUILT` (PT-MVP-04) | Walkthrough testato dal vivo da Fabrizio; checklist non confermata live |
| Partner pubblica offerta | `BUILT` (PT-MVP-07) | Nessun run live distinto confermato |
| Parent scopre un bisogno | `LIVE` (P-MVP-01/03/04) | |
| Invia richiesta | `LIVE` (P-MVP-05) | 16 booking reali |
| Partner risponde | `LIVE` (PT-MVP-09) / `LIVE_WITH_GAP` (PT-MVP-12, e-mail) | Risposta sì, notifica e-mail no (`RESEND_API_KEY`) |
| Planner si aggiorna | `LIVE` (P-MVP-06/07) | |
| Admin monitora | `BUILT` (A-MVP-04) | Declassato da `LIVE`: nessuna evidenza di un Admin che consulta davvero l'oversight su un Partner reale |

**Sintesi**: la journey non è uniformemente `LIVE` — 4 delle 10 tappe sono `BUILT` o `LIVE_WITH_GAP`. Questo è più severo e più corretto della sintesi v1 ("LIVE a livello di codice su tutte le 10 tappe"), che confondeva "il codice esiste" con "la tappa è pronta".
