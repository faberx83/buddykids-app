# TRAMA — September Beta Product Contract (uso interno)

25/08/2026 — Cosa possiamo realmente sostenere con 1 Partner + 3 famiglie, e poi con 3-5 Partner + 10-20 famiglie. Condizione preliminare a tutto quanto segue: il redeploy dei fix già pronti (vedi `TRAMA_PLATFORM_PRODUCT_TRUTH.md` §3) deve essere completato prima di onboardare il primo Partner reale.

## PER LE FAMIGLIE

| Capability | What you can do | Limit | Assistance required | Status |
|---|---|---|---|---|
| Iscrizione e accesso | Creare account, aggiungere famiglia/figli | — | Nessuna | AVAILABLE IN BETA |
| Modifica figlio | Cambiare avatar e interessi | Non puoi modificare nome/data di nascita/genere né eliminare un figlio dopo la creazione | Contattaci per correzioni | LIMITED BETA |
| Pianificazione (Planner) | Vedere copertura settimanale, budget, calendario, mappa | Le posizioni sulla mappa sono indicative, non precise | Nessuna | AVAILABLE IN BETA |
| Ricerca attività | Filtrare per età, tipo, accessibilità, dieta, disponibilità giornaliera | — | Nessuna | AVAILABLE IN BETA |
| Richiesta prenotazione ("Riempi") | Inviare una richiesta al centro per una o più settimane/giorni | La richiesta non blocca il posto finché il centro non accetta | Nessuna | AVAILABLE IN BETA |
| Risposta del centro | Vedere accettazione totale/parziale/rifiuto/proposta alternativa | — | Nessuna | AVAILABLE IN BETA |
| Gestione prenotazioni | Vedere, modificare (giorni), cancellare le proprie prenotazioni | — | Nessuna | AVAILABLE IN BETA |
| Gruppi e community | Creare/unirsi a gruppi, vedere community | — | Nessuna | AVAILABLE IN BETA |
| Condivisione piano | Condividere un link di sola lettura del proprio calendario | — | Nessuna | AVAILABLE IN BETA |
| Segnalazioni | Segnalare problemi/idee durante la Beta | — | Nessuna | AVAILABLE IN BETA |
| Notifiche email | Ricevere email per accettazione/rifiuto prenotazione | **Le email non sono ancora attive**: ti avviseremo noi direttamente finché non lo sono | TRAMA assiste (contatto diretto) | AVAILABLE — ASSISTED BETA |
| Cancellazione account | Disattivare il tuo account | La riattivazione richiede di contattarci; non è ancora una cancellazione definitiva dei dati | TRAMA assiste | LIMITED BETA |
| Calendario scolastico | — | Non esiste ancora nel prodotto | — | ROADMAP |
| Pagamenti in-app | — | Non esistono, i pagamenti restano fuori piattaforma | — | NOT ANNOUNCED |

## PER I PARTNER

| Capability | What you can do | Limit | Assistance required | Status |
|---|---|---|---|---|
| Candidatura | Presentare il tuo centro tramite il modulo pubblico | L'attivazione dell'account richiede approvazione nostra | TRAMA assiste (approvazione) | AVAILABLE — ASSISTED BETA |
| Verifica identità | Caricare un documento per la verifica | La revisione è manuale da parte nostra | TRAMA assiste | AVAILABLE — ASSISTED BETA |
| Profilo centro | Gestire foto, descrizione, servizi | — | Nessuna | AVAILABLE IN BETA |
| Creazione attività | Creare e modificare attività, tag, foto | Il modulo è un unico form, non un wizard passo-passo | Nessuna | AVAILABLE IN BETA |
| Calendario e disponibilità | Gestire giorni/settimane, capacità, prezzi, sconti, last-minute, modifiche massive ("Giornata particolare") | — | Nessuna | AVAILABLE IN BETA |
| Pubblicazione attività | — | **Non esiste ancora un modo per "spegnere" un'attività**: una volta creata resta sempre visibile finché non ci contatti | TRAMA assiste (intervento diretto) | LIMITED BETA |
| Richieste e prenotazioni | Ricevere richieste, accettare (intere o per giorno), rifiutare, proporre alternative, cancellare/rimborsare per giorno | Per le prenotazioni a settimana intera non esiste ancora un'accettazione parziale strutturata: puoi solo proporre un'alternativa in un messaggio libero | Nessuna | AVAILABLE IN BETA |
| Dashboard | **Verrà attivata con dati reali del tuo centro non appena completiamo il prossimo aggiornamento** — oggi, prima di quell'aggiornamento, non fidarti dei numeri che vedi | Vedi nota | TRAMA ti avviserà quando è pronta | **AVAILABLE — ASSISTED BETA (condizionata al redeploy)** |
| Notifiche email | Ricevere email per nuove richieste | **Non ancora attive**: ti contatteremo direttamente finché non lo sono | TRAMA assiste | AVAILABLE — ASSISTED BETA |
| Segnalazioni/supporto | Segnalare problemi/idee | — | Nessuna | AVAILABLE IN BETA |
| Analytics | — | Non esiste ancora una vista analytics per i Partner | — | ROADMAP |
| Multi-sede | — | Un account Partner gestisce un solo centro | — | NOT ANNOUNCED |

## PER TRAMA ADMIN (cosa dobbiamo essere in grado di gestire durante il pilot)

- Completare il redeploy prima di onboardare qualunque Partner reale (condizione bloccante, vedi Manual Ops Map #10).
- Iscrivere manualmente ogni centro/famiglia reale al cohort Beta (Manual Ops Map #1) — unica via oggi, nessuna UI dedicata.
- Approvare ogni candidatura centro e revisionare ogni verifica identità (operazioni attese, non gap).
- Monitorare quotidianamente le prenotazioni con `email_delivery_status = 'not_configured'` e contattare a mano genitori/centro finché Resend non è configurato (procedura già formalizzata in `GATE_RESEND_API_KEY.md`).
- Essere pronti a intervenire manualmente se un Partner vuole "spegnere" un'attività (nessun self-service oggi).
- Gestire ogni richiesta di cancellazione account con la consapevolezza che non esiste ancora una pipeline automatica né una SLA.
- Tenere sotto controllo il Feature Control Center (`/admin/feature-flags`) come unico kill switch sicuro per `TRAMA_ONE_ENABLED`, se necessario.

## Scala di riferimento

Questo contratto è scritto per 1 Partner + 3 famiglie nella prima fase, poi 3-5 Partner + 10-20 famiglie. Le voci "TRAMA assiste"/"ASSISTED BETA" sono sostenibili a questa scala con intervento manuale diretto di Fabrizio; non sono automaticamente sostenibili a una scala maggiore senza le release indicate in `TRAMA_BETA_ROADMAP_EXTERNAL.md`.
