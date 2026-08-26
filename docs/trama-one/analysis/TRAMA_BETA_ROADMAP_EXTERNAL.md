# TRAMA — External Beta Roadmap

25/08/2026. Roadmap prodotto per Partner/famiglie — non contiene backlog tecnico (migration, RLS, bug, refactoring, debito tecnico, observability, framework di test): quello resta interno.

## PRIVATE BETA — SETTEMBRE

Solo ciò che possiamo realmente offrire oggi (condizionato al redeploy dei fix già pronti, vedi `TRAMA_PLATFORM_PRODUCT_TRUTH.md`):

- Iscrizione famiglia, gestione base figli, Planner, Ricerca con filtri avanzati, richiesta prenotazione, risposta del centro (intera/per-giorno/alternativa), gestione prenotazioni, gruppi/community, condivisione piano, segnalazioni.
- Per i Partner: candidatura assistita, verifica identità assistita, gestione completa attività/calendario/prezzi/capacità, inbox richieste, risposta a prenotazioni, cancellazioni/rimborsi per giorno.
- Assistenza diretta TRAMA per: notifiche (email non ancora attive), spegnimento di un'attività, cancellazione account.

## POST-BETA / VALIDAZIONE Q4

Capability già motivate dai primi use case reali della Beta, con dipendenze e confidenza dichiarate:

| Feature | Value proposition | Stato attuale | Dipendenza | Confidenza |
|---|---|---|---|---|
| Notifiche email automatiche | Ridurre il bisogno di contatto manuale per ogni evento | Codice pronto, manca solo la configurazione del servizio esterno | Configurazione servizio email in produzione | HIGH |
| Pubblicazione/sospensione attività autonoma | Dare ai Partner il controllo di mettere in pausa un'attività senza contattarci | Non esiste ancora | Decisione di design + piccola estensione dati | HIGH |
| Modifica/cancellazione profilo figlio | Permettere correzioni senza contattare l'assistenza | Solo aggiunta esiste oggi | Estensione delle azioni esistenti | HIGH |
| Accettazione parziale strutturata per prenotazioni a settimana | Dare ai Partner lo stesso livello di flessibilità già disponibile per le prenotazioni a giorno | Oggi solo un messaggio libero | Estensione del modello di risposta già esistente per i giorni | MEDIUM |
| Dashboard analytics per Partner | Dare visibilità sulle proprie performance | Non esiste (solo lato Admin, e solo parzialmente) | Costruzione ex-novo | MEDIUM |
| Calendario scolastico integrato al Planner | Aiutare le famiglie a pianificare attorno alle chiusure scolastiche | Solo struttura dati di base predisposta, nessuna logica applicativa | Fonte dati chiusure scolastiche regionali/nazionali + logica Planner | MEDIUM |
| Cancellazione account con esportazione dati | Dare alle famiglie un controllo reale e conforme sui propri dati | Oggi solo disattivazione manuale | Pipeline di cancellazione/export dedicata | MEDIUM |

## SCALE / FUTURE

Capability strutturali per quando il prodotto cresce oltre la scala del Micro Pilot:

| Feature | Value proposition | Stato attuale | Dipendenza | Confidenza |
|---|---|---|---|---|
| Multi-sede per un Partner | Permettere a un gestore con più centri di operare da un unico account | Non supportato architetturalmente oggi | Evoluzione del modello dati di proprietà del centro | MEDIUM |
| Pagamenti in-app | Chiudere il ciclo prenotazione→pagamento dentro la piattaforma | Non esiste | Integrazione con un fornitore di pagamenti | LOW (nessuna data sostenibile oggi) |
| Famiglia multi-tenant (più tutori non conviventi) | Supportare situazioni familiari più complesse | Modello famiglia attuale è a singolo nucleo | Evoluzione dello schema dati Famiglia | LOW |

Nessuna data d'arrivo viene indicata per le voci "Scale/Future": non ancora sostenibile.
