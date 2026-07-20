# TRAMA ONE — Documentazione ufficiale

Questa cartella raccoglie il pacchetto documentale ufficiale di **TRAMA ONE — Unified Ecosystem**, l'evoluzione cross-portale (Parent, Partner, Admin) del progetto TRAMA. I tre deliverable di governo derivano da `TRAMA_ONE_Delivery_Pack_v1.0.zip` (conservato invariato in questa cartella); i quattro documenti normativi (MVP + tre Handbook) sono stati aggiunti separatamente da Fabrizio, come previsto dall'Implementation Pack.

Questo file è puramente descrittivo/organizzativo. Non implementa, non avvia e non anticipa nessuno sprint né la Gap Analysis.

## Verifica completezza pacchetto — tutti e 7 i documenti ufficiali presenti

| # | Documento | Stato |
|---|---|---|
| 1 | `TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx` | ✅ Presente |
| 2 | `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx` (Handbook Parent) | ✅ Presente |
| 3 | `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx` (Handbook Partner) | ✅ Presente |
| 4 | `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx` (Handbook Admin) | ✅ Presente |
| 5 | `TRAMA_ONE_Architecture_Blueprint_v1.0.html` | ✅ Presente |
| 6 | `TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx` | ✅ Presente |
| 7 | `TRAMA_ONE_Claude_Master_Prompt_v1.0.md` | ✅ Presente |

Più il repository/database corrente (`buddykids-app_v1`), che non è un file in questa cartella ma è la fonte AS-IS a priorità massima (vedi sotto).

**Problemi di leggibilità:** nessuno. Tutti e 4 i `.docx` sono stati estratti con successo (testo, tabelle e struttura leggibili, nessun errore/warning di conversione); l'`.html` è un documento valido e completo.

## Cosa rappresenta ciascun documento

| Documento | Rappresenta |
|---|---|
| Repository e database correnti (`buddykids-app_v1`) | **AS-IS** — verità tecnica su ciò che esiste davvero oggi (codice, schema, dati) |
| `TRAMA_MVP_Settembre_2026_..._v1.1_Trust_Layer.docx` | **MVP Settembre 2026** — scope, critical path e piano di lancio della beta (target 28 settembre 2026) |
| `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx` | **TO-BE Parent** — architettura, journey e business rule target per il portale Genitore |
| `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx` | **TO-BE Partner** — architettura, onboarding e supply operations target per il portale Gestore |
| `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx` | **TO-BE Admin** — governance, trust, referral e control room target per il portale Admin |
| `TRAMA_ONE_Claude_Master_Prompt_v1.0.md` + `TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx` | **Regole di implementazione** — gerarchia delle fonti, vincoli non negoziabili, output obbligatori di Fase A, template Fase B/sprint, quality gate e Definition of Done |
| `TRAMA_ONE_Architecture_Blueprint_v1.0.html` | **Rappresentazione visuale** — vista interattiva condivisa di architettura, processi, stati e schermate target per Product, IT e stakeholder |

## Ordine di priorità delle fonti

1. **Repository e database correnti** — verità dell'implementazione AS-IS.
2. **MVP Settembre 2026 v1.1** — verità dello scope e della sequenza di lancio (cosa entra a settembre 2026).
3. **Handbook Parent / Partner / Admin aggiornati** — verità dell'architettura e delle business rule TO-BE.
4. **Architecture Blueprint TRAMA ONE** — rappresentazione visuale condivisa; non sostituisce le business rule dei documenti sopra.
5. **Product Requirements e sitemap storiche** — evidenza e contesto di supporto; non prevalgono sui documenti aggiornati.

## Regola di prevalenza in caso di conflitto

- **Repository e database rappresentano la verità tecnica dell'AS-IS.** Nessun documento sostituisce la lettura diretta del codice e dello schema per capire cosa esiste davvero oggi.
- **L'MVP Settembre 2026 prevale sul perimetro della roadmap futura.** Se un documento descrive una capability (Trust Score completo, livelli, gamification, Marketplace B2B, verifica AI, ecc.) che l'MVP colloca esplicitamente dietro feature flag/shadow mode o fuori scope, prevale il perimetro MVP: quella capability non entra nella beta di settembre 2026, indipendentemente da quanto dettagliata sia la sua descrizione negli Handbook.
- **Gli Handbook aggiornati prevalgono sui vecchi requirement.** Ogni Handbook dichiara nella propria "Nota metodologica"/"Revision history" quali sezioni sono AS-IS osservato e quali sono TO-BE proposto; le versioni più recenti (Parent 1.2, Partner 1.1, Admin 1.1) e i Product Requirements in esse integrati prevalgono su Product Requirements isolati o bozze precedenti (es. "Product Requirements - Portale Partner (gestori).docx" citato come riferimento non normativo nell'Implementation Pack).
- Nessuna decisione va inventata in caso di ambiguità residua: va registrata in un **Assumption Log**, con una scelta provvisoria e reversibile, mai definitiva.

## AS-IS, MVP, TO-BE e roadmap futura

- **AS-IS**: ciò che esiste realmente, verificabile solo leggendo repository e database — non i documenti. Legacy (V1) e Next Gen (V2, `/nextgen`) sono l'AS-IS oggi in produzione **e devono restare funzionanti**: nessuna modifica distruttiva, rimozione o rottura delle loro route durante il lavoro su TRAMA ONE.
- **MVP (lancio beta, target 28 settembre 2026)**: il sottoinsieme di scope definito da `TRAMA_MVP_Settembre_2026_..._Trust_Layer.docx` — ciò che deve funzionare al lancio (Trust Layer minimo: richiesta Partner, verifica identità, review Admin, checklist, walkthrough fino alla prima pubblicazione), non tutto il TO-BE descritto negli Handbook.
- **TO-BE**: l'architettura e i flussi target descritti dagli Handbook Parent/Partner/Admin e dal Blueprint, ciascuno per il proprio portale — l'obiettivo verso cui TRAMA ONE evolve, non tutto realizzabile all'MVP.
- **Roadmap futura (Fase 2/3)**: tutto ciò che i documenti descrivono ma collocano esplicitamente fuori dallo scope MVP (Trust Score completo, Partnership Level, referral/incentivi economici, Quality/Health Engine, verifica AI, gamification, CRM evoluto, Marketplace B2B). Per regola esplicita del Master Prompt, non va implementato dentro il beta MVP.

## Principi guida per l'esecuzione

- **Repository e database sono la verità tecnica dell'AS-IS.**
- **L'MVP Settembre 2026 prevale sul perimetro della roadmap futura.**
- **Gli Handbook aggiornati prevalgono sui vecchi requirement.**
- **Legacy e Next Gen devono restare funzionanti.** Convivono con TRAMA ONE tramite pattern Strangler Fig e route isolate sotto `/one`; nessuna route, tabella o colonna usata da Legacy/Next Gen va cancellata o rinominata.
- **TRAMA ONE è un'evoluzione reuse-first, non una riscrittura.** Entità canoniche (User, Family, Child, Partner, Center, Location, Activity, Occurrence/Week, Availability, Price, Request/Booking, Planner, Feedback, CenterLead) non vanno duplicate se esistono già; auth, middleware, RLS, servizi, repository, hook e componenti si riusano quando compatibili, con motivazione esplicita quando non lo sono.
- **Deploy, test e automazioni esistenti si aggiornano in modo incrementale, non si rifanno da zero.** La suite Playwright, `deploy.sh`/`test-deploy.sh`, la matrice xlsx dei test e le automazioni già in produzione (es. pipeline segnalazioni BETA) restano la base: TRAMA ONE vi si aggiunge (nuovi smoke test, nuove righe di matrice, migrazioni additive), non le sostituisce.

## Conflitti e incongruenze rilevati (non risolti)

Segnalati per revisione da Fabrizio, nessuna correzione autonoma effettuata:

1. **Disallineamento di versione tra MVP e Handbook citati come base.** La tabella di testata di `TRAMA_MVP_Settembre_2026_..._v1.1_Trust_Layer.docx` dichiara "Base documentale: Handbook Parent 1.1, Partner 1.0, Admin 1.0". Le versioni effettivamente presenti in questa cartella sono però più recenti: Parent **Draft 1.2**, Partner **Draft 1.1**, Admin **Draft 1.1**. L'MVP risulta quindi basato su versioni degli Handbook antecedenti a quelle consegnate — non è chiaro se l'MVP v1.1 incorpori già i contenuti aggiunti nelle revisioni successive degli Handbook (es. la sezione "Referral incentives" introdotta in Parent 1.2) o se vada a sua volta aggiornato.
2. **Versionamento asimmetrico tra gli Handbook.** L'Handbook Parent è alla revisione 1.2 ("Referral incentives e Partner Trust alignment"), mentre Partner e Admin restano entrambi alla 1.1. Non è specificato nei documenti se le novità di Parent 1.2 abbiano un corrispettivo pianificato lato Partner/Admin o se siano intenzionalmente Parent-only.
3. **Campo "Data" assente nella testata di Partner e Admin.** MVP e Parent Handbook riportano esplicitamente "Data: 16 luglio 2026" nella tabella di controllo del documento; gli Handbook Partner e Admin non riportano questo campo, quindi la loro data di redazione/ultima revisione non è verificabile dal documento stesso.

## Prevalenza documentale e incongruenze note

Regole di governo che stabiliscono come leggere questo pacchetto documentale nel suo insieme, incluso come trattare le incongruenze registrate nella sezione precedente. Sostituiscono qualunque interpretazione autonoma caso per caso.

1. **Repository, database e configurazioni rappresentano la verità dell'AS-IS tecnico.** Nessun documento — MVP, Handbook o Blueprint — sostituisce la lettura diretta di codice, schema e configurazioni per stabilire cosa esiste davvero oggi.
2. **`TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx` definisce il perimetro del pilot.** In particolare: perimetro del pilot; priorità di delivery; capability bloccanti (che devono esserci al lancio); capability rinviabili (dietro feature flag/shadow mode o esplicitamente fuori scope).
3. **Gli Handbook più recenti definiscono il TO-BE dettagliato**, ciascuno per il proprio portale: Parent **1.2**, Partner **1.1**, Admin **1.1**.
4. **Se l'MVP cita versioni precedenti degli Handbook, il perimetro MVP resta comunque valido.** Il dettaglio architetturale va letto negli Handbook più recenti (Parent 1.2, Partner 1.1, Admin 1.1), non nelle versioni citate nella tabella di testata dell'MVP. Le nuove capability introdotte dagli Handbook più recenti (es. referral incentives in Parent 1.2) **non entrano automaticamente nell'MVP**: entrano solo se il perimetro MVP le include esplicitamente.
5. **L'Implementation Pack (`TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx`) definisce il metodo di lavoro con Claude** — gerarchia delle fonti, vincoli non negoziabili, output obbligatori, strategia di riuso, quality gate.
6. **Il Master Prompt (`TRAMA_ONE_Claude_Master_Prompt_v1.0.md`) governa l'Impact Assessment iniziale** (Fase A) e i template degli sprint successivi (Fase B).
7. **L'Architecture Blueprint (`TRAMA_ONE_Architecture_Blueprint_v1.0.html`) è una rappresentazione visuale e non prevale né sul repository né sugli Handbook.** In caso di divergenza tra ciò che mostra il Blueprint e ciò che dicono repository o Handbook, prevalgono repository/Handbook.
8. **I documenti originali DOCX, HTML e Markdown ufficiali elencati in questo README sono canonici.**
9. **Eventuali copie convertite in Markdown (o altro formato) di questi documenti sono derivate e non canoniche** — utili per lettura rapida, mai come riferimento normativo in caso di dubbio: fa fede sempre il file originale.
10. **L'assenza della data nella testata degli Handbook Partner e Admin è una lacuna di metadata, non un conflitto funzionale.** Non blocca né altera la lettura del contenuto TO-BE dei due documenti.
11. **Il diverso numero di versione tra Parent (1.2), Partner (1.1) e Admin (1.1) è intenzionale** e deriva da cicli di revisione distinti per portale, non da un disallineamento da correggere.
12. **Ogni conflitto non risolvibile tramite queste regole va inserito nell'Assumption Log**, con una scelta provvisoria e reversibile — non va risolto autonomamente da Claude.

## Stato di questa cartella

Solo organizzazione documentale. Nessun codice applicativo, test, script di deploy, database o configurazione è stato modificato. Nessuno sprint né la Gap Analysis sono stati avviati.
