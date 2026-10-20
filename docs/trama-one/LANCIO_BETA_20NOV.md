# TRAMA — Dove siamo e piano di lancio della beta famiglie (20/11/2026)

**Data:** 20/10/2026 · **Produzione:** commit `21412d9`, deploy del 20/10 alle 16:20 · **Autore:** Claude, chat "00 · Stato & Roadmap"
**Fonti:** verifica in sola lettura di database, hosting e repository fatta oggi; documenti di iniziativa del Project. Dati personali e identificativi tecnici omessi.

> **Per il revisore esterno (ChatGPT o altri).** Questo documento è la sintesi per un audit indipendente. Il founder vuole lanciare il **20/11/2026** una beta a inviti con famiglie amiche, con tutte le funzioni accese e il focus sui genitori. Ti chiediamo di contestare premesse, priorità e piano, non di confermarli. Le domande sono nella sezione 12. Il pre-mortem è in un documento a parte (`PREMORTEM.md`) e la guida per le famiglie in `GUIDA_FAMIGLIE_BETA.md`.

> **Nota sulla data.** Il 20 novembre è la *Giornata internazionale dei diritti dell'infanzia e dell'adolescenza*. La *Giornata internazionale delle famiglie* è invece il 15 maggio. Il 20/11 funziona come data di lancio, ma va comunicato con il riferimento corretto e con tono sobrio: un'app che lancia "nel giorno dei diritti dei bambini" rischia di sembrare opportunista.

---

## 1. In una pagina

- **Cos'è TRAMA.** È una web app installabile (PWA) per i genitori italiani che organizzano il tempo dei figli:
  - attività e corsi;
  - ponti e vacanze scolastiche;
  - centri estivi;
  - chi accompagna e chi ritira.

  C'è anche un portale per i centri e un'area Admin. Primo mercato: Milano.
- **Chi la fa.** Un founder solo e non tecnico, part-time, con il codice scritto da assistenti AI. Il deploy lo fa sempre lui, con un comando.
- **Cosa è cambiato in tre settimane:**
  - redesign completo dell'app famiglie (V2);
  - dominio `tramapp.it` attivo;
  - email transazionali configurate;
  - nuove notifiche ("Chi accompagna domani?", "Scuola chiusa", "Il buongiorno di TRAMA");
  - informative in bozza dentro l'app;
  - pagina pubblica di benvenuto con lista d'attesa;
  - Radar per segnalare attività trovate fuori.

  In tutto **44 commit dal 14/10**.
- **Cosa non è cambiato: nessun utente esterno.**
  - 10 account, tutti del founder o di persone vicine;
  - nessuna iscrizione negli ultimi 30 giorni;
  - lista d'attesa vuota.
- **La decisione.** Lancio beta il 20/11 con famiglie amiche, **tutte le funzioni accese**, focus genitori. I centri arriveranno "per accerchiamento": se le famiglie usano TRAMA, i centri seguiranno. Poi un modello freemium per le famiglie e, solo dopo, la commissione sui centri.
- **Giudizio sintetico di Claude.** Il prodotto è pronto per amici molto più di quanto lo fosse un mese fa. Il rischio del 20/11 non è il codice: è che le famiglie trovino un'app **vuota o rotta al primo passo**.
  - Oggi **nessuna attività ha date future**.
  - Le email di conferma della registrazione passano da un canale con limiti molto bassi.
  - Le informative pubblicate hanno ancora i campi del titolare da compilare.
  - Le notifiche più importanti non sono mai state provate con un caso vero.

  Sono tutti problemi risolvibili in 31 giorni, ma vanno affrontati **prima** di aggiungere altro.

---

## 2. Risposte rapide

| Domanda | Risposta verificata |
|---|---|
| Il pulsante flottante delle segnalazioni è stato tolto apposta? | **Sì**, il 14/10 (commit "Polish V2: un solo flottante"): con la nuova barra l'unico elemento flottante è il **+**. Il feedback si apre da **Profilo → "Aiutaci a migliorare TRAMA"** e dalla riga **"Dicci cosa ne pensi"** in fondo alla Home (dal 15/10). Nel portale Gestori il pulsante flottante c'è ancora. Per la beta conviene renderlo più visibile (sezione 6). |
| Le notifiche funzionano tutte? | Il **meccanismo** sì: i job automatici girano ogni giorno, push e campanella sono attivi. Però **nessuna push di promemoria è mai partita**, perché non c'era nessun caso da segnalare (tabella in sezione 5). Solo 3 utenti hanno le notifiche push attive, e dopo il cambio di dominio vanno riattivate. |
| La notifica di check-in funziona? | Il job gira ogni mattina alle 7:30 (10 esecuzioni negli ultimi 10 giorni), ma ha sempre trovato **zero bambini da segnalare**. Il check-in parte solo per le **prenotazioni TRAMA del giorno**, e oggi non esiste nessuna attività con date future. Quindi non è mai stata provata davvero e **non riguarda gli impegni aggiunti a mano**. Per provarla serve una prenotazione di prova su un giorno della settimana in corso (sezione 9, settimana 2). |

---

## 3. Cosa esiste oggi (app famiglie)

Funzioni visibili alla coorte beta, salvo dove indicato:

| Area | Cosa fa | Stato per la beta |
|---|---|---|
| Benvenuto (`tramapp.it/benvenuto`) | Pagina pubblica, "Cosa fa TRAMA" animato, lista d'attesa | Pubblica. **Lista d'attesa: 0 iscritti.** Nessun avviso email al founder: manca la variabile `WAITLIST_NOTIFY_EMAIL`. |
| Accesso e onboarding | Registrazione con codice beta; onboarding in 3 schermate, poi figli e scuola | V2. Le email di conferma partono dal servizio standard di Supabase (vedi sezione 6, B2). |
| Home | Saluto, **Oggi** (prenotazioni, impegni, chi porta e chi ritira), **Da fare**, riepilogo del periodo, prossima chiusura scolastica, azioni rapide | V2 |
| Planner | **Settimana / Stagione**, Mese, Chi fa cosa (anche sugli impegni aggiunti a mano, solo feriali), condividi ed esporta (.ics), Mappa e Gruppi | V2. "Stagione" conta solo le settimane estive. |
| + (barra) | Un impegno, Chi accompagna, Una scoperta (Radar), Un altro genitore | V2 |
| Scopri | Per quando (ponti, prossime settimane, estate), Per chi, filtri, Elenco/Mappa; centri Partner, Scoperte TRAMA (fonti pubbliche), scoperte della community | V2. **Nessuna data futura prenotabile.** |
| Richiesta a un centro | 2 passi, "Invia la richiesta al centro", "Nessun pagamento adesso" | V2. Il centro risponde dal suo portale. |
| Prenotazioni | In arrivo / Passate / Da sistemare, stato spiegato | V2 |
| Profilo e famiglia | La tua famiglia (figli, genitori, chi vi aiuta, luoghi), impostazioni, informative, segnalazioni | V2 |
| Classe e scuola | Gruppi di classe o scuola con proposte | V2. Serve massa critica nella stessa classe. |
| Radar | Foto, link o testo di un'attività trovata fuori → scheda strutturata, controllo doppioni | Acceso per la beta. **L'estrazione AI è simulata** (manca la chiave): con una foto senza testo il risultato è nullo. |
| Calendario scolastico | Chiusure 2026/27 per Lombardia/Milano e Puglia/Rutigliano | Acceso per la beta. Fuori da queste zone non c'è. |
| Il buongiorno di TRAMA | Riepilogo del mattino alle 8, push ed email, attivabile dal Profilo | **Solo anteprima interna.** |
| Chi accompagna "plus" | Scelta istantanea, tutto l'impegno, avviso all'altro genitore | **Solo anteprima interna** (rilasciato oggi). |
| Consensi | Accettazione delle informative all'ingresso | Acceso per la beta. Le informative pubblicate sono **bozze con campi da completare** (titolare, sede, P.IVA). |

**Portale centri:** completo (attività, settimane e giorni, posti, prezzi, risposte alle richieste, presenze), ancora nello stile precedente. **Admin:** feature flag a livelli, inviti beta, lista d'attesa, moderazione Radar, calendari scolastici. Alcune dashboard mostrano ancora dati finti.

**Tecnica:**
- stack Next.js + Supabase (dati in UE) + Vercel;
- ogni funzione nasce dietro flag e sale per gruppi;
- 44 migration del database;
- circa 950 test automatici nella cartella principale, in gran parte logica e controlli sul sorgente;
- i test end-to-end reali non sono mai stati eseguiti in modo completo.

---

## 4. Numeri reali (20/10/2026)

| Voce | Valore |
|---|---|
| Account | 10 (7 genitori, 2 gestori, 1 admin). 0 nuovi in 30 giorni. |
| Figli registrati | 16 |
| Coorte beta | 9 membri; anteprima interna 2 |
| Centri / attività | 9 / 8, tutti di prova. Tre si chiamano ancora "Test centro estivo", "Centro pippo", "[TEST] Centro BuddyKids". |
| Date prenotabili future | **0.** Tutte le 35 settimane di attività sono di giugno–agosto 2026. |
| Prenotazioni | 20 (17 confermate), tutte di prova e passate |
| Impegni aggiunti a mano | 8 |
| Feedback | 59, l'ultimo il 09/10 |
| Lista d'attesa | 0 |
| Notifiche push attive | 3 utenti (9 dispositivi) |
| Informative | Privacy e Termini "bozza 1" pubblicate il 16/10; 0 accettazioni registrate |

---

## 5. Notifiche ed email: cosa è davvero verificato

| Messaggio | Canale | Quando parte | Stato |
|---|---|---|---|
| Check-in di oggi ("X è arrivato?") con Sì / In ritardo / No | Push | Ogni mattina alle 7:30, solo per **prenotazioni TRAMA** del giorno | Il job gira, ma **mai inviata** (0 casi). Da provare con una prenotazione di prova. |
| "Domani: chi accompagna?" | Push | Ogni sera, se manca chi porta o ritira (prenotazioni + impegni, lun–ven) | Il job gira (3 genitori abilitati), **0 invii finora** |
| "Scuola chiusa tra una settimana / dopodomani" | Push | Ogni sera, se una chiusura non è organizzata | Stesso job, 0 invii finora |
| Nuova proposta in Classe e scuola | Push | Quando un'altra famiglia propone | Mai provata con due famiglie vere |
| Il buongiorno di TRAMA | Push + email | Alle 8 | Solo anteprima interna |
| Risposta del centro (accettata, non accettata, lista d'attesa, proposta) | Email + campanella | Quando il centro risponde | Email configurata il 16–20/10, **nessun invio registrato da allora** |
| Inviti (altro genitore, gruppo, centro → famiglia) | Email | All'invio | Configurata; da confermare con una prova reale |
| Conferma registrazione, reset password | Email **di Supabase** (non `tramapp.it`) | All'iscrizione | Il servizio standard di Supabase ha un **limite di invio molto basso** (pochi messaggi l'ora): con 15 famiglie insieme molte conferme non arriverebbero. **Bloccante.** |
| Avviso al founder per la lista d'attesa | Email | A ogni iscrizione dal benvenuto | **Non attivo:** manca `WAITLIST_NOTIFY_EMAIL` |

**Limite da spiegare alle famiglie:** su iPhone le notifiche arrivano solo se TRAMA è aggiunta alla schermata Home (Safari → Condividi → "Aggiungi alla schermata Home") e si consente l'invio. È il punto in cui più famiglie si perderanno.

---

## 6. Cosa manca per il 20/11

### Bloccanti: senza questi non si invita nessuno

| # | Cosa | Perché | Chi |
|---|---|---|---|
| B1 | **Catalogo con date future.** Togliere i centri di test; aggiungere attività di novembre–dicembre (corsi settimanali, ponte dell'Immacolata 7–8/12, vacanze di Natale) | Oggi Scopri non ha niente di prenotabile: l'app sembra vuota | Fabrizio e Claude (sezione 7) |
| B2 | **Email di registrazione dal dominio** (SMTP di Supabase tramite Resend) | Il limite del servizio standard blocca le iscrizioni in gruppo | Fabrizio (impostazione Supabase), Claude (istruzioni) |
| B3 | **Titolare del trattamento** e campi delle informative completati (anche solo il founder come persona fisica per la beta), poi bozza 2 | Si stanno raccogliendo dati di minori con un'informativa che dice "[RAGIONE SOCIALE DA COMPLETARE]" | Fabrizio decide; Claude aggiorna i testi |
| B4 | **Scadenze silenziose:** codice `TRAMABETA26` (01/12) e accesso della coorte beta a TRAMA ONE, impegni esterni e Scoperte (31/12) | La beta si spegnerebbe da sola a metà dicembre | Fabrizio, da Admin: nuovo codice e proroga a fine giugno 2027 |
| B5 | **Prova generale** di tutti i percorsi con 2–3 famiglie vicinissime, su iPhone e Android: iscrizione, figli, impegni, invito all'altro genitore, chi accompagna, richiesta a un centro, risposta, check-in, email, push | Nessun percorso è mai stato fatto da qualcuno che non sia il founder | Fabrizio + 2–3 famiglie |

### Importanti: da fare entro il 20/11

| # | Cosa | Perché |
|---|---|---|
| I1 | **Congelare le funzioni** dal 27/10: solo correzioni e voci di questa lista | Ogni novità rimanda la prova generale e aumenta i bug |
| I2 | **Cruscotto beta:** una query settimanale con attivazione, uso, coordinamento e ritorno per famiglia. Gli eventi di prodotto oggi non hanno un identificativo utente | Senza, il 20/12 non sapremo se ha funzionato |
| I3 | **Feedback visibile** per la durata della beta (riga fissa in Home o pulsante nel Profilo in evidenza) e 5 interviste in calendario | Il feedback oggi è nascosto |
| I4 | **Radar:** accendere l'AI vera (chiave e costo da decidere, da dichiarare nell'informativa) oppure nascondere "foto" e tenere link/testo | Con l'AI simulata la foto di un volantino non produce niente: delude |
| I5 | **Vercel a pagamento** (Pro) prima del lancio | Il piano gratuito è per uso non commerciale e conserva i log solo 1 ora: un bug segnalato la sera non è più diagnosticabile |
| I6 | **Backup del database:** verificare il piano Supabase e avere almeno un backup scaricato prima del lancio | Dati di famiglie vere |
| I7 | **Notifiche push** riattivate su `tramapp.it` per i 3 account esistenti; passaggio "a tutti" del trasloco e Site URL di Supabase | Dopo il cambio dominio le vecchie iscrizioni push non valgono |
| I8 | `WAITLIST_NOTIFY_EMAIL`, casella `trama@tramapp.it` funzionante (è il Reply-To) | Le risposte delle famiglie non devono perdersi |
| I9 | Accendere per la beta "Il buongiorno di TRAMA" e "Chi accompagna plus", dopo una settimana di prova interna | Sono le due funzioni che creano abitudine |
| I10b | **Regione dei server vicina ai dati:** le funzioni Vercel girano negli USA (`iad1`), il database è a Parigi. Ogni pagina fa più letture che attraversano l'Atlantico. Una riga in `vercel.json` (`"regions": ["cdg1"]`) | App più veloce e dati trattati in UE, più semplice da scrivere nell'informativa |
| I10 | Pagina pubblica del piano condiviso e "Classe e scuola": verifica con due famiglie della stessa classe | È ciò che vedono nonni e altri genitori |

### Rimandabili dopo il 20/11
- Impegni ricorrenti ("ogni martedì"). Utili, ma per la beta basta inserire le date a mano o copiare la settimana. Se diventa la prima lamentela, sono la prima cosa da fare a dicembre.
- Messaggi ai centri come conversazione, Accompagnamento/Ritiro completo, Deleghe.
- Restyle del portale centri.
- Pagamenti, multi-sede.

---

## 7. Centri: veri, finti o tutti e due?

**Raccomandazione:** tre livelli, mai mescolati e mai camuffati.

| Livello | Cosa | Perché | Come |
|---|---|---|---|
| 1. **Scoperte TRAMA** (vere, da fonti pubbliche) | 30–50 attività reali nelle zone delle famiglie invitate: corsi pomeridiani, open day, ponte dell'Immacolata, campus di Natale, Carnevale | È il cuore del family-first: utili subito, senza bisogno che il centro sia su TRAMA. "Aggiungi al Planner" invece di "Prenota". | Claude prepara il dataset; Fabrizio sceglie le zone (quelle delle scuole delle famiglie invitate) |
| 2. **Centri di prova**, dichiarati | 3 centri con nome e badge espliciti ("Centro di prova"), date da novembre a gennaio, compresi giorni della settimana in corso | Servono a provare richiesta, risposta, email e check-in. **Non devono sembrare veri:** un amico che "prenota" un campus inesistente è il peggior incidente possibile | Gestiti dagli account gestore di prova del founder, che risponde alle richieste. La guida lo spiega. |
| 3. **1–2 centri veri amici** | Una realtà che il founder conosce (per esempio l'associazione di ginnastica ritmica di cui ha rifatto il sito) con i corsi veri della stagione | È l'unico modo di provare il ciclo completo famiglia ↔ centro con dati reali, e il primo caso di "accerchiamento" | Guida già nel repo (`GUIDA_TOUR_PER_CENTRO_AMICO.md`); onboarding seguito da vicino |

**Da non fare:** centri finti con nomi realistici, recensioni e voti inventati, o "posti disponibili" che nessuno gestisce. Oltre al rischio di fiducia, le regole del progetto vietano dati di test visibili in produzione come se fossero veri.

**Limite del modello dati:** un corso settimanale si rappresenta oggi come una serie di giorni singoli. Per la beta va bene (si caricano 8–10 date); se i centri veri arrivano, serve la ricorrenza.

---

## 8. Strategia: famiglie prima ("accerchiamento")

### La tesi
1. TRAMA è utile a una famiglia anche se nessuno dei suoi centri è su TRAMA: impegni, chi accompagna, ponti, condivisione con i nonni.
2. Ogni famiglia, usandola, genera **segnali di domanda sui centri**:
   - impegni con il nome del centro;
   - "Centri che hai suggerito";
   - segnalazioni Radar;
   - Scoperte salvate.
3. Quando un centro ha 5–10 famiglie della sua zona che lo hanno già nel Planner, TRAMA si presenta con un dato, non con una promessa: *"12 famiglie del tuo quartiere organizzano già i tuoi corsi su TRAMA"*. Questo è l'accerchiamento.

### Condizioni perché funzioni
- **Densità, non numero.** 15 famiglie di 2 classi della stessa scuola valgono più di 40 famiglie sparse per Milano: Classe e scuola, Gruppi e "Chi accompagna" tra famiglie vivono di vicinanza. Raccomandazione: invitare per **grappoli** (2–3 classi o scuole).
- **Un'abitudine quotidiana.** Il buongiorno delle 8, "Domani chi accompagna?" e la Home "Oggi" sono il motivo per riaprire l'app. Senza un'abitudine, un planner muore in una settimana.
- **Due adulti per famiglia.** Il valore del coordinamento esiste solo se anche l'altro genitore (o i nonni) è dentro.
- **Misurare i segnali sui centri**: quali centri e attività citano le famiglie. Oggi i dati ci sono, sparsi in tre tabelle; serve un riepilogo per centro.

### Modello economico in tre tempi
| Fase | Quando | Cosa | Cosa si impara |
|---|---|---|---|
| 1. Beta gratuita, tutto acceso | 20/11/2026 → primavera 2027 | Nessun prezzo. Una "porta finta" per TRAMA Plus ("Mi interessa") per misurare l'interesse. | Uso ricorrente, funzioni che contano, prima disponibilità a pagare |
| 2. Freemium famiglie | Dopo la stagione estiva 2027, se la ritenzione regge | Gratis il cuore (Planner, impegni, Scopri). Plus: famiglia allargata, buongiorno avanzato, sincronizzazione calendario, storico, più figli o nonni. Prezzo indicativo 2–4 €/mese. | Conversione (attesa realistica: 2–5% degli attivi) |
| 3. Centri | Quando ci sono richieste reali verso centri reali | Commissione sulla richiesta confermata (3–5%) o canone leggero, solo sul valore portato | Accettazione dei centri, disintermediazione |

**Opinione di Claude:**
- l'ordine è giusto per imparare, ma il freemium B2C da solo difficilmente sostiene il progetto: per arrivare a 1.000 €/mese servono circa 400 famiglie paganti, cioè 8–20 mila famiglie attive;
- il freemium va quindi letto come prova di valore, non come modello di ricavo;
- i ricavi veri passano dai centri (fase 3) o da canali B2B2C (welfare aziendale, comuni). Conviene tenerlo scritto ora, per non scoprirlo tra un anno.

### "Tutto acceso" in beta: sì, con due accortezze
- **Tutto acceso, ma guidato:** la guida chiede 5 "missioni" nella prima settimana (vedi `GUIDA_FAMIGLIE_BETA.md`), non "esplora".
- **Nascondere o etichettare ciò che oggi delude:**
  - foto nel Radar senza AI;
  - prenotazione su centri di prova (badge);
  - "Stagione" fuori dall'estate.

---

## 9. Piano dei 31 giorni

F = Fabrizio · C = Claude (nella chat dell'iniziativa giusta)

| Settimana | Obiettivo | Attività |
|---|---|---|
| **1 · 21–27/10** Fondamenta | Chiudere i bloccanti "di carta" | F: titolare per la beta. C: informative bozza 2. F: SMTP Supabase via Resend. F: Vercel Pro e verifica backup. F: nuovo codice beta, proroga della coorte al 30/06/2027. C: script per nascondere i centri di test, 3 centri di prova con date, dataset Scoperte novembre–gennaio sulle zone scelte. F: contatto con 1–2 centri amici. C: cruscotto beta. **Il 27/10 si congelano le funzioni.** |
| **2 · 28/10–3/11** Prova generale | Ogni percorso fatto da qualcuno che non è il founder | 2–3 famiglie "zero", iPhone e Android. Prenotazione di prova su un giorno della settimana per provare check-in, risposta del centro ed email. Elenco dei bug. Profilo Instagram impostato e primo post (sezione 11). |
| **3 · 4–10/11** Correzioni e kit | Zero bug bloccanti | C: correzioni. Guida famiglie definitiva, video brevi da registrazione dello schermo, messaggio WhatsApp d'invito, traccia per 5 interviste. Accensione per la beta di Buongiorno e Chi accompagna plus. Reel teaser. |
| **4 · 11–17/11** Pronti | Inviti pronti, sistema fermo | Elenco invitati per grappoli (2–3 classi o scuole, 15–20 famiglie). Golden journeys eseguiti sul dominio vero. **Il 16/11 si congela il codice** (quel giorno arriva anche il promemoria del codice beta). Post del conto alla rovescia. |
| **18–20/11** Lancio | Inviti a ondate | 18/11: prima ondata di 5 famiglie. 20/11: le altre e il post pubblico. Ogni giorno: controllo di cruscotto, feedback e errori. |
| **21/11–20/12** Osservazione | Imparare | Punto settimanale nella chat 00. Interviste nella settimana 2. Decisione il 20/12 (criteri nel pre-mortem). |

---

## 10. Come si misura il successo (al 20/12)

| Metrica | Definizione | Obiettivo |
|---|---|---|
| Attivazione | Famiglia con almeno un figlio e almeno 3 impegni o richieste entro 48 ore | ≥ 70% degli invitati iscritti |
| Coordinamento | Famiglie con 2 adulti collegati | ≥ 40% |
| Ritorno | Famiglie attive in almeno 3 giorni nella seconda settimana | ≥ 40% |
| Chi accompagna | Famiglie che assegnano chi porta o ritira in almeno una settimana | ≥ 50% |
| Domanda verso i centri | Centri o attività distinti citati dalle famiglie (impegni, suggerimenti, Radar, salvati) | ≥ 25 |
| Passaparola | Inviti spontanei ad altre famiglie | ≥ 5 |
| Voce | Feedback scritti / interviste | ≥ 1 per famiglia / 5 |

---

## 11. Teaser Instagram

**Messaggio guida:** *"Il tempo dei tuoi figli, organizzato."* (dal copione del video)
**Tono:** sincero, leggero e milanese; niente promesse che il prodotto non mantiene (niente "centri verificati", niente "paghi in app").

**Regole:**
- niente volti riconoscibili di bambini veri;
- se si usa video generato con AI, la dicitura "Video realizzato con l'intelligenza artificiale";
- niente schermate dell'app inventate: si usano registrazioni vere con dati di prova.

| Quando | Formato | Contenuto | Didascalia (bozza) |
|---|---|---|---|
| Subito | Bio | "Il tempo dei tuoi figli, organizzato. Beta su invito dal 20.11 · tramapp.it" | — |
| ~3/11 | Carosello 4 slide (grafica) | 1. "Quante chat servono per organizzare un martedì?" 2. "Corso di nuoto alle 17. Chi la porta?" 3. "Il 7 e l'8 dicembre la scuola è chiusa. E voi?" 4. Logo, "C'è un modo più semplice. 20.11" | "Gruppi WhatsApp, fogli Excel, post-it sul frigo. Stiamo costruendo un modo più semplice. Dal 20 novembre, su invito. 🧵" |
| ~10/11 | Reel 15 s, 9:16 | Notifiche e messaggi che si accavallano sullo schermo (grafica, non app finta), poi silenzio, poi la Home vera di TRAMA con "Oggi" e "Chi accompagna", poi il logo. Testo: "Meno chat. Più tempo." | "Organizzare la settimana dei figli non dovrebbe essere un secondo lavoro. TRAMA arriva il 20.11. Link in bio per entrare nella lista." |
| 17/11 | Storia con conto alla rovescia | Sticker "Countdown" verso il 20/11 + link a `tramapp.it/benvenuto` | — |
| 20/11 | Post di lancio | Foto o grafica calda (mani, zaino, calendario), "TRAMA è aperta, su invito" | "Oggi, Giornata dei diritti dell'infanzia, apriamo la beta di TRAMA alle prime famiglie. Se vuoi provarla, scrivici o lasciati in lista: tramapp.it" |

Il video lungo del copione (`COPIONE_video_landing_flow.md`) resta per la pagina di benvenuto; la sua versione 9:16 da 30 secondi può essere il secondo reel.

---

## 12. Domande per il revisore

1. **Data e perimetro.** Il 20/11 con 15–20 famiglie amiche "tutto acceso" è la scelta giusta? Oppure un lancio a due ondate (5 famiglie il 20/11, il resto a gennaio, quando si inizia a pensare all'estate) imparerebbe di più con meno rischio?
2. **Accerchiamento.** La sequenza famiglie → segnali sui centri → centri ti sembra realistica? Cosa servirebbe per renderla misurabile già a dicembre?
3. **Grappoli.** Invitare per classe o scuola invece che per amicizia: concordi? Che dimensione minima serve per vedere un effetto di rete?
4. **Catalogo.** Livelli 1–2–3 (Scoperte vere, centri di prova dichiarati, 1–2 centri amici): manca qualcosa? È rischioso mostrare centri di prova ad amici?
5. **Fuori stagione.** A novembre il caso d'uso principale (organizzare l'estate) non c'è ancora. Ponti, Natale e corsi pomeridiani bastano a creare l'abitudine fino a febbraio?
6. **Modello economico.** Freemium famiglie prima e commissione dopo: quale esperimento a basso costo faresti in beta per misurare la disponibilità a pagare?
7. **Bloccanti.** Nella sezione 6 c'è qualcosa di sovrastimato o sottostimato? Cosa toglieresti per guadagnare tempo?
8. **Punti ciechi.** Cosa non stiamo vedendo?
