# TRAMA — Pre-mortem della beta famiglie

**Data:** 20/10/2026 · **Sostituisce:** il pre-mortem del 23/09/2026 (`archive/superseded-versions/PREMORTEM_20260923.md`) · **Autore:** Claude, da validare con Fabrizio e con un revisore esterno

> **Metodo (Gary Klein).** Non ci chiediamo "cosa può andare storto?". Immaginiamo che sia **già andata male** e ci chiediamo "cosa deve essere successo?". Lavoriamo su due orizzonti:
> - **Scenario A, breve:** è il 20/12/2026 e la beta è un flop. Le famiglie si sono iscritte e non usano più l'app, oppure non sono mai riuscite a entrare.
> - **Scenario B, lungo:** è ottobre 2027. TRAMA è ferma, è un progetto parallelo che non è diventato niente.
>
> **Limite.** Le valutazioni sono un'ipotesi di Claude su dati verificati, non l'esito di un workshop con persone diverse. Il modo migliore di usare questo documento è leggerlo con 2–3 persone (un genitore, un gestore, un esterno) e chiedere a ciascuno di aggiungere una causa.

Legenda: **P** probabilità, **I** impatto (A alta, M media, B bassa).

---

## Scenario A — 20/12/2026: "la beta è stata un flop"

### A1. Si sono perse al primo passo · P: A · I: A
**Cosa è successo:**
- la mail di conferma non è arrivata: il servizio standard di Supabase ha un limite di invio molto basso e il 20/11 se ne sono iscritte 12 insieme;
- chi l'ha ricevuta è finito su un vecchio indirizzo;
- su iPhone nessuno ha aggiunto l'app alla schermata Home, quindi niente notifiche;
- qualcuno ha visto un'informativa con "[RAGIONE SOCIALE DA COMPLETARE]" e ha lasciato perdere.

**Segnali oggi:** email di registrazione da Supabase e non da `tramapp.it`; informative con campi vuoti; 3 utenti su 10 con le push attive.

**Mitigazione:**
- SMTP di Supabase via Resend (B2);
- informative completate (B3);
- guida con il passaggio "Aggiungi alla schermata Home" illustrato;
- prima ondata di sole 5 famiglie, assistite al telefono se serve.

### A2. L'app era vuota · P: A · I: A
**Cosa è successo:**
- in Scopri c'erano solo centri estivi di giugno, alcuni chiamati "Centro pippo";
- la vista "Stagione" parlava d'estate a novembre;
- la Home di una famiglia appena iscritta non aveva niente da mostrare;
- dopo 5 minuti la domanda era "e quindi?".

**Segnali oggi:** 0 date prenotabili future; 3 centri di test visibili; Stagione solo estiva.

**Mitigazione:**
- catalogo a tre livelli (Scoperte vere di novembre–gennaio nelle zone delle famiglie, 3 centri di prova dichiarati, 1–2 centri amici);
- onboarding che porta subito a inserire i corsi della settimana;
- "Ponti e vacanze" in evidenza (Immacolata, Natale).

### A3. Nessuno ha capito cosa fare · P: M · I: A
**Cosa è successo:** "Tutto acceso" ha voluto dire 12 funzioni in 5 schede. Ogni famiglia ha toccato tre cose a caso e non ha avuto il suo "momento aha" (*"ah, il martedì lo porta il nonno e lo sa già"*).

**Segnali oggi:** nessuna guida per le famiglie; il feedback è nascosto nel Profilo.

**Mitigazione:**
- guida con 5 missioni per la prima settimana;
- messaggio di benvenuto del founder;
- riga "Dicci cosa ne pensi" in evidenza;
- telefonata di 10 minuti al giorno 3 con le prime 5 famiglie.

### A4. Nessuno è tornato · P: A · I: A
**Cosa è successo:** dopo la prima sera nessun motivo per riaprire. L'altro genitore non è mai entrato, "Chi accompagna" è rimasto vuoto, il buongiorno era spento. Il gruppo WhatsApp della classe ha continuato a fare il suo lavoro: "abbastanza buono e gratis" ha vinto.

**Segnali oggi:**
- buongiorno e Chi accompagna plus solo interni;
- 0 promemoria inviati finora;
- nessun impegno ricorrente: un corso del martedì va inserito 10 volte.

**Mitigazione:**
- accendere buongiorno e Chi accompagna plus per la beta dopo una settimana di prova;
- chiedere esplicitamente di invitare l'altro genitore (missione 3);
- misurare il ritorno nella settimana 2;
- se "inserire i corsi" è la prima lamentela, gli impegni ricorrenti diventano la prima cosa da fare a dicembre.

### A5. Famiglie sparse, nessun effetto rete · P: A · I: M
**Cosa è successo:** gli inviti sono andati ad amici di zone e scuole diverse. Classe e scuola vuote, Gruppi vuoti, nessun passaggio condiviso. L'"accerchiamento" non è mai cominciato perché nessun centro aveva più di una famiglia.

**Mitigazione:**
- invitare per grappoli: 2–3 classi o scuole, almeno 5 famiglie ciascuna;
- per ogni grappolo una famiglia "capofila" che fa da riferimento.

### A6. Non abbiamo imparato niente · P: A · I: A
**Cosa è successo:**
- gli eventi di prodotto non hanno un identificativo utente, quindi nessun dato di ritorno per famiglia;
- il feedback è arrivato in 4 messaggi WhatsApp al founder, non registrati;
- le interviste non sono state fatte per mancanza di tempo.

Il 20/12 l'unica conclusione possibile era "boh, mi sembra che qualcuno la usi".

**Mitigazione:**
- cruscotto beta settimanale (query sulle tabelle, nessun dato personale nell'output);
- 5 interviste fissate in calendario **prima** del lancio;
- regola: ogni feedback arrivato su WhatsApp viene ricopiato in TRAMA o nel documento della beta.

### A7. Un incidente di fiducia tra amici · P: M · I: A
**Cosa è successo**, in uno di questi modi:
- un'amica ha "prenotato" un centro di prova credendolo vero;
- il Radar ha pubblicato un volantino con dati sbagliati, visibile a tutti;
- una notifica è arrivata alla famiglia sbagliata;
- la foto di un volantino è finita a un servizio AI senza che fosse scritto da nessuna parte.

Tra amici, l'imbarazzo pesa più di un bug.

**Mitigazione:**
- centri di prova con badge e nome espliciti;
- Radar con anteprima obbligatoria e moderazione già attiva; AI vera solo se dichiarata nell'informativa;
- prova generale delle notifiche con 2 famiglie (settimana 2).

### A8. Il founder è rimasto senza fiato · P: A · I: A
**Cosa è successo:**
- un mese con lavoro principale, famiglia, 15 famiglie da seguire, deploy serali, Instagram;
- in parallelo è continuato lo sviluppo di nuove funzioni (44 commit in 7 giorni la settimana prima);
- la prova generale è stata compressa in due sere;
- il 20/11 è arrivato con bug aperti.

**Mitigazione:**
- funzioni congelate dal 27/10 e codice congelato dal 16/11;
- un'ora fissa al giorno per la beta;
- deploy solo nei giorni stabiliti (per esempio martedì e venerdì) durante la beta;
- Instagram ridotto a 4 contenuti.

### A9. Un rilascio ha rotto la beta · P: M · I: A
**Cosa è successo:**
- ogni modifica su main va subito alle famiglie della coorte beta;
- un deploy serale ha rotto l'accesso o il Planner;
- con il piano gratuito di Vercel i log restano solo un'ora, quindi la segnalazione della mattina dopo non era diagnosticabile;
- i test end-to-end reali non erano mai stati eseguiti.

**Mitigazione:**
- Vercel Pro;
- golden journeys eseguiti prima del 16/11;
- nuove funzioni durante la beta solo in "Anteprima interna" per 48 ore prima di passare alla coorte;
- rollback documentato (Vercel "Promote" del deploy precedente).

### A10. La beta si è spenta da sola · P: A (se non si interviene) · I: A
**Cosa è successo:** il codice `TRAMABETA26` è scaduto il 01/12 e nessuno nuovo è riuscito a entrare. Il 31/12 sono scaduti gli accessi della coorte a TRAMA ONE, agli impegni esterni e alle Scoperte. Le famiglie hanno trovato un'app diversa il 1° gennaio.

**Mitigazione:** nuovo codice per il lancio e proroga della coorte al 30/06/2027 (settimana 1). Promemoria già fissato al 16/11.

### A11. Un problema legale è arrivato prima delle famiglie · P: B · I: A
**Cosa è successo:**
- un genitore attento (o un datore di lavoro) ha chiesto chi fosse il titolare dei dati dei suoi figli;
- la risposta era "nessuno, ancora";
- le informative erano bozze mai riviste da un legale;
- il marchio "TRAMA" non era mai stato verificato.

**Mitigazione:**
- titolare definito per la beta (anche persona fisica);
- bozza 2 completa;
- un'ora di consulenza legale prima del 20/11 su informativa, minori e Radar;
- ricerca di anteriorità del marchio entro dicembre.

---

## Scenario B — ottobre 2027: "TRAMA è ferma"

| # | Causa | P | I | Segnale da guardare | Mitigazione |
|---|---|---|---|---|---|
| B1 | **Fuori stagione:** la beta di novembre si è spenta prima di febbraio, quando le famiglie iniziano davvero a pensare all'estate. Si è ripartiti da zero nel momento sbagliato. | A | A | Famiglie attive a metà gennaio < 30% | Piano di rilancio a fine gennaio ("Inizia a organizzare l'estate"), Scoperte estive pubblicate presto, centri veri entro febbraio |
| B2 | **Accerchiamento mai scattato:** i centri hanno ignorato i segnali delle famiglie, oppure i segnali erano troppo pochi per un centro qualsiasi | M | A | Nessun centro con ≥ 5 famiglie che lo citano entro marzo | Concentrare i grappoli sulle zone dei 2–3 centri amici; riepilogo "famiglie per centro" mostrato al centro |
| B3 | **Nessun modello di ricavo credibile:** il freemium converte poco, la commissione non parte perché i centri non sono dentro, il progetto resta un costo | A | A | Interesse per Plus < 10% degli attivi; 0 centri disposti a pagare | Tenere aperta la pista B2B2C (welfare aziendale, comuni, scuole); test di prezzo con 5 centri amici in primavera |
| B4 | **Troppo prodotto per una persona:** tre generazioni di interfaccia, decine di flag, test fragili. Ogni modifica costa di più, il founder rallenta | A | M | Tempo medio per una correzione in crescita; deploy falliti | Dopo la beta, pulizia: spegnere e togliere Legacy e TRAMA ONE non usati, ridurre i flag, test end-to-end sui 5 percorsi chiave |
| B5 | **Dipendenza dal singolo:** tutto passa dal Mac del founder e dalle chat con l'AI; un mese di stop ferma tutto | A | A | Nessun secondo umano che sappia fare un deploy | Documentazione operativa aggiornata (questo pacchetto), un secondo account con accesso in emergenza, valutare un co-founder o un freelance tecnico a ore |
| B6 | **Concorrenza dal basso:** un gestionale per centri o un'app di scuola aggiunge un planner per le famiglie | M | M | Annunci di concorrenti | Il vantaggio è il coordinamento tra famiglie (chi accompagna, classe, nonni), non il calendario: investire lì |
| B7 | **Brand non registrabile** o confusione con altri "Trama" | M | M | Esito della ricerca marchi | Verifica entro dicembre, prima di investire in comunicazione |

---

## Criteri di decisione (da scrivere ora, non dopo)

**Al 20/12/2026**, con almeno 15 famiglie iscritte:

| Esito | Condizione | Azione |
|---|---|---|
| **Avanti** | Ritorno in settimana 2 ≥ 40% **e** coordinamento (2 adulti) ≥ 40% | Rilancio a fine gennaio con il tema "estate", nuovi grappoli, primi centri veri |
| **Correggere** | Ritorno 20–40% | Un solo ciclo di correzioni mirate su quanto emerso dalle interviste, nuova misura a fine gennaio |
| **Ripensare** | Ritorno < 20% o meno di 10 famiglie attivate | Fermare lo sviluppo, rifare 10 interviste, rivedere la proposta (per esempio solo coordinamento tra famiglie della stessa classe) |

**Al 31/03/2027** (iscrizioni ai centri estivi): almeno 3 centri veri con richieste reali dalle famiglie, altrimenti l'ipotesi "accerchiamento" va rivista.

---

## Le 5 cose da fare questa settimana per rendere meno probabili questi scenari

1. SMTP delle email di registrazione via Resend (A1).
2. Titolare e informative bozza 2 (A1, A11).
3. Catalogo: via i centri di test, dentro 3 centri di prova dichiarati e le prime Scoperte di novembre–gennaio (A2, A7).
4. Nuovo codice beta e proroga della coorte (A10).
5. Data della prova generale con 2–3 famiglie fissata nel calendario (A1, A3, A9).
