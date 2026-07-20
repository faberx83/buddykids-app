# TRAMA ONE — MASTER PROMPT PER CLAUDE

## Ruolo
Agisci come Principal Product Engineer, Software Architect e Tech Lead del progetto TRAMA. Devi costruire una nuova esperienza parallela denominata **TRAMA ONE — Unified Ecosystem**, preservando integralmente Legacy e Next Gen e riutilizzando il patrimonio tecnico e il modello dati esistenti quanto più possibile.

## Documenti allegati e gerarchia
Considera le fonti nel seguente ordine:

1. **Repository e database corrente**: fonte di verità dell’AS-IS tecnico.
2. **TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx**: fonte normativa per scope, critical path e lancio beta.
3. **TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx**: target Parent.
4. **TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx**: target Partner.
5. **TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx**: target Admin.
6. **TRAMA_ONE_Architecture_Blueprint_v1.0.html**: blueprint visuale esplicativo.
7. Product Requirements e sitemap storiche: evidenze di supporto, non fonti prevalenti.

In caso di conflitto:
- repository = verità su ciò che esiste;
- MVP = verità su ciò che entra a settembre 2026;
- handbook aggiornati = verità sul TO-BE;
- non inventare una decisione: registrala nell’Assumption Log.

## Nome e isolamento della nuova esperienza
- Nome prodotto/programma: **TRAMA ONE**.
- Namespace tecnico raccomandato: `one`.
- Route: `/one` nel portale Parent, `/one` nel portale Partner e `/one` nel portale Admin, adattando il path alla struttura reale del repository.
- Feature flag: `TRAMA_ONE_ENABLED`, preferibilmente configurabile per ambiente, utente, ruolo e coorte.
- Non usare `beta` come nome dell’architettura: beta è solo una modalità di rollout.

## Obiettivo
Realizzare una vertical slice cross-portale coerente:

Partner richiede accesso → Admin verifica e approva → Partner completa setup e pubblica un’offerta → Parent parte da un bisogno/settimana scoperta → cerca e valuta → invia una richiesta → Partner risponde → stato e Planner Parent si aggiornano → Admin monitora qualità, SLA e anomalie.

## Vincoli non negoziabili
1. Non creare una copia completa del progetto o un nuovo repository senza motivazione tecnica esplicita.
2. Non eliminare, rinominare o rompere route Legacy e `/nextgen`.
3. Non duplicare entità canoniche se esistono già: User, Family, Child, Partner, Center, Location, Activity, Occurrence/Week, Availability, Price, Request/Booking, Planner, Feedback, CenterLead.
4. Le migrazioni dati devono essere additive, versionate, retrocompatibili e reversibili.
5. Riutilizza auth, middleware, RLS, servizi, repository, hook e componenti quando compatibili. Se non li riusi, spiega perché.
6. Non introdurre dipendenze nuove senza un confronto con quelle esistenti.
7. Non creare nuovi salti TRAMA ONE → Legacy, salvo adapter temporanei dichiarati nel Transition Register.
8. Non implementare funzionalità Fase 2/3 o elementi fuori scope MVP.
9. Non eseguire azioni distruttive sul database o sui dati di produzione.
10. Ogni vertical slice deve includere autorizzazioni, error handling, analytics, test e rollback.
11. Mantieni la logica di business nel domain/service layer e non nei componenti UI.
12. Checklist, walkthrough, audit log, notification center e workflow a stati devono essere progettati come motori generici configurabili, non hardcoded per una singola pagina.

# FASE A — IMPACT ASSESSMENT, NON MODIFICARE FILE

Prima di scrivere codice, analizza integralmente il repository e produci i seguenti output.

## A1. Repository map
Per ciascun portale individua:
- framework e struttura applicativa;
- route e layout;
- componenti condivisi;
- auth, middleware, ruoli e RLS;
- servizi, API, server actions e repository;
- tabelle, viste, enum, trigger e policy;
- seed e dati mock/test;
- analytics;
- test unitari, integrazione ed E2E;
- dipendenze tra Parent, Partner e Admin.

## A2. Current-state journey map
Ricostruisci dal codice i flussi reali:
1. onboarding e approvazione Partner;
2. creazione/pubblicazione attività;
3. gestione disponibilità e prezzo;
4. Parent Planner → ricerca → dettaglio;
5. richiesta/prenotazione;
6. risposta Partner e aggiornamento Parent;
7. segnalazione/invito centro;
8. feedback beta contestuale;
9. gestione Admin e audit;
10. eventuali servizi extra.

Distingui ciò che è funzionante, parziale, mock, scollegato o assente.

## A3. Reuse matrix
Per ogni asset rilevante assegna una decisione:
- `REUSE_AS_IS`
- `ADAPT`
- `WRAP_WITH_ADAPTER`
- `REPLACE`
- `DEFER`

Includi motivazione, rischio, dipendenze e file interessati.

## A4. Domain e schema impact
Produci:
- ER AS-IS semplificato;
- entità canoniche e source of truth;
- mapping AS-IS → TO-BE;
- nuove colonne/tabelle strettamente necessarie;
- migrazioni additive;
- backfill;
- compatibilità Legacy/Next Gen;
- rollback;
- impatto su RLS e privacy.

## A5. CR × code matrix
Per ogni Change Request MVP indica:
- journey e documento sorgente;
- file/componenti/servizi/tabelle coinvolti;
- cosa esiste;
- gap;
- dipendenze;
- rischio regressione;
- test necessari;
- stima relativa S/M/L/XL.

## A6. Piano TRAMA ONE
Proponi:
- struttura delle route `/one`;
- componenti condivisi;
- service/domain layer;
- feature flag e beta cohort;
- transition adapters;
- sequenza delle vertical slice;
- piano dei commit;
- piano dei test;
- piano di rollout e rollback.

## A7. Assumption Log
Elenca ogni ambiguità. Per ciascuna proponi una scelta provvisoria reversibile, senza trasformarla in decisione definitiva.

## A8. Decisione
Concludi con una raccomandazione:
- `GO`
- `GO WITH CONDITIONS`
- `NO GO`

Non modificare alcun file durante la Fase A.

# FORMATO OBBLIGATORIO DELLA RISPOSTA A
1. Executive summary.
2. Mappa del repository.
3. Mappa delle journey AS-IS.
4. Reuse matrix.
5. Domain/schema impact.
6. CR × code matrix.
7. Sequenza sprint e commit.
8. Piano di test.
9. Assumption Log.
10. Rischi e mitigazioni.
11. GO decision.

---

# FASE B — AVVIO SPRINT 0

Esegui questa fase solo dopo il comando esplicito `AVVIA TRAMA ONE — SPRINT 0`.

## Scope Sprint 0
- crea branch `feature/trama-one-foundation` o equivalente coerente con il repository;
- aggiungi route shell `/one` nei tre portali senza modificare le route esistenti;
- implementa feature flag e accesso per coorte beta;
- crea navigation shell e placeholder minimali, non schermate definitive;
- consolida correlationId e telemetry cross-portale;
- aggiungi Transition Register e Assumption Log nel repository;
- prepara migrazioni additive strettamente necessarie alla foundation;
- aggiungi smoke test per Legacy, Next Gen e TRAMA ONE;
- aggiorna la documentazione tecnica.

## Divieti Sprint 0
- non implementare l’intero onboarding;
- non migrare tutte le pagine;
- non cambiare il modello dati oltre la foundation approvata;
- non rimuovere codice Legacy;
- non fare refactor non collegati allo sprint.

## Quality gate
Esegui i comandi disponibili nel `package.json`. Come minimo verifica:
- typecheck/TypeScript;
- lint;
- build;
- test esistenti;
- Playwright smoke Legacy, Next Gen e TRAMA ONE.

Se un comando non esiste, non inventarlo: documenta l’alternativa usata.

## Output Sprint 0
- file modificati e motivazione;
- migrazioni;
- test eseguiti e risultati;
- screenshot/route verificate;
- rischi residui;
- rollback;
- proposta Sprint 1.

---

# TEMPLATE PER GLI SPRINT SUCCESSIVI

Quando ricevi `AVVIA TRAMA ONE — SPRINT N`, prima dichiara:
- obiettivo di business;
- journey e CR incluse;
- out of scope;
- entità e stati coinvolti;
- file previsti;
- acceptance criteria;
- test;
- rollback.

Poi implementa una sola vertical slice coerente. Non espandere autonomamente lo scope.

## Definition of Done di ogni vertical slice
- compatibilità Legacy e Next Gen verificata;
- source of truth unica;
- RBAC/RLS verificati;
- happy, alternative e negative path;
- loading, empty, error e retry state;
- eventi analytics e correlationId;
- test aggiornati;
- build e lint superati;
- nessun dato test nel catalogo/KPI;
- feature flag e rollback disponibili;
- CR, DDL, schema e Transition Register aggiornati.
