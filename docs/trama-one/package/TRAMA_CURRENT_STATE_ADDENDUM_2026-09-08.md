# TRAMA — Current State Addendum — 08/09/2026

**Tipo di documento**: ADDENDUM, non sostituzione. Il package `TRAMA_DOCUMENTATION_PACKAGE_20260805_v1` (v4, as-of `2026-08-06T11:20:00Z`, commit `24464bf`) resta il documento di riferimento per il modello di stato a 7 dimensioni, le 4 metriche di copertura e i 3 verdetti separati. Questo addendum non li ricalcola: registra COSA È CAMBIATO nel repository tra il 06/08/2026 e l'08/09/2026 (oltre un mese di lavoro, ~70 voci di task tracciate) e QUALE PARTE del package v4 è oggi stale di conseguenza — in modo che chi fa l'audit sappia esattamente dove il v4 è ancora affidabile e dove non lo è più.

**As-of timestamp**: 2026-09-08T11:08:17Z (UTC)
**As-of commit (repository)**: `46af2a3` (branch `main`)
**As-of commit (produzione, verificato via `deploy_events`)**: `a30bcc6` — **produzione è INDIETRO di 6 commit rispetto al repository** (vedi Sezione 3). Tutto il lavoro descritto dalla Sezione 6 in poi (Dashboard Partner, Il mio centro, onboarding carousel) esiste nel codice ma NON è ancora servito agli utenti reali.
**Autore**: sessione Claude (Cowork), su richiesta di Fabrizio Pirulli. Nessuna riga di questo documento implementa o corregge codice applicativo — puramente descrittivo, stesso principio del package v4 (README.md, "Cosa NON è questo package").
**Stato**: current

---

## Indice

1. Perché questo addendum esiste
2. Come leggerlo insieme al package v4
3. Stato repository vs produzione (verificato)
4. Stato feature flag `TRAMA_ONE_ENABLED` (verificato)
5. Metodologia: come sono state raccolte le informazioni sotto
6. Changelog per dominio — Genitore/Planner (già in v4, solo delta minori)
7. Changelog per dominio — Gestore/Partner: prenotazioni e disponibilità
8. Changelog per dominio — Check-in e presenze
9. Changelog per dominio — Promemoria partenza (nuova feature, post-v4)
10. Changelog per dominio — Servizi extra prenotazione (nuova feature, post-v4)
11. Changelog per dominio — Dashboard Gestore (redesign strutturale, post-v4)
12. Changelog per dominio — "Il mio centro" (nuovo layer, post-v4)
13. Changelog per dominio — Onboarding (carousel Parent rinnovato + carousel Partner nuovo + replay)
14. Changelog trasversale — Osservabilità/telemetria
15. Changelog trasversale — UI/UX legacy cleanup
16. Gap noti confermati ancora aperti (invariati rispetto a v4)
17. Gap nuovi emersi durante questo periodo
18. Gap chiusi rispetto a v4
19. Stato migration database (elenco, nessuna applicata da questa sessione)
20. Stato copertura test Playwright (delta)
21. Mappa di staleness dei documenti del package v4
22. Cosa NON è stato fatto (limiti espliciti di questo addendum)
23. Collegamento al Final Audit (Sezione 40-47 dello spec Partner Daily Workspace)
24. Come aggiornare questo addendum in futuro

---

## 1. Perché questo addendum esiste

Fabrizio ha chiesto una sessione di audit di prodotto (08/09/2026) e, nello stesso scambio, una wave finale di implementazione ("FINAL PRE-FREEZE IMPLEMENTATION WAVE") su Dashboard Partner, "Il mio centro" e onboarding. Il package v4 esistente è fermo al 06/08/2026: usarlo da solo per un audit oggi darebbe una fotografia sbagliata su almeno tre aree strutturalmente cambiate (Dashboard, Il mio centro, onboarding) e ignorerebbe interamente altre quattro feature complete nel frattempo (Promemoria partenza reali, Servizi extra prenotazione, Check-in push, disponibilità back-in-stock push). Riscrivere da zero tutti gli 11 documenti del package v4 in questa sessione avrebbe richiesto di ricostruire manualmente conteggi/metriche a 7 dimensioni per ~70 voci di lavoro senza gli stessi strumenti di verifica a script usati per produrre il v4 (vedi `TRAMA_DOCUMENTATION_QA_REPORT.md`) — un rischio concreto di introdurre proprio l'inconsistenza numerica che il QA Remediation del v4 era nato per eliminare. Questo addendum sceglie quindi la via onesta: non tocca i numeri del v4, li supera con un changelog verificabile e una mappa esplicita di cosa è stale.

## 2. Come leggerlo insieme al package v4

Leggere prima `docs/trama-one/package/README.md` (punto di ingresso del v4), poi questo addendum. Ovunque questo addendum dichiari un delta rispetto a un documento del v4 (Sezione 21), quel documento resta la fonte per tutto ciò che NON è stato toccato dal delta.

## 3. Stato repository vs produzione (verificato)

Verificato via query SQL diretta (sola lettura) su `deploy_events`, tabella applicativa che registra ogni deploy Vercel (vedi `internal/deploy-notify`):

| commit | esito | quando (UTC) |
|---|---|---|
| `a30bcc6` | ok | 2026-09-07 13:35:45 |
| `a30bcc6` | ko (tentativo precedente) | 2026-09-07 13:28:05 |
| `06df5d9` | ok | 2026-09-06 19:13:40 |

Il repository ha oggi HEAD `46af2a3`, 6 commit dopo `a30bcc6`:
`23d31e8` (redesign Dashboard), `02b53d7` (rifinitura Dashboard, regola stato positivo singolo), `c51b9ce` ("Il mio centro" header+riepilogo), `a5d172f` (carousel Parent rinnovato + replay), `853be2f` (carousel Partner nuovo + replay), `46af2a3` (test mirati Dashboard/Il mio centro/onboarding Partner).

**Implicazione per l'audit**: nessuna delle feature descritte nelle Sezioni 11-13 di questo addendum è oggi osservabile in produzione. Sono verificate staticamente (tsc/eslint/build puliti ad ogni commit, vedi Sezione 20) ma non ancora da un utente reale. Il deploy resta, per policy di questa sessione, un'azione che solo Fabrizio esegue.

## 4. Stato feature flag `TRAMA_ONE_ENABLED` (verificato)

Verificato via query SQL diretta su `feature_flag_overrides`:

| scope | valore | enabled | scadenza |
|---|---|---|---|
| global | — | `false` | (scaduto 2026-08-03, mai riattivato) |
| cohort | `trama-one-controlled-beta` | `true` | 2026-10-02 |
| role | `platform_admin` | `true` | mai |

Nessun cambiamento rispetto allo stato fotografato nel pre-flight di questa sessione (Sezione 166 del task-log interno). **Tutto** ciò che dipende da questo flag — entrambi i carousel di onboarding, entrambi i tour guidati, lo Spotlight Partner/Parent — resta visibile SOLO alla Controlled Beta Cohort e a `platform_admin`, mai al pubblico generale. Questo è un limite di prodotto REALE e documentato, non un difetto introdotto da questa wave.

## 5. Metodologia

Le sezioni 6-15 sono state ricostruite leggendo i messaggi di commit reali (`git log`) e i commenti in-code datati che li accompagnano (pattern già in uso in questo repository: ogni cambiamento non ovvio porta un commento con data e motivazione, vedi `CLAUDE.md`), incrociati con la cronologia dei task tracciati in questa sessione. Non è stato eseguito alcun ricalcolo delle 4 metriche di copertura del v4 (Epic Health, MVP Capability Implementation Coverage, MVP Production Readiness, Pilot Validation Coverage): richiederebbe lo stesso script di verifica usato per il v4, non ricostruibile in modo affidabile da questa sessione nel tempo disponibile — dichiarato come limite esplicito in Sezione 22, non nascosto.

## 6. Changelog — Genitore/Planner

Nessun cambiamento strutturale rispetto al v4 in quest'area nel periodo coperto da questo addendum, oltre a quanto già coperto dalle Sezioni 7-10 (che toccano prenotazioni/check-in visti anche dal lato Genitore) e al rinnovo del carousel di onboarding (Sezione 13). Il Planner Beta v1.1/v1.1.1 descritto nel v4 resta la fonte corretta per quest'area.

## 7. Changelog — Gestore/Partner: prenotazioni e disponibilità

- Race-condition sulla capacità in fase di accettazione richiesta, chiusa.
- Banner "Solo N posti" allineato alla disponibilità reale invece che a un conteggio statico.
- Roster check-in reso cross-portale (Partner + Genitore) via `booking_days`, non più due fonti divergenti.
- Footer "Stato prenotazione" lato Partner: mostrava `bookings.status` grezzo (quasi sempre "Confermata" per via del pagamento demo) invece della risposta operativa del centro (`partnerDecision`) — corretto, stesso principio riapplicato poi alla Dashboard (Sezione 11).
- Età come filtro hard nello smart matching (non più solo un suggerimento visivo).
- Disponibilità "torna disponibile" (0→>0 posti): push event-driven ai genitori interessati, basata su segnali di raccomandazione reali — non un cron a tappeto.

## 8. Changelog — Check-in e presenze

- Push di promemoria check-in lato Genitore: riusa la finestra "actionable" già esistente, nessuna nuova UI.
- Cron `checkin-reminders`: aggiunto un evento di audit trail (`checkin_push_cron_run`) dopo che un 401 in produzione (CRON_SECRET mancante su Vercel) era passato inosservato per assenza di osservabilità — diagnosticato da questa sessione via `deploy_events` + screenshot Vercel forniti da Fabrizio, corretto da Fabrizio lato Vercel (fuori dal perimetro di questa sessione), verificato via query Supabase il giorno dopo: il cron ha effettivamente sparato con successo (08/09/2026, 08:22 UTC).
- Registro presenze: indicazione visiva di quali righe hanno un check-in genitore da confermare.

## 9. Changelog — Promemoria partenza (nuova feature)

Prima di questo periodo, "Promemoria" era UI senza persistenza reale. Aggiunta: migration additiva `travel_reminders`, data layer + server action dedicati, cron di invio push alla partenza, `PromemoriaClient` riscritto per leggere/scrivere dati reali invece di uno stato locale.

## 10. Changelog — Servizi extra prenotazione (nuova feature)

Prima di questo periodo, i servizi extra (es. mensa) non erano selezionabili in fase di prenotazione. Aggiunta: migration additiva (colonne su `bookings` + `activities.meal_price_extra`), capability probe nel data layer, nuovo step "Servizi" nel wizard di prenotazione (`BookingClient`/`StepIndicator`), persistenza della selezione e dell'importo nella server action di creazione prenotazione, campo prezzo extra mensa nei form attività lato Gestore, visualizzazione dei servizi scelti su entrambi i portali.

## 11. Changelog — Dashboard Gestore (redesign strutturale)

Commit `23d31e8` + `02b53d7`, sez. 1-9 della spec "Partner Daily Workspace" (08/09/2026), **non ancora in produzione** (Sezione 3). Riepilogo:

- Nuovo blocco "Oggi al centro" (presenze attese/registrate oggi, check-in da confermare, giornate speciali delle attività) — condizionale, scompare se non c'è segnale per oggi (regola "NO SIGNAL → NO CARD").
- Nuova riga "Collegamenti rapidi" (Report presenze, Promozioni con badge "in scadenza" condizionale, Servizi consigliati, Inviti) — sempre visibile, link reali verso pagine già esistenti, nessuna nuova route.
- Regola "stato positivo singolo": quando non c'è alcun segnale per oggi, un solo banner neutro ("Tutto sotto controllo per oggi.") invece di zero feedback o più banner.
- Griglia KPI spostata più in basso nella pagina, con trend settimanale ("+N questa settimana") su 2 delle 6 card (Fatturato confermato, Prenotazioni in attesa) — le altre 4 KPI restano senza trend perché un raffronto temporale non è significativo per quei valori.
- Rimosso il vecchio banner ridondante "N promo attive" in fondo pagina (stessa informazione ora nella card "Promozioni" dei Collegamenti rapidi).
- **Regressione di test trovata e corretta nella stessa sessione**: i test Playwright preesistenti (`tests/gestore/dashboard.spec.ts`, TC-072/TC-120/TC-121) erano stati resi obsoleti da questo redesign (testavano "Promo attive"/"Occupazione settimanale"/"Attività recente", tutti rimossi) senza mai essere aggiornati — corretto in questo stesso ciclo, vedi Sezione 20.

## 12. Changelog — "Il mio centro" (nuovo layer)

Commit `c51b9ce`, sez. 10-15 della stessa spec, **non ancora in produzione**. "Il mio centro" resta un form di configurazione (`CenterProfileClient`, invariato) — aggiunto sopra un layer di orientamento, non una seconda dashboard:

- Header con nome/città/stato onboarding reali + CTA condizionale "Vedi come ti vedono le famiglie", che punta alla prima attività pubblicata reale del centro (mai una preview finta: **confermato via audit che non esiste alcuna route pubblica dedicata al centro in sé** — un centro è visibile alle famiglie solo indirettamente, dentro la pagina di una sua attività pubblicata; gap documentato, non aggirato con codice finto).
- Riepilogo configurazione: 4 card (Attività/Promozioni/Servizi/Profilo) con conteggi reali e link reali verso le pagine che gestiscono davvero ciascuna sezione.
- Stato "Profilo" (Completo/Da completare): binario onesto calcolato LIVE sui campi reali del centro — deliberatamente NON riusa il checklist item `profile_complete` esistente (quello è una spunta manuale del wizard onboarding, non ricalcolata se il gestore svuota un campo dopo — sarebbe stato un dato fuorviante).

## 13. Changelog — Onboarding

Commit `a5d172f` + `853be2f`, sez. 16-27 della stessa spec, **non ancora in produzione**, e comunque dietro `TRAMA_ONE_ENABLED` (Sezione 4) come tutto l'onboarding di questo prodotto:

- Copy del carousel Parent (`lib/nextgen/onboarding-slides.ts`) sostituita integralmente — 5 slide, testi definitivi di questa wave.
- Carousel Partner (`lib/center/onboarding-slides.ts`, `components/center/OnboardingCarousel.tsx`) — **prima inesistente**: esisteva solo il tour guidato "dove cliccare" (`activity_creation_partner`), mai un "perché TRAMA serve" per il Partner. 4 slide nuove, stesso motore di persistenza Walkthrough già esistente (un solo step sentinella "carousel" del nuovo tutorial `partner_beta_onboarding`, nessuna nuova migration).
- Punto di REPLAY per entrambi i profili, prima assente: bottone "Rivedi introduzione TRAMA" in Preferenze, sia Genitore (`/nextgen/profile/impostazioni/preferenze`) sia Gestore (`/center/account/preferenze`, accanto al tour guidato preesistente, invariato). `WalkthroughRestartButton` generalizzato con prop opzionali per supportare copy diversa per ciascun caso d'uso, zero regressioni sul chiamante Partner preesistente (default = testo originale identico).
- `revalidateAllWalkthroughPortals()` esteso per coprire anche `/nextgen` e `/center` (prima solo le shell `/one*`), necessario perché un "Riavvia" da Preferenze avesse effetto affidabile sulle vere route Dashboard.

## 14. Changelog trasversale — Osservabilità/telemetria

Evento `checkin_push_cron_run` (Sezione 8). Nessun altro cambiamento di infrastruttura di telemetria in questo periodo oltre a quanto già in v4.

## 15. Changelog trasversale — UI/UX legacy cleanup

Nessun nuovo intervento di cleanup legacy strutturale in questo periodo oltre a quanto già chiuso e documentato nel v4 (Fix background globale, Nextgen mode per Modifica prenotazione, ecc.).

## 16. Gap noti confermati ancora aperti (invariati rispetto a v4)

- Nessuna route pubblica dedicata `/centro/[slug]` (confermato via audit in Sezione 12, non solo assunto).
- `TRAMA_ONE_ENABLED` resta OFF globalmente — tutto l'onboarding (entrambi i carousel, entrambi i tour, entrambi i replay) è visibile solo alla Controlled Beta Cohort e a `platform_admin` (Sezione 4).
- Gli 88 ID `DEFER`+`ROADMAP_TO_BE` del backlog Handbook completo restano non coperti codice-per-codice (dichiarato in v4, non riverificato qui).
- OD-15 (menu "Scatta foto" su Profilo, mobile) — stato invariato rispetto a quanto registrato in v4, non toccato da questa sessione.

## 17. Gap nuovi emersi durante questo periodo

- **Produzione dietro di 6 commit** rispetto al repository (Sezione 3) — non un bug, ma un fatto operativo che chiunque faccia l'audit su un ambiente live deve conoscere: ciò che descrivono le Sezioni 11-13 non è oggi osservabile fuori da questa sessione.
- Regressione di test causata dal redesign Dashboard, trovata e corretta nella stessa sessione (Sezione 11, dettaglio in Sezione 20) — non un gap residuo, ma degno di nota per chi verifica la cronologia dei commit.

## 18. Gap chiusi rispetto a v4

- OD-02 (Calendario disponibilità Partner) — già CLOSED nel v4 stesso (06/08/2026), non riaperto.
- Nessun altro Open Decision del v4 risulta chiuso da lavoro di questo periodo: le feature nuove (Sezioni 7-13) rispondevano a segnalazioni dirette di Fabrizio successive al 06/08, non erano tra gli Open Decisions elencati nel v4.

## 19. Stato migration database

Migration additive introdotte in questo periodo (tutte applicate da Fabrizio, mai da questa sessione — regola di governance invariata):

- `travel_reminders` (Promemoria partenza, Sezione 9)
- colonne servizi extra su `bookings` + `activities.meal_price_extra` (Sezione 10)
- `migration_35` (Sezione 143-145 del task-log interno: regole quantitative attendance) — applicata, statistiche aggiornate di conseguenza.

Nessuna migration è stata scritta o applicata per il lavoro descritto nelle Sezioni 11-13 (Dashboard/Il mio centro/onboarding): tutto riuso di tabelle/funzioni già esistenti, per costruzione (vedi commenti in-code citati nelle rispettive sezioni).

## 20. Stato copertura test Playwright (delta)

- `tests/gestore/dashboard.spec.ts`: 3 test preesistenti riallineati al markup post-redesign (Sezione 11) + 10 nuovi test `DASH-P-01..10`.
- `tests/gestore/profilo-centro.spec.ts`: 6 nuovi test `CENTER-P-01..06`.
- `tests/nextgen/onboarding-carousel.spec.ts`: riallineato alla nuova copy Parent + 1 nuovo test di replay (`ONB-P13`).
- `tests/gestore/onboarding-carousel-partner.spec.ts` (nuovo file): 6 test `ONB-C-01..06`.
- Verifica eseguita in questa sessione: `tsc --noEmit` pulito, `eslint` pulito (solo warning preesistenti non toccati), `npm run build` pulita, subset `[no browser]` di tutti i file sopra eseguito con `npx playwright test` — 20/20 passato. I test gated `isRealDeployment` (che richiedono un browser reale + un deploy Supabase configurato) non sono eseguibili in questo sandbox per assenza di librerie di sistema (limite dell'ambiente, non un fallimento logico) — **restano da eseguire da Fabrizio contro un ambiente reale prima di considerarli PASS**, esattamente come ogni altro test dello stesso tipo già presente nella suite.

## 21. Mappa di staleness dei documenti del package v4

| Documento | Stale per via di | Severità |
|---|---|---|
| `TRAMA_MASTER_REQUIREMENT_CATALOG.md` | Nuove feature Sezioni 9-13 non hanno un ID CR/PCR/ACR assegnato | Media — nessun requisito v4 esistente è diventato falso, solo incompleto |
| `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md` | Idem, nessuna riga per il codice nuovo | Media |
| `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md` | Le 4 metriche non includono il lavoro post-06/08 | Media — sottostima la copertura reale, non la sovrastima |
| `TRAMA_PROJECT_SAL_20260805.md` | Scorecard Partner non riflette Dashboard/Il mio centro/onboarding | Alta per chi legge solo questo file senza l'addendum |
| `TRAMA_OPEN_DECISIONS_AND_GAPS.md` | Non include i gap nuovi di Sezione 17 | Bassa — nessun gap esistente è stato invalidato |
| `TRAMA_DOCUMENTATION_CHANGELOG.md` | Risolto — voce aggiunta in cima al file, append-only, in questa stessa sessione | — |
| Tutti gli altri file di `package/` (Manifest, QA Report, Source Register, ID Reconciliation, Canonical Release Model, OD02 procedure) | Nessun impatto sostanziale: descrivono processo/struttura, non feature specifiche | Nessuna |

Nessun documento del v4 contiene un'affermazione oggi FALSA (es. "la Dashboard non ha KPI") — sono INCOMPLETI (non menzionano cosa è stato aggiunto dopo), distinzione importante per chi fa l'audit.

## 22. Cosa NON è stato fatto (limiti espliciti di questo addendum)

- Non sono stati riscritti i file numerici del v4 (Master Requirement Catalog, Traceability Matrix, Coverage Heatmap, SAL) con nuovi ID/righe/metriche: avrebbe richiesto ricostruire manualmente lo stesso rigore a script del QA Remediation v4, rischiando di introdurre proprio l'errore di conteggio che quel QA Remediation esisteva per eliminare. Il changelog verificabile sopra (Sezioni 6-15) è la via scelta al suo posto.
- Non sono stati ricalcolati i 3 verdetti finali del v4 (Documentation Package Status / MVP Implementation Readiness / September Launch Decision): richiede lo stesso ricalcolo a 4 metriche di cui sopra.
- Il verdetto readiness per le 4 fasi di lancio richiesto dall'audit di oggi (sez. 40-47 della spec Partner Daily Workspace) è materia del Final Audit separato (Sezione 23), non di questo documento.

## 23. Collegamento al Final Audit

Il report di audit finale (GREEN/AMBER/RED per dominio, gap P0-P3, verdetti di readiness per le 4 fasi di lancio) è consegnato come messaggio di chiusura della sessione che ha prodotto questo addendum, non come file separato — per restare aderente al formato richiesto esplicitamente da Fabrizio in quella sessione. Questo addendum ne è l'evidenza scritta di supporto (changelog verificabile + mappa di staleness), non il verdetto stesso.

## 24. Come aggiornare questo addendum in futuro

Alla prossima sessione di lavoro rilevante: (1) verificare `deploy_events` e `feature_flag_overrides` come in Sezioni 3-4 prima di scrivere qualunque numero; (2) aggiungere una nuova sezione di changelog per dominio invece di modificare quelle esistenti sopra (append-only, stesso principio del `TRAMA_DOCUMENTATION_CHANGELOG.md` del v4); (3) se il periodo coperto supera ~1 mese o ~30 voci di lavoro, valutare con Fabrizio se sia il momento di un nuovo QA Remediation completo (v5) invece di un ulteriore addendum, per non lasciare accumulare staleness sui documenti numerici del v4 oltre un punto recuperabile a mano.
