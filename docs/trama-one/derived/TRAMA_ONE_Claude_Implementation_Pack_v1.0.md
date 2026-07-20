> **DERIVED COPY — NON CANONICAL**
> Documento sorgente: TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx
> Versione: 1.0 (Implementation ready — subject to repository impact assessment)
> Nome file: TRAMA_ONE_Claude_Implementation_Pack_v1.0.md
> Metodo di conversione: pandoc 2.9.2.1, `pandoc -f docx -t gfm --wrap=none`
> Data di conversione: 2026-07-20 09:41 UTC
>
> Questo file è una copia derivata generata automaticamente per la sola consultazione/ricerca full-text. Non è normativo: in caso di qualunque dubbio o discrepanza fa fede esclusivamente il documento originale `../TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx`.

---

**TRAMA ONE**

**Claude Implementation Pack**

Architettura parallela, riuso del patrimonio esistente e delivery controllato

<table>
<tbody>
<tr class="odd">
<td><p><strong>Nome ufficiale della nuova versione</strong></p>
<p>TRAMA ONE — Unified Ecosystem. Nome tecnico: one. Route target: /one nei tre portali. La beta è una modalità di rollout, non il nome dell’architettura.</p></td>
</tr>
</tbody>
</table>

| **Versione**           | 1.0                                                            |
| ---------------------- | -------------------------------------------------------------- |
| **Stato**              | Implementation ready — subject to repository impact assessment |
| **Autore di prodotto** | Fabrizio Pirulli                                               |
| **Perimetro**          | Parent, Partner, Admin                                         |
| **Data target beta**   | 28 settembre 2026                                              |

# 1\. Valutazione di comprensibilità per Claude

Valutazione complessiva: 8/10 come base di analisi e pianificazione; 6,5/10 se i documenti vengono consegnati senza gerarchia, prompt operativo e vincoli di implementazione.

| **Dimensione**             | **Valutazione**     | **Motivazione**                                                                                      |
| -------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Chiarezza strategica       | Alta                | Visione, responsabilità dei portali, journey e priorità sono esplicite.                              |
| Copertura funzionale       | Alta                | Handbook e MVP coprono processi, business rule, backlog, KPI e roadmap.                              |
| Mappatura al codice        | Media               | Solo Claude, leggendo il repository, può stabilire file, servizi e tabelle realmente riutilizzabili. |
| Eseguibilità diretta       | Media               | Le CR non sono tutte specifiche tecniche development-ready e non vanno implementate in blocco.       |
| Rischio di interpretazione | Medio-alto          | Senza source hierarchy Claude potrebbe confondere AS-IS, TO-BE, MVP e roadmap futura.                |
| Riuso architetturale       | Potenzialmente alto | Deve essere dimostrato con una reuse matrix sul repository, non assunto.                             |

<table>
<tbody>
<tr class="odd">
<td><p><strong>Giudizio operativo</strong></p>
<p>Claude può comprendere precisamente cosa fare se riceve un pacchetto normativo ridotto, una gerarchia delle fonti e l’obbligo di eseguire prima una gap analysis. Non va chiesto di “implementare i documenti”: va chiesto di costruire TRAMA ONE per vertical slice, preservando Legacy e Next Gen.</p></td>
</tr>
</tbody>
</table>

# 2\. Nome, convivenza delle versioni e strategia tecnica

| **Esperienza** | **Ruolo**                                   | **Stato**                                  | **Route/namespace consigliato** |
| -------------- | ------------------------------------------- | ------------------------------------------ | ------------------------------- |
| Legacy / V1    | Baseline storica e fallback                 | Congelata, corretta solo per bug bloccanti | Route attuali                   |
| Next Gen / V2  | Evoluzione Parent già disponibile           | Mantenuta e stabilizzata durante il pilot  | /nextgen                        |
| TRAMA ONE      | Architettura unificata Parent–Partner–Admin | Nuova esperienza parallela e progressiva   | /one su ciascun portale         |

Perché “TRAMA ONE”: comunica l’unificazione dell’ecosistema senza presentarsi come un semplice restyling incrementale. Il nome può essere usato internamente e con stakeholder; non è necessario mostrarlo agli utenti finali.

  - Pattern raccomandato: Strangler Fig. La nuova esperienza sostituisce gradualmente i flussi, non l’intera applicazione in un big bang.

  - Route isolate: /one. Nessuna modifica distruttiva alle route Legacy o /nextgen.

  - Feature flag: TRAMA\_ONE\_ENABLED, con attivazione per utente/coorte/ruolo.

  - Migrazioni dati additive e retrocompatibili; nessuna nuova tabella duplicata se un’entità canonica esiste già.

  - Servizi, repository, hook e componenti condivisi vengono riusati quando compatibili; le dipendenze UI Legacy non devono contaminare il nuovo dominio.

  - Rollback immediato tramite feature flag e mantenimento del percorso precedente.

# 3\. Documenti da allegare a Claude

Pacchetto minimo obbligatorio, in questo ordine:

1.  TRAMA\_MVP\_Settembre\_2026\_Competitive\_Intelligence\_Italia\_v1.1\_Trust\_Layer.docx — fonte normativa per scope, critical path e lancio.

2.  TRAMA\_Product\_Architecture\_CX\_Handbook\_Draft\_1.2\_Referral\_Incentives.docx — architettura e journey Parent.

3.  TRAMA\_Partner\_Product\_Architecture\_CX\_Handbook\_Draft\_1.1\_Trust\_Layer.docx — architettura, onboarding e supply operations Partner.

4.  TRAMA\_Admin\_Product\_Architecture\_CX\_Handbook\_Draft\_1.1\_Trust\_Control\_Room.docx — governance, trust, referral e control room Admin.

5.  TRAMA\_ONE\_Architecture\_Blueprint\_v1.0.html — vista visuale condivisa di architettura, processi, stati e schermate target.

Allegati di riferimento, non normativi:

  - Product Requirements - Portale Partner (gestori).docx: dettaglio della visione originaria; in caso di conflitto prevale il Partner Handbook aggiornato.

  - Sitemap e report Playwright: evidenza AS-IS; il repository resta la fonte tecnica definitiva sul comportamento esistente.

  - sitemap.spec.ts: strumento di verifica e non requisito funzionale.

## 3.1 Gerarchia delle fonti

| **Priorità** | **Fonte**                                | **Uso**                                                       |
| ------------ | ---------------------------------------- | ------------------------------------------------------------- |
| 1            | Repository e database corrente           | Verità dell’implementazione AS-IS.                            |
| 2            | MVP settembre 2026 v1.1                  | Verità dello scope e della sequenza di lancio.                |
| 3            | Handbook Parent/Partner/Admin aggiornati | Verità dell’architettura TO-BE e delle regole di dominio.     |
| 4            | Blueprint TRAMA ONE                      | Rappresentazione visuale; non sostituisce le business rule.   |
| 5            | Product Requirements e sitemap storiche  | Evidenza e contesto; non prevalgono sui documenti aggiornati. |

# 4\. Regole non negoziabili per Claude

  - Non creare un nuovo repository o una copia completa dell’app senza una motivazione approvata.

  - Non duplicare Family, Child, Partner, Center, Activity, Availability, Request/Booking, Planner e User se esistono già.

  - Non modificare dati o schema prima di aver prodotto l’inventario delle entità e la migration plan.

  - Non cancellare o rinominare route, tabelle o colonne utilizzate da Legacy/Next Gen.

  - Non introdurre nuovi passaggi TRAMA ONE → Legacy, salvo adapter temporanei dichiarati e tracciati.

  - Non implementare roadmap Fase 2/3 dentro il beta MVP.

  - Non inventare business rule: registrare l’ambiguità nell’Assumption Log e adottare la soluzione meno irreversibile.

  - Ogni vertical slice deve includere UI, dominio, autorizzazioni, analytics, errori, test e rollback.

  - Il codice generato deve superare TypeScript, lint, build e Playwright prima del merge.

  - Ogni modifica deve essere piccola, revisionabile e collegata a CR/Journey/DDL.

# 5\. Output obbligatori prima di scrivere codice

| **Output**                | **Contenuto minimo**                                            | **Gate**     |
| ------------------------- | --------------------------------------------------------------- | ------------ |
| Repository map            | App, route, moduli, servizi, API, hook, tabelle, RLS, test      | Obbligatorio |
| Current-state journey map | Come funzionano oggi i flussi critici nei tre portali           | Obbligatorio |
| Reuse matrix              | Reuse as-is / adapt / wrap / replace / defer per asset          | Obbligatorio |
| Entity & schema impact    | Entità esistenti, gap, migrazioni additive, backfill e rollback | Obbligatorio |
| CR × code matrix          | CR, file impattati, rischi, test e dipendenze                   | Obbligatorio |
| Implementation sequence   | Vertical slice e commit plan                                    | Obbligatorio |
| Assumption log            | Ambiguità e decisioni reversibili                               | Obbligatorio |
| GO decision               | GO / GO WITH CONDITIONS / NO GO per Sprint 0                    | Obbligatorio |

# 6\. Strategia di riuso: come evitare di rifare tutto

| **Layer**              | **Principio**                             | **Azione richiesta a Claude**                                                            |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Autenticazione e ruoli | Riutilizzare sessioni e identity provider | Mappare auth, middleware, ruoli e RLS; aggiungere solo permessi mancanti.                |
| Modello dati           | Un solo record canonico per entità        | Produrre ER AS-IS e TO-BE; migrazioni additive e adapter per campi storici.              |
| Servizi di dominio     | Condivisi tra UI diverse                  | Estrarre o riusare service/repository; evitare fetch duplicati in ogni route.            |
| Componenti UI          | Riuso selettivo                           | Riutilizzare componenti accessibili e neutrali; non ereditare layout Legacy incoerenti.  |
| Workflow e stati       | Motori generici                           | Checklist, walkthrough, audit, notification e state machine devono essere configurabili. |
| Analytics              | Eventi canonici cross-portale             | Stesso correlationId tra Parent, Partner e Admin.                                        |
| Test                   | Protezione della baseline                 | Mantenere test esistenti e aggiungere journey TRAMA ONE senza rimuovere copertura.       |
| Deploy                 | Rollout progressivo                       | Feature flag, coorte beta e rollback senza redeploy quando possibile.                    |

# 7\. Sequenza di implementazione raccomandata

| **Fase** | **Obiettivo**                   | **Deliverable**                                                               |
| -------- | ------------------------------- | ----------------------------------------------------------------------------- |
| Sprint 0 | Baseline e foundation TRAMA ONE | Route /one, feature flag, telemetry, repository map, schema impact.           |
| Sprint 1 | Supply activation               | Onboarding Partner, review Admin, checklist, walkthrough, prima offerta.      |
| Sprint 2 | Catalogo canonico               | Activity, occurrence/week, availability, pricing e pubblicazione controllata. |
| Sprint 3 | Demand vertical slice           | Planner gap → search → detail → request con context preservation.             |
| Sprint 4 | Fulfilment                      | Partner response, request state, Parent My Activities e Planner sync.         |
| Sprint 5 | Learning e supply growth        | Floating feedback, CenterLead/invite in shadow mode, analytics e hardening.   |

<table>
<tbody>
<tr class="odd">
<td><p><strong>Regola di delivery</strong></p>
<p>La prima release utile non è “tutte le schermate nuove”. È una sola journey completa che attraversa i tre portali e produce un dato misurabile.</p></td>
</tr>
</tbody>
</table>

# 8\. Modalità d’uso del prompt

Il file Markdown allegato contiene un prompt già pronto. Va usato in due passaggi:

6.  Avviare Claude sul repository e allegare il pacchetto minimo. Inviare il Master Prompt in modalità ANALYSIS ONLY. Claude deve produrre gli output della sezione 5 e non modificare file.

7.  Dopo aver verificato il piano, inviare il comando di avvio Sprint 0 contenuto nello stesso file. Ogni sprint successivo usa il template e limita lo scope alle CR indicate.

Evitare prompt come “implementa tutto il documento”, “rifai l’architettura” o “sistemami l’app”. Sono troppo ampi e rendono impossibile controllare regressioni, assunzioni e duplicazioni.

# 9\. Quality gate e Definition of Done

| **Categoria**  | **Criterio**                                                                            |
| -------------- | --------------------------------------------------------------------------------------- |
| Compatibilità  | Legacy e Next Gen restano raggiungibili e funzionanti.                                  |
| Riuso          | Ogni nuovo schema/componente dichiara perché non è stato possibile riusare l’esistente. |
| Dati           | Nessuna duplicazione di stato; source of truth documentata.                             |
| Sicurezza      | RBAC/RLS testati per Parent, Partner e Admin.                                           |
| Journey        | Happy path, alternative path e negative path coperti.                                   |
| Qualità        | TypeScript, lint e build superati.                                                      |
| E2E            | Playwright copre almeno la vertical slice cross-portale.                                |
| Analytics      | Eventi, correlationId e KPI verificabili.                                               |
| Rollback       | Feature flag o migration rollback disponibile.                                          |
| Documentazione | CR, DDL, Assumption Log e schema impact aggiornati.                                     |

# 10\. Deliverable del pacchetto

  - TRAMA\_ONE\_Claude\_Master\_Prompt\_v1.0.md — prompt completo da incollare in Claude.

  - TRAMA\_ONE\_Architecture\_Blueprint\_v1.0.html — mockup visuale interattivo per Product, IT e stakeholder.

  - TRAMA\_ONE\_Claude\_Implementation\_Pack\_v1.0.docx — il presente documento di governo.

  - TRAMA\_ONE\_Delivery\_Pack\_v1.0.zip — archivio dei tre deliverable.
