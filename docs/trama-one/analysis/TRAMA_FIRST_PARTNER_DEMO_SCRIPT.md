# TRAMA — First Partner Demo Script

Per una demo di 10-15 minuti, uso di Fabrizio. Nessuna metrica, utente o traction inventati. **Precondizione: eseguire questa demo solo dopo che il redeploy dei fix in corso è confermato riuscito** — prima di allora, la dashboard Partner mostra dati finti e non va assolutamente mostrata a un cliente.

## 1. Ordine delle schermate

1. Modulo di candidatura pubblico (`/auth/candidati`) — mostralo da fuori, senza login.
2. Login del Partner (account già preparato in anticipo, non registrato live).
3. Dashboard del centro (`/center`) — solo dopo conferma redeploy.
4. Profilo del centro.
5. Creazione/modifica di un'attività, con calendario giorni e "Giornata particolare".
6. Inbox delle richieste (`/center/prenotazioni`).
7. Risposta a una richiesta (accetta/rifiuta/proponi alternativa).
8. Chiusura sul percorso famiglia: apri velocemente la Home/Planner di un account genitore di prova per mostrare cosa vede chi prenota.

## 2. Percorso preciso

Segui l'ordine sopra senza saltare a pagine non elencate. Non aprire menu laterali "a caso" durante la demo.

## 3. Cosa spiegare

Che TRAMA collega centri e famiglie in un unico posto: il centro gestisce calendario/prezzi/richieste, la famiglia cerca e prenota, tutto si sincronizza automaticamente.

## 4. Valore da enfatizzare

Il tempo risparmiato dal centro nel gestire calendario e richieste in un solo posto, e la chiarezza per la famiglia su cosa è disponibile e quando.

## 5. Capability reali da mostrare

Candidatura, login, profilo centro, creazione/modifica attività, calendario con modifica massiva "Giornata particolare", inbox richieste, risposta a una richiesta (intera o per singolo giorno), Planner/Ricerca/prenotazione lato famiglia.

## 6. Capability da descrivere come "Beta assistita"

Verifica identità (revisione manuale nostra), notifiche via email (oggi le comunichiamo noi direttamente), eventuale sospensione di un'attività (richiede un nostro intervento).

## 7. Feature roadmap citabili

Notifiche email automatiche, possibilità per il Partner di mettere in pausa un'attività da solo, dashboard con analisi delle performance, calendario scolastico per le famiglie — tutte descritte come "in arrivo", mai con una data specifica.

## 8. Feature che NON vanno promesse

Pagamenti in-app, multi-sede per un singolo Partner, accettazione parziale strutturata su prenotazioni a settimana intera, cancellazione dati reale/GDPR-compliant, qualunque contenuto legale (Termini/Privacy) come già pubblicato, qualunque numero di utenti o metrica di traction.

## 9. Route da NON aprire durante la demo

- `/admin` e `/admin/activities` e `/admin/analytics`: finché il redeploy non è confermato, mostrano dati completamente finti senza alcun avviso — non aprirle davanti al cliente.
- `/center` (dashboard Partner): stessa ragione, stessa condizione — verificare il redeploy prima di ogni demo.
- `/nextgen/admin`: è solo un placeholder testuale, non mostra nulla di reale.
- `/center/one`, `/admin/one/onboarding`: pagine raggiungibili solo con configurazioni particolari, possono comportarsi in modo inatteso se aperte fuori contesto.
- `/privacy`, `/terms`: non hanno ancora un contenuto legale pubblicato, mostrerebbero uno stato vuoto.

## 10. Risposta consigliata a "Ma questo funziona già?"

"Sì, quello che ti sto mostrando è il prodotto vero: un centro reale può candidarsi, gestire il proprio calendario e ricevere richieste oggi. Alcune parti — come le notifiche via email — le gestiamo ancora noi manualmente durante questa prima fase."

## 11. Risposta consigliata a "E i pagamenti?"

"I pagamenti restano fuori dalla piattaforma per ora: il centro e la famiglia si accordano separatamente. È una delle prime cose che valuteremo di integrare più avanti, ma non abbiamo ancora una data."

## 12. Risposta consigliata a "Quanti utenti avete?"

"Siamo all'inizio: stiamo aprendo con un primo gruppo ristretto di centri e famiglie proprio per rifinire il prodotto insieme a loro prima di aprire più in grande."

## 13. Risposta consigliata a "Posso gestirmi tutto da solo?"

"La gran parte sì: calendario, attività, prezzi, richieste le gestisci tu in autonomia. Alcune cose — come l'attivazione iniziale del tuo account e le notifiche email — le seguiamo insieme a te in questa prima fase."

## 14. Risposta consigliata a "Cosa vi manca prima di aprire?"

"Stiamo completando l'ultimo aggiornamento tecnico e finalizzando i testi legali (privacy e termini) con la nostra consulenza legale. Il prodotto funziona già; vogliamo essere sicuri che ogni dettaglio sia a posto prima di allargare la platea."
