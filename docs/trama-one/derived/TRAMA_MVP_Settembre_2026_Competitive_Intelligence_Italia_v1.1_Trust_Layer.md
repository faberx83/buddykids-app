> **DERIVED COPY — NON CANONICAL**
> Documento sorgente: TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx
> Versione: 1.1 (16 luglio 2026 — Piano operativo aggiornato, GO WITH CONDITIONS)
> Nome file: TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.md
> Metodo di conversione: pandoc 2.9.2.1, `pandoc -f docx -t gfm --wrap=none`
> Data di conversione: 2026-07-20 09:41 UTC
>
> Questo file è una copia derivata generata automaticamente per la sola consultazione/ricerca full-text. Non è normativo: in caso di qualunque dubbio o discrepanza fa fede esclusivamente il documento originale `../TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx`.

---

**TRAMA**

**MVP SETTEMBRE 2026**

Piano integrato Parent · Partner · Admin

**Competitive Intelligence Italia**

Posizionamento, competitor, scelte build/partner/buy e piano di validazione

<table>
<tbody>
<tr class="odd">
<td>Decisione proposta<br />
Lanciare a fine settembre 2026 una beta privata e geograficamente concentrata. La revisione Partner rende strettamente necessario includere un Trust Layer minimo: richiesta “Diventa Partner TRAMA” in due minuti, verifica identità, review Admin, checklist e walkthrough fino alla prima pubblicazione. Trust Score completo, livelli e incentivi referral restano dietro feature flag/shadow mode e non devono ritardare la vertical slice domanda → richiesta → risposta → Planner.</td>
</tr>
</tbody>
</table>

| Campo                | Valore                                                                           |
| -------------------- | -------------------------------------------------------------------------------- |
| **Versione**         | 1.1                                                                              |
| **Data**             | 16 luglio 2026                                                                   |
| **Stato**            | Piano operativo aggiornato - GO WITH CONDITIONS, Trust Layer minimo obbligatorio |
| **Autore**           | Fabrizio Pirulli                                                                 |
| **Base documentale** | Handbook Parent 1.1, Partner 1.0, Admin 1.0; sitemap 27/22/18 pagine             |

# Indice

**1. Executive decision e piano condiviso**

2\. Definizione del beta MVP settembre 2026

3\. Service blueprint cross-portale

4\. Scope funzionale Parent, Partner e Admin

5\. Modello di dominio e stati condivisi

6\. Backlog MVP e dipendenze

7\. Roadmap luglio–settembre 2026

8\. Operating model del pilot

9\. Esperimenti, KPI e gate decisionali

10\. Modello commerciale da validare

  - Trust e Partnership Level come leve di ranking e crescita, non come tier acquistabili o pay-to-win.

  - Referral program demand-driven: reward Genitore e fee Partner agevolata solo dopo valore verificato e con anti-abuso.

**11. Scenario competitivo italiano**

**12. Deep dive SQUBY**

13\. Profili dei player rilevanti

14\. Matrice comparativa e strategic whitespace

15\. Posizionamento e vantaggio difendibile

16\. Strategia build / partner / buy

17\. Rischi e mitigazioni

**18. Raccomandazioni finali**

Appendici – fonti, glossario e checklist di lancio

# 1\. Executive decision e piano condiviso

<table>
<tbody>
<tr class="odd">
<td>Valutazione sintetica<br />
Il lancio di settembre resta fattibile come beta controllata. Il Product Requirements Partner modifica però il critical path: senza ingresso controllato, review e attivazione guidata non esiste supply affidabile da mostrare alle famiglie. Per contenere effort, il beta implementa state machine, checklist, walkthrough e trust telemetry minima; verifica AI, ranking avanzato, gamification, livelli visibili e programma economico referral completo sono predisposti o testati in shadow mode.</td>
</tr>
</tbody>
</table>

## 1.1 Il piano condiviso, ricordato e aggiornato

Il piano concordato separa correttamente quattro momenti di validazione:

| Periodo                     | Fase                            | Scopo                                                                                                                                                                                    |
| --------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Settembre–dicembre 2026** | Beta privata e apprendimento    | Validare comprensione del valore, onboarding della supply, qualità dei dati, utilizzo del Planner, richieste e risposta dei centri.                                                      |
| **Gennaio–febbraio 2027**   | Costruzione dell’offerta estiva | Onboardare centri per l’estate, caricare settimane e disponibilità, creare waitlist e interesse qualificato.                                                                             |
| **Marzo–aprile 2027**       | Pilot commerciale stagionale    | Validare conversione ricerca → richiesta/prenotazione, disponibilità reale e willingness to pay. A Milano le iscrizioni comunali 2026 sono state aperte dal 19 marzo al 7 aprile \[S2\]. |
| **Giugno–luglio 2027**      | Validazione operativa           | Misurare qualità del servizio, cambi, presenze, supporto, retention e valore del Planner durante l’utilizzo reale.                                                                       |

La riapertura delle scuole lombarde il 7/14 settembre 2026 rende settembre un momento utile per intercettare il riassetto delle routine familiari; non coincide però con il picco di acquisto dei centri estivi, che si concentra in primavera \[S1\]\[S2\].

## 1.2 Cosa significa “lancio settembre 2026”

| Aspetto             | Decisione MVP                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Tipo di lancio**  | Beta privata / invite-only, non lancio nazionale pubblico.                                                         |
| **Geografia**       | Una micro-area ad alta densità: 1–2 municipi di Milano e primo hinterland, scelta in base ai contatti disponibili. |
| **Cohort Genitori** | 30–50 famiglie amiche o facilmente osservabili.                                                                    |
| **Cohort Partner**  | 5–10 centri, con almeno 20–40 offerte complessive.                                                                 |
| **Transazione**     | Richiesta o prenotazione con conferma Partner; pagamento online non obbligatorio.                                  |
| **Operazioni**      | Admin supporta manualmente onboarding, qualità, deduplica e anomalie.                                              |
| **Obiettivo**       | Raccogliere evidenze su problema, soluzione, supply e intenzione transazionale; non massimizzare fatturato.        |

## 1.3 Tesi strategica

<table>
<tbody>
<tr class="odd">
<td><p>TRAMA non deve essere “un altro gestionale” né “un altro elenco di campi estivi”.</p>
<p>La proposta differenziante è un motore need-first: la famiglia parte da un tempo non coperto, trova un’offerta verificata e coerente, invia una richiesta o prenota e vede il proprio Planner aggiornarsi. Il Partner ottiene domanda incrementale senza dover sostituire subito il proprio gestionale. L’Admin governa qualità, stati e apprendimento del marketplace.</p></td>
</tr>
</tbody>
</table>

# 2\. Definizione del beta MVP settembre 2026

## 2.1 North Star del beta

**Settimane o bisogni familiari trasformati in una richiesta qualificata verso un centro verificato.**

Nel beta non serve dimostrare l’intero ciclo economico. Serve dimostrare che il circuito a tre portali produce valore e dati migliori del flusso frammentato Google/Instagram/WhatsApp/Excel.

## 2.2 Principi di scope

  - > Una sola journey dominante, end-to-end e misurabile.

  - > Dati canonici condivisi tra i tre portali: nessuna duplicazione di stati.

  - > Manual operations acceptable: il beta può usare approvazioni e supporto manuali purché tracciati.

  - > Nessuna sostituzione forzata dei gestionali Partner nel beta.

  - > Nessun centro non verificato pubblicato o prenotabile.

  - > Feature flag e rollback per ogni capability nuova.

  - > Test Playwright sulle journey, non solo sulle singole pagine.

  - > Isolamento completo dei dati test e demo.

  - Referral incentives non bloccanti: eligibility misurata in shadow mode prima di impegni economici automatici.

  - Trust minimum viable: completezza, verification status, freshness e response SLA raccolti; score non visibile.

  - Progressive onboarding: richiesta iniziale ≤2 minuti, verifica e configurazione separate.

  - Partner entry controlled: nessun listing pubblico da account non verificato.

## 2.3 Journey primaria del MVP

|                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Partner invia richiesta “Diventa Partner” → verifica identità → Admin approva → walkthrough e checklist → Partner pubblica offerta → Genitore identifica un bisogno → scopre e invia richiesta → Partner risponde → Planner e stato si aggiornano → Admin monitora. Loop opzionale: Genitore suggerisce un centro → CenterLead → onboarding Partner; reward/incentive in shadow mode. |

## 2.4 In scope / out of scope

| IN scope               | Contenuto                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Identità e accessi** | Account Parent, Partner e Admin; ruoli minimi e accesso protetto.                                                             |
| **Supply**             | Onboarding centro, sede, attività, periodo/settimana, prezzo, età, capienza, servizi inclusi, policy minime.                  |
| **Qualità**            | Checklist Admin e preview della scheda Parent.                                                                                |
| **Demand**             | Planner/bisogno, ricerca, filtri essenziali, dettaglio Next Gen, idoneità bambino.                                            |
| **Conversione**        | Richiesta o booking non pagato; accetta/rifiuta; stato condiviso.                                                             |
| **Post-conversione**   | Planner aggiornato e “Le mie attività” minimo.                                                                                |
| **Growth learning**    | Suggerimento centro non iscritto e CenterLead.                                                                                |
| **Beta learning**      | Floating CTA contestuale e triage Admin.                                                                                      |
| **Data & quality**     | Eventi analytics, feature flag, audit essenziale, test E2E.                                                                   |
| Trust Layer minimo     | Partner request, identity verification, Admin Review, state machine, checklist, walkthrough, Notification Center e Audit Log. |
| Trust telemetry        | Raccogliere completezza, verifica, availability freshness, response SLA e cancellazioni; score interno non visibile.          |
| Referral foundation    | CenterLead, DemandContext, dedupe, claim e status; reward/commission solo shadow/manuale.                                     |

| OUT of scope                    | Motivazione                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Pagamenti e finanza**         | Checkout, rimborsi, payout, riconciliazione, commission ledger reale.                                                 |
| **Operations avanzate**         | RFID/QR, presenze giornaliere, gruppi, mensa, certificati, document management completo.                              |
| **Servizi extra**               | Catering, navette e supplier marketplace: solo modello futuro, non delivery settembre.                                |
| **Promozioni avanzate**         | Dynamic pricing, coupon, family discount engine, last minute automation.                                              |
| **Logistica avanzata**          | Travel time real-time, navigazione, reminder intelligenti e quiet hours.                                              |
| **Marketplace nazionale**       | SEO nazionale, catalogo ampio e self-service massivo.                                                                 |
| **Integrazioni**                | Connector completi con Squby/Golee/Sportclubby; nel beta CSV/deep link/manual sync.                                   |
| **Migrazione totale Legacy**    | Solo route attraversate dalla journey primaria.                                                                       |
| Trust avanzato e AI             | Verifica AI, analisi recensioni/social, ranking evoluto, Health/Quality Engine e AI Coach non necessari a settembre.  |
| Gamification e livelli visibili | Badge, missioni, benchmark e Partnership Level in UI dopo la baseline di comportamento.                               |
| Referral automatico economico   | Wallet, coupon automatico, commission ledger e settlement completi dopo booking/pagamenti; settembre usa shadow mode. |

# 3\. Service blueprint cross-portale

## 3.1 Responsabilità per portale

| Portale     | Job to be done                                        | Responsabilità MVP                                                                                                                                                 | Non responsabilità MVP                                                                                        |
| ----------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Parent**  | Organizzare il tempo dei figli                        | Bisogno/Planner, ricerca, confronto, richiesta, stato, suggerimento centro, feedback e status referral; reward solo se attivato in shadow/manuale.                 | Gestione operativa del centro; amministrazione e payout.                                                      |
| **Partner** | Trasformare la propria offerta in domanda qualificata | Richiesta Partner, verifica identità, checklist, walkthrough, profilo/sede, attività, periodi, disponibilità, risposta richieste, notifiche e dati Trust minimi.   | AI verification, CRM/marketing automation, gamification, Trust Score visibile, gestionale operativo completo. |
| **Admin**   | Garantire fiducia e continuità del marketplace        | Candidature card-based, state machine, approvazioni, qualità catalogo, Trust config minima, code operative, CenterLead, feedback, feature flag, analytics e audit. | Automatizzazione totale; può operare manualmente con audit.                                                   |

## 3.2 Contratti di servizio tra portali

| Relazione            | Evento / contratto                   | Requisito                                                                 |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| **Partner → Admin**  | center.submitted                     | Centro con dati minimi e documenti/consensi necessari alla verifica.      |
| **Admin → Partner**  | center.approved / changes\_requested | Esito tracciato, reason code e requisiti residui.                         |
| **Partner → Parent** | offering.published                   | Scheda verificata, periodo, prezzo, età, disponibilità e policy.          |
| **Parent → Partner** | request.submitted                    | Bambino, periodo, offerta, note e consenso minimo; nessun dato eccedente. |
| **Partner → Parent** | request.accepted / declined          | Esito e indicazioni successive; Planner aggiornato in modo idempotente.   |
| **Parent → Admin**   | center.suggested                     | Lead contestualizzato, deduplicabile, non pubblicato.                     |
| **Tutti → Admin**    | feedback.submitted                   | Contesto tecnico/funzionale e categoria per triage.                       |
| **Admin → Tutti**    | feature\_flag / configuration        | Configurazione controllata e rollback.                                    |

## 3.3 Punto di efficienza principale

<table>
<tbody>
<tr class="odd">
<td><p>Un solo stato, tre viste.</p>
<p>Centro, offerta e richiesta non devono essere copiati nei tre portali. Devono essere gli stessi oggetti, con permessi e rappresentazioni diverse. È il principale risparmio della revisione: riduce incoerenze, supporto, doppio inserimento e test duplicati.</p></td>
</tr>
</tbody>
</table>

# 4\. Scope funzionale Parent, Partner e Admin

## 4.1 Parent MVP

| ID           | Capability                        | Criterio MVP                                                        | Prio |
| ------------ | --------------------------------- | ------------------------------------------------------------------- | ---- |
| **P-MVP-01** | Home/Planner orientati al bisogno | Mostrare copertura e una CTA dominante: “Trova un’attività”.        | P0   |
| **P-MVP-02** | Context object                    | Conservare source, period/week, child, filtri e correlationId.      | P0   |
| **P-MVP-03** | Ricerca essenziale                | Località, età, periodo, categoria, prezzo; stato persistente.       | P0   |
| **P-MVP-04** | Dettaglio Next Gen                | Contenuto standard, disponibilità, idoneità, prezzo, servizi e CTA. | P0   |
| **P-MVP-05** | Richiesta/booking leggero         | Selezione bambino e periodo, invio, riepilogo, stato.               | P0   |
| **P-MVP-06** | Planner aggiornato                | Inserimento una sola volta su accettazione/booking confermato.      | P0   |
| **P-MVP-07** | Le mie attività minimo            | Richieste in attesa, accettate, rifiutate e annullate.              | P0   |
| **P-MVP-08** | Suggerisci un centro              | Creazione CenterLead, dedupe e consenso di contatto.                | P1   |
| **P-MVP-09** | Floating CTA beta                 | Feedback contestuale con route, journey, build e triage.            | P0   |

## 4.2 Partner MVP

| ID        | Capability                | Criterio MVP                                                                                     | Prio |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------ | ---- |
| PT-MVP-01 | Diventa Partner TRAMA     | Step 1 ≤2 min con dati minimi; progress e save/resume.                                           | P0   |
| PT-MVP-02 | Identity verification     | Ragione sociale, P.IVA, fonte pubblica e dichiarazione di rappresentanza.                        | P0   |
| PT-MVP-03 | Partner state machine     | Stato, permessi, notifiche, e-mail e storico condivisi con Admin.                                | P0   |
| PT-MVP-04 | Checklist profilo         | Completezza deterministica e requisiti di pubblicazione.                                         | P0   |
| PT-MVP-05 | Walkthrough task-based    | Profilo → prima attività → settimane → prezzi → pubblicazione → dashboard; resume/skip/relaunch. | P0   |
| PT-MVP-06 | Centro e sede             | Identità, contatti, indirizzo, servizi e area operativa.                                         | P0   |
| PT-MVP-07 | Wizard attività           | Contenuto, età, periodo, prezzo, capienza, policy e preview Parent.                              | P0   |
| PT-MVP-08 | Disponibilità strutturata | Capienza per periodo/settimana, freshness e alert.                                               | P0   |
| PT-MVP-09 | Inbox richieste           | Queue con SLA, azioni semplici, reason code e stato condiviso.                                   | P0   |
| PT-MVP-10 | Dashboard task-first      | Massimo tre azioni, checklist, alert, richieste e Guida Interattiva.                             | P0   |
| PT-MVP-11 | Trust telemetry minima    | Completezza, verifica, freshness, SLA e cancellazioni raccolti; score non mostrato.              | P1   |
| PT-MVP-12 | Notification/Audit        | Eventi e comunicazioni su stati e azioni critiche.                                               | P0   |

## 4.3 Admin MVP

| ID       | Capability                     | Criterio MVP                                                                                | Prio |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------- | ---- |
| A-MVP-01 | Command center                 | Code Partner, attività, richieste, feedback, categorie/territori scoperti.                  | P0   |
| A-MVP-02 | Application review cards       | Logo, categoria, città, completezza, fonti, note, azioni rapide e storico.                  | P0   |
| A-MVP-03 | Partner approval state machine | Approve, changes, review, reject con reason code, notifica e audit.                         | P0   |
| A-MVP-04 | Activation oversight           | Checklist, tutorial progress e first publish, senza data entry Admin.                       | P0   |
| A-MVP-05 | Activity quality               | Checklist minima e preview Parent.                                                          | P0   |
| A-MVP-06 | Demand/supply queue            | Richieste in SLA, CenterLead, dedupe, claim e outreach status.                              | P0   |
| A-MVP-07 | Trust config minima            | Pesi/versione per completezza, verifica, freshness e response SLA; nessun override manuale. | P1   |
| A-MVP-08 | Feedback beta                  | Triage contestuale, owner e link a bug/CR.                                                  | P0   |
| A-MVP-09 | Feature flags                  | Coorte, rollout, rollback per onboarding, trust e referral.                                 | P0   |
| A-MVP-10 | Audit e RBAC                   | Azioni sensibili, accessi e config tracciati.                                               | P0   |

# 5\. Modello di dominio e stati condivisi

## 5.1 Entità canoniche MVP

| Entità                  | Significato                             | Owner                | Nota MVP                                                                            |
| ----------------------- | --------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| **Household**           | Nucleo familiare                        | Parent               | Genitori, figli e permessi minimi.                                                  |
| **Child**               | Bambino                                 | Parent               | Età/data di nascita, preferenze minime, nessun dato sanitario non necessario.       |
| **PartnerOrganization** | Gestore                                 | Partner/Admin        | Entità legale/operativa che possiede centri e offerte.                              |
| **Center**              | Centro                                  | Partner/Admin        | Identità pubblica e stato di verifica.                                              |
| **Location**            | Sede                                    | Partner/Admin        | Indirizzo e servizi logistici.                                                      |
| **Activity**            | Attività                                | Partner/Admin        | Template descrittivo riutilizzabile.                                                |
| **Offering**            | Offerta vendibile                       | Partner/Admin        | Attività + sede + periodo + prezzo + capienza + policy.                             |
| **Availability**        | Disponibilità                           | Partner              | Source of truth dei posti per Offering.                                             |
| **Request**             | Richiesta                               | Parent/Partner       | Intento qualificato con stato condiviso.                                            |
| **Booking**             | Prenotazione                            | Tutti                | Nel beta può coincidere con una richiesta accettata; nessun pagamento obbligatorio. |
| **PlannerItem**         | Elemento Planner                        | Parent               | Riferimento alla richiesta/booking, non copia dell’attività.                        |
| **CenterLead**          | Centro suggerito                        | Parent/Admin         | Lead non pubblico con origine domanda.                                              |
| **BetaFeedback**        | Feedback contestuale                    | Tutti/Admin          | Testo, contesto, triage e risoluzione.                                              |
| **AuditEvent**          | Evento di audit                         | Admin                | Chi, cosa, quando e motivazione delle azioni sensibili.                             |
| PartnerVerification     | Verifica identità e fonti pubbliche     | Partner/Admin        | Stato, fonti e decisioni versionate.                                                |
| TutorialProgress        | Avanzamento walkthrough                 | Partner/System       | Resume, skip, relaunch e completion events.                                         |
| ChecklistItem           | Requisito di attivazione/pubblicazione  | Partner/System       | Regola deterministica e percentuale.                                                |
| TrustSignal             | Segnale minimo di qualità/comportamento | System/Admin config  | Completezza, verifica, freshness, SLA e cancellation; score non visibile.           |
| ReferralAttribution     | Collegamento CenterLead-referrer        | Admin/System         | First-qualified; anti-abuso; pseudonimizzato.                                       |
| IncentiveEligibility    | Esito shadow reward/commission          | Admin/Finance/System | Nessuna applicazione automatica prima del ledger reale.                             |

## 5.2 State machine minime

| Oggetto        | Stati MVP                                                              | Regola                                                                            |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Center**     | LEAD → CLAIMED → SUBMITTED → CHANGES\_REQUESTED → APPROVED → SUSPENDED | Solo APPROVED può avere offerte pubbliche.                                        |
| **Offering**   | DRAFT → SUBMITTED → APPROVED → PUBLISHED → PAUSED → ARCHIVED           | PUBLISHED richiede centro approvato, completezza e disponibilità.                 |
| **Request**    | DRAFT → SUBMITTED → VIEWED → ACCEPTED / DECLINED / EXPIRED / CANCELLED | Ogni transizione ha attore, timestamp e reason code.                              |
| **Booking**    | PENDING → CONFIRMED → CANCELLED                                        | Nel beta nasce da Request ACCEPTED; pagamento\_status = NOT\_REQUIRED / EXTERNAL. |
| **Feedback**   | NEW → TRIAGED → PLANNED / ANSWERED / DUPLICATE → CLOSED                | Bug, improvement, content e support non vanno confusi.                            |
| **CenterLead** | NEW → DEDUPED → QUALIFIED → CONTACTED → CLAIMED / REJECTED             | Non compare nel catalogo prima di CLAIMED + APPROVED.                             |

## 5.3 Regole di consistenza

  - > Availability è l’unico dato utilizzato per mostrare i posti; il testo descrittivo non può contraddirla.

  - > Il Planner memorizza requestId/bookingId e non duplica prezzo, stato o disponibilità.

  - > Admin può correggere dati solo con motivazione e audit; le modifiche pubbliche rilevanti notificano il Partner.

  - > Una richiesta non può essere accettata se la capienza non è sufficiente.

  - > La stessa richiesta non può aggiornare il Planner due volte: gli eventi sono idempotenti.

  - > I dati del bambino visibili al Partner sono minimizzati e limitati al processo richiesto.

  - > I record demo/test non entrano in catalogo, funnel e KPI reali.

# 6\. Backlog MVP e dipendenze

## 6.1 Dodici epic cross-portale

| Epic    | Nome                             | Portali              | Outcome                                        |
| ------- | -------------------------------- | -------------------- | ---------------------------------------------- |
| **E01** | Identity, RBAC e tenant boundary | Parent/Partner/Admin | Prerequisito di sicurezza.                     |
| **E02** | Journey context e shell coerente | Parent/Common        | Preserva bambino, periodo, source e filtri.    |
| **E03** | Supply onboarding e approval     | Partner/Admin        | Porta un centro da bozza ad approvato.         |
| **E04** | Canonical catalog & offering     | Partner/Admin/Common | Attività, periodo, prezzo, capienza e qualità. |
| **E05** | Discovery & detail Next Gen      | Parent               | Dalla ricerca alla decisione senza Legacy.     |
| **E06** | Request/booking lifecycle        | Tutti                | Stati condivisi e risposta Partner.            |
| **E07** | Planner & My Activities sync     | Parent/Common        | Ritorno deterministico e stato operativo.      |
| **E08** | Admin operating queues           | Admin                | Code e SLA anziché dashboard passiva.          |
| **E09** | Demand-led supply acquisition    | Parent/Admin/Partner | Suggerimento, dedupe, outreach e claim.        |
| **E10** | Beta feedback loop               | Tutti/Admin          | Feedback contestuale, triage e chiusura.       |
| **E11** | Analytics & experiment framework | Tutti                | Eventi correlati end-to-end.                   |
| **E12** | Quality, feature flag e E2E      | Common               | Rollback e test sulle journey.                 |

## 6.2 Mapping con gli handbook esistenti

| Epic    | Parent CR                       | Partner CR                       | Admin CR               |
| ------- | ------------------------------- | -------------------------------- | ---------------------- |
| **E02** | CR-001, 006, 007, 016, 043, 048 | \-                               | \-                     |
| **E03** | \-                              | PCR-002, 003                     | ACR-002, 019           |
| **E04** | CR-010, 011                     | PCR-006, 007, 010, 011, 024, 025 | ACR-005, 013           |
| **E05** | CR-009, 012, 017, 018, 019      | \-                               | \-                     |
| **E06** | CR-013, 014                     | PCR-013, 015, 029                | ACR-007, 022           |
| **E07** | CR-015, 021, 026, 034, 035      | \-                               | ACR-007                |
| **E08** | \-                              | PCR-001                          | ACR-001, 008, 015      |
| **E09** | CR-049                          | Onboarding/claim da dettagliare  | ACR-004, 023, 024      |
| **E10** | CR-050                          | PCR-023                          | ACR-016                |
| **E11** | CR-044                          | PCR-021                          | ACR-014                |
| **E12** | CR-045, 047, 048                | PCR-034, 035, 036                | ACR-017, 018, 030, 032 |

## 6.3 Critical path

|                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RBAC/tenant → Center + Offering model → Admin approval → Publish catalog → Parent detail → Request lifecycle → Partner response → Planner sync → Analytics + E2E** |

<table>
<tbody>
<tr class="odd">
<td><p>Regola di delivery</p>
<p>Non sviluppare tre roadmap indipendenti. Ogni sprint deve chiudere una vertical slice cross-portale; in caso contrario si produrranno schermate complete ma nessun processo validabile.</p></td>
</tr>
</tbody>
</table>

# 7\. Roadmap luglio–settembre 2026

## 7.1 Piano a cinque sprint

| Fase     | Date                   | Obiettivo                          | Contenuto                                                                                                                                                                                         | Exit criteria                                                 |
| -------- | ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Sprint 0 | 20-31 luglio           | Baseline e scope freeze            | Repo impact assessment, data model, route/event inventory, snapshot, test smoke e design pack: journey, BPMN, state machine, wireframe, module architecture, ER, migration/rollout/test/microcopy | Scope MVP e assunzioni congelati                              |
| Sprint 1 | 3-14 agosto            | Trust entry foundation             | Diventa Partner, identity verification, state machine, Admin review cards, audit e feature flag                                                                                                   | Submission → decisione Admin tracciata end-to-end             |
| Sprint 2 | 17-28 agosto           | Activation e supply publish        | Checklist, walkthrough, centro/sede, attività, settimane, prezzo, preview Parent e first publish                                                                                                  | Partner approvato pubblica offerta senza supporto strutturale |
| Sprint 3 | 31 agosto-11 settembre | Demand → request → response        | Parent search/detail/request, Partner SLA queue, Admin monitor e availability/state sync                                                                                                          | Vertical slice cross-portale completa                         |
| Sprint 4 | 14-25 settembre        | Planner sync, learning e hardening | Planner/My Activities, feedback beta, analytics, Trust signals, CenterLead, Playwright, security/performance                                                                                      | Go-live checklist verde; reward/incentive solo shadow mode    |

## 7.2 Condizioni di fattibilità

| Condizione                                | Necessità               | Conseguenza se assente                                     |
| ----------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| **Scope freeze entro 31 luglio**          | Obbligatoria            | Slittamento o beta non affidabile.                         |
| **Niente pagamenti nel beta**             | Fortemente raccomandata | Aumento rilevante di rischio legale, tecnico e operativo.  |
| **Partner selezionati e assistiti**       | Obbligatoria            | Cold start e dati incompleti.                              |
| **Operazioni Admin manuali**              | Accettabile             | Consente di rinviare automazioni e mantenere il controllo. |
| **Test con dati realistici**              | Obbligatoria            | Impossibile verificare disponibilità, stati e permessi.    |
| **Un solo ambiente beta stabile**         | Obbligatoria            | Confusione tra demo, test e clienti.                       |
| **Supporto quotidiano prime 2 settimane** | Obbligatoria            | Feedback perso e fiducia danneggiata.                      |

## 7.3 Stima di effort

Stima consulenziale AI-assisted, da validare sul repository: **45–70 giornate/persona equivalenti** per una beta cross-portale con scope sopra definito. La fascia bassa richiede forte riuso del codice, nessun pagamento, partner assistiti e operazioni manuali. Con una sola persona non tecnica che orchestra Claude, la capacità di verifica e debugging è il vincolo principale, non la velocità di generazione del codice.

# 8\. Operating model del pilot

## 8.1 Disegno della cohort

| Dimensione                 | Target beta    | Perché                                                                                       |
| -------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| **Famiglie invitate**      | 30–50          | Sufficienti per osservare comportamenti e fare interviste, senza sovraccaricare il supporto. |
| **Famiglie attive target** | 20–30          | Base minima per funnel e retention qualitativa.                                              |
| **Centri contattati**      | 15–20          | Serve un funnel supply per arrivare a 5–10 attivi.                                           |
| **Centri attivi**          | 5–10           | Densità minima e supporto gestibile.                                                         |
| **Offerte pubblicate**     | 20–40          | Varietà minima per età, area e categoria.                                                    |
| **Aree geografiche**       | 1–2 micro-zone | La densità vale più della copertura estesa.                                                  |
| **Durata osservazione**    | 8–12 settimane | Consente iterazione e verifica della ripetizione d’uso.                                      |

## 8.2 Contenuti adatti al periodo settembre–dicembre

  - > Open day e prove di sport/corsi annuali.

  - > Laboratori e attività del weekend.

  - > Campus per chiusure scolastiche, Halloween, ponti e vacanze natalizie.

  - > Pre-registrazioni o manifestazioni di interesse per l’estate 2027.

  - > Attività che abbiano periodi e capienza strutturabili, evitando un catalogo solo editoriale.

Questi contenuti consentono di testare la promessa “organizzare la famiglia” anche fuori dal picco estivo. Il test commerciale dei centri estivi resta previsto in primavera 2027.

## 8.3 RACI operativo

| Attività                   | Product / Fabrizio | Claude / Engineering | Partner Ops | Admin Ops | UX/Data |
| -------------------------- | ------------------ | -------------------- | ----------- | --------- | ------- |
| **Scope e priorità**       | A/R                | C                    | C           | C         | C       |
| **Implementazione e test** | A                  | R                    | I           | I         | C       |
| **Onboarding centri**      | A                  | C                    | R           | C         | I       |
| **Qualità catalogo**       | A                  | C                    | C           | R         | C       |
| **Supporto famiglie**      | A                  | I                    | I           | R         | C       |
| **Triage feedback**        | A                  | C                    | C           | R         | R       |
| **KPI e decisioni**        | A/R                | C                    | C           | C         | R       |

# 9\. Esperimenti, KPI e gate decisionali

## 9.1 Le quattro ipotesi da validare

| Ipotesi         | Domanda di ricerca                                                | Segnale positivo                                                                         |
| --------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Problem**     | L’organizzazione e la scoperta sono abbastanza dolorose?          | Famiglie completano il Planner e descrivono un risparmio di tempo/ansia senza prompting. |
| **Solution**    | Planner + catalogo strutturato è migliore del flusso frammentato? | Uso ripetuto, richieste inviate e minori backtrack/abbandoni.                            |
| **Supply**      | I centri vedono valore nella domanda incrementale?                | Onboarding completato, dati mantenuti aggiornati e risposte entro SLA.                   |
| **Transaction** | Le famiglie compiono un’azione economicamente significativa?      | Richiesta accettata, intenzione di pagamento o booking reale nella primavera 2027.       |

## 9.2 KPI del beta

| KPI                               | Definizione                                            | Target ipotesi      | Tipo       |
| --------------------------------- | ------------------------------------------------------ | ------------------- | ---------- |
| **Parent activation**             | % invitati che crea Household + almeno un bisogno      | ≥60%                | Leading    |
| **Planner intent rate**           | % attivi che crea o seleziona un bisogno/periodo       | ≥50%                | Leading    |
| **Search-to-detail**              | Dettagli aperti / ricerche con risultati               | ≥35%                | Leading    |
| **Detail-to-request**             | Richieste / dettagli unici                             | ≥15–25%             | Core       |
| **Request response SLA**          | % richieste con risposta entro 24h                     | ≥80%                | Supply     |
| **Request acceptance**            | % richieste accettate                                  | ≥40%                | Core       |
| **Partner onboarding completion** | % centri iniziati che arrivano a submitted             | ≥60%                | Supply     |
| **Time to publish**               | Mediana da onboarding start a prima offerta pubblicata | ≤3 giorni assistiti | Supply     |
| **Catalog completeness**          | % offerte sopra quality threshold                      | ≥90%                | Quality    |
| **30-day parent retention**       | % attivi che torna entro 30 giorni                     | ≥25%                | Retention  |
| **Feedback actionability**        | % feedback riproducibile/collegabile a decisione       | ≥70%                | Learning   |
| **Critical journey error-free**   | % sessioni E2E senza errore bloccante                  | ≥95%                | Quality    |
| Partner request completion        | Candidature inviate / aperture                         | ≥70%                | Leading    |
| Median partner request time       | Tempo apertura → Step 1 submitted                      | ≤2 min              | UX         |
| Approved-to-active conversion     | Partner con prima offerta / approvati                  | ≥60%                | Supply     |
| Walkthrough completion            | Partner che completano moduli MVP / approvati          | ≥70%                | Activation |
| Trust data coverage               | Segnali MVP presenti / segnali applicabili             | 100%                | Quality    |
| Referral lead activation          | Partner attivi / CenterLead qualificati                | Baseline            | Growth     |

I target sono ipotesi di pilot, non benchmark di mercato. Vanno congelati prima del lancio e riletti con numerosità e contesto qualitativo.

## 9.3 Gate dicembre 2026

| Esito             | Condizione                                                                                                                      | Decisione                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **GO**            | Almeno 20 famiglie attive, 5 centri attivi, 20 offerte complete, richieste reali, SLA Partner sostenibile e segnali di ritorno. | Investire in supply estiva 2027 e booking commerciale.             |
| **GO WITH PIVOT** | Problema confermato ma conversione bassa oppure supply difficile.                                                               | Correggere proposition, flusso o modello Partner prima di gennaio. |
| **NO GO / PAUSE** | Basso utilizzo anche con cohort assistita, centri non mantengono dati, nessuna azione transazionale.                            | Non ampliare lo sviluppo; riesaminare segmento e problema.         |

# 10\. Modello commerciale da validare

## 10.1 Modello consigliato per il beta

| Attore                         | Prezzo beta                                                                                                | Cosa si misura                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Famiglie**                   | Gratuito                                                                                                   | Uso, retention, richiesta e willingness to pay indiretta.                   |
| **Primi Partner**              | Gratuito fino alla fine del pilot                                                                          | Onboarding, valore lead, tempo risparmiato e willingness to pay/commission. |
| **Commissione “shadow”**       | Simulata al 3% promo / 5% standard, non necessariamente fatturata                                          | Margine, accettabilità e impatto sui prezzi.                                |
| **Servizi extra**              | Non attivi                                                                                                 | Raccogliere interesse per catering/navetta senza costruire il marketplace.  |
| Referral Parent (shadow)       | Nessun reward sulla sola segnalazione; simulare 10% fino a 25 euro dopo primo booking con centro attivato. | Tasso eligibility, costo potenziale, redemption intenzionale e abuso.       |
| Partner referral tier (shadow) | Simulare 3% vs 5% per 50 booking/12 mesi con quality targets.                                              | Accettabilità, qualità supply, costo di acquisizione e mantenimento target. |

## 10.2 Possibile modello post-validazione

  - > Commissione sul booking confermato: 3% early adopter, 5% standard, da validare per segmento e ticket.

  - > Partner Lite gratuito o a costo minimo per pubblicare e gestire richieste; Premium per analytics, automazioni e strumenti operativi.

  - > Lead generation / featured placement con regole trasparenti, senza degradare il ranking organico.

  - > Commissione sui servizi B2B extra (catering, navetta, pre/post) dopo validazione del supplier model.

  - > B2G/B2B2C per enti, welfare aziendale e voucher in una fase successiva.

<table>
<tbody>
<tr class="odd">
<td><p>Attenzione strategica</p>
<p>Il prezzo di Squby parte da valori annuali per anagrafica molto bassi e include una profondità operativa elevata [S6]. TRAMA non deve giustificare il proprio prezzo come sostituto del gestionale; deve monetizzare domanda incrementale, conversione, intelligence e servizi di ecosistema.</p></td>
</tr>
</tbody>
</table>

# 11\. Scenario competitivo italiano

## 11.1 Struttura del mercato

Il mercato non presenta un solo competitor equivalente a TRAMA. È diviso in quattro categorie:

| Categoria                          | Player esemplificativi                            | Valore dominante                                            | Limite rispetto a TRAMA                                                                                       |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Gestionali B2B/B2C**             | SQUBY, Golee, BookyWay                            | Iscrizioni, pagamenti, presenze, documenti, comunicazioni.  | Esperienza centrata sulla singola organizzazione; discovery cross-centro e Planner famiglia non sono il core. |
| **Marketplace / discovery**        | Tutto Campi Estivi, KidPass, Keikibu              | Audience, ricerca, contenuti e visibilità.                  | Operazioni Partner e orchestrazione post-scelta più limitate.                                                 |
| **Marketplace + gestionale sport** | Sportclubby                                       | Discovery locale, booking e gestione del club.              | Focus sport/fitness generale, non organizzazione multi-bambino e bisogni familiari.                           |
| **Piattaforme pubbliche**          | SYSAP e portali comunali                          | Accreditamento, voucher, controllo ente e accesso famiglia. | Scope territoriale/istituzionale e processo voucher-centrico.                                                 |
| **Workflow informale**             | Google, Instagram, WhatsApp, Excel, gruppi locali | Abitudini consolidate e costo percepito nullo.              | Frammentazione, dati non comparabili e nessun Planner integrato.                                              |

## 11.2 Evidenze di domanda e stagionalità

  - > Nel 2026 il monitoraggio Eures–Adoc riportato da Sky indica una media nazionale di 179 euro a settimana e 233 euro a Milano, rendendo prezzo, periodo e comparabilità elementi sensibili \[S3\].

  - > I dati istituzionali disponibili mostrano una fruizione territorialmente disomogenea; la Lombardia risultava sopra la media nazionale nelle misure citate dal Centro nazionale per l’infanzia \[S4\].

  - > Le iscrizioni comunali milanesi per l’estate 2026 sono state concentrate tra il 19 marzo e il 7 aprile, confermando che il prodotto e la supply devono essere pronti prima della primavera \[S2\].

  - > Il finanziamento pubblico continua a sostenere attività socioeducative e collaborazioni pubblico-private, aprendo una prospettiva B2G futura ma non necessaria per il beta \[S5\].

## 11.3 Strategic groups

| Player                               | Domanda / discovery         | Operations Partner | Orchestrazione ecosistema | Planner famiglia               | Rilevanza per TRAMA                                         |
| ------------------------------------ | --------------------------- | ------------------ | ------------------------- | ------------------------------ | ----------------------------------------------------------- |
| **SQUBY**                            | Bassa                       | Molto alta         | Media                     | Assente nell’evidenza pubblica | Benchmark operativo e possibile partner/integration target. |
| **Sportclubby**                      | Alta nel fitness/sport      | Molto alta         | Medio-alta                | Assente                        | Modello architetturale più vicino, ma segmento diverso.     |
| **Tutto Campi Estivi**               | Molto alta, stagionale      | Bassa/media        | Bassa                     | Assente                        | Competitor diretto per SEO, audience e camp discovery.      |
| **Keikibu**                          | Media/alta, ampia           | Bassa/media        | Bassa                     | Assente                        | Competitor per breadth, community e supplier directory.     |
| **SYSAP**                            | Media, locale/istituzionale | Media              | Alta lato ente            | Assente                        | Benchmark per portale tripartito e voucher.                 |
| **Golee**                            | Bassa                       | Alta               | Bassa                     | Assente                        | Competitor SaaS Partner.                                    |
| **BookyWay**                         | Bassa per scelta dichiarata | Alta               | Bassa; API disponibili    | Assente                        | Potenziale integration partner.                             |
| **KidPass / Centri Estivi Digitali** | Media, editoriale           | Bassa              | Bassa                     | Assente                        | Benchmark per curation e suggerimento centri.               |

# 12\. Deep dive SQUBY

## 12.1 Profilo

| Dimensione               | Evidenza pubblica                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Società**              | iGrest Srl, Milano. Il sito presenta SQUBY come gestionale cloud per associazioni sportive, centri educativi, cooperative, scuole, oratori e campus \[S6\]. |
| **Scala dichiarata**     | Il sito dichiara oltre 170.000 utenti; dato self-reported, non market share certificata \[S6\].                                                             |
| **Canali**               | Web, app iOS/Android e dispositivi/wearable per accessi e pagamenti \[S6\].                                                                                 |
| **Funzioni**             | Iscrizioni, anagrafiche, documenti, messaggistica, accessi RFID/QR, mensa, gruppi, attività, contabilità, bar/e-commerce e pagamenti \[S6\].                |
| **Pricing pubblico**     | Piani annuali per anagrafica: Lite 0,90 €, Standard 2,29 €, Professional 2,99 €, con condizioni e moduli differenti \[S6\].                                 |
| **Pagamenti**            | SQUBY Pay integra Mollie; il sito descrive anche opzioni Stripe/Satispay e commissioni di transazione \[S7\].                                               |
| **Strategia dichiarata** | Materiale stampa 2025 indica fundraising ed espansione geografica, inclusa l’Europa dal 2026 \[S8\].                                                        |

## 12.2 Valutazione strategica

| Area                     | Valutazione                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Forza principale**     | Profondità operativa, ampiezza moduli, app genitore, pricing trasparente e base installata dichiarata.                                                                                                                                                       |
| **Job servito**          | Digitalizzare il rapporto tra una singola organizzazione e i propri iscritti.                                                                                                                                                                                |
| **Gap rispetto a TRAMA** | Nelle fonti pubbliche consultate non emerge come core una discovery neutrale tra centri né un Planner familiare che parte da settimane/bisogni scoperti. Questa è un’inferenza da posizionamento e funzionalità pubbliche, non una prova di assenza tecnica. |
| **Rischio competitivo**  | Alto sul portale Partner: costruire presenze, mensa, pagamenti e documenti significherebbe inseguire un incumbent più maturo.                                                                                                                                |
| **Rischio lato Parent**  | Medio: SQUBY serve i genitori già iscritti alla struttura; potrebbe estendersi a discovery e cross-selling usando la base installata.                                                                                                                        |
| **Opportunità**          | TRAMA può essere canale di domanda e layer di organizzazione, integrandosi o convivendo con SQUBY invece di sostituirlo.                                                                                                                                     |
| **Mossa raccomandata**   | Partner portal “marketplace cockpit” leggero, CSV/deep link nel breve; esplorazione integrazione e partnership nel 2027.                                                                                                                                     |

## 12.3 SWOT SQUBY rispetto a TRAMA

| Strengths                                                                                                            | Weaknesses / gap osservabili                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base installata dichiarata; operations molto complete; mobile; accessi e pagamenti; prezzo basso; ampiezza segmenti. | Esperienza focalizzata sull’organizzazione cliente; potenziale complessità; nessuna evidenza pubblica di family planning need-first e comparazione cross-center. |

| Opportunities per TRAMA                                                                                           | Threats per TRAMA                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Referral/integration; onboarding centri già digitalizzati; non duplicare operations; offrire demand intelligence. | SQUBY può aggiungere marketplace/discovery; lock-in dei centri; costo di switching molto basso per restare sul gestionale esistente. |

## 12.4 Risposta competitiva

1.  Non presentare TRAMA ai gestori come “nuovo gestionale completo”.

2.  Promettere domanda incrementale, qualità della vetrina e riduzione del vuoto di capacità.

3.  Consentire modalità “gestione leggera” e “usa il tuo gestionale”.

4.  Progettare un import standard di attività, periodi, prezzi e capienza.

5.  Conservare in TRAMA solo gli oggetti necessari al marketplace e al Planner.

6.  Valutare connector/API solo dopo aver raggiunto densità e partner attivi.

# 13\. Profili dei player rilevanti

## Tutto Campi Estivi

| Profilo                                                                                                                                                                                  | Punti di forza                                                                          | Gap / limite                                                                                                    | Implicazione per TRAMA                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Marketplace e community verticale. Il sito dichiara oltre 250.000 visite di genitori per stagione, più di 140 organizzatori, oltre 800 proposte e 18.000 iscritti alla community \[S9\]. | SEO, specializzazione, audience, filtri, contenuti verificati e prenotazione/richiesta. | Non emerge una gestione della settimana familiare né un sistema operativo Partner paragonabile a un gestionale. | Competitor diretto per acquisizione domanda estiva. TRAMA deve differenziarsi sul bisogno, la continuità e la densità locale. |

## Sportclubby

| Profilo                                                                                                                                        | Punti di forza                                                       | Gap / limite                                                                                                 | Implicazione per TRAMA                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Piattaforma sport/fitness con gestionale, app cliente, marketplace geolocalizzato, pagamenti, liste d’attesa, comunicazioni e accessi \[S10\]. | Modello end-to-end domanda + operations; network e discovery locale. | Focus generale su sport/fitness, non su famiglie multi-bambino e pianificazione di periodi di cura/attività. | È il benchmark architetturale più vicino e dimostra che marketplace + SaaS è possibile; rischio di espansione kids. |

## Keikibu

| Profilo                                                                                                                                          | Punti di forza                                           | Gap / limite                                                                                                           | Implicazione per TRAMA                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Piattaforma ampia per famiglie 0–13: eventi, corsi, sport, servizi, fornitori, community e app; presenta anche un assistente AI in beta \[S11\]. | Ampiezza, community, local content e supplier directory. | Breadth elevata può ridurre profondità transazionale e organizzativa; nessuna evidenza pubblica di Planner need-first. | Competitor per attenzione e discovery. TRAMA deve evitare di diventare una directory generalista. |

## Golee

| Profilo                                                                                                                                 | Punti di forza                                                        | Gap / limite                                                  | Implicazione per TRAMA                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Gestionale per sport e camp con iscrizioni, documenti, pagamenti, app genitori, notifiche e presenze; prova gratuita 14 giorni \[S12\]. | UX SaaS, supporto e operations essenziali per piccoli/medi operatori. | Non è un marketplace cross-centro nelle evidenze considerate. | Competitor lato Partner; possibile sistema preesistente da non sostituire nel beta. |

## BookyWay

| Profilo                                                                                                                                                                                                                     | Punti di forza                                                                      | Gap / limite                                                        | Implicazione per TRAMA                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| App universale di prenotazione; dichiara oltre 2.300 attività e un milione di utenti, ma afferma esplicitamente di non essere un aggregatore \[S13\]. Offre API per sincronizzare prenotazioni, calendari e utenti \[S14\]. | Booking, app cliente, API, ampiezza verticale e adozione internazionale dichiarata. | Scelta strategica di non aggregare centri; family planning assente. | Potenziale partner tecnologico/integration target, non solo competitor. |

## SYSAP Centri Estivi

| Profilo                                                                                                                        | Punti di forza                                                                | Gap / limite                                                      | Implicazione per TRAMA                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Piattaforma tripartita per famiglie, centri e Comuni, focalizzata su voucher, accreditamento, QR e controllo pubblico \[S15\]. | Orchestrazione multi-attore, B2G, pagamenti garantiti e catalogo accreditato. | Vincolata al processo pubblico/voucher e alla copertura comunale. | Benchmark Admin e possibile futuro concorrente/partner nel B2G. |

## KidPass / Centri Estivi Digitali

| Profilo                                                                                              | Punti di forza                                       | Gap / limite                                                                         | Implicazione per TRAMA                                                                                                             |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Portale di ricerca e selezione 2026, partnership in evidenza e processo “segnala un centro” \[S16\]. | Brand editoriale, curation e contenuti per famiglie. | Profondità operativa e transazionale non evidente nelle pagine pubbliche analizzate. | Benchmark diretto per CR-049: il semplice suggerimento esiste già; TRAMA deve chiudere il loop fino al claim e alla pubblicazione. |

## Operatori diretti

| Profilo                                                                                 | Punti di forza                                             | Gap / limite                                                | Implicazione per TRAMA                                                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Experience Camp, federazioni e singoli network vendono direttamente la propria offerta. | Brand, controllo della supply, fiducia e specializzazione. | Catalogo proprietario e assenza di neutralità cross-center. | Competono per domanda e possono disintermediare; sono anche potenziali anchor partner. |

# 14\. Matrice comparativa e strategic whitespace

## 14.1 Scorecard basata su evidenza pubblica

Scala: 0 = nessuna evidenza pubblica; 1 = limitato; 2 = medio; 3 = forte. I punteggi sono una valutazione consulenziale e non una verifica tecnica dei prodotti.

| Player                 | Discovery | Planner | Multi-center | Partner Ops | Admin Orchestration | Booking/Pay | Attendance | Integration |
| ---------------------- | --------- | ------- | ------------ | ----------- | ------------------- | ----------- | ---------- | ----------- |
| **SQUBY**              | 0         | 0       | 0            | 3           | 2                   | 3           | 3          | 1           |
| **Tutto Campi Estivi** | 3         | 0       | 3            | 1           | 1                   | 2           | 0          | 0           |
| **Keikibu**            | 2         | 0       | 2            | 1           | 1                   | 1           | 0          | 0           |
| **Sportclubby**        | 3         | 0       | 3            | 3           | 2                   | 3           | 2          | 1           |
| **Golee**              | 0         | 0       | 0            | 3           | 1                   | 3           | 2          | 0           |
| **BookyWay**           | 0         | 0       | 0            | 3           | 1                   | 3           | 2          | 3           |
| **SYSAP**              | 2         | 0       | 2            | 2           | 3                   | 2           | 1          | 1           |
| **KidPass**            | 2         | 0       | 2            | 1           | 0                   | 1           | 0          | 0           |
| **TRAMA target**       | 3         | 3       | 3            | 2           | 3                   | 2           | 1          | 2           |

## 14.2 White space difendibile

<table>
<tbody>
<tr class="odd">
<td><p>Need-first orchestration</p>
<p>Nessun player analizzato combina in modo evidente: bisogno temporale della famiglia → confronto multi-centro → offerta verificata e disponibile → richiesta/booking → aggiornamento del Planner → dato di domanda non servita che alimenta l’acquisizione di nuovi centri.</p></td>
</tr>
</tbody>
</table>

| White space                               | Valore                                                     | Condizione per renderlo reale                       |
| ----------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| **Planner familiare come origine**        | TRAMA parte dal problema, non dal catalogo.                | Coverage model semplice e uso ripetuto.             |
| **Availability strutturata cross-center** | Confronto reale per periodo, età e capienza.               | Partner mantiene dati o integrazione affidabile.    |
| **Demand-led supply**                     | Le ricerche senza risultato generano pipeline commerciale. | CenterLead dedupe, outreach e claim.                |
| **Three-portal control loop**             | Ogni azione è osservabile e governata.                     | Stati condivisi, Admin operativo e analytics.       |
| **Service marketplace futuro**            | TRAMA può colmare gap dei centri con fornitori.            | Non anticipare delivery prima del core marketplace. |
| **Family graph e planning data**          | Migliori suggerimenti e retention.                         | Consenso, minimizzazione e reale valore percepito.  |

## 14.3 Il vero incumbent

Il concorrente più difficile non è un’app singola. È il workflow composto da Google, Instagram, passaparola, gruppi WhatsApp, moduli, e-mail, fogli Excel e calendari personali. È gratuito, familiare e sufficientemente buono. TRAMA vince solo se riduce concretamente tempo, incertezza e ripetizioni; una UI più elegante non basta.

# 15\. Posizionamento e vantaggio difendibile

## 15.1 Positioning statement

<table>
<tbody>
<tr class="odd">
<td><p>Proposta</p>
<p>Per genitori che devono coprire e coordinare il tempo dei figli, TRAMA è il sistema operativo familiare che trasforma un periodo scoperto in un’attività verificata e organizzata. A differenza delle directory e dei gestionali del singolo centro, collega pianificazione, discovery, offerta disponibile e gestione post-scelta in un unico circuito.</p></td>
</tr>
</tbody>
</table>

## 15.2 Messaggio per ciascun lato

| Audience                   | Promessa                                                    | Prova MVP                                                            |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| **Genitore**               | Meno ricerche sparse, più settimane organizzate.            | Dal bisogno alla richiesta e al Planner senza cambiare applicazione. |
| **Partner**                | Nuova domanda qualificata senza cambiare subito gestionale. | Offerta pubblicabile in pochi passi e richieste con contesto.        |
| **Admin / TRAMA Ops**      | Qualità e marketplace governabili.                          | Code, SLA, lead, feedback e funnel osservabili.                      |
| **Futuro fornitore extra** | Accesso a centri con bisogni verificati.                    | Non nel beta; raccolta dell’interesse e modellazione domanda.        |

## 15.3 Moat: cosa può diventare difendibile

| Asset                               | Difendibilità       | Come costruirlo                                           |
| ----------------------------------- | ------------------- | --------------------------------------------------------- |
| **Densità locale verificata**       | Alta se concentrata | Micro-zone, anchor partner e aggiornamento disponibilità. |
| **Planning graph familiare**        | Medio-alta          | Bisogni, periodi, bambini e scelte; privacy by design.    |
| **Demand gap intelligence**         | Alta                | Zero results, center suggestions e richieste non servite. |
| **Workflow e integrazioni Partner** | Media-alta          | Import/connector e riduzione del doppio inserimento.      |
| **Trust & quality operations**      | Media-alta          | Verifica, quality score, SLA e gestione anomalie.         |
| **Brand e community**               | Media               | Beta cohort, referral, contenuti utili e trasparenza.     |
| **Codice/UI**                       | Bassa da sola       | Facilmente replicabile; deve servire gli asset sopra.     |

# 16\. Strategia build / partner / buy

## 16.1 Cosa costruire

| Capability                           | Decisione     | Razionale                                            |
| ------------------------------------ | ------------- | ---------------------------------------------------- |
| **Planner e context object**         | BUILD         | È il differenziatore centrale.                       |
| **Catalogo/Offering canonico**       | BUILD         | Serve alla comparazione e al circuito cross-portale. |
| **Request lifecycle e Planner sync** | BUILD         | È il cuore transazionale e dell’apprendimento.       |
| **Admin quality/control plane**      | BUILD leggero | Necessario per fiducia e pilot; automazioni dopo.    |
| **CenterLead e demand gap**          | BUILD         | Crea un asset proprietario di crescita supply.       |
| **Feedback contextuale**             | BUILD         | Accelera il learning loop del beta.                  |

## 16.2 Cosa non ricostruire ora

| Capability                         | Decisione            | Alternative                                                         |
| ---------------------------------- | -------------------- | ------------------------------------------------------------------- |
| **Pagamenti**                      | PARTNER/BUY          | Stripe/Mollie/Satispay in fase commerciale; non custodire fondi.    |
| **Full gestionale centro**         | PARTNER/INTEROPERATE | Convivere con Squby, Golee, BookyWay, Sportclubby.                  |
| **Accessi/RFID/presenze hardware** | DO NOT BUILD pre-PMF | Integrare o deep-linkare soluzioni mature.                          |
| **Messaggistica massiva**          | BUY                  | Email/push provider; thread contestuale TRAMA solo dove necessario. |
| **Mappe e travel time**            | BUY                  | Provider cartografico; dopo validazione core.                       |
| **Documenti/certificati**          | DEFER / PARTNER      | Elevata complessità privacy e operations.                           |
| **Catering/navetta marketplace**   | DEFER                | Modellare il dominio, validare domanda, poi costruire.              |

## 16.3 Interoperabilità progressiva

| Fase                | Meccanismo                                        | Uso                                                                                          |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Beta settembre**  | CSV, template, deep link, operazioni manuali      | Ridurre il doppio inserimento senza sviluppo integration-heavy.                              |
| **Pilot primavera** | Webhook/import schedulato per partner selezionati | Sincronizzare disponibilità e stati.                                                         |
| **Scale**           | API/connector standard                            | BookyWay pubblicizza API bidirezionali; altri player vanno valutati commercialmente \[S14\]. |
| **Ecosistema**      | Partner program                                   | TRAMA come demand layer e non competitor obbligatorio dei gestionali.                        |

# 17\. Rischi e mitigazioni

| ID      | Rischio                              | Livello    | Mitigazione                                                                                                                            |
| ------- | ------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **R1**  | Scope eccessivo                      | Molto alto | Freeze; no pagamenti, presenze, servizi extra e migrazione totale.                                                                     |
| **R2**  | Qualità del codice AI-generated      | Alto       | Vertical slice, commit piccoli, review Claude separata, build/lint/Playwright, rollback.                                               |
| **R3**  | Cold start supply                    | Molto alto | Onboarding assistito, anchor partner e micro-geografia.                                                                                |
| **R4**  | Doppio inserimento Partner           | Alto       | Template import, modalità lightweight e strategia integrazione.                                                                        |
| **R5**  | Disponibilità non aggiornata         | Alto       | Timestamp, alert stale, conferma Partner e nessuna promessa “real time” non supportata.                                                |
| **R6**  | Bassa rilevanza stagionale settembre | Medio/alto | Usare attività annuali, weekend, holiday camp e pre-interest estate 2027; non leggere il beta come test completo di summer conversion. |
| **R7**  | Privacy minori                       | Molto alto | Minimizzazione, RBAC, audit, consensi e review legale prima del pilot.                                                                 |
| **R8**  | Supporto ingestibile                 | Alto       | Cohort limitata, code Admin, SLA e canali distinti da feedback prodotto.                                                               |
| **R9**  | Competizione con gestionali          | Medio      | Posizionarsi come demand/planning layer e offrire interoperabilità.                                                                    |
| **R10** | Metriche poco affidabili             | Alto       | Event taxonomy, correlationId, dati test isolati e baseline pre-lancio.                                                                |

## 17.2 Red flags di go-live

  - > Route critica ancora Legacy o non misurabile.

  - > Partner può accettare una richiesta senza disponibilità sufficiente.

  - > Admin non può sospendere un’offerta o ricostruire chi ha modificato uno stato.

  - > Dati famiglia o bambino visibili oltre il necessario.

  - > Eventi analytics duplicati o contaminati da dati test.

  - > Meno di 5 centri e 20 offerte complete a una settimana dal lancio.

  - > P0 aperti su login, pubblicazione, richiesta, risposta o Planner sync.

# 18\. Raccomandazioni finali

## 18.1 Decisione

<table>
<tbody>
<tr class="odd">
<td><p>GO WITH CONDITIONS</p>
<p>Procedere verso una beta privata il 28 settembre 2026. Il lancio è coerente con il piano condiviso solo se viene trattato come fase di apprendimento e non come validazione commerciale definitiva dei centri estivi. La prova di mercato transazionale resta la primavera 2027.</p></td>
</tr>
</tbody>
</table>

## 18.2 Dieci decisioni operative non negoziabili

7.  Congelare entro il 31 luglio lo scope descritto in questo documento.

8.  Usare una request/booking senza pagamento come conversione primaria del beta.

9.  Sviluppare per vertical slice cross-portale, non per completamento di singoli portali.

10. Selezionare una micro-geografia e privilegiare densità a copertura.

11. Onboardare manualmente 5–10 partner e non affidarsi al self-service.

12. Non ricostruire le funzioni mature di SQUBY/Golee/BookyWay/Sportclubby.

13. Rendere Center, Offering, Availability e Request oggetti canonici condivisi.

14. Attivare CenterLead e floating feedback come learning loop, con Admin operativo.

15. Bloccare il go-live senza test E2E, audit e isolamento dati test.

16. Usare i risultati settembre–dicembre per decidere l’investimento sulla stagione 2027.

17. La feature “Suggerisci/Invita un centro” può essere attivata dopo la readiness Partner/Admin, ma non deve ritardare la journey primaria.

18. Trust Score avanzato, Partner Level visibili e referral economics automatici non sono gate di settembre; si raccolgono segnali e si usa shadow mode.

19. Il Trust Layer minimo è parte del critical path del beta: entry, review, checklist, walkthrough, notifiche e audit.

## 18.3 Piano immediato di esecuzione

| Entro            | Output                                                                               |
| ---------------- | ------------------------------------------------------------------------------------ |
| **20 luglio**    | Branch/release baseline, scope freeze draft, dataset pilot e shortlist partner.      |
| **31 luglio**    | Epic e acceptance criteria approvati; Sprint 0 chiuso; prime 5 strutture contattate. |
| **14 agosto**    | Domain model e Admin foundation operativi.                                           |
| **28 agosto**    | Prima offerta pubblicata end-to-end da Partner ad Admin.                             |
| **11 settembre** | Prima richiesta Parent accettata dal Partner e visibile nel Planner.                 |
| **25 settembre** | Pilot dataset, E2E, privacy/roles, analytics e support model pronti.                 |
| **28 settembre** | Beta privata.                                                                        |
| **31 ottobre**   | Prima review go/pivot con dati e interviste.                                         |
| **15 dicembre**  | Decision gate per investimento summer 2027.                                          |

# Appendice A – Fonti e livello di evidenza

Fonti consultate al 16 luglio 2026. I dati di scala dichiarati dai competitor sono riportati come self-reported e non equivalgono a market share certificata.

| ID      | Fonte                               | Documento                                           | Evidenza                                                      |
| ------- | ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| **S1**  | Regione Lombardia                   | Calendario scolastico 2026/2027                     | Avvio 7 settembre infanzia e 14 settembre altri ordini.       |
| **S2**  | Comune di Milano                    | Centri estivi primarie 2026 / comunicato iscrizioni | Finestra 19 marzo–7 aprile 2026.                              |
| **S3**  | Sky TG24 su Osservatorio Eures–Adoc | Centri estivi, spesa media 2026                     | 179 €/settimana nazionale; 233 € Milano.                      |
| **S4**  | Minori.gov.it                       | Dati Osservatorio \#Conibambini                     | Fruizione e differenze territoriali.                          |
| **S5**  | Dipartimento Politiche Famiglia     | Avviso attività socioeducative 2026                 | Collaborazioni pubblico/private e periodo attività.           |
| **S6**  | SQUBY / iGrest                      | Home, guida funzionalità e prezzi                   | Funzioni, scala dichiarata, pricing e posizionamento.         |
| **S7**  | SQUBY / iGrest                      | SQUBY Pay – condizioni                              | Pagamento integrato e partner PSP.                            |
| **S8**  | SQUBY / iGrest                      | Fundraising per crescere in Europa                  | Strategia dichiarata di espansione.                           |
| **S9**  | Tutto Campi Estivi                  | Marketplace campi estivi                            | Metriche self-reported su audience, organizzatori e proposte. |
| **S10** | Sportclubby                         | Sportclubby Business                                | Gestionale, app cliente, marketplace e booking.               |
| **S11** | Keikibu                             | Piattaforma famiglie e area fornitori               | Discovery ampia, community e supplier area.                   |
| **S12** | Golee                               | Camp Estivo                                         | Iscrizioni, pagamenti, documenti, app e presenze.             |
| **S13** | BookyWay                            | App universale di prenotazione                      | Scala self-reported e scelta di non essere aggregatore.       |
| **S14** | BookyWay                            | API                                                 | Sincronizzazione sistemi e disponibilità di API.              |
| **S15** | SYSAP                               | Gestione voucher centri estivi                      | Portali famiglia/centro/comune.                               |
| **S16** | KidPass / Centri Estivi Digitali    | Ricerca e segnala centro                            | Discovery, curation e segnalazione centri.                    |

## Link alle fonti

S1 – Regione Lombardia: Calendario scolastico 2026/2027 – [<span class="underline">https://www.regione.lombardia.it/istruzione-formazione-e-lavoro/formazione-professionale/calendario-scolastico-2026-2027</span>](https://www.regione.lombardia.it/istruzione-formazione-e-lavoro/formazione-professionale/calendario-scolastico-2026-2027)

S2 – Comune di Milano: Centri estivi primarie 2026 / comunicato iscrizioni – [<span class="underline">https://www.comune.milano.it/servizi/scuola/scuole-primarie-centri-estivi</span>](https://www.comune.milano.it/servizi/scuola/scuole-primarie-centri-estivi)

S3 – Sky TG24 su Osservatorio Eures–Adoc: Centri estivi, spesa media 2026 – [<span class="underline">https://tg24.sky.it/economia/2026/06/12/centri-estivi-spesa-media-famiglie-citta-piu-care</span>](https://tg24.sky.it/economia/2026/06/12/centri-estivi-spesa-media-famiglie-citta-piu-care)

S4 – Minori.gov.it: Dati Osservatorio \#Conibambini – [<span class="underline">https://www.minori.gov.it/it/notizia/centri-estivi-dati-dellosservatorio-conibambini</span>](https://www.minori.gov.it/it/notizia/centri-estivi-dati-dellosservatorio-conibambini)

S5 – Dipartimento Politiche Famiglia: Avviso attività socioeducative 2026 – [<span class="underline">https://famiglia.governo.it/it/politiche-e-attivita/comunicazione/notizie/avviso-finanziamento-ai-comuni-per-attivita-socio-educative-a-favore-dei-minori-annualita-2026/</span>](https://famiglia.governo.it/it/politiche-e-attivita/comunicazione/notizie/avviso-finanziamento-ai-comuni-per-attivita-socio-educative-a-favore-dei-minori-annualita-2026/)

S6 – SQUBY / iGrest: Home, guida funzionalità e prezzi – [<span class="underline">https://www.squby.it/</span>](https://www.squby.it/)

S7 – SQUBY / iGrest: SQUBY Pay – condizioni – [<span class="underline">https://www.squby.it/squby-pay-condizioni/</span>](https://www.squby.it/squby-pay-condizioni/)

S8 – SQUBY / iGrest: Fundraising per crescere in Europa – [<span class="underline">https://www.squby.it/squby-fundraising-per-crescere-in-europa-italiaoggi/</span>](https://www.squby.it/squby-fundraising-per-crescere-in-europa-italiaoggi/)

S9 – Tutto Campi Estivi: Marketplace campi estivi – [<span class="underline">https://www.tuttocampiestivi.com/it/campi-estivi-on-line</span>](https://www.tuttocampiestivi.com/it/campi-estivi-on-line)

S10 – Sportclubby: Sportclubby Business – [<span class="underline">https://www.sportclubby.com/it/sportclubby-business</span>](https://www.sportclubby.com/it/sportclubby-business)

S11 – Keikibu: Piattaforma famiglie e area fornitori – [<span class="underline">https://keikibu.com/</span>](https://keikibu.com/)

S12 – Golee: Camp Estivo – [<span class="underline">https://golee.it/camp-estivo/</span>](https://golee.it/camp-estivo/)

S13 – BookyWay: App universale di prenotazione – [<span class="underline">https://bookyway.com/it/</span>](https://bookyway.com/it/)

S14 – BookyWay: API – [<span class="underline">https://bookyway.com/it/bookyway-api/</span>](https://bookyway.com/it/bookyway-api/)

S15 – SYSAP: Gestione voucher centri estivi – [<span class="underline">https://www.sysap.com/centri-estivi/</span>](https://www.sysap.com/centri-estivi/)

S16 – KidPass / Centri Estivi Digitali: Ricerca e segnala centro – [<span class="underline">https://www.centriestividigitali.it/</span>](https://www.centriestividigitali.it/)

# Appendice B – Base interna TRAMA

| Artefatto                                                        | Uso nel presente documento                                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **TRAMA Product Architecture & CX Handbook – Parent Draft 1.1**  | CR Parent, roadmap S6–S12, CenterLead e floating feedback.                                      |
| **TRAMA Partner Product Architecture & CX Handbook – Draft 1.0** | 22 pagine, journey supply, PCR e roadmap Partner.                                               |
| **TRAMA Admin Product Architecture & CX Handbook – Draft 1.0**   | 18 pagine, governance, ACR e roadmap Admin.                                                     |
| **Sitemap applicativa**                                          | Baseline ecosistema: Parent 27 pagine, Partner 22, Admin 18; zero errori nella mappa fornita.   |
| **Repository e test Playwright**                                 | Da usare per impact assessment e stime tecniche definitive; non analizzati in questo documento. |

# Appendice C – Go-live checklist beta

| Area           | Controllo                                             | Stato |
| -------------- | ----------------------------------------------------- | ----- |
| **Product**    | Scope e journey primaria congelati.                   | ☐     |
| **Product**    | Copy e CTA coerenti sui tre portali.                  | ☐     |
| **Supply**     | 5–10 partner attivi e 20–40 offerte complete.         | ☐     |
| **Admin**      | Code approval, quality, request e feedback operative. | ☐     |
| **Data**       | Event taxonomy e correlationId verificati.            | ☐     |
| **Quality**    | Build, lint e Playwright verdi.                       | ☐     |
| **Security**   | RBAC, audit e data minimization verificati.           | ☐     |
| **Privacy**    | Informative/consensi beta e canali supporto definiti. | ☐     |
| **Operations** | Owner, SLA, escalation e rollback documentati.        | ☐     |
| **Support**    | FAQ e messaggio onboarding per famiglie e centri.     | ☐     |
| **Analytics**  | Dashboard beta e baseline pre-lancio.                 | ☐     |
| **Release**    | Feature flag, backup e release notes pronti.          | ☐     |
| **Learning**   | Interviste e survey calendarizzate.                   | ☐     |
| **Decision**   | Gate 31 ottobre e 15 dicembre fissati.                | ☐     |

**FINE DOCUMENTO**
