> **DERIVED COPY — NON CANONICAL**
> Documento sorgente: TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx
> Versione: Draft 1.1 (Product Requirements Partner integrati) — Handbook Partner
> Nome file: TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.md
> Metodo di conversione: pandoc 2.9.2.1, `pandoc -f docx -t gfm --wrap=none`
> Data di conversione: 2026-07-20 09:41 UTC
>
> Questo file è una copia derivata generata automaticamente per la sola consultazione/ricerca full-text. Non è normativo: in caso di qualunque dubbio o discrepanza fa fede esclusivamente il documento originale `../TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx`.

---

**TRAMA**

**Partner / Gestori  
Product Architecture & CX Handbook**

Supply side: onboarding, offerta, disponibilità, prenotazioni e servizi extra

| **Campo** | **Valore**                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| Versione  | Draft 1.1                                                                                                               |
| Stato     | Work in progress - Product Requirements Partner integrati                                                               |
| Autore    | Fabrizio Pirulli                                                                                                        |
| Fonte     | Sitemap Partner (22 pagine) + Product Requirements “Diventa Partner TRAMA”, Trust Layer, walkthrough e livelli          |
| Obiettivo | Definire un ingresso Partner semplice e controllato, attivare supply di qualità e governare fiducia, ranking e crescita |

<table>
<tbody>
<tr class="odd">
<td>Nota metodologica<br />
Il documento mantiene la struttura della baseline Draft 1.0 e integra i Product Requirements Partner. Le route e le evidenze di sitemap restano AS-IS; onboarding, Trust Layer, walkthrough, livelli e incentivi referral sono requisiti TO-BE da validare tramite DDL e refinement tecnico. Verifica AI, Quality/Health Engine, gamification, CRM evoluto e Marketplace B2B restano estensioni architetturali, non implementazioni immediate.</td>
</tr>
</tbody>
</table>

# 1\. Executive Summary

<table>
<tbody>
<tr class="odd">
<td>Sintesi<br />
TRAMA non è un marketplace aperto: è un ecosistema nel quale ogni nuovo Partner può aumentare o ridurre il valore complessivo. Il portale Partner deve quindi combinare ingresso rapido e rassicurante, verifica controllata, accompagnamento operativo e crescita misurabile. La revisione introduce il Trust Layer: “Diventa Partner TRAMA”, verifica identità, validazione Admin, walkthrough contestuale, checklist di attivazione, Trust Score interno, Partnership Level comportamentali, Notification Center e Audit Log. Il principio guida è accompagnare il Gestore come un consulente, non valutarlo con linguaggio burocratico.</td>
</tr>
</tbody>
</table>

| **Indicatore**                 | **Valore**                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pagine Partner                 | 22                                                                                                                                                                                       |
| Collegamenti rilevati          | 248                                                                                                                                                                                      |
| Errori scanner                 | 0                                                                                                                                                                                        |
| Portale correlato              | Genitore + Admin + Partner                                                                                                                                                               |
| Obiettivo target               | Supply affidabile, pubblicabile e governabile                                                                                                                                            |
| Product Requirements integrati | Trust Layer, onboarding controllato, walkthrough, checklist, score interno, livelli, notifiche e audit                                                                                   |
| MVP immediato                  | Ingresso Partner, review Admin, walkthrough, checklist e telemetria Trust minima                                                                                                         |
| Gate pre-implementazione       | Journey Partner e Admin, BPMN onboarding/review, state machine, wireframe funzionali, architettura moduli, ER semplificato, migrazione, rollout feature flag, test e microcopy approvati |

## 1.1 Executive Findings

| **ID** | **Finding**                                                                                                                  | **Impatto** | **Priorità** | **Effetto cross-portale**                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------ | -------------------------------------------------------- |
| PF-01  | Portale Partner è il motore di supply: senza onboarding e pubblicazione guidata la domanda Parent non converte               | Alto        | P0           | Attività incomplete o assenti nel catalogo Parent        |
| PF-02  | Disponibilità, settimane e prezzi devono diventare domini strutturati e non campi descrittivi                                | Alto        | P0           | Booking e Planner affidabili                             |
| PF-03  | Richieste e prenotazioni devono usare stati condivisi con Parent/Admin                                                       | Alto        | P0           | Riduzione supporto e perdita fiducia                     |
| PF-04  | Servizi extra aprono un dominio B2B che richiede Admin e supplier model                                                      | Medio/Alto  | P1           | Nuove revenue e maggiore copertura servizi               |
| PF-05  | Analytics Partner deve essere action-oriented per migliorare offerta e saturazione                                           | Medio       | P1           | Efficienza commerciale e riempimento settimane           |
| PF-06  | L’ingresso deve essere controllato ma percepito come adesione a una community professionale, non come pratica burocratica    | Alto        | P0           | Aumenta conversione supply senza abbassare qualità       |
| PF-07  | La richiesta iniziale deve richiedere non più di due minuti e rinviare i dati approfonditi alla fase di verifica             | Alto        | P0           | Riduce drop-off e rende misurabile il funnel Partner     |
| PF-08  | L’approvazione non conclude l’onboarding: serve un walkthrough task-based fino alla prima attività pubblicata                | Alto        | P0           | Accelera il time-to-value per Parent e Admin             |
| PF-09  | Trust Score e Partnership Level devono guidare ranking e controlli senza trasformarsi in una pagella visibile o acquistabile | Alto        | P1           | Protegge fiducia, qualità e imparzialità del marketplace |
| PF-10  | I Partner acquisiti da segnalazione Genitore richiedono attribuzione, incentivi condizionati e anti-abuso                    | Medio-Alto  | P1           | Riduce CAC supply e premia comportamenti di qualità      |

## 1.2 Principi di revisione

Journey first: i flussi devono seguire gli obiettivi operativi, non la struttura tecnica delle pagine.

Single source of truth: ogni dominio deve avere un owner chiaro tra Genitore, Partner e Admin.

No manual re-entry: un dato inserito da Partner o Admin deve alimentare Genitore senza duplicazione.

Operational observability: ogni stato critico deve essere monitorabile e governabile da Admin.

Pilot first: la roadmap privilegia ciò che consente validazione reale del marketplace.

Reusable engines: walkthrough, checklist, state machine, notifiche e ranking devono essere componenti generici, non logiche hardcoded.

Trust by design: score, ranking, verifiche e livelli sono motori interni, versionati e auditabili.

Coach, not judge: microcopy, suggerimenti e warning devono spiegare il beneficio e indicare il passo successivo.

Progressive disclosure: prima richiesta essenziale, poi verifica e configurazione solo quando necessarie.

# 2\. Audit completo delle 22 schermate Partner

<table>
<tbody>
<tr class="odd">
<td><strong>Lettura dell’audit<br />
</strong>Ogni schermata è valutata rispetto a ruolo, responsabilità target, correlazioni ecosistema, criticità, KPI e Change Request. L’obiettivo non è descrivere la UI attuale ma definire il livello di qualità atteso per renderla utile al pilot e alla scalabilità.</td>
</tr>
</tbody>
</table>

# Audit schermata - Dashboard Gestore

| **Campo**               | **Valutazione**                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /partner/dashboard                                                                                                                             |
| Ruolo primario          | Hub operativo del centro                                                                                                                       |
| Responsabilità target   | Mostrare task urgenti, stato offerta, richieste e saturazione                                                                                  |
| Attori coinvolti        | Gestore, Staff centro                                                                                                                          |
| Correlazione ecosistema | Alimenta Admin con stati operativi e Genitore con disponibilità attendibili                                                                    |
| Criticità principale    | Rischio dashboard descrittiva ma non task-oriented                                                                                             |
| Rischio operativo       | Richieste non gestite e disponibilità non aggiornate                                                                                           |
| Requisiti PR integrati  | Stato profilo e verifica; checklist percentuale; suggerimenti positivi; ultime prenotazioni; alert; attività recenti; CTA “Guida Interattiva”. |
| Stati UI                | First login, in verifica, approvato da configurare, attivo, inattivo, limitato/sospeso.                                                        |
| Eventi cross-portale    | partner\_dashboard\_viewed, checklist\_item\_completed, tutorial\_resumed, availability\_alert\_opened.                                        |
| NFR / controlli         | Massimo tre next-best-action; nessuna metrica senza azione; p95 interazione entro budget; accessibilità keyboard e screen reader.              |

## KPI da monitorare

• Time to first meaningful action

• Profile checklist completion

• Walkthrough completion/resume rate

• Richieste entro SLA

• Availability freshness

• Next-best-action completion

## Change Request collegate

• PCR-001 Task dashboard

• PCR-018 Alert disponibilità

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
La dashboard mostra massimo tre next-best-action, stato verifica, checklist, suggerimenti positivi e accesso alla Guida Interattiva; il contenuto cambia in base allo stato Partner.</td>
</tr>
</tbody>
</table>

# Audit schermata - Onboarding Centro

| **Campo**                 | **Valutazione**                                                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route / Area              | /partner/onboarding                                                                                                                                                                                                  |
| Ruolo primario            | Avvio registrazione gestore                                                                                                                                                                                          |
| Responsabilità target     | Raccogliere dati minimi per qualificazione e approvazione                                                                                                                                                            |
| Attori coinvolti          | Gestore, Admin Operations                                                                                                                                                                                            |
| Correlazione ecosistema   | Admin approva; Genitore vede solo centri approvati                                                                                                                                                                   |
| Criticità principale      | Onboarding potenzialmente lungo e non progressivo                                                                                                                                                                    |
| Rischio operativo         | Drop-off lato supply prima della pubblicazione                                                                                                                                                                       |
| Requisiti PR integrati    | “Diventa Partner TRAMA”: Step 1 ≤2 minuti con nome struttura, referente, e-mail, telefono, comune, categoria e descrizione; Step 2 con ragione sociale, P.IVA, una fonte pubblica e dichiarazione di rappresentanza. |
| Workflow target           | Richiesta → Documentazione → Verifica → Revisione Admin → Approvato → Walkthrough → Profilo completo → Partner attivo.                                                                                               |
| Estensioni architetturali | Punti di estensione per analisi sito, Google Business, social, recensioni e dati pubblici; nessuna AI nel MVP.                                                                                                       |
| Edge case                 | Duplicato, organizzazione già registrata, claim contestato, dati fiscali non validi, fonte pubblica assente, richiesta integrazione.                                                                                 |
| Wireframe funzionale      | Stepper 1 Richiesta → 2 Identità → 3 Invio; progress, save/resume, tempo atteso, stato pratica e CTA unica per step.                                                                                                 |
| Microcopy minimo          | “Entra nella community professionale TRAMA”; “Richiesta ricevuta”; “Ci serve un’integrazione”; “Sei stato approvato: iniziamo a pubblicare”. Tono positivo, chiaro e mai burocratico.                                |

## KPI da monitorare

• Partner request completion

• Median time to submit request

• Identity verification completion

• Changes requested rate

• Time to Admin decision

• Approved-to-active conversion

## Change Request collegate

• PCR-002 Wizard onboarding

• PCR-003 Save as draft

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
La richiesta iniziale è completabile in due minuti; verifica identità e fonti pubbliche sono separate; stati, integrazioni richieste e tempi attesi sono sempre visibili.</td>
</tr>
</tbody>
</table>

# Audit schermata - Profilo Centro

| **Campo**               | **Valutazione**                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /partner/center/profile                                                                                                                 |
| Ruolo primario          | Identità pubblica del centro                                                                                                            |
| Responsabilità target   | Gestire dati visibili ai genitori e verificabili da Admin                                                                               |
| Attori coinvolti        | Gestore, Admin                                                                                                                          |
| Correlazione ecosistema | Scheda centro visibile su catalogo Parent                                                                                               |
| Criticità principale    | Confusione tra dati pubblici e amministrativi                                                                                           |
| Rischio operativo       | Informazioni incomplete o non affidabili                                                                                                |
| Requisiti PR integrati  | Checklist persistente: logo, foto, descrizione, servizi, attività, settimane, prezzi, contatti, pagamenti, regolamento e disponibilità. |
| Trust feedback          | Non mostrare il Trust Score; mostrare solo stato verificato e suggerimenti positivi, specifici e azionabili.                            |
| Partnership Level       | New → Verified → Trusted → Premium → Excellence; livelli non acquistabili e dipendenti da comportamento e qualità.                      |
| Cross-portale           | Completezza e stato alimentano Admin Review, ranking interno e qualità della scheda Parent.                                             |

## KPI da monitorare

• Profile completeness

• Checklist completion time

• Verified profile rate

• Positive suggestion action rate

• Partner level progression

## Change Request collegate

• PCR-004 Separazione dati pubblici/admin

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
La checklist è deterministica e persistente; il Partner vede cosa manca e perché, senza visualizzare un Trust Score numerico o messaggi giudicanti.</td>
</tr>
</tbody>
</table>

# Audit schermata - Sedi

| **Campo**               | **Valutazione**                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Route / Area            | /partner/locations                                                                  |
| Ruolo primario          | Gestione sedi fisiche                                                               |
| Responsabilità target   | Definire indirizzi, aree, servizi, capienza e raggiungibilità                       |
| Attori coinvolti        | Gestore, Admin                                                                      |
| Correlazione ecosistema | Genitore usa sede per distanza, mappa e logistica; Admin usa sede per servizi extra |
| Criticità principale    | Sede non modellata come entità autonoma                                             |
| Rischio operativo       | Attività senza logistica affidabile                                                 |

## KPI da monitorare

• Sedi complete

• Attività senza sede

• Errori geocoding

## Change Request collegate

• PCR-005 Location model

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Ogni attività pubblicata deve essere collegata a una sede valida.</td>
</tr>
</tbody>
</table>

# Audit schermata - Catalogo Attività

| **Campo**               | **Valutazione**                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /partner/activities                                                                                                         |
| Ruolo primario          | Lista attività del gestore                                                                                                  |
| Responsabilità target   | Governare stato, completezza, pubblicazione e performance delle attività                                                    |
| Attori coinvolti        | Gestore                                                                                                                     |
| Correlazione ecosistema | Admin controlla qualità; Genitore visualizza attività pubblicate                                                            |
| Criticità principale    | Manca vista per stato pubblicazione/completezza                                                                             |
| Rischio operativo       | Offerta incompleta nel catalogo Parent                                                                                      |
| Requisiti PR integrati  | Stato attività, completezza, fonti, disponibilità, quality feedback e suggerimenti; prima attività inclusa nel walkthrough. |
| Trust drivers           | Qualità contenuti, immagini, aggiornamenti, cancellazioni e reclami concorrono al Trust Score interno.                      |

## KPI da monitorare

• Attività draft

• Attività pubblicate

• Incomplete rate

## Change Request collegate

• PCR-006 Activity status board

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Lista attività filtrabile per stato, stagione, sede, pubblicazione e completezza.</td>
</tr>
</tbody>
</table>

# Audit schermata - Nuova Attività

| **Campo**               | **Valutazione**                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /partner/activities/new                                                                                                                        |
| Ruolo primario          | Creazione offerta                                                                                                                              |
| Responsabilità target   | Guidare inserimento dati, settimane, prezzi, servizi e policy                                                                                  |
| Attori coinvolti        | Gestore                                                                                                                                        |
| Correlazione ecosistema | Genera entità Activity consumata da Parent e governata da Admin                                                                                |
| Criticità principale    | Rischio form lungo senza validazione guidata                                                                                                   |
| Rischio operativo       | Dati insufficienti per conversione genitori                                                                                                    |
| Requisiti PR integrati  | Moduli walkthrough “Crea la prima attività”, “Inserisci settimane”, “Configura prezzi” e “Pubblica”; avanzamento automatico dopo azione reale. |
| Ripresa                 | Ogni modulo è interrompibile, riprendibile, saltabile e rilanciabile senza perdere i dati inseriti.                                            |

## KPI da monitorare

• Creazione completata

• Errori validazione

• Tempo creazione

## Change Request collegate

• PCR-007 Wizard attività

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>La creazione è per step e consente preview Parent prima della pubblicazione.</td>
</tr>
</tbody>
</table>

# Audit schermata - Dettaglio Attività

| **Campo**               | **Valutazione**                                            |
| ----------------------- | ---------------------------------------------------------- |
| Route / Area            | /partner/activities/:id                                    |
| Ruolo primario          | Gestione attività esistente                                |
| Responsabilità target   | Modificare contenuti, disponibilità, prezzi, pubblicazione |
| Attori coinvolti        | Gestore, Admin in controllo                                |
| Correlazione ecosistema | Modifiche impattano dettaglio Parent e prenotazioni        |
| Criticità principale    | Rischio modifica non governata su attività già prenotate   |
| Rischio operativo       | Incoerenze con booking esistenti                           |

## KPI da monitorare

• Modifiche post-booking

• Errori sync

• Versioni attività

## Change Request collegate

• PCR-008 Versioning attività

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Le modifiche impattanti richiedono conferma e generano audit trail.</td>
</tr>
</tbody>
</table>

# Audit schermata - Calendario

| **Campo**               | **Valutazione**                                    |
| ----------------------- | -------------------------------------------------- |
| Route / Area            | /partner/calendar                                  |
| Ruolo primario          | Vista temporale attività/prenotazioni              |
| Responsabilità target   | Mostrare settimane, eventi, capienza e operatività |
| Attori coinvolti        | Gestore, Staff                                     |
| Correlazione ecosistema | Allineato a Planner Parent e Admin Operations      |
| Criticità principale    | Calendario può duplicare settimane e disponibilità |
| Rischio operativo       | Doppia gestione e incoerenze                       |

## KPI da monitorare

• Aggiornamenti calendario

• Conflitti slot

• No-show

## Change Request collegate

• PCR-009 Calendar as operational view

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Calendario è vista operativa, non source of truth della disponibilità.</td>
</tr>
</tbody>
</table>

# Audit schermata - Settimane

| **Campo**               | **Valutazione**                                                        |
| ----------------------- | ---------------------------------------------------------------------- |
| Route / Area            | /partner/weeks                                                         |
| Ruolo primario          | Configurazione stagionale                                              |
| Responsabilità target   | Definire periodi vendibili per attività e sede                         |
| Attori coinvolti        | Gestore                                                                |
| Correlazione ecosistema | Parent usa settimane per Planner; Admin monitora copertura marketplace |
| Criticità principale    | Settimana non standardizzata come dominio comune                       |
| Rischio operativo       | Ricerca Parent non confrontabile                                       |

## KPI da monitorare

• Settimane configurate

• Gap stagionali

• Week coverage

## Change Request collegate

• PCR-010 Standard week model

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Le settimane seguono calendario comune e possono essere associate a più attività.</td>
</tr>
</tbody>
</table>

# Audit schermata - Disponibilità

| **Campo**               | **Valutazione**                                                  |
| ----------------------- | ---------------------------------------------------------------- |
| Route / Area            | /partner/availability                                            |
| Ruolo primario          | Capienza e posti                                                 |
| Responsabilità target   | Gestire posti disponibili, liste attesa e overbooking prevention |
| Attori coinvolti        | Gestore                                                          |
| Correlazione ecosistema | Parent booking e Admin anomaly detection                         |
| Criticità principale    | Disponibilità non aggiornata in tempo utile                      |
| Rischio operativo       | Richieste su posti non disponibili                               |

## KPI da monitorare

• Disponibilità stale

• Overbooking

• Waitlist conversion

## Change Request collegate

• PCR-011 Availability source of truth

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Ogni booking verifica disponibilità aggiornata e blocca inconsistenze.</td>
</tr>
</tbody>
</table>

# Audit schermata - Prezzi

| **Campo**               | **Valutazione**                                           |
| ----------------------- | --------------------------------------------------------- |
| Route / Area            | /partner/pricing                                          |
| Ruolo primario          | Pricing attività e servizi                                |
| Responsabilità target   | Definire prezzo base, sconti, extra, commissioni e policy |
| Attori coinvolti        | Gestore, Admin commerciale                                |
| Correlazione ecosistema | Parent mostra prezzo finale; Admin governa commissioni    |
| Criticità principale    | Prezzo non scomposto in componenti                        |
| Rischio operativo       | Opacità e contestazioni                                   |

## KPI da monitorare

• Prezzi completi

• Differenze prezzo

• Conversione per fascia prezzo

## Change Request collegate

• PCR-012 Pricing components

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Il prezzo Parent deriva da componenti tracciati e non da testo libero.</td>
</tr>
</tbody>
</table>

# Audit schermata - Prenotazioni

| **Campo**               | **Valutazione**                                   |
| ----------------------- | ------------------------------------------------- |
| Route / Area            | /partner/bookings                                 |
| Ruolo primario          | Gestione prenotazioni ricevute                    |
| Responsabilità target   | Confermare, modificare, esportare e seguire stati |
| Attori coinvolti        | Gestore                                           |
| Correlazione ecosistema | Stato visibile in Parent e monitorato da Admin    |
| Criticità principale    | Stati non armonizzati con Parent                  |
| Rischio operativo       | Famiglie senza conferma affidabile                |

## KPI da monitorare

• Tempo conferma

• Booking pending

• Cancellation rate

## Change Request collegate

• PCR-013 Unified booking state

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Ogni prenotazione ha stato univoco condiviso tra Partner, Parent e Admin.</td>
</tr>
</tbody>
</table>

# Audit schermata - Dettaglio Prenotazione

| **Campo**               | **Valutazione**                                             |
| ----------------------- | ----------------------------------------------------------- |
| Route / Area            | /partner/bookings/:id                                       |
| Ruolo primario          | Gestione pratica singola                                    |
| Responsabilità target   | Vedere bambino, famiglia, servizi, note e azioni consentite |
| Attori coinvolti        | Gestore, Supporto                                           |
| Correlazione ecosistema | Parent vede aggiornamenti; Admin audit e supporto           |
| Criticità principale    | Rischio accesso a dati personali non necessari              |
| Rischio operativo       | Privacy e gestione errata                                   |

## KPI da monitorare

• Azioni su booking

• Errori gestione

• Ticket per booking

## Change Request collegate

• PCR-014 Booking detail permissions

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Il dettaglio mostra solo dati necessari e registra ogni cambio stato.</td>
</tr>
</tbody>
</table>

# Audit schermata - Richieste

| **Campo**               | **Valutazione**                                 |
| ----------------------- | ----------------------------------------------- |
| Route / Area            | /partner/requests                               |
| Ruolo primario          | Lead/prenotazioni non confermate                |
| Responsabilità target   | Convertire richieste in prenotazioni o risposte |
| Attori coinvolti        | Gestore                                         |
| Correlazione ecosistema | Parent attende risposta; Admin monitora SLA     |
| Criticità principale    | Richieste trattate come inbox generica          |
| Rischio operativo       | Tempi risposta lunghi e perdita domanda         |

## KPI da monitorare

• SLA risposta

• Conversione richiesta

• Richieste scadute

## Change Request collegate

• PCR-015 Request SLA queue

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Le richieste sono ordinate per SLA e hanno azioni rapide coerenti.</td>
</tr>
</tbody>
</table>

# Audit schermata - Gruppi

| **Campo**               | **Valutazione**                                                  |
| ----------------------- | ---------------------------------------------------------------- |
| Route / Area            | /partner/groups                                                  |
| Ruolo primario          | Gestione gruppi iscritti                                         |
| Responsabilità target   | Organizzare partecipanti per settimana/attività                  |
| Attori coinvolti        | Gestore, Staff                                                   |
| Correlazione ecosistema | Parent vede gruppo quando condivisibile; Admin monitora capienza |
| Criticità principale    | Gruppi non collegati a booking e presenze                        |
| Rischio operativo       | Duplicazioni operative                                           |

## KPI da monitorare

• Gruppi completi

• Bambini non assegnati

• Capienza gruppo

## Change Request collegate

• PCR-016 Group roster model

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Ogni gruppo deriva da prenotazioni confermate e mantiene capienza.</td>
</tr>
</tbody>
</table>

# Audit schermata - Presenze

| **Campo**               | **Valutazione**                                             |
| ----------------------- | ----------------------------------------------------------- |
| Route / Area            | /partner/attendance                                         |
| Ruolo primario          | Check-in/out operativo                                      |
| Responsabilità target   | Registrare presenze e anomalie giornaliere                  |
| Attori coinvolti        | Staff centro                                                |
| Correlazione ecosistema | Parent può vedere presenza; Admin controlla sicurezza e SLA |
| Criticità principale    | Presenze isolate dal booking                                |
| Rischio operativo       | Informazioni operative non riconciliate                     |

## KPI da monitorare

• Check-in rate

• Assenze

• Presenze senza booking

## Change Request collegate

• PCR-017 Attendance integration

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Non esistono presenze non riconducibili a booking/gruppo valido.</td>
</tr>
</tbody>
</table>

# Audit schermata - Messaggi

| **Campo**               | **Valutazione**                                                     |
| ----------------------- | ------------------------------------------------------------------- |
| Route / Area            | /partner/messages                                                   |
| Ruolo primario          | Comunicazione con famiglie                                          |
| Responsabilità target   | Gestire comunicazioni operative senza disperderle su canali esterni |
| Attori coinvolti        | Gestore, Famiglia                                                   |
| Correlazione ecosistema | Parent riceve notifiche; Admin può intervenire su dispute           |
| Criticità principale    | Messaggi non strutturati e non tracciabili                          |
| Rischio operativo       | Perdita comunicazioni importanti                                    |

## KPI da monitorare

• Messaggi aperti

• Tempo risposta

• Ticket generati

## Change Request collegate

• PCR-018 Structured messaging

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Comunicazioni importanti sono templateizzate e legate a booking/gruppo.</td>
</tr>
</tbody>
</table>

# Audit schermata - Servizi Extra

| **Campo**               | **Valutazione**                                               |
| ----------------------- | ------------------------------------------------------------- |
| Route / Area            | /partner/services                                             |
| Ruolo primario          | Adozione servizi aggiuntivi                                   |
| Responsabilità target   | Attivare pranzo, pre/post, navetta, catering offerti o propri |
| Attori coinvolti        | Gestore, Admin, Fornitore                                     |
| Correlazione ecosistema | Admin propone servizi; Parent vede opzioni                    |
| Criticità principale    | Servizi trattati come flag e non come sottodominio            |
| Rischio operativo       | Promessa commerciale non governabile                          |

## KPI da monitorare

• Servizi attivati

• Attach rate

• Anomalie servizio

## Change Request collegate

• PCR-019 Extra services marketplace

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Ogni servizio ha provider, condizioni, disponibilità e impatto prezzo.</td>
</tr>
</tbody>
</table>

# Audit schermata - Promozioni

| **Campo**                 | **Valutazione**                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route / Area              | /partner/promotions                                                                                                                                                   |
| Ruolo primario            | Sconti e campagne                                                                                                                                                     |
| Responsabilità target     | Gestire last minute, promo famiglia, riempimento settimane                                                                                                            |
| Attori coinvolti          | Gestore, Admin commerciale                                                                                                                                            |
| Correlazione ecosistema   | Parent riceve offerte; Admin governa sostenibilità                                                                                                                    |
| Criticità principale      | Promozioni non collegate a saturazione                                                                                                                                |
| Rischio operativo         | Sconti inefficaci o non controllati                                                                                                                                   |
| Referral Partner          | Un Partner acquisito da un CenterLead qualificato può accedere a commissione ridotta solo dopo approvazione e raggiungimento di target di qualità.                    |
| Vantaggio Genitore        | Nessun premio sulla sola segnalazione: reward proposto del 10% fino a 25 euro, one-shot e valido 6 mesi, solo dopo attivazione del centro e primo booking confermato. |
| Attribution               | First-qualified referral precedente a registrazione o claim; duplicati aggregano domanda ma non moltiplicano reward.                                                  |
| Regola economica proposta | 5% standard → 3% per i primi 50 booking confermati o 12 mesi, se profilo ≥90%, SLA risposta ≥80%, disponibilità fresca ≥90% e cancellazioni \<5%.                     |
| Controllo                 | Incentivo versionato, feature-flagged, non cumulabile e revocabile in caso di abuso o decadimento requisiti.                                                          |

## KPI da monitorare

• Referral-attributed partners

• Incentive eligibility rate

• Referred partner activation

• Commission incentive retention

• Quality target compliance

## Change Request collegate

• PCR-020 Promotion rules

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
Referral e promozioni distinguono sconto commerciale, commissione Partner e reward Genitore; eleggibilità, target, durata, cumulabilità e revoca sono versionati e auditabili.</td>
</tr>
</tbody>
</table>

# Audit schermata - Analytics Partner

| **Campo**               | **Valutazione**                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Route / Area            | /partner/analytics                                                                               |
| Ruolo primario          | Performance offerta                                                                              |
| Responsabilità target   | Misurare visualizzazioni, richieste, booking, saturazione e ricavi                               |
| Attori coinvolti        | Gestore, Admin                                                                                   |
| Correlazione ecosistema | Admin monitora marketplace; Partner migliora offerta                                             |
| Criticità principale    | Metriche non actionable                                                                          |
| Rischio operativo       | Dashboard non usata                                                                              |
| Requisiti PR integrati  | Mostrare suggerimenti e trend azionabili; non esporre Trust Score numerico nella prima versione. |
| Esempi di guidance      | “Aggiungi immagini”, “Aggiorna disponibilità”, “Hai risposto rapidamente alle ultime richieste”. |

## KPI da monitorare

• Suggestion action rate

• Trust data coverage

• Availability freshness

• Response quality

• Level progression baseline

## Change Request collegate

• PCR-021 Partner analytics

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
Analytics e Trust feedback indicano azioni concrete; nessun punteggio interno viene mostrato nella prima versione e ogni raccomandazione è spiegabile.</td>
</tr>
</tbody>
</table>

# Audit schermata - Impostazioni

| **Campo**               | **Valutazione**                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /partner/settings                                                                                              |
| Ruolo primario          | Configurazione account e permessi                                                                              |
| Responsabilità target   | Gestire utenti staff, notifiche, dati amministrativi                                                           |
| Attori coinvolti        | Gestore admin                                                                                                  |
| Correlazione ecosistema | Admin controlla ruoli; Parent non impattato direttamente                                                       |
| Criticità principale    | Permessi poco granulari                                                                                        |
| Rischio operativo       | Azioni operative eseguite da ruoli non autorizzati                                                             |
| Guida Interattiva       | Voce “Rivedi il Tutorial” per rilanciare percorso completo o singoli moduli.                                   |
| Architettura            | Tutorial Engine e Notification Center separati dal contenuto delle singole pagine e governati da feature flag. |

## KPI da monitorare

• Tutorial relaunch rate

• Module completion

• Notification opt-in

• Role configuration errors

## Change Request collegate

• PCR-022 Partner roles

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
Impostazioni consentono ruoli granulari, notifiche e rilancio del walkthrough completo o per modulo; le configurazioni critiche sono auditabili.</td>
</tr>
</tbody>
</table>

# Audit schermata - Supporto

| **Campo**               | **Valutazione**                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /partner/support                                                                                                            |
| Ruolo primario          | Canale assistenza Partner                                                                                                   |
| Responsabilità target   | Raccogliere problemi e richieste operative                                                                                  |
| Attori coinvolti        | Gestore, Admin support                                                                                                      |
| Correlazione ecosistema | Admin gestisce ticket; impatto indiretto su Parent                                                                          |
| Criticità principale    | Supporto non collegato al contesto                                                                                          |
| Rischio operativo       | Ticket generici e poco risolvibili                                                                                          |
| Decisione MVP           | Non creare FAQ, Help Center, Academy, video o documentazione estesa. Usare walkthrough contestuale e supporto con contesto. |
| Escalation              | Il tutorial risolve apprendimento; il ticket gestisce problema operativo; i due flussi non devono essere confusi.           |

## KPI da monitorare

• Contextual ticket actionability

• Median triage time

• Walkthrough deflection

• Reopen rate

• Support-to-product insight rate

## Change Request collegate

• PCR-023 Contextual partner support

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
Il supporto conserva route, oggetto e severità; la Guida Interattiva copre apprendimento, mentre ticket e incident coprono problemi operativi.</td>
</tr>
</tbody>
</table>

# 3\. Journey e processi Partner

# PJ01 - Onboarding e approvazione centro

<table>
<tbody>
<tr class="odd">
<td>Obiettivo<br />
Portare un’organizzazione da richiesta Partner a Partner attivo, verificato e capace di pubblicare la prima offerta, senza percezione burocratica e con fiducia governata.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Registrazione gestore → modulo esteso/tecnico → invio → attesa manuale → esito poco visibile → accesso al gestionale senza accompagnamento → configurazione frammentata

## Diagramma TO-BE

Diventa Partner (≤2 min) → verifica identità e fonte pubblica → submission → Admin Review (approve / changes / review / reject) → approvato → walkthrough task-based → checklist profilo → prima attività + settimane + prezzi → pubblicazione → Partner attivo → progressione Verified/Trusted/Premium/Excellence

## Business Rules

BR-01-01 La richiesta iniziale raccoglie solo nome struttura, referente, e-mail, telefono, comune, categoria e breve descrizione.

BR-01-02 La verifica identità richiede ragione sociale, Partita IVA, almeno una fonte pubblica e dichiarazione di rappresentanza.

BR-01-03 Il Partner può salvare, interrompere e riprendere senza perdere dati né ricominciare il processo.

BR-01-04 Nel MVP non viene eseguita verifica AI; sono predisposti adapter e dati per fonti pubbliche future.

BR-01-05 Ogni stato Partner determina permessi, notifiche, e-mail, next action e audit trail.

BR-01-06 L’Admin può approvare, richiedere integrazione, mettere in revisione, rifiutare, contattare e consultare lo storico.

BR-01-07 Solo un Partner approvato può pubblicare offerta visibile al Genitore.

BR-01-08 Il walkthrough evidenzia componenti reali e avanza solo dopo il completamento dell’azione richiesta.

BR-01-09 Ogni modulo del walkthrough è interrompibile, riprendibile, saltabile e rilanciabile singolarmente.

BR-01-10 La checklist di profilo usa regole deterministiche e deve spiegare l’effetto di ogni elemento sulla pubblicabilità.

BR-01-11 Il Trust Score è interno, 0-100, aggiornato automaticamente, con pesi configurabili e non modificabile manualmente.

BR-01-12 Nella UI Partner il Trust Score non viene mostrato; sono mostrati suggerimenti positivi, specifici e azionabili.

BR-01-13 I Partnership Level dipendono dal comportamento e non sono acquistabili.

BR-01-14 Walkthrough, checklist, state machine, notifiche e ranking devono essere motori generici e riutilizzabili.

BR-01-15 Nel MVP non vengono creati FAQ, Help Center, Academy o video: apprendimento e supporto restano contestuali.

## KPI e Change Request

| **KPI**                          | **Change Request**                 |
| -------------------------------- | ---------------------------------- |
| Partner Request Completion       | PCR-037, PCR-038, ACR-035          |
| Median Request Time              | PCR-037                            |
| Identity Verification Completion | PCR-038, ACR-036                   |
| Time to Admin Decision           | PCR-039, ACR-035                   |
| Walkthrough Completion           | PCR-040, PCR-041                   |
| Time to First Published Activity | PCR-040, PCR-042, PCR-006, PCR-007 |
| Approved-to-Active Conversion    | PCR-039, PCR-040, PCR-042          |

# PJ02 - Creazione e pubblicazione attività

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Creare attività comparabile, ricercabile e prenotabile dai genitori.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Form attività → contenuti → disponibilità separata → pubblicazione non governata

## Diagramma TO-BE

Wizard attività → sede → settimane → pricing → servizi → preview Parent → quality check → pubblicazione

## Business Rules

BR-02-01 Attività senza sede valida non pubblicabile.

BR-02-02 Prezzo e settimane sono obbligatori.

BR-02-03 La preview Parent è obbligatoria prima della pubblicazione.

## KPI e Change Request

| **KPI**               | **Change Request**        |
| --------------------- | ------------------------- |
| activity publish rate | PCR-006, PCR-007, ACR-005 |
| quality score         | PCR-006, PCR-007, ACR-005 |
| time to publish       | PCR-006, PCR-007, ACR-005 |

# PJ03 - Gestione disponibilità e capienza

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Mantenere posti disponibili affidabili durante la stagione.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Disponibilità aggiornata manualmente e potenzialmente disallineata

## Diagramma TO-BE

Availability source of truth → aggiornamenti → blocco posti → waitlist → Admin anomalies

## Business Rules

BR-03-01 Ogni booking riduce capienza.

BR-03-02 Disponibilità stale genera alert.

BR-03-03 Overbooking non consentito senza override Admin.

## KPI e Change Request

| **KPI**             | **Change Request** |
| ------------------- | ------------------ |
| stale availability  | PCR-011, ACR-007   |
| overbooking         | PCR-011, ACR-007   |
| waitlist conversion | PCR-011, ACR-007   |

# PJ04 - Gestione richieste

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Rispondere rapidamente alle richieste famiglie e convertirle.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Inbox richieste → risposta manuale → stato poco visibile

## Diagramma TO-BE

SLA queue → azione rapida → conferma/alternativa/rifiuto → notifica Parent → update Admin

## Business Rules

BR-04-01 Richieste hanno SLA.

BR-04-02 Ogni risposta aggiorna stato Parent.

BR-04-03 Richiesta scaduta genera alert.

## KPI e Change Request

| **KPI**            | **Change Request** |
| ------------------ | ------------------ |
| response SLA       | PCR-015, ACR-008   |
| request conversion | PCR-015, ACR-008   |
| lost demand        | PCR-015, ACR-008   |

# PJ05 - Gestione prenotazioni

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Governare prenotazioni confermate e variazioni.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Lista prenotazioni → dettaglio → modifica non sempre tracciata

## Diagramma TO-BE

Booking queue → dettaglio autorizzato → azioni per stato → audit → update Parent/Admin

## Business Rules

BR-05-01 Stati booking condivisi.

BR-05-02 Modifiche rilevanti notificano famiglia.

BR-05-03 Dati personali minimizzati.

## KPI e Change Request

| **KPI**                   | **Change Request**        |
| ------------------------- | ------------------------- |
| booking confirmation time | PCR-013, PCR-014, ACR-007 |
| stuck bookings            | PCR-013, PCR-014, ACR-007 |
| support cases             | PCR-013, PCR-014, ACR-007 |

# PJ06 - Gruppi e presenze

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Tradurre booking in operatività giornaliera.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Booking, gruppi e presenze non necessariamente riconciliati

## Diagramma TO-BE

Booking confermati → roster gruppo → check-in/out → anomalie → Parent/Admin visibility

## Business Rules

BR-06-01 Gruppi derivano da booking confermati.

BR-06-02 Presenze senza booking non ammesse salvo eccezione tracciata.

BR-06-03 Anomalie hanno owner.

## KPI e Change Request

| **KPI**             | **Change Request** |
| ------------------- | ------------------ |
| roster completeness | PCR-016, PCR-017   |
| attendance accuracy | PCR-016, PCR-017   |
| anomaly rate        | PCR-016, PCR-017   |

# PJ07 - Servizi extra

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Consentire ai centri di adottare servizi proposti o propri.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Servizio come informazione descrittiva

## Diagramma TO-BE

Admin configura servizio/provider → Partner aderisce → settimane/sedi abilitate → Parent vede opzioni

## Business Rules

BR-07-01 Servizio ha provider, area, SLA e prezzo.

BR-07-02 Partner può aderire solo se compatibile.

BR-07-03 Parent vede solo servizi attivi.

## KPI e Change Request

| **KPI**          | **Change Request**        |
| ---------------- | ------------------------- |
| service adoption | PCR-019, ACR-011, ACR-012 |
| attach rate      | PCR-019, ACR-011, ACR-012 |
| incidents        | PCR-019, ACR-011, ACR-012 |

# PJ08 - Promozioni e saturazione

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Aiutare il centro a riempire settimane con bassa domanda.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Promo manuali non legate a saturazione

## Diagramma TO-BE

Saturazione / referral attribution → verifica eleggibilità → promo o commission tier → pubblicazione controllata → misurazione uplift e qualità → rinnovo, scadenza o revoca

## Business Rules

BR-08-01 Ogni promo è limitata temporalmente e ha audience, budget, condizioni e limite utilizzo.

BR-08-02 Le promozioni non possono violare prezzo minimo o condizioni comunicate al Genitore.

BR-08-03 L’uplift è misurato per settimana e distinto dalla domanda organica.

BR-08-04 Il Partner referral incentive è disponibile solo per CenterLead qualificati e attribuiti prima della registrazione.

BR-08-05 La commissione proposta è 3% anziché 5% per i primi 50 booking confermati o 12 mesi, whichever comes first.

BR-08-06 Il mantenimento richiede profilo ≥90%, SLA risposta ≥80%, disponibilità fresca ≥90% e cancellazioni \<5%.

BR-08-07 L’incentivo non è acquistabile, non è cumulabile e può essere sospeso per abuso o decadimento requisiti.

BR-08-08 Regole, soglie, durata e versione dell’incentivo sono configurate da Admin e registrate nel ledger commerciale.

BR-08-09 Il Genitore non riceve vantaggi sulla sola segnalazione: il reward proposto è 10% fino a 25 euro sul primo booking confermato con il Partner referral, one-shot e con scadenza 6 mesi.

BR-08-10 L’attribution usa il primo suggerimento qualificato precedente alla registrazione o claim; i duplicati aggregano domanda ma non moltiplicano reward.

BR-08-11 Reward Genitore e commission tier Partner possono essere sospesi o reversed con reason code in caso di abuso, errore o decadimento requisiti.

## KPI e Change Request

| **KPI**          | **Change Request** |
| ---------------- | ------------------ |
| occupancy lift   | PCR-020            |
| promo conversion | PCR-020            |
| margin impact    | PCR-020            |

# PJ09 - Comunicazioni operative

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Ridurre dispersione WhatsApp/email e centralizzare messaggi importanti.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Messaggi esterni e non collegati al booking

## Diagramma TO-BE

Template comunicazione → destinatari da booking/gruppo → invio → tracciamento apertura → support escalation

## Business Rules

BR-09-01 Comunicazioni critiche hanno template.

BR-09-02 Messaggi collegati a booking/gruppo.

BR-09-03 Admin può vedere solo in caso di supporto.

## KPI e Change Request

| **KPI**           | **Change Request** |
| ----------------- | ------------------ |
| message open rate | PCR-018            |
| response time     | PCR-018            |
| escalations       | PCR-018            |

# PJ10 - Supporto Partner contestuale

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Rendere risolvibili i problemi del gestore.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Support generico → triage manuale

## Diagramma TO-BE

Walkthrough task-based / CTA supporto contestuale → contesto route e oggetto → guida o ticket appropriato → triage Admin → risoluzione / CR / bug → aggiornamento suggerimenti e test

## Business Rules

BR-10-01 Ogni ticket conserva route, oggetto, stato Partner, modulo walkthrough e severità.

BR-10-02 Il tutorial e il supporto sono motori separati: apprendimento non viene trattato come incident.

BR-10-03 Il walkthrough può essere rilanciato completo o per singolo modulo.

BR-10-04 Nel MVP non vengono creati FAQ, Help Center, Academy o video.

BR-10-05 I feedback ricorrenti entrano nel backlog con frequenza e journey di origine.

BR-10-06 Le segnalazioni sensibili vengono instradate a processi specifici e accessi minimizzati.

## KPI e Change Request

| **KPI**              | **Change Request** |
| -------------------- | ------------------ |
| ticket actionability | PCR-023, ACR-015   |
| triage time          | PCR-023, ACR-015   |
| reopen rate          | PCR-023, ACR-015   |

# Information Architecture TO-BE

| **Sezione TO-BE** | **Responsabilità**                                                 | **Motivazione**                                          | **Dipendenze cross-portale**                             |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------- |
| Dashboard         | Orientare il gestore sulle priorità                                | Riduce tempi morti e richieste perse                     | Admin SLA, Parent booking status                         |
| Onboarding        | Portare centro a stato approvabile                                 | Supply activation misurabile                             | Admin approvals                                          |
| Offerta           | Creare e pubblicare attività                                       | Qualità catalogo e conversione Parent                    | Admin quality, Parent search                             |
| Operatività       | Gestire richieste, booking, gruppi, presenze                       | Riduce frammentazione quotidiana                         | Parent post-booking, Admin anomalies                     |
| Crescita          | Promozioni, analytics, servizi extra                               | Efficienza e saturazione                                 | Admin services, Parent attach rate                       |
| Configurazione    | Ruoli, notifiche, supporto                                         | Sicurezza e governance                                   | Admin audit                                              |
| Diventa Partner   | Raccogliere richiesta minima, verifica identità e submission       | Massimizza conversione senza rinunciare al controllo     | Admin Review, CenterLead, Legal/Privacy                  |
| Guida Interattiva | Accompagnare configurazione e prima pubblicazione con azioni reali | Riduce time-to-value e supporto generico                 | Checklist, Activity, Week, Pricing, Feature Flags        |
| Trust & Growth    | Suggerimenti, stato verifica, livelli e incentivi                  | Trasforma qualità e comportamento in crescita misurabile | Admin Trust Engine, Parent conversion, Commercial ledger |

# Domain Model e ownership dati

| **Dominio**          | **Entità principali**                                                             | **Owner scrittura**  | **Portali consumatori** | **Regole chiave**                                                            |
| -------------------- | --------------------------------------------------------------------------------- | -------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| Center               | Partner, Center, Location, StaffRole                                              | Partner/Admin        | Parent, Admin           | Centro pubblicabile solo se approvato e completo                             |
| Activity             | Activity, ActivityVersion, Category, AgeRange                                     | Partner              | Parent, Admin           | Attività pubblicata solo con qualità e disponibilità valide                  |
| Week & Availability  | SeasonWeek, Capacity, Waitlist                                                    | Partner              | Parent, Admin           | Disponibilità source of truth per booking                                    |
| Booking              | Booking, Request, BookingStatus                                                   | Parent/Partner       | Parent, Partner, Admin  | Stati condivisi e transizioni controllate                                    |
| Operations           | Group, Roster, Attendance                                                         | Partner              | Parent, Admin           | Roster derivato da booking confermati                                        |
| Services             | ExtraService, ProviderOffer, PartnerAdoption                                      | Admin/Partner        | Parent                  | Servizio visibile solo se attivo e compatibile                               |
| Engagement           | Message, Ticket, Feedback                                                         | Partner/Parent       | Admin                   | Comunicazioni contestualizzate e tracciabili                                 |
| Verification         | PartnerVerification, VerificationStatus, VerificationDocument, AdminReview        | Partner/Admin        | Partner, Admin          | Fonti, decisioni e integrazioni sono versionate e auditabili                 |
| Activation           | TutorialProgress, TutorialModule, ChecklistItem, ProfileCompleteness              | Partner/System       | Partner, Admin          | Progressi persistenti, regole deterministiche e motori riutilizzabili        |
| Trust                | TrustScoreHistory, PartnerLevel, PartnerRanking, TrustWeightVersion               | System/Admin config  | Admin, Search/Ranking   | Score interno 0-100, automatico, pesi configurabili, nessun override manuale |
| Referral incentive   | ReferralAttribution, PartnerIncentive, IncentiveEligibility, IncentiveRuleVersion | Admin/System         | Partner, Admin, Finance | Riduzione commissione solo dopo attribuzione e target di qualità             |
| Audit & Notification | AuditEvent, Notification, NotificationPreference                                  | System/Admin/Partner | Partner, Admin          | Ogni stato e azione critica produce evento e comunicazione coerente          |

# Matrice Processi × Pagine × Responsabilità

| **Processo**                       | **Dashboard Gestor** | **Onboarding Centr** | **Profilo Centro** | **Sedi** | **Catalogo Attivit** | **Nuova Attività** | **Dettaglio Attivi** | **Calendario** | **Settimane** | **Disponibilità** | **Prezzi** | **Prenotazioni** |
| ---------------------------------- | -------------------- | -------------------- | ------------------ | -------- | -------------------- | ------------------ | -------------------- | -------------- | ------------- | ----------------- | ---------- | ---------------- |
| Onboarding e approvazione centro   | R                    | C                    | C                  | C        | C                    | R                  | C                    | C              | C             | C                 | R          | C                |
| Creazione e pubblicazione attività | C                    |                      | S                  |          | R                    | S                  |                      | C              | S             | R                 |            | S                |
| Gestione disponibilità e capienza  | C                    | S                    |                    | R        | S                    |                    |                      | C              | R             |                   | S          |                  |
| Gestione richieste                 | C                    |                      | R                  | S        |                      |                    | S                    | R              |               | S                 |            |                  |
| Gestione prenotazioni              | C                    | R                    | S                  |          |                      | S                  | R                    | C              | S             |                   |            | R                |
| Gruppi e presenze                  | R                    | S                    |                    |          | S                    | R                  |                      | C              |               |                   | R          |                  |
| Servizi extra                      | C                    |                      |                    | S        | R                    |                    | S                    | C              |               | R                 |            |                  |
| Promozioni e saturazione           | C                    | C                    | C                  | R        | C                    | C                  | C                    | C              | R             | C                 | C          | C                |
| Comunicazioni operative            | C                    | S                    | R                  |          | S                    |                    |                      | R              |               |                   | S          |                  |
| Supporto Partner contestuale       | C                    | R                    |                    | S        |                      |                    | R                    | C              |               | S                 |            | R                |

<table>
<tbody>
<tr class="odd">
<td><strong>Legenda<br />
</strong>R = responsabilità primaria; S = supporto operativo; C = controllo/governance; vuoto = non coinvolta.</td>
</tr>
</tbody>
</table>

# Backlog Change Request

| **ID**  | **Area**     | **Descrizione**                                                            | **Priorità** | **Dipendenze**                       | **Sprint** |
| ------- | ------------ | -------------------------------------------------------------------------- | ------------ | ------------------------------------ | ---------- |
| PCR-001 | Catalogo     | Dashboard task-oriented con priorità operative                             | P0           | \-                                   | S6         |
| PCR-002 | Availability | Wizard onboarding centro                                                   | P0           | Admin approval                       | S6         |
| PCR-003 | Booking      | Salvataggio bozza onboarding                                               | P1           | Admin approval                       | S8         |
| PCR-004 | Operations   | Separazione dati pubblici/amministrativi                                   | P1           | Admin approval                       | S8         |
| PCR-005 | Services     | Modello sede come entità autonoma                                          | P1           | \-                                   | S8         |
| PCR-006 | Analytics    | Activity status board                                                      | P0           | Activity model                       | S6         |
| PCR-007 | Security     | Wizard creazione attività                                                  | P0           | Activity model                       | S6         |
| PCR-008 | Onboarding   | Versioning attività e audit modifiche                                      | P1           | Activity model                       | S8         |
| PCR-009 | Catalogo     | Calendario come vista operativa                                            | P1           | \-                                   | S8         |
| PCR-010 | Availability | Standard week model                                                        | P0           | \-                                   | S6         |
| PCR-011 | Booking      | Disponibilità source of truth                                              | P0           | \-                                   | S6         |
| PCR-012 | Operations   | Pricing components                                                         | P1           | \-                                   | S8         |
| PCR-013 | Services     | Unified booking state                                                      | P0           | Booking model                        | S6         |
| PCR-014 | Analytics    | Permessi dettaglio prenotazione                                            | P1           | Booking model                        | S8         |
| PCR-015 | Security     | Coda richieste con SLA                                                     | P0           | Booking model                        | S6         |
| PCR-016 | Onboarding   | Roster gruppi derivato da booking                                          | P1           | Booking model                        | S8         |
| PCR-017 | Catalogo     | Integrazione presenze-booking                                              | P1           | Booking model                        | S8         |
| PCR-018 | Availability | Messaggistica strutturata                                                  | P1           | \-                                   | S8         |
| PCR-019 | Booking      | Marketplace servizi extra                                                  | P0           | Service model                        | S7         |
| PCR-020 | Operations   | Regole promozioni                                                          | P1           | \-                                   | S8         |
| PCR-021 | Services     | Analytics Partner actionable                                               | P1           | \-                                   | S8         |
| PCR-022 | Analytics    | Ruoli Partner granulari                                                    | P1           | \-                                   | S8         |
| PCR-023 | Security     | Supporto Partner contestuale                                               | P1           | \-                                   | S8         |
| PCR-024 | Onboarding   | Preview Parent scheda attività                                             | P1           | Activity model                       | S9         |
| PCR-025 | Catalogo     | Completezza attività obbligatoria                                          | P1           | Activity model                       | S9         |
| PCR-026 | Availability | Alert disponibilità stale                                                  | P1           | \-                                   | S9         |
| PCR-027 | Booking      | Waitlist per attività piene                                                | P1           | \-                                   | S9         |
| PCR-028 | Operations   | Export operativo prenotazioni                                              | P1           | Booking model                        | S9         |
| PCR-029 | Services     | Notifiche Partner su nuove richieste                                       | P1           | \-                                   | S9         |
| PCR-030 | Analytics    | Template comunicazioni famiglia                                            | P2           | \-                                   | S10        |
| PCR-031 | Security     | Saturazione settimanale e suggerimenti                                     | P2           | \-                                   | S10        |
| PCR-032 | Onboarding   | Gestione servizi propri vs servizi TRAMA                                   | P2           | Service model                        | S10        |
| PCR-033 | Catalogo     | Audit trail azioni staff                                                   | P2           | \-                                   | S10        |
| PCR-034 | Availability | Feature flag beta Partner                                                  | P2           | \-                                   | S10        |
| PCR-035 | Booking      | Pulizia dati test e demo                                                   | P2           | \-                                   | S10        |
| PCR-036 | Operations   | Playwright journey Partner                                                 | P0           | \-                                   | S7         |
| PCR-037 | Onboarding   | Nuovo ingresso “Diventa Partner TRAMA” con richiesta iniziale ≤2 minuti    | P0           | Partner model, Legal copy            | S6         |
| PCR-038 | Verification | Verifica identità minima, fonte pubblica e dichiarazione di rappresentanza | P0           | PCR-037, Admin Review                | S6         |
| PCR-039 | Workflow     | State machine Partner con permessi, notifiche, e-mail e storico            | P0           | PCR-038, ACR-036                     | S6         |
| PCR-040 | Activation   | Product Walkthrough contestuale e task-based                               | P0           | PCR-039, Activity/Week/Pricing flows | S7         |
| PCR-041 | Activation   | Persistenza, resume, skip e relaunch per tutorial e moduli                 | P1           | PCR-040                              | S7         |
| PCR-042 | Activation   | Checklist profilo e motore di completezza configurabile                    | P0           | PCR-039                              | S7         |
| PCR-043 | Trust        | Trust Score interno 0-100 e storico aggiornamenti                          | P1           | Verification, Analytics events       | S9         |
| PCR-044 | Trust        | Pesi Trust configurabili e versionati, senza override manuale              | P1           | PCR-043, Admin config                | S9         |
| PCR-045 | UX           | Layer di suggerimenti positivi e azionabili, senza score visibile          | P1           | PCR-042, PCR-043                     | S9         |
| PCR-046 | Trust        | Partnership Level comportamentali non acquistabili                         | P2           | PCR-043, PCR-044                     | S10        |
| PCR-047 | Platform     | Notification Center cross-state e preferenze Partner                       | P1           | PCR-039, event catalog               | S7         |
| PCR-048 | Security     | Audit Log Partner/Admin per azioni, stati e revisioni                      | P0           | PCR-039, ACR-046                     | S6-S7      |
| PCR-049 | Growth       | Attribuzione referral da CenterLead a Partner onboarding                   | P1           | Parent CR-049/051, ACR-044           | S9         |
| PCR-050 | Commercial   | Commissione ridotta condizionata a target di qualità e volume              | P1           | PCR-049, ACR-045, Commercial ledger  | S9-S10     |

# Roadmap per Sprint e criteri di accettazione

| **Sprint** | **Obiettivo**                     | **CR principali**                           | **Criteri di accettazione**                                                                                                                                     |
| ---------- | --------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S6         | Trust entry foundation            | PCR-001,037,038,039,042,048                 | Richiesta Partner ≤2 minuti; identità e fonti separate; state machine e Admin Review tracciati; checklist foundation; nessuna pubblicazione senza approvazione. |
| S7         | Activation e prima pubblicazione  | PCR-006,007,010,011,024,025,036,040,041,047 | Walkthrough task-based completo e riprendibile; prima attività, settimane, prezzi e preview Parent; notifiche e Playwright vertical slice verdi.                |
| S8         | Richieste, booking e operatività  | PCR-013-018,022,023,028,029                 | Stati condivisi; richieste con SLA; permessi e comunicazioni contestuali; nessuna re-entry tra portali.                                                         |
| S9         | Trust telemetry e referral growth | PCR-021,026,031,043-045,049,050             | Trust interno calcolato e versionato; suggerimenti positivi; referral attribuito; incentivo simulabile e monitorabile senza esporre score.                      |
| S10        | Livelli, servizi e hardening      | PCR-019,020,027,030,032-035,046             | Livelli comportamentali; servizi e promo governati; feature flag, audit, dati test puliti, security/performance/accessibility gate superati.                    |

# KPI di prodotto, UX e qualità

| **KPI**                          | **Definizione**                                     | **Owner**      | **Target iniziale**      |
| -------------------------------- | --------------------------------------------------- | -------------- | ------------------------ |
| Supply Activation Rate           | Centri approvati con almeno una attività pubblicata | Business/Ops   | \>60% pilot              |
| Time to First Published Activity | Tempo da registrazione a prima attività pubblicata  | Product/Ops    | \<5 giorni               |
| Activity Completeness Score      | Percentuale schede complete rispetto ai requisiti   | Product        | \>90%                    |
| Availability Freshness           | Disponibilità aggiornata negli ultimi N giorni      | Partner Ops    | \>85%                    |
| Request Response SLA             | Richieste risposte entro SLA                        | Partner/Ops    | \>80%                    |
| Booking Confirmation Time        | Tempo medio conferma booking                        | Partner        | \<24h                    |
| Service Attach Rate              | Prenotazioni con servizi extra                      | Business       | Baseline pilot           |
| Partner Actionability            | Ticket/feedback con contesto sufficiente            | Product        | \>75%                    |
| Partner Request Completion       | Richieste inviate / aperture “Diventa Partner”      | Product/Growth | ≥70% pilot               |
| Median Partner Request Time      | Tempo mediano apertura → submission Step 1          | Product/UX     | ≤2 minuti                |
| Verification Completion          | Partner che completano identità / richieste inviate | Ops/Product    | ≥85%                     |
| Walkthrough Completion           | Partner approvati che completano i moduli MVP       | Product        | ≥70%                     |
| Approved-to-Active Conversion    | Partner con prima offerta pubblicata / approvati    | Business/Ops   | ≥60%                     |
| Profile Checklist Completion     | Item completati / item applicabili                  | Partner Ops    | ≥90% prima pubblicazione |
| Trust Data Coverage              | Driver Trust disponibili / driver applicabili       | Data/Product   | 100% sui driver MVP      |
| Positive Suggestion Action Rate  | Suggerimenti completati / suggerimenti aperti       | Product        | Baseline pilot           |
| Referral Partner Activation      | Partner attivi / CenterLead referral qualificati    | Growth         | Baseline pilot           |
| Incentive Quality Compliance     | Partner incentivati che mantengono i target         | Business/Ops   | ≥80%                     |

# Design Decision Log

| **ID**   | **Decisione**                                          | **Razionale**                                                                            | **Alternative**                               | **Stato** |
| -------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------- | --------- |
| PDDL-001 | Dashboard Partner task-first                           | Il gestore deve sapere cosa fare, non solo leggere metriche                              | Dashboard metrica / task board                | Proposed  |
| PDDL-002 | Onboarding progressivo                                 | Riduce drop-off e consente recupero supply                                               | Form unico / wizard                           | Proposed  |
| PDDL-003 | Sede entità autonoma                                   | Logistica e servizi extra dipendono dalla sede                                           | Campo testo su attività / Location model      | Proposed  |
| PDDL-004 | Disponibilità source of truth                          | Booking affidabile richiede capienza strutturata                                         | Descrizione libera / Capacity model           | Proposed  |
| PDDL-005 | Attività versionata                                    | Modifiche post-booking devono essere tracciate                                           | Sovrascrittura diretta / versioning           | Proposed  |
| PDDL-006 | Calendario come vista                                  | Evita duplicazione con week/availability                                                 | Pagina autonoma / view                        | Proposed  |
| PDDL-007 | Stati booking condivisi                                | Parent, Partner e Admin devono leggere la stessa verità                                  | Stati locali / state machine                  | Proposed  |
| PDDL-008 | Servizi extra come sottodominio                        | Catering/navetta richiedono provider, SLA e prezzo                                       | Flag servizio / service domain                | Proposed  |
| PDDL-009 | Promozioni legate a saturazione                        | Sconti devono riempire settimane deboli                                                  | Promo manuale / rule based                    | Proposed  |
| PDDL-010 | Supporto contestuale                                   | Ticket risolvibili richiedono contesto                                                   | Form generico / contextual support            | Proposed  |
| PDDL-011 | Ruoli Partner granulari                                | Staff diversi non devono avere stessi permessi                                           | Admin unico / RBAC                            | Proposed  |
| PDDL-012 | Analytics actionable                                   | Metriche devono attivare azioni                                                          | Report statici / action analytics             | Proposed  |
| PDDL-013 | TRAMA è ecosistema controllato, non marketplace aperto | Ogni Partner modifica qualità e fiducia complessive                                      | Open listing / controlled entry               | Proposed  |
| PDDL-014 | Onboarding in due livelli                              | Richiesta rapida e verifica separata riducono drop-off senza perdere controllo           | Form unico / progressive disclosure           | Proposed  |
| PDDL-015 | Walkthrough task-based, non slide                      | Il valore nasce dal completamento di azioni reali                                        | Tour informativo / guided action              | Proposed  |
| PDDL-016 | Nessun Help Center/Academy nel MVP                     | La guida contestuale è più coerente con un prodotto iniziale e riduce contenuto obsoleto | FAQ/video / walkthrough                       | Proposed  |
| PDDL-017 | Trust Score interno e non visibile                     | Evitare effetto pagella e gaming del sistema                                             | Score pubblico / guidance positiva            | Proposed  |
| PDDL-018 | Trust Score automatico e non modificabile manualmente  | Ranking e verifiche richiedono coerenza e auditabilità                                   | Override Admin / pesi configurabili           | Proposed  |
| PDDL-019 | Partnership Level comportamentali e non acquistabili   | I livelli devono rappresentare qualità, non potere commerciale                           | Tier a pagamento / behavior tier              | Proposed  |
| PDDL-020 | Engines generici e riutilizzabili                      | Walkthrough, checklist e state machine serviranno anche ad Admin e Famiglie              | Implementazioni verticali / shared engines    | Proposed  |
| PDDL-021 | Referral attribution prima dell’onboarding             | L’incentivo deve premiare vera acquisizione incrementale                                 | Attribution post-hoc / first qualified lead   | Proposed  |
| PDDL-022 | Commissione referral condizionata a qualità            | Una fee ridotta senza target può attrarre supply debole e creare arbitraggio             | Riduzione automatica / target-based incentive | Proposed  |

# Conclusioni e punti di efficienza cross-portale

<table>
<tbody>
<tr class="odd">
<td>Efficienze attese<br />
1. Funnel Partner più corto: la richiesta iniziale richiede due minuti e rinvia la complessità alla verifica.<br />
2. Time-to-value più basso: walkthrough e checklist portano dall’approvazione alla prima offerta pubblicata senza Help Center separato.<br />
3. Trust riusabile: score, livelli, ranking e audit lavorano sugli stessi eventi e alimentano Admin e ricerca Parent.<br />
4. Meno re-entry: profilo, attività, settimane, prezzi e disponibilità restano unici per Partner, Parent e Admin.<br />
5. Supply acquisition demand-driven: i suggerimenti Genitore diventano CenterLead attribuiti e misurabili.<br />
6. Incentivi sostenibili: sconto Genitore e commissione Partner vengono erogati solo dopo attivazione e target verificati.<br />
7. Minore debito: walkthrough, checklist, notifiche, workflow e feature flag sono engine generici, non logiche hardcoded.</td>
</tr>
</tbody>
</table>
