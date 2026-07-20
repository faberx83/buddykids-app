> **DERIVED COPY — NON CANONICAL**
> Documento sorgente: TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx
> Versione: Draft 1.1 (Trust Layer e Partner Requirements integrati) — Handbook Admin
> Nome file: TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.md
> Metodo di conversione: pandoc 2.9.2.1, `pandoc -f docx -t gfm --wrap=none`
> Data di conversione: 2026-07-20 09:41 UTC
>
> Questo file è una copia derivata generata automaticamente per la sola consultazione/ricerca full-text. Non è normativo: in caso di qualunque dubbio o discrepanza fa fede esclusivamente il documento originale `../TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx`.

---

**TRAMA**

**Admin  
Product Architecture & CX Handbook**

Control plane ecosistema: governance, qualità, operatività, supply acquisition e servizi extra

| **Campo** | **Valore**                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| Versione  | Draft 1.1                                                                                                           |
| Stato     | Work in progress - Trust Layer e Partner Requirements integrati                                                     |
| Autore    | Fabrizio Pirulli                                                                                                    |
| Fonte     | Sitemap Admin (18 pagine) + Product Requirements Partner con impatti su review, trust, livelli, tutorial e referral |
| Obiettivo | Trasformare Admin in Control Room della salute dell’ecosistema e governare ingresso, fiducia, incentivi e audit     |

<table>
<tbody>
<tr class="odd">
<td>Nota metodologica<br />
La struttura Draft 1.0 è invariata. Le integrazioni distinguono requisiti operativi MVP (review, state machine, checklist, walkthrough oversight, notifiche e audit) da motori predisposti o successivi (verifica AI, recommendation, health, gamification, CRM e marketplace B2B).</td>
</tr>
</tbody>
</table>

# 1\. Executive Summary

<table>
<tbody>
<tr class="odd">
<td>Sintesi<br />
L’Admin non è un pannello CRUD: è la Control Room che protegge qualità, fiducia e continuità dell’ecosistema. I nuovi Product Requirements richiedono una dashboard di candidature, una state machine Partner esplicita, decisioni tracciate, Trust Engine interno, configurazione dei pesi, Partnership Level, oversight del walkthrough, Notification Center, Audit Log e governance degli incentivi referral. La capacità Admin deve crescere per code e SLA, senza trasformare l’esperienza Partner in un controllo burocratico.</td>
</tr>
</tbody>
</table>

| **Indicatore**                 | **Valore**                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Pagine Admin                   | 18                                                                                                                        |
| Collegamenti rilevati          | 244                                                                                                                       |
| Errori scanner                 | 0                                                                                                                         |
| Portale correlato              | Genitore + Admin + Partner                                                                                                |
| Obiettivo target               | Governance completa di marketplace, qualità e operatività                                                                 |
| Product Requirements integrati | Admin Review, Trust Engine, Partner Level, Tutorial/Checklist oversight, Notification Center, Audit e referral incentives |

## 1.1 Executive Findings

| **ID** | **Finding**                                                                                         | **Impatto** | **Priorità** | **Effetto cross-portale**                                |
| ------ | --------------------------------------------------------------------------------------------------- | ----------- | ------------ | -------------------------------------------------------- |
| AF-01  | Admin deve essere control plane, non semplice backoffice CRUD                                       | Alto        | P0           | Governance su tutti i portali                            |
| AF-02  | Approvals, qualità catalogo e anomalie booking sono code operative prioritarie                      | Alto        | P0           | Riduzione rischio marketplace                            |
| AF-03  | Supply acquisition da suggerimenti Parent richiede CenterLead, dedupe e outreach tracciato          | Alto        | P0           | Crescita supply guidata dalla domanda                    |
| AF-04  | Servizi extra richiedono modello Fornitore/Servizio/SLA/area                                        | Medio/Alto  | P1           | Nuove efficienze per centri                              |
| AF-05  | Audit log e permessi sono prerequisiti per operare su dati sensibili                                | Alto        | P0           | Compliance e accountability                              |
| AF-06  | La validazione Partner richiede una dashboard di candidature, non una tabella generica              | Alto        | P0           | Riduce tempi, errori e review non omogenee               |
| AF-07  | Trust Score, pesi e livelli devono essere configurabili, storicizzati e mai corretti manualmente    | Alto        | P1           | Ranking e controlli coerenti tra Partner e Parent        |
| AF-08  | Ogni stato Partner deve avere permessi, comunicazioni, SLA e audit                                  | Alto        | P0           | Evita partner bloccati e azioni non tracciate            |
| AF-09  | Referral reward e commission reduction richiedono attribution, eligibility, ledger e anti-frode     | Alto        | P1           | Sostenibilità economica e acquisizione supply misurabile |
| AF-10  | Admin deve osservare walkthrough e checklist senza diventare owner della configurazione del Partner | Medio       | P1           | Supporto mirato e minore lavoro manuale                  |

## 1.2 Principi di revisione

Journey first: i flussi devono seguire gli obiettivi operativi, non la struttura tecnica delle pagine.

Single source of truth: ogni dominio deve avere un owner chiaro tra Genitore, Partner e Admin.

No manual re-entry: un dato inserito da Partner o Admin deve alimentare Genitore senza duplicazione.

Operational observability: ogni stato critico deve essere monitorabile e governabile da Admin.

Pilot first: la roadmap privilegia ciò che consente validazione reale del marketplace.

Incentive governance: reward e commissioni agevolate devono derivare da eventi e regole versionate, non da eccezioni manuali.

Separation of duties: configurazione regole, review Partner e interventi commerciali devono avere permessi distinti.

Explainable trust: pesi, versioni e fonti del Trust Engine devono essere auditabili anche se non esposti al Partner.

Queue-first operations: ogni dashboard deve rendere espliciti owner, SLA, next action e motivo della priorità.

# 2\. Audit completo delle 18 schermate Admin

<table>
<tbody>
<tr class="odd">
<td><strong>Lettura dell’audit<br />
</strong>Ogni schermata Admin viene valutata rispetto a responsabilità operativa, potere di intervento, impatto sui portali Genitore/Partner, KPI e Change Request. Il punto chiave è stabilire cosa Admin può vedere, modificare, approvare o solo monitorare.</td>
</tr>
</tbody>
</table>

# Audit schermata - Dashboard Admin

| **Campo**               | **Valutazione**                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /admin/dashboard                                                                                                                                    |
| Ruolo primario          | Control plane ecosistema                                                                                                                            |
| Responsabilità target   | Priorità operative: approvazioni, anomalie, SLA, marketplace health                                                                                 |
| Attori coinvolti        | Admin Operations, Product                                                                                                                           |
| Correlazione ecosistema | Vista di controllo su Genitore e Partner                                                                                                            |
| Criticità principale    | Rischio dashboard metrica e non operativa                                                                                                           |
| Rischio operativo       | Anomalie non gestite in tempo                                                                                                                       |
| Requisiti PR integrati  | Nuove candidature, Partner in verifica/approvati/da completare/inattivi, segnalazioni, performance territoriale, categorie mancanti, alert e audit. |
| Prioritizzazione        | Coda per SLA, rischio, impatto sulla domanda e blocco della pubblicazione; massimo tre focus operativi principali.                                  |
| Cross-portale           | Riceve submission Partner, demand gap Parent, feedback beta e anomalie booking; emette decisioni e configurazioni.                                  |
| NFR / controlli         | RBAC, audit 100% azioni sensibili, filtri salvabili, alert deduplicati, rollback feature flag.                                                      |

## KPI da monitorare

• Open critical queues

• Partner approval SLA

• Marketplace health

• Incomplete/inactive Partner rate

• Territory/category gaps

• Audit exceptions

## Change Request collegate

• ACR-001 Admin command center

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
La Control Room mostra candidature, Partner da completare/inattivi, categorie e territori scoperti, anomalie e audit; ogni elemento ha owner, SLA e next action.</td>
</tr>
</tbody>
</table>

# Audit schermata - Approvazioni Partner

| **Campo**               | **Valutazione**                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /admin/partners/approvals                                                                                                                     |
| Ruolo primario          | Qualifica supply                                                                                                                              |
| Responsabilità target   | Approvare, chiedere integrazioni o rifiutare gestori                                                                                          |
| Attori coinvolti        | Admin Operations                                                                                                                              |
| Correlazione ecosistema | Partner onboarding e visibilità Parent                                                                                                        |
| Criticità principale    | Criteri approvazione non formalizzati                                                                                                         |
| Rischio operativo       | Centri incompleti o non affidabili pubblicati                                                                                                 |
| Processo sorgente       | Candidatura avviata dal flusso “Diventa Partner TRAMA”.                                                                                       |
| Card candidatura        | Logo, nome, categoria, città, stato, completezza, documenti, fonti, data, note e quick actions.                                               |
| Azioni                  | Approva, richiedi integrazione, metti in revisione, rifiuta, contatta Partner, visualizza storico.                                            |
| State machine           | Richiesta → Documentazione → Verifica → Revisione → Approvato / changes requested / rejected.                                                 |
| Audit                   | Ogni decisione richiede reason code, note, attore, timestamp e notifica coerente al Partner.                                                  |
| Wireframe funzionale    | Queue filtrabile + card candidatura + side panel 360 + action bar Approva/Integra/Revisione/Rifiuta + timeline audit.                         |
| Microcopy decisionale   | Messaggi separati per richiesta ricevuta, integrazione, revisione, approvazione e rifiuto; sempre motivazione, prossimo passo e tempo atteso. |

## KPI da monitorare

• Median time to first review

• Time to decision

• Changes requested rate

• Decision consistency

• Reopened reviews

• Approved-to-active conversion

## Change Request collegate

• ACR-002 Approval workflow

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
La review utilizza card complete, state machine esplicita, quick actions, reason code, storico e notifica; nessuna decisione sensibile è priva di AuditEvent.</td>
</tr>
</tbody>
</table>

# Audit schermata - Dettaglio Partner

| **Campo**               | **Valutazione**                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /admin/partners/:id                                                                                                          |
| Ruolo primario          | Gestione anagrafica gestore                                                                                                  |
| Responsabilità target   | Vedere stato, sedi, attività, documenti, performance e problemi                                                              |
| Attori coinvolti        | Admin                                                                                                                        |
| Correlazione ecosistema | Interviene su dati Partner e qualità Parent                                                                                  |
| Criticità principale    | Troppi dati senza separazione operativa                                                                                      |
| Rischio operativo       | Errore umano in modifiche sensibili                                                                                          |
| Trust 360               | Verification, checklist, Product Walkthrough progress, Trust Score history, driver, Partner Level, ranking e incidenti.      |
| Controlli               | Trust Score non modificabile manualmente; Admin configura pesi/versioni e può aprire review, non sovrascrivere il risultato. |
| Referral                | Visualizzare CenterLead sorgente, famiglia referrer pseudonimizzata, attribution e stato incentivo.                          |

## KPI da monitorare

• Trust driver coverage

• Trust score volatility

• Partner level progression

• Checklist completion

• Tutorial completion

• Admin intervention rate

## Change Request collegate

• ACR-003 Partner 360

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
Partner 360 separa identità, verifica, checklist, walkthrough, Trust, level, commerciale, sicurezza e storico; score e ranking non sono modificabili manualmente.</td>
</tr>
</tbody>
</table>

# Audit schermata - Registry Centri

| **Campo**               | **Valutazione**                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /admin/centers                                                                                                |
| Ruolo primario          | Anagrafica centri/sedi                                                                                        |
| Responsabilità target   | Gestire centri, sedi, duplicati e lead non iscritti                                                           |
| Attori coinvolti        | Admin                                                                                                         |
| Correlazione ecosistema | Supply Acquisition, Parent suggerisce centri                                                                  |
| Criticità principale    | Centro iscritto e lead non separati                                                                           |
| Rischio operativo       | Dedupe difficile e catalogo sporco                                                                            |
| Referral pipeline       | CenterLead, DemandContext, invitation, claim, onboarding, activation e reward status.                         |
| Deduplica               | Nome, indirizzo, dominio, contatti, P.IVA e match con partner/centri esistenti.                               |
| Anti-abuso              | Rate limit, self-referral, relazioni tra referrer e organizzazione, duplicati e contestazioni di attribution. |

## KPI da monitorare

• Lead dedupe precision

• Qualified CenterLead rate

• Claim rate

• Referral activation

• Attribution disputes

• Time to first published activity

## Change Request collegate

• ACR-004 Center registry + lead dedupe

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
CenterLead, CenterClaim, PartnerVerification, Partner attivo e attività pubblicata sono stati distinti; attribution e incentivi non creano listing pubblico anticipato.</td>
</tr>
</tbody>
</table>

# Audit schermata - Catalogo Attività

| **Campo**               | **Valutazione**                                                        |
| ----------------------- | ---------------------------------------------------------------------- |
| Route / Area            | /admin/activities                                                      |
| Ruolo primario          | Governance qualità offerta                                             |
| Responsabilità target   | Validare contenuti, categorie, età, settimane, pricing e pubblicazione |
| Attori coinvolti        | Admin Content/Ops                                                      |
| Correlazione ecosistema | Impatto diretto su ricerca Parent e conversione                        |
| Criticità principale    | Moderazione non basata su checklist                                    |
| Rischio operativo       | Offerta incoerente e bassa fiducia                                     |

## KPI da monitorare

• Activities pending review

• Quality score

• Search defects

## Change Request collegate

• ACR-005 Activity quality workflow

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Nessuna attività va online senza quality score minimo.</td>
</tr>
</tbody>
</table>

# Audit schermata - Dettaglio Attività Admin

| **Campo**               | **Valutazione**                                                   |
| ----------------------- | ----------------------------------------------------------------- |
| Route / Area            | /admin/activities/:id                                             |
| Ruolo primario          | Controllo puntuale offerta                                        |
| Responsabilità target   | Audit, correzioni controllate, storico modifiche e preview Parent |
| Attori coinvolti        | Admin, Partner                                                    |
| Correlazione ecosistema | Allinea Partner con esperienza Parent                             |
| Criticità principale    | Modifica diretta può bypassare Partner                            |
| Rischio operativo       | Conflitti di ownership                                            |

## KPI da monitorare

• Admin edits

• Partner corrections

• Re-review rate

## Change Request collegate

• ACR-006 Governed edits

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Ogni modifica Admin ha motivazione e notifica quando impatta Partner.</td>
</tr>
</tbody>
</table>

# Audit schermata - Prenotazioni Admin

| **Campo**               | **Valutazione**                                      |
| ----------------------- | ---------------------------------------------------- |
| Route / Area            | /admin/bookings                                      |
| Ruolo primario          | Supervisione transazioni                             |
| Responsabilità target   | Monitorare stati, anomalie, cancellazioni e supporto |
| Attori coinvolti        | Admin Ops/Support                                    |
| Correlazione ecosistema | Parent e Partner condividono stato booking           |
| Criticità principale    | Manca vista eccezioni prioritaria                    |
| Rischio operativo       | Booking bloccati e perdita fiducia                   |

## KPI da monitorare

• Stuck bookings

• Disputes

• Admin interventions

## Change Request collegate

• ACR-007 Booking operations queue

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>La vista ordina le prenotazioni per rischio operativo e SLA.</td>
</tr>
</tbody>
</table>

# Audit schermata - Richieste / Lead

| **Campo**               | **Valutazione**                                           |
| ----------------------- | --------------------------------------------------------- |
| Route / Area            | /admin/requests                                           |
| Ruolo primario          | Monitor domanda non convertita                            |
| Responsabilità target   | Controllare richieste verso partner e suggerimenti centri |
| Attori coinvolti        | Admin commerciale                                         |
| Correlazione ecosistema | Parent genera domanda; Partner converte o perde           |
| Criticità principale    | Richieste e lead supply possono confondersi               |
| Rischio operativo       | Pipeline non misurabile                                   |

## KPI da monitorare

• Request SLA

• Lead conversion

• Lost demand

## Change Request collegate

• ACR-008 Demand and supply queues

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Richieste famiglia e lead centro sono code distinte ma correlate.</td>
</tr>
</tbody>
</table>

# Audit schermata - Utenti e Famiglie

| **Campo**               | **Valutazione**                                             |
| ----------------------- | ----------------------------------------------------------- |
| Route / Area            | /admin/families                                             |
| Ruolo primario          | Supporto account Parent                                     |
| Responsabilità target   | Assistenza, stato account, consenso, anomalie e beta cohort |
| Attori coinvolti        | Admin Support                                               |
| Correlazione ecosistema | Parent e feedback beta                                      |
| Criticità principale    | Accesso dati sensibili non minimizzato                      |
| Rischio operativo       | Privacy e abuso interno                                     |

## KPI da monitorare

• Support cases

• Data access events

• Consent issues

## Change Request collegate

• ACR-009 Family support permissions

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Accesso ai dati famiglia è profilato e tracciato.</td>
</tr>
</tbody>
</table>

# Audit schermata - Pagamenti / Commissioni

| **Campo**               | **Valutazione**                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /admin/payments                                                                                                              |
| Ruolo primario          | Governance economica                                                                                                         |
| Responsabilità target   | Commissioni, payout, fee, rimborsi e riconciliazioni                                                                         |
| Attori coinvolti        | Admin Finance                                                                                                                |
| Correlazione ecosistema | Partner ricavi; Parent pagamenti                                                                                             |
| Criticità principale    | Commissioni non collegate a booking states                                                                                   |
| Rischio operativo       | Disallineamento economico                                                                                                    |
| Incentivi referral      | Configurare 5% standard / 3% agevolato, durata 12 mesi o 50 booking, target e cause di revoca.                               |
| Reward Genitore         | 10% fino a 25 euro sul primo booking confermato con il centro referral, scadenza 6 mesi; nel beta può essere shadow/manuale. |
| Ledger                  | Eligibility, earned, issued, redeemed, expired, suspended e reversed derivano da eventi tracciati.                           |

## KPI da monitorare

• Commission accuracy

• Referral incentive eligibility

• Reward issued/redeemed

• Incentive quality compliance

• Reversal/fraud rate

• Reconciliation errors

## Change Request collegate

• ACR-010 Commercial ledger

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
Commissioni e reward derivano da booking e referral events; regole, soglie, versioni, sospensioni, scadenze e reversal sono riconciliabili.</td>
</tr>
</tbody>
</table>

# Audit schermata - Servizi Extra

| **Campo**               | **Valutazione**                                             |
| ----------------------- | ----------------------------------------------------------- |
| Route / Area            | /admin/services                                             |
| Ruolo primario          | Marketplace B2B extra                                       |
| Responsabilità target   | Configurare catering, navette, pre/post e offerte ai centri |
| Attori coinvolti        | Admin BizDev, Partner                                       |
| Correlazione ecosistema | Partner attiva; Parent compra/vede                          |
| Criticità principale    | Servizi extra non modellati come offerta B2B                |
| Rischio operativo       | Operazioni manuali e promesse non scalabili                 |

## KPI da monitorare

• Service adoption

• Attach rate

• Service incidents

## Change Request collegate

• ACR-011 Extra service platform

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Servizi hanno provider, condizioni, aree, SLA e visibilità configurabili.</td>
</tr>
</tbody>
</table>

# Audit schermata - Fornitori

| **Campo**               | **Valutazione**                                |
| ----------------------- | ---------------------------------------------- |
| Route / Area            | /admin/suppliers                               |
| Ruolo primario          | Gestione supplier ecosystem                    |
| Responsabilità target   | Onboarding, copertura, listini e SLA fornitori |
| Attori coinvolti        | Admin BizDev/Ops                               |
| Correlazione ecosistema | Supporta servizi extra per Partner             |
| Criticità principale    | Fornitore non collegato a servizio e area      |
| Rischio operativo       | Catering/navetta non erogabile                 |

## KPI da monitorare

• Supplier coverage

• SLA breaches

• Active suppliers

## Change Request collegate

• ACR-012 Supplier model

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Un servizio extra non è proponibile senza fornitore e area validi.</td>
</tr>
</tbody>
</table>

# Audit schermata - Tassonomie / Contenuti

| **Campo**               | **Valutazione**                                                |
| ----------------------- | -------------------------------------------------------------- |
| Route / Area            | /admin/taxonomies                                              |
| Ruolo primario          | Regole catalogo                                                |
| Responsabilità target   | Gestire categorie, età, tag, stagioni, servizi e copy standard |
| Attori coinvolti        | Admin Product/Content                                          |
| Correlazione ecosistema | Parent ricerca; Partner creazione attività                     |
| Criticità principale    | Tassonomie hardcoded o duplicate                               |
| Rischio operativo       | Ricerca incoerente                                             |

## KPI da monitorare

• Taxonomy usage

• Unmapped activities

• Filter conversion

## Change Request collegate

• ACR-013 Taxonomy governance

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Tutte le categorie usate da Partner sono governate da Admin.</td>
</tr>
</tbody>
</table>

# Audit schermata - Analytics Ecosistema

| **Campo**               | **Valutazione**                                             |
| ----------------------- | ----------------------------------------------------------- |
| Route / Area            | /admin/analytics                                            |
| Ruolo primario          | Osservabilità marketplace                                   |
| Responsabilità target   | Misurare supply, demand, conversione, qualità, stagionalità |
| Attori coinvolti        | Admin, Product, Business                                    |
| Correlazione ecosistema | Tutti i portali                                             |
| Criticità principale    | Metriche non collegate a decisioni                          |
| Rischio operativo       | Roadmap guidata da impressioni                              |

## KPI da monitorare

• North Star

• Supply activation

• Booking conversion

## Change Request collegate

• ACR-014 Ecosystem analytics

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Ogni dashboard ha owner, frequenza e decisione collegata.</td>
</tr>
</tbody>
</table>

# Audit schermata - Support Tickets

| **Campo**               | **Valutazione**                                 |
| ----------------------- | ----------------------------------------------- |
| Route / Area            | /admin/support                                  |
| Ruolo primario          | Gestione assistenza multi-portale               |
| Responsabilità target   | Triage feedback, bug, supporto Parent e Partner |
| Attori coinvolti        | Admin Support/Product                           |
| Correlazione ecosistema | Floating CTA beta e Partner support             |
| Criticità principale    | Ticket non contestualizzati                     |
| Rischio operativo       | Bassa actionability                             |

## KPI da monitorare

• Triage time

• Actionability rate

• Reopen rate

## Change Request collegate

• ACR-015 Unified support queue

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Ogni ticket è collegato a route, utente, dominio e severità.</td>
</tr>
</tbody>
</table>

# Audit schermata - Feedback Beta

| **Campo**               | **Valutazione**                           |
| ----------------------- | ----------------------------------------- |
| Route / Area            | /admin/beta-feedback                      |
| Ruolo primario          | Product discovery contestuale             |
| Responsabilità target   | Gestire segnalazioni beta da floating CTA |
| Attori coinvolti        | Product, Admin                            |
| Correlazione ecosistema | Parent/Partner/Admin beta feedback        |
| Criticità principale    | Feedback non trasformato in backlog       |
| Rischio operativo       | Perdita apprendimento clienti amici       |

## KPI da monitorare

• Feedback actionability

• Feedback to CR

• Median triage

## Change Request collegate

• ACR-016 Beta feedback triage

<table>
<tbody>
<tr class="odd">
<td><strong>Criterio di accettazione schermata<br />
</strong>Ogni feedback viene classificato entro SLA e legato a bug/CR/decisione.</td>
</tr>
</tbody>
</table>

# Audit schermata - Configurazione Sistema

| **Campo**               | **Valutazione**                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Route / Area            | /admin/settings                                                                          |
| Ruolo primario          | Feature flag e parametri                                                                 |
| Responsabilità target   | Controllare feature beta, ruoli, soglie e parametri marketplace                          |
| Attori coinvolti        | Admin Superuser                                                                          |
| Correlazione ecosistema | Tutti i portali                                                                          |
| Criticità principale    | Configurazioni critiche senza governance                                                 |
| Rischio operativo       | Rotture applicative o esposizione errata                                                 |
| Trust configuration     | Driver, pesi, soglie, versioni, livelli e date di efficacia.                             |
| Referral configuration  | Reward, cap, durata, first-qualified attribution, target Partner, cumulabilità e budget. |
| Feature flags           | Rollout per coorte di onboarding, walkthrough, trust, livelli e incentivi con rollback.  |

## KPI da monitorare

• Trust rule versions

• Config changes with approval

• Feature flag rollback time

• Referral budget consumption

• Configuration incidents

## Change Request collegate

• ACR-017 Controlled configuration

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
Pesi Trust, livelli, referral reward, commission tiers e feature flag sono versionati, approvati, auditati e reversibili.</td>
</tr>
</tbody>
</table>

# Audit schermata - Audit Log / Admin Users

| **Campo**               | **Valutazione**                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Route / Area            | /admin/audit-log                                                                                                                             |
| Ruolo primario          | Sicurezza e tracciabilità                                                                                                                    |
| Responsabilità target   | Tracciare azioni sensibili e gestire utenti Admin                                                                                            |
| Attori coinvolti        | Admin Superuser, Security                                                                                                                    |
| Correlazione ecosistema | Tutti i domini dati                                                                                                                          |
| Criticità principale    | Assenza di audit trail completo                                                                                                              |
| Rischio operativo       | Compliance e accountability insufficienti                                                                                                    |
| Requisiti PR integrati  | Audit di review, cambi stato, pesi Trust, livelli, referral attribution, reward, commissioni, configurazioni e impersonation/support access. |
| Immutabilità            | Gli eventi non vengono cancellati; eventuali correzioni sono nuovi eventi correlati.                                                         |

## KPI da monitorare

• Sensitive actions logged

• Unattributed changes

• Role drift

• Audit query time

• Unauthorized attempts

• Correction events

## Change Request collegate

• ACR-018 Audit and roles

<table>
<tbody>
<tr class="odd">
<td>Criterio di accettazione schermata<br />
Audit Log copre review, Trust config, livelli, referral attribution, incentivi, accessi ai dati e correzioni tramite eventi append-only.</td>
</tr>
</tbody>
</table>

# 3\. Journey e processi Admin

# AJ01 - Approva e attiva partner

<table>
<tbody>
<tr class="odd">
<td>Obiettivo<br />
Garantire un ingresso Partner rapido ma controllato, con review coerente, attivazione guidata e dati Trust utilizzabili senza trasformare Admin in un revisore burocratico.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Registrazione Partner → revisione manuale non standard → richieste integrazione non strutturate → approvazione → configurazione Partner non osservabile

## Diagramma TO-BE

Partner Request → Identity Verification → Application Card → Admin Review → approve / changes / review / reject → Audit + Notification → Partner Walkthrough → Checklist → first publish → active → Trust/Level monitoring

## Business Rules

BR-01-01 La candidatura Admin è una pratica di workflow con stato, non una riga anagrafica.

BR-01-02 Ogni card mostra dati identificativi, completezza, documenti/fonti, data, note e azioni rapide.

BR-01-03 Approva, integrazione, revisione e rifiuto richiedono reason code e AuditEvent.

BR-01-04 Ogni stato determina permessi Partner, comunicazioni e SLA.

BR-01-05 La verifica AI non viene eseguita nel MVP; l’architettura supporta fonti e adapter futuri.

BR-01-06 L’approvazione abilita il walkthrough ma non rende automaticamente pubblicabile un’attività incompleta.

BR-01-07 Admin vede progresso checklist e tutorial per supporto, senza completare attività al posto del Partner.

BR-01-08 Trust Score e livello sono calcolati dal sistema e non modificabili manualmente.

BR-01-09 I pesi Trust e le soglie sono configurazioni versionate con separation of duties.

BR-01-10 Ogni cambiamento di stato o configurazione produce Notification e AuditEvent.

## KPI e Change Request

| **KPI**         | **Change Request** |
| --------------- | ------------------ |
| time to approve | ACR-002, ACR-003   |
| revision rate   | ACR-002, ACR-003   |
| approved supply | ACR-002, ACR-003   |

# AJ02 - Governance qualità attività

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Assicurare schede comparabili e affidabili per i genitori.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Attività pubblicate con controlli variabili

## Diagramma TO-BE

Review queue → quality score → preview Parent → approve/pending → publish

## Business Rules

BR-02-01 Quality score minimo obbligatorio.

BR-02-02 Categorie da tassonomia.

BR-02-03 Prezzi/settimane verificati.

## KPI e Change Request

| **KPI**            | **Change Request**        |
| ------------------ | ------------------------- |
| quality score      | ACR-005, ACR-006, ACR-013 |
| activities pending | ACR-005, ACR-006, ACR-013 |
| search defects     | ACR-005, ACR-006, ACR-013 |

# AJ03 - Gestione booking anomali

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Sbloccare prenotazioni critiche e ridurre perdita fiducia.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Booking distribuiti tra Partner e Parent

## Diagramma TO-BE

Exception queue → owner → intervento → notifica → chiusura con reason code

## Business Rules

BR-03-01 Booking bloccato oltre SLA entra in coda.

BR-03-02 Ogni intervento admin è tracciato.

BR-03-03 Famiglia e Partner hanno stato allineato.

## KPI e Change Request

| **KPI**           | **Change Request** |
| ----------------- | ------------------ |
| stuck bookings    | ACR-007            |
| intervention time | ACR-007            |
| disputes          | ACR-007            |

# AJ04 - Pipeline domanda non servita

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Trasformare richieste e suggerimenti centri in crescita supply.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Richieste e suggerimenti dispersi

## Diagramma TO-BE

Parent suggestion/invite → CenterLead + DemandContext → dedupe → first-qualified attribution → outreach/invitation → claim → Partner request/verification → Admin approval → first publish → activation → Parent reward eligibility + Partner commission incentive

## Business Rules

BR-04-01 Un centro suggerito è CenterLead e non un listing pubblico.

BR-04-02 Lead duplicati aggregano DemandContext ma non moltiplicano reward economici.

BR-04-03 L’attribution economica usa il primo suggerimento qualificato precedente alla registrazione/claim.

BR-04-04 Self-referral, organizzazioni collegate e anomalie devono essere sottoposte a controllo anti-abuso.

BR-04-05 Il Genitore matura il reward solo dopo approvazione, prima attività pubblicata e primo booking confermato con il centro.

BR-04-06 Il reward proposto è 10% fino a 25 euro, one-shot, scadenza 6 mesi e non cumulabile salvo regola esplicita.

BR-04-07 Il Partner accede alla commissione ridotta solo dopo attivazione e target di qualità verificati.

BR-04-08 Ogni passaggio lead → claim → activation → reward/incentive è tracciato e notificabile.

## KPI e Change Request

| **KPI**           | **Change Request** |
| ----------------- | ------------------ |
| lead conversion   | ACR-004, ACR-008   |
| lost demand       | ACR-004, ACR-008   |
| center claim rate | ACR-004, ACR-008   |

# AJ05 - Servizi extra e fornitori

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Creare efficienza B2B per centri senza servizi.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Servizi extra gestiti manualmente

## Diagramma TO-BE

Supplier → service → area/SLA/pricing → proposta Partner → attivazione → Parent visibility

## Business Rules

BR-05-01 Servizio richiede fornitore valido.

BR-05-02 Area copertura obbligatoria.

BR-05-03 Adesione Partner tracciata.

## KPI e Change Request

| **KPI**           | **Change Request** |
| ----------------- | ------------------ |
| service adoption  | ACR-011, ACR-012   |
| supplier coverage | ACR-011, ACR-012   |
| attach rate       | ACR-011, ACR-012   |

# AJ06 - Supporto unificato

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Gestire problemi Genitore, Partner e feedback beta in un’unica logica.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Canali separati e non contestualizzati

## Diagramma TO-BE

Unified queue → triage → bug/CR/support → owner → chiusura → analytics

## Business Rules

BR-06-01 Ticket ha contesto.

BR-06-02 Feedback beta triage entro SLA.

BR-06-03 Bug ricorrente genera CR.

## KPI e Change Request

| **KPI**       | **Change Request** |
| ------------- | ------------------ |
| triage time   | ACR-015, ACR-016   |
| actionability | ACR-015, ACR-016   |
| reopen rate   | ACR-015, ACR-016   |

# AJ07 - Tassonomie e catalogo

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Mantenere coerenza di ricerca, filtri e creazione attività.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Categorie duplicate/hardcoded

## Diagramma TO-BE

Admin taxonomy → Partner creation → Parent filters → analytics adoption

## Business Rules

BR-07-01 Solo tassonomie attive sono usabili.

BR-07-02 Deprecazioni hanno migrazione.

BR-07-03 Tag non mappati bloccano pubblicazione.

## KPI e Change Request

| **KPI**             | **Change Request** |
| ------------------- | ------------------ |
| unmapped activities | ACR-013            |
| filter usage        | ACR-013            |
| conversion by tag   | ACR-013            |

# AJ08 - Commercial governance

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Controllare commissioni, payout, rimborsi e marginalità.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Dati economici non sempre collegati agli stati operativi

## Diagramma TO-BE

Booking/referral event → eligibility engine → commission tier / reward → ledger → issue/redeem/payout/reversal → quality monitoring → expiry or renewal → reconciliation

## Business Rules

BR-08-01 Ogni evento economico deriva da booking, servizio o referral tracciato.

BR-08-02 Rimborsi, reversal e sospensioni hanno reason code e correlazione all’evento originario.

BR-08-03 Commissioni, reward e target sono versionati con data di efficacia.

BR-08-04 La commissione standard proposta è 5%; il referral tier è 3% per 50 booking o 12 mesi.

BR-08-05 Il referral tier richiede profilo ≥90%, SLA risposta ≥80%, disponibilità fresca ≥90% e cancellazioni \<5%.

BR-08-06 Il reward Genitore è earned solo con prima transazione confermata; nessun vantaggio economico sulla sola segnalazione.

BR-08-07 In beta senza pagamento, eligibility e costi sono calcolati in shadow mode o applicati manualmente con audit.

BR-08-08 Budget, cap, cumulabilità e anti-frode sono configurazioni Admin separate dai contenuti UI.

## KPI e Change Request

| **KPI**               | **Change Request** |
| --------------------- | ------------------ |
| reconciliation errors | ACR-010            |
| refund time           | ACR-010            |
| commission accuracy   | ACR-010            |

# AJ09 - Feature flags e configurazioni

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Abilitare beta e rollout controllati senza rischi.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Configurazioni potenzialmente manuali

## Diagramma TO-BE

Flag → target cohort → rollout → monitoring → rollback

## Business Rules

BR-09-01 Flag critico richiede owner.

BR-09-02 Rollback disponibile.

BR-09-03 Cambio configurazione tracciato.

## KPI e Change Request

| **KPI**          | **Change Request** |
| ---------------- | ------------------ |
| config incidents | ACR-017            |
| rollback time    | ACR-017            |
| flag changes     | ACR-017            |

# AJ10 - Audit e sicurezza interna

<table>
<tbody>
<tr class="odd">
<td><strong>Obiettivo<br />
</strong>Garantire accountability su dati e azioni sensibili.</td>
</tr>
</tbody>
</table>

## Diagramma AS-IS

Logging parziale

## Diagramma TO-BE

Role model → action log → review → alert anomalie → remediation

## Business Rules

BR-10-01 Azioni sensibili sempre loggate.

BR-10-02 Accesso dati personali minimizzato.

BR-10-03 Ruoli admin periodicamente rivisti.

## KPI e Change Request

| **KPI**                  | **Change Request** |
| ------------------------ | ------------------ |
| sensitive actions logged | ACR-018            |
| unauthorized attempts    | ACR-018            |
| role drift               | ACR-018            |

# Information Architecture TO-BE

| **Sezione TO-BE**      | **Responsabilità**                                            | **Motivazione**                                              | **Dipendenze cross-portale**                             |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| Command Center         | Priorità operative e anomalie                                 | Admin lavora per code e SLA, non per menu                    | Tutti i portali                                          |
| Supply Governance      | Partner, centri, lead e approvazioni                          | Garantisce qualità e crescita offerta                        | Partner onboarding, Parent suggestions                   |
| Catalog Governance     | Attività, tassonomie, contenuti                               | Rende la ricerca Parent coerente                             | Partner activity creation                                |
| Marketplace Operations | Booking, richieste, supporto                                  | Riduce frizioni transazionali                                | Parent/Partner status                                    |
| Services Platform      | Fornitori e servizi extra                                     | Abilita efficienze B2B e nuove revenue                       | Partner services, Parent extras                          |
| System Governance      | Ruoli, audit, configurazioni                                  | Sicurezza e controllo                                        | Tutti i domini                                           |
| Partner Review & Trust | Candidature, verifiche, checklist, score, livelli e storico   | Unifica qualità di ingresso e monitoraggio continuo          | Partner onboarding, Parent catalog/ranking               |
| Activation Oversight   | Walkthrough, tutorial progress, profilo e first publish       | Riduce partner approvati ma inattivi                         | Partner Dashboard, Activity, Notifications               |
| Referral & Incentives  | CenterLead, attribution, reward, commission tier e anti-abuso | Trasforma domanda non servita in crescita supply sostenibile | Parent suggestion, Partner onboarding, Commercial ledger |

# Domain Model e ownership dati

| **Dominio**          | **Entità principali**                                                      | **Owner scrittura**  | **Portali consumatori**  | **Regole chiave**                                                         |
| -------------------- | -------------------------------------------------------------------------- | -------------------- | ------------------------ | ------------------------------------------------------------------------- |
| Supply               | Partner, Center, CenterLead, CenterClaim                                   | Admin/Partner        | Parent, Partner          | Lead suggeriti e centri iscritti sono stati distinti                      |
| Catalog              | Activity, Taxonomy, QualityScore                                           | Admin/Partner        | Parent                   | Pubblicazione governata da qualità                                        |
| Transaction          | Booking, Request, PaymentEvent                                             | Parent/Partner/Admin | Tutti                    | Stati e ledger derivano da eventi tracciati                               |
| Services             | Supplier, ExtraService, SLA, CoverageArea                                  | Admin                | Partner, Parent          | Servizi extra richiedono fornitore valido                                 |
| Support              | Ticket, BetaFeedback, Resolution                                           | Admin/Product        | Parent, Partner          | Feedback convertibile in CR o bug                                         |
| Security             | AdminUser, Role, AuditEvent                                                | Admin Superuser      | Audit                    | Azione sensibile sempre tracciata                                         |
| Analytics            | Event, KPI, Cohort, Report                                                 | Admin/Product        | Business                 | Metriche collegate a decisioni                                            |
| Partner verification | PartnerVerification, VerificationStatus, VerificationDocument, AdminReview | Admin/Partner        | Partner, Admin           | Decisioni e fonti versionate; nessuna pubblicazione prima di approvazione |
| Trust governance     | TrustScoreHistory, TrustWeightVersion, PartnerLevel, PartnerRanking        | System/Admin config  | Admin, Search/Ranking    | Score automatico, non sovrascrivibile; pesi e soglie versionati           |
| Activation oversight | TutorialProgress, TutorialModule, ChecklistItem, ProfileCompleteness       | Partner/System       | Partner, Admin           | Admin monitora, Partner esegue; motori generici                           |
| Referral economics   | ReferralAttribution, ReferralReward, PartnerIncentive, EligibilityDecision | System/Admin         | Parent, Partner, Finance | Reward e fee ridotta solo dopo eventi e target eleggibili                 |
| Notification & audit | Notification, NotificationTemplate, AuditEvent, CorrectionEvent            | System/Admin         | Partner, Admin, Parent   | Stati e azioni critiche hanno comunicazioni e audit append-only           |

# Matrice Processi × Pagine × Responsabilità

| **Processo**                   | **Dashboard Admin** | **Approvazioni Par** | **Dettaglio Partne** | **Registry Centri** | **Catalogo Attivit** | **Dettaglio Attivi** | **Prenotazioni Adm** | **Richieste / Lead** | **Utenti e Famigli** | **Pagamenti / Comm** | **Servizi Extra** | **Fornitori** |
| ------------------------------ | ------------------- | -------------------- | -------------------- | ------------------- | -------------------- | -------------------- | -------------------- | -------------------- | -------------------- | -------------------- | ----------------- | ------------- |
| Approva e attiva partner       | R                   | C                    | C                    | C                   | C                    | R                    | C                    | C                    | C                    | C                    | R                 | C             |
| Governance qualità attività    | C                   |                      | S                    |                     | R                    | S                    |                      | C                    | S                    | R                    |                   | S             |
| Gestione booking anomali       | C                   | S                    |                      | R                   | S                    |                      |                      | C                    | R                    |                      | S                 |               |
| Pipeline domanda non servita   | C                   |                      | R                    | S                   |                      |                      | S                    | R                    |                      | S                    |                   |               |
| Servizi extra e fornitori      | C                   | R                    | S                    |                     |                      | S                    | R                    | C                    | S                    |                      |                   | R             |
| Supporto unificato             | R                   | S                    |                      |                     | S                    | R                    |                      | C                    |                      |                      | R                 |               |
| Tassonomie e catalogo          | C                   |                      |                      | S                   | R                    |                      | S                    | C                    |                      | R                    |                   |               |
| Commercial governance          | C                   | C                    | C                    | R                   | C                    | C                    | C                    | C                    | R                    | C                    | C                 | C             |
| Feature flags e configurazioni | C                   | S                    | R                    |                     | S                    |                      |                      | R                    |                      |                      | S                 |               |
| Audit e sicurezza interna      | C                   | R                    |                      | S                   |                      |                      | R                    | C                    |                      | S                    |                   | R             |

<table>
<tbody>
<tr class="odd">
<td><strong>Legenda<br />
</strong>R = responsabilità primaria; S = supporto operativo; C = controllo/governance; vuoto = non coinvolta.</td>
</tr>
</tbody>
</table>

# Backlog Change Request

| **ID**  | **Area**     | **Descrizione**                                              | **Priorità** | **Dipendenze**            | **Sprint** |
| ------- | ------------ | ------------------------------------------------------------ | ------------ | ------------------------- | ---------- |
| ACR-001 | Governance   | Admin command center operativo                               | P0           | \-                        | S6         |
| ACR-002 | Booking      | Workflow approvazione Partner                                | P0           | Partner model             | S6         |
| ACR-003 | Supply       | Partner 360                                                  | P1           | Partner model             | S8         |
| ACR-004 | Services     | Registry centri e lead dedupe                                | P0           | CenterLead model          | S6         |
| ACR-005 | Support      | Activity quality workflow                                    | P0           | \-                        | S6         |
| ACR-006 | Taxonomy     | Modifiche governate attività                                 | P1           | \-                        | S8         |
| ACR-007 | Finance      | Booking operations queue                                     | P0           | Booking model             | S6         |
| ACR-008 | Security     | Code domanda e supply                                        | P0           | CenterLead model          | S6         |
| ACR-009 | Approvals    | Permessi supporto famiglie                                   | P1           | \-                        | S8         |
| ACR-010 | Governance   | Commercial ledger                                            | P1           | Booking model             | S8         |
| ACR-011 | Booking      | Piattaforma servizi extra                                    | P0           | Service/Supplier model    | S7         |
| ACR-012 | Supply       | Supplier model                                               | P1           | Service/Supplier model    | S8         |
| ACR-013 | Services     | Taxonomy governance                                          | P0           | \-                        | S7         |
| ACR-014 | Support      | Ecosystem analytics                                          | P1           | \-                        | S8         |
| ACR-015 | Taxonomy     | Unified support queue                                        | P0           | \-                        | S7         |
| ACR-016 | Finance      | Beta feedback triage                                         | P0           | \-                        | S7         |
| ACR-017 | Security     | Configurazione controllata e rollback                        | P1           | \-                        | S8         |
| ACR-018 | Approvals    | Audit log e ruoli Admin                                      | P0           | \-                        | S7         |
| ACR-019 | Governance   | Checklist qualità centro                                     | P1           | Partner model             | S8         |
| ACR-020 | Booking      | Reason code richieste integrazione                           | P1           | Partner model             | S9         |
| ACR-021 | Supply       | Scoring marketplace health                                   | P1           | \-                        | S9         |
| ACR-022 | Services     | SLA engine richieste/prenotazioni                            | P1           | Booking model             | S9         |
| ACR-023 | Support      | Lead supply outreach tracking                                | P1           | CenterLead model          | S9         |
| ACR-024 | Taxonomy     | Center claim process                                         | P1           | CenterLead model          | S9         |
| ACR-025 | Finance      | Cohort beta management                                       | P1           | \-                        | S9         |
| ACR-026 | Security     | Incident management operativo                                | P1           | \-                        | S9         |
| ACR-027 | Approvals    | Commission versioning                                        | P1           | Booking model             | S9         |
| ACR-028 | Governance   | Supplier SLA monitoring                                      | P1           | Service/Supplier model    | S9         |
| ACR-029 | Booking      | Data access minimization                                     | P2           | \-                        | S10        |
| ACR-030 | Supply       | Admin feature flags                                          | P2           | \-                        | S10        |
| ACR-031 | Services     | Report settimanale pilot                                     | P2           | \-                        | S10        |
| ACR-032 | Support      | Playwright Admin journeys                                    | P0           | \-                        | S7         |
| ACR-033 | Taxonomy     | Data retention policies                                      | P2           | \-                        | S10        |
| ACR-034 | Finance      | Cross-portal event catalog                                   | P2           | \-                        | S10        |
| ACR-035 | Approvals    | Dashboard candidature con card, quick actions e SLA          | P0           | Partner request model     | S6         |
| ACR-036 | Approvals    | State machine Partner, permessi, reason code e comunicazioni | P0           | ACR-035, Partner PCR-039  | S6         |
| ACR-037 | Verification | Modello fonti/documenti e adapter per verifica futura        | P1           | PartnerVerification       | S6-S7      |
| ACR-038 | Activation   | Oversight checklist, completezza e first publish             | P1           | Partner PCR-042           | S7         |
| ACR-039 | Activation   | Oversight tutorial progress e re-engagement                  | P1           | Partner PCR-040/041       | S7         |
| ACR-040 | Trust        | Trust Score engine interno e history                         | P1           | Event catalog, analytics  | S9         |
| ACR-041 | Trust        | Configurazione pesi/soglie Trust versionata                  | P1           | ACR-040, RBAC             | S9         |
| ACR-042 | Trust        | Partnership Level e ranking governance                       | P2           | ACR-040/041               | S10        |
| ACR-043 | Platform     | Notification Center e template per stati Partner             | P1           | ACR-036, event catalog    | S7         |
| ACR-044 | Growth       | Referral attribution, dedupe e anti-abuso                    | P1           | CenterLead, Parent CR-051 | S9         |
| ACR-045 | Commercial   | Reward Genitore e commission incentive eligibility/ledger    | P1           | ACR-010, ACR-044          | S9-S10     |
| ACR-046 | Security     | Audit esteso per trust, review, livelli e incentivi          | P0           | ACR-018, ACR-036/041/045  | S6-S10     |

# Roadmap per Sprint e criteri di accettazione

| **Sprint** | **Obiettivo**                   | **CR principali**                   | **Criteri di accettazione**                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S6         | Control Room e ingresso Partner | ACR-001,002,004,005,018,035-037,046 | Candidature in card; state machine e quick actions; audit e notifiche; lead/centri distinti; nessuna decisione priva di reason code. Gate pre-coding: journey, BPMN, state machine, wireframe Partner/Admin, module architecture, ER, migrazione, rollout, test e microcopy approvati. |
| S7         | Activation oversight e supporto | ACR-015,016,032,038,039,043         | Checklist e tutorial osservabili; unified support; feedback beta; notifiche; Playwright review-to-first-publish verdi.                                                                                                                                                                 |
| S8         | Booking, catalogo e servizi     | ACR-006-013,017,019,020,022         | Quality workflow, booking exceptions, tassonomie e service model; config/rollback operativi.                                                                                                                                                                                           |
| S9         | Trust e referral economics      | ACR-014,021,023-028,040,041,044,045 | Trust history e pesi versionati; referral attribution; shadow ledger reward/commission; anti-abuso e marketplace health.                                                                                                                                                               |
| S10        | Livelli, sicurezza e hardening  | ACR-029-034,042,046                 | Partnership Level, RBAC, retention, audit coverage, event catalog e quality gates cross-portale superati.                                                                                                                                                                              |

# KPI di prodotto, UX e qualità

| **KPI**                             | **Definizione**                                      | **Owner**        | **Target iniziale**   |
| ----------------------------------- | ---------------------------------------------------- | ---------------- | --------------------- |
| Marketplace Health Score            | Indice combinato supply, domanda, qualità e anomalie | Product/Business | Baseline pilot        |
| Time to Approve Partner             | Tempo da submission a decisione Admin                | Ops              | \<3 giorni            |
| Activity Quality Score              | Qualità media schede pubblicate                      | Product          | \>85/100              |
| Stuck Booking Rate                  | Booking fermi oltre SLA                              | Ops              | \<5%                  |
| Lost Demand Rate                    | Richieste senza risposta o senza offerta             | Business         | Trend decrescente     |
| Lead to Active Center               | Lead/suggerimenti convertiti in centro attivo        | BizDev           | Baseline pilot        |
| Service Adoption Rate               | Centri che adottano servizi extra                    | Business         | Baseline              |
| Audit Coverage                      | Azioni sensibili tracciate                           | Security         | 100%                  |
| Partner Application First Review    | Tempo submission → prima azione Admin                | Ops              | \<1 giorno lavorativo |
| Decision Consistency                | Decisioni conformi a checklist / decisioni           | Product/Ops      | \>95%                 |
| Approved-to-Active Conversion       | Partner attivi / approvati                           | Business/Ops     | \>60% pilot           |
| Trust Data Coverage                 | Driver popolati / driver applicabili                 | Data/Product     | 100% driver MVP       |
| Trust Manual Override               | Modifiche manuali al punteggio                       | Security/Product | 0                     |
| Referral Attribution Dispute Rate   | Attribution contestate / referral                    | Growth/Ops       | \<2%                  |
| Parent Reward Earn Rate             | Reward earned / referral qualificati                 | Growth           | Baseline pilot        |
| Referral Partner Quality Compliance | Partner referral che mantengono target               | Business/Ops     | ≥80%                  |
| Incentive Reversal Rate             | Reward/fee reversed per abuso o errore               | Finance/Ops      | \<2%                  |

# Design Decision Log

| **ID**   | **Decisione**                                                 | **Razionale**                                                       | **Alternative**                             | **Stato** |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- | --------- |
| ADDL-001 | Admin come control plane                                      | TRAMA deve governare processi, non solo dati                        | CRUD / command center                       | Proposed  |
| ADDL-002 | Approvazione con checklist                                    | Qualità supply richiede criteri espliciti                           | Review libera / checklist                   | Proposed  |
| ADDL-003 | CenterLead distinto da Center                                 | Suggerimenti Parent non sono centri pubblicabili                    | Unica anagrafica / lead model               | Proposed  |
| ADDL-004 | Quality score attività                                        | Catalogo affidabile richiede regole oggettive                       | Moderazione manuale / scoring               | Proposed  |
| ADDL-005 | Booking exception queue                                       | Admin deve vedere prima ciò che blocca valore                       | Lista completa / exception queue            | Proposed  |
| ADDL-006 | Servizi extra B2B                                             | Catering/navette creano nuovo sottodominio                          | Note testuali / service platform            | Proposed  |
| ADDL-007 | Supplier model                                                | Un servizio senza fornitore e SLA non è governabile                 | Servizio generico / supplier domain         | Proposed  |
| ADDL-008 | Supporto unificato                                            | Beta feedback e ticket devono alimentare backlog                    | Canali separati / unified queue             | Proposed  |
| ADDL-009 | Tassonomie governate                                          | Filtri Parent e creazione Partner devono condividere semantica      | Hardcoded / admin taxonomy                  | Proposed  |
| ADDL-010 | Audit log obbligatorio                                        | Dati sensibili e azioni critiche richiedono accountability          | Logging parziale / audit trail              | Proposed  |
| ADDL-011 | Feature flag controllati                                      | Beta e rollout richiedono rollback                                  | Deploy diretto / feature flags              | Proposed  |
| ADDL-012 | Ledger commerciale event-based                                | Commissioni devono derivare da eventi di dominio                    | Calcoli manuali / ledger                    | Proposed  |
| ADDL-013 | Candidatura Partner come workflow card-based                  | Review e SLA non sono governabili con tabella CRUD                  | Generic table / review cards                | Proposed  |
| ADDL-014 | State machine Partner centrale                                | Permessi e comunicazioni devono dipendere da un solo stato canonico | Flags locali / shared state machine         | Proposed  |
| ADDL-015 | Trust Score non modificabile manualmente                      | Evitare favoritismi e perdita di spiegabilità                       | Admin override / configurable weights       | Proposed  |
| ADDL-016 | Pesi Trust versionati con separation of duties                | Cambi ranking hanno impatto economico e reputazionale               | Config libera / governed version            | Proposed  |
| ADDL-017 | Admin osserva, Partner completa il walkthrough                | Evitare che Ops faccia data entry al posto della supply             | Admin completion / Partner ownership        | Proposed  |
| ADDL-018 | Center referral usa first-qualified attribution               | Premiare acquisizione incrementale evitando duplicati               | Last touch / first qualified                | Proposed  |
| ADDL-019 | Reward Genitore solo dopo transazione confermata              | La sola segnalazione incentiva spam e non genera valore verificato  | Reward on submit / activation+booking       | Proposed  |
| ADDL-020 | Commissione Partner ridotta solo con target                   | Fee agevolata deve premiare supply di qualità                       | Automatic discount / quality-gated tier     | Proposed  |
| ADDL-021 | Incentivi gestiti da ledger event-based                       | Servono riconciliazione, reversal e audit                           | Manual notes / incentive ledger             | Proposed  |
| ADDL-022 | Trust, checklist, tutorial e notification come shared engines | Riduce hardcoding e consente riuso sui tre portali                  | Vertical implementations / platform engines | Proposed  |

# Conclusioni e punti di efficienza cross-portale

<table>
<tbody>
<tr class="odd">
<td>Efficienze attese<br />
1. Review coerente: candidature, fonti, checklist e decisioni usano un unico workflow con SLA e audit.<br />
2. Meno Partner inattivi: Admin monitora walkthrough e first publish senza sostituirsi al Gestore.<br />
3. Trust spiegabile: score, pesi, livelli e ranking condividono eventi, history e configurazioni versionate.<br />
4. Crescita supply demand-driven: CenterLead e attribution collegano i gap Parent all’onboarding Partner.<br />
5. Incentivi sostenibili: reward e commissione ridotta sono condizionati a attivazione, booking e qualità.<br />
6. Meno lavoro manuale: code operative, notifiche e reason code sostituiscono e-mail e controlli ad hoc.<br />
7. Riutilizzo cross-portale: state machine, walkthrough, checklist, notification, audit e feature flags diventano servizi comuni.</td>
</tr>
</tbody>
</table>
