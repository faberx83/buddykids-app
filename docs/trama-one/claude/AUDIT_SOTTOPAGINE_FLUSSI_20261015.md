# TRAMA — Pagine ancora in vecchio stile e analisi dei flussi (15/10/2026)

**Ambito:** app famiglie (area `/nextgen` con la nuova barra) e le pagine condivise che si aprono da lì (scheda attività, prenotazione, modifica, piano condiviso, accesso).
**Base:** `main` @ `111d02e`, online dalle 15:20 del 15/10. Correzioni di questo giro sul ramo `claude/sottopagine-v2`, da pubblicare con `bash deploy.sh`.
**Metodo:** lettura del codice di ogni pagina, prove a schermo con dati d'esempio, regressione `tests/one` (952 test verdi; i fallimenti sono gli stessi già noti).

---

## 1. In breve

- Le **sei schermate principali** (Home, Planner, Scopri, Prenotazioni, Profilo, Gruppi) sono nello stile V2. Lo stesso vale per scheda attività, Salvati, onboarding, barra con il +, filtri e "Una scoperta".
- **Oggi, correzioni semplici e trasversali:**
  - tutte le **sottopagine** hanno l'intestazione V2;
  - i loro pulsanti e le selezioni passano dal viola al **blu notte**;
  - gli hub (Impostazioni, Famiglia) hanno le righe del Profilo V2.

  Restano però pagine con il contenuto disegnato alla vecchia maniera (sezione 3).
- **Il problema più serio non è grafico: è il percorso di prenotazione.**
  - Dalla scheda V2 si entra in un flusso vecchio a 3–4 passi.
  - Ha un passo **"Pagamento" finto**: "Carta •••• 4242", Apple Pay, un IBAN d'esempio.
  - Finisce con "**ufficialmente iscritto**… Totale **pagato**". Ma in beta non si paga niente e la prenotazione è una **richiesta** che il centro deve ancora confermare.
  - Con amici veri in beta questo crea aspettative sbagliate. Va sistemato prima di invitare (sezione 4.2).

## 2. Mappa delle pagine

Legenda:
- **V2** = ridisegnata;
- **Ponte** = intestazione V2 e blu notte da oggi, con il contenuto ancora nella forma di prima;
- **Vecchio** = fuori dall'area con la nuova barra, quindi senza ponte.

| Area | Pagina | Come ci arrivi | Stato | Note |
|---|---|---|---|---|
| Barra | Home | barra | V2 | |
| Barra | Planner (Settimana, Stagione, Mese, Chi fa cosa, Mappa, Gruppi) | barra | V2 | Budget ed Esporta sono fogli V2 con contenuto vecchio |
| Barra | Scopri (Elenco, Mappa, Filtri) | barra | V2 | Popup della mappa e "Proponi invito" ancora vecchi |
| Barra | Prenotazioni (elenco e prenotazione aperta) | barra | V2 | |
| Barra | + (Un impegno, Chi accompagna, Una scoperta, Un altro genitore) | barra | V2 | Il modulo "Un impegno" è ancora vecchio (pillole, campi stretti) |
| Profilo | Profilo | avatar | V2 | |
| Profilo | Salvati | Profilo | V2 | |
| Profilo | Famiglia (invita l'altro genitore, persone di fiducia) | Profilo | Ponte | Pagina lunga (450 righe): form e card da ridisegnare |
| Profilo | Indirizzi | Profilo | Ponte | Form semplice |
| Profilo | Promemoria e avvisi | Profilo | Ponte | Interruttori e scelte vecchie |
| Profilo | Presenze | Profilo | Ponte | |
| Profilo | Messaggi ai centri | Profilo | Ponte | |
| Profilo | Centri che hai suggerito | Profilo | Ponte | |
| Profilo | Le mie segnalazioni | Profilo | Ponte | |
| Profilo | Impostazioni (hub) | Profilo | V2 | Righe come il Profilo |
| Profilo | Sicurezza, Preferenze, Privacy e account | Impostazioni | Ponte | "Metodi di pagamento: Presto" va bene così |
| Profilo | Cos'è TRAMA | Profilo | V2 | |
| Gruppi | Gruppi, dettaglio gruppo | Planner, Profilo | V2 | |
| Gruppi | Community (elenco e dettaglio: classe, scuola) | Planner → Gruppi | Ponte | Card vecchie; "Community" e "Gruppi" si confondono (4.5) |
| Scopri | Scoperta della community (dettaglio) | card in Scopri | Ponte | |
| Scopri | Scheda attività | "Vedi" | V2 | |
| Notifiche | Novità (con 👍/👎) | campanella in Home | Ponte | Emoji come pulsanti, box tratteggiati viola |
| Prenotazione | Prenota (Settimane, Servizi, Bambini, **Pagamento**) | scheda → Prenota | **Vecchio** | Il pezzo più importante da rifare (4.2) |
| Prenotazione | Prenotazione inviata | dopo Prenota | **Vecchio** | "Ufficialmente iscritto", "Totale pagato", emoji 🎉 |
| Prenotazione | Modifica prenotazione | Prenotazioni → Modifica | **Vecchio** | 627 righe |
| Fuori app | Piano condiviso (link per nonni e tata) | link condiviso | **Vecchio** | Lo vedono persone esterne: è un biglietto da visita |
| Fuori app | Accesso e registrazione | primo ingresso | **Vecchio** | Pulsante viola a pillola; vale per tutti, anche Legacy (6) |
| Residuo | Settimana del Planner di prima (`/planner/settimana/…`) | solo dal Planner di prima | Non raggiungibile in V2 | Nessuna azione |

## 3. Cosa ho già sistemato oggi (ramo `claude/sottopagine-v2`)

1. **Intestazione V2 per tutte le sottopagine:**
   - stessa freccia da 44px, titolo Poppins 24 e segno TRAMA delle pagine principali;
   - niente barra bianca con il bordo né logo piccolo;
   - un solo punto di modifica (`PageHeader`), attivo solo con la nuova barra. Legacy, Gestori e prenotazione restano come prima.
2. **Ponte colori:**
   - nell'area con la nuova barra il viola pieno dei pulsanti e delle selezioni diventa blu notte;
   - il testo viola diventa l'accento leggibile;
   - lo sfondo diventa quello caldo delle pagine V2.

   È solo un blocco CSS limitato a quell'area: si toglie in un attimo se serve. Le pagine V2 non usano quel viola, quindi non cambiano.
3. **Hub Impostazioni e Famiglia:** righe come il Profilo V2 (card con bordo, icona su tinta neutra, testi più leggibili, tocco da 64px).
4. **"Chi accompagna" dal +:** prima portava al Planner senza aprire niente; ora apre il foglio "Chi fa cosa" della settimana che stai guardando.
5. **Profilo → Condivisione piano:** il sottotitolo dice dove si fa ("Nel Planner: Condividi settimana").

Da ieri e stamattina, già online: Indietro chiude i fogli, impegno nella settimana aperta, ponti → settimana, legenda dei pallini, genere nell'onboarding, Salvati V2, scheda attività V2, filtri V2, "Una scoperta" nel +, "Avvia navigazione" anche senza indirizzo.

## 4. Analisi dei flussi

### 4.1 Primo accesso (amico invitato)
**Percorso:** link d'invito → registrazione → onboarding (3 schermate animate, figli, scuola) → Home.
- **Bene:** l'onboarding è lineare, si salta e si rivede dal Profilo.
- **Da sistemare:**
  - la pagina di accesso e registrazione è nello stile di prima, ed è la prima cosa che si vede;
  - senza email transazionali la conferma dell'account passa dal servizio standard di Supabase, che ha limiti bassi: con più amici insieme alcune conferme potrebbero non arrivare.

  Entrambe dipendono da dominio e email (sezione 7).

### 4.2 Trovare e prenotare (il flusso più importante)
**Percorso:** Scopri → card → scheda (V2) → **Prenota** → passi Settimane, (Servizi), Bambini, Pagamento → "Prenotazione inviata" → Prenotazioni.

Problemi, in ordine:
1. **Pagamento finto:** metodi di pagamento d'esempio (carta, Apple Pay, IBAN) in un'app dove in beta non si paga.
2. **Messaggio finale sbagliato:** "ufficialmente iscritto/a… Totale pagato", mentre la prenotazione è in attesa della risposta del centro (lo stato vero lo mostra bene Prenotazioni V2).
3. **Salto di stile:** dalla scheda V2 si entra in pagine viola e bianche di prima, poi si torna in Prenotazioni V2.
4. **Troppi passi per una richiesta:** per le Scoperte TRAMA e community (non prenotabili) va bene "Aggiungi al Planner"; per i centri Partner bastano 2 passi.

**Proposta:**
- **Passo 1 "Cosa":** settimane o giorni e servizi in una pagina.
- **Passo 2 "Per chi e invio":** bambini, riepilogo e "**Invia la richiesta al centro**", con la frase "Paghi direttamente al centro quando conferma" (o la formula che decidi tu).
- **Fine:** "Richiesta inviata: ti avvisiamo quando il centro risponde", poi Prenotazioni.
- Stessa logica di oggi (prezzi, giorni, posti, controlli): cambia solo la presentazione, dietro la release di Scopri e Prenotazioni.

### 4.3 Organizzare la settimana
**Percorso:** + → Un impegno, oppure Planner → settimana → Chi fa cosa.
- **Bene da oggi:**
  - impegno già sulla settimana aperta;
  - Chi accompagna apre il foglio;
  - legenda dei pallini e frase su chi resta scoperto.
- **Da sistemare:**
  - il modulo "Un impegno" è ancora quello di prima (pillole, data e ora poco leggibili, "Salva" piccolo): è il gesto più frequente e merita un foglio V2;
  - "Chi accompagna" funziona per le prenotazioni ma non per gli impegni aggiunti a mano. Esempio: la gara di Franchidea non chiede chi la porta. È una regola del modello e va decisa (6).

### 4.4 Ponti e vacanze
**Percorso:** Home → riepilogo → tocco sulla settimana → Planner → "Trova attività" → Scopri con il periodo già scelto.
- Lineare da oggi.
- **Limite:** gli impegni aggiunti a mano contano per la copertura dei ponti, ma non per l'estate (regola attuale, già nota).

### 4.5 Gruppi e Community
- Ci sono due concetti vicini: **Gruppi** ("Andiamo insieme": iscriversi insieme, sconto, passaggi) e **Community** (classe o scuola, proposte).
- Stanno nella stessa scheda "Gruppi" del Planner, ma si aprono in pagine con stili diversi.
- Per un amico in beta la differenza non è evidente.
- **Proposta:** in beta mostrare solo i Gruppi e tenere la Community dietro flag finché non c'è un caso d'uso vero. Oppure rinominarla "Classe e scuola".

### 4.6 Notifiche, novità e feedback
- **Notifiche:** si aprono solo dalla campanella in Home. Va bene, perché il pallino sulla barra avvisa.
- **Novità:** si aprono dalle notifiche. Le emoji 👍/👎 come pulsanti sono il residuo grafico più evidente.
- **Feedback:** solo da Profilo → "Aiutaci a migliorare TRAMA". Per una beta con amici è nascosto.
- **Proposta:** una riga "Dicci cosa ne pensi" in fondo alla Home, solo per la beta.

### 4.7 Condivisione con nonni e tata
**Percorso:** Planner → "Condividi settimana" → link → pagina pubblica.
- La pagina pubblica è nello stile di prima ed è quella che vedono le persone **fuori** da TRAMA.
- Conviene rifarla insieme alla prenotazione: è piccola.

## 5. Priorità di restyle (dopo i lavori di domani)

| # | Cosa | Perché | Peso |
|---|---|---|---|
| 1 | Prenotazione a 2 passi + "Richiesta inviata", senza pagamento finto | Messaggi sbagliati verso utenti veri | Medio |
| 2 | Foglio V2 "Un impegno" | Gesto più frequente | Piccolo |
| 3 | Piano condiviso (pagina pubblica) | Lo vedono persone esterne | Piccolo |
| 4 | Famiglia (invita l'altro genitore, persone di fiducia) | Parte di "Chi accompagna" | Medio |
| 5 | Novità senza emoji, Promemoria, Indirizzi | Coerenza | Piccolo |
| 6 | Modifica prenotazione | Uso raro in beta | Medio |
| 7 | Community, Presenze, Messaggi, Segnalazioni, Impostazioni (contenuto) | Uso raro | Piccolo ciascuna |
| 8 | Accesso e registrazione | Prima impressione, ma vale per tutti (6) | Piccolo |

## 6. Dubbi: decide Fabrizio

1. **Pagamento in beta:** confermi "si paga al centro" e niente pagamento in app? Serve per scrivere il passo di invio e la conferma.
2. **Accesso e registrazione:** la pagina non sa ancora chi sei, quindi non può seguire il flag. Allinearla al blu notte la cambia per tutti, anche per chi usa la versione classica. Va bene?
3. **Chi accompagna sugli impegni aggiunti a mano:** devono entrare in "Chi fa cosa" (per esempio la gara di Franchidea)? Cambia una regola del Planner, non solo la grafica.
4. **Community in beta:** nasconderla o rinominarla?
5. **Feedback più visibile in beta:** riga in Home sì o no?

## 7. Domani (16/10)

1. **Consensi e informative.** Bozze di Informativa privacy (dati di minori, responsabili Supabase/Vercel/Resend/OSM, dati in UE) e Termini, marcate BOZZA per il legale. Poi pubblicazione delle versioni e accensione del consenso all'ingresso (il codice è pronto e spento).
2. **Cambio dominio `tramapp.it`.**
   - **Lato tuo:** DNS su Register, domini su Vercel, URL in Supabase Auth.
   - **Lato mio:** codice e `deploy.sh`.
   - Prima affiancato ai vecchi indirizzi, poi il passaggio.
   - Con il dominio partono le **email** (Resend).
3. **Pulizia delle schede finte.**
   - Da togliere o nascondere: "Prova FP", "test", "[TEST] Attività BuddyKids" e i centri di prova.
   - Sulle attività dimostrative restano voti, numero di recensioni e km inseriti a mano: in V2 non si vedono più, ma vanno puliti nei dati.
4. **Catalogo per la beta con amici.** Attività vere (Scoperte TRAMA da fonti pubbliche) o dimostrative ma fatte bene: descrizione, orari, fascia d'età, servizi, prezzi, settimane e giorni aperti. Devono coprire da ora in avanti:
   - pomeriggi settimanali (sport, musica, inglese);
   - ponte di Sant'Ambrogio e Immacolata;
   - vacanze di Natale;
   - Carnevale e Pasqua;
   - poi l'estate 2027.

   Da decidere insieme: zone di Milano e se mostrarle come "esempio" o come attività vere.

---
*Correzioni di questo giro: ramo `claude/sottopagine-v2`. Test: `tests/one/sottopagine-v2.spec.ts` (SP-01..04).*

---

## Aggiornamento 15/10 pomeriggio — risposte di Fabrizio ai 5 dubbi

1. **"Nessun pagamento, è una beta fake"** → FATTO (dietro BOOKINGS_V2_ENABLED, release già esistente).
   `/booking/[id]` diventa "Richiedi un posto" in 2 passi (Quando: settimane + servizi; Chi partecipa: bambini +
   riepilogo con "Costo indicativo" e "Nessun pagamento adesso") e pulsante "Invia la richiesta al centro".
   Conferma: "Richiesta inviata" → "Vai a Prenotazioni" / "Torna alla Home". Stessa createBookingAction: il
   centro risponde dalla Inbox (partner_decision "pending" → "In attesa del centro" in Prenotazioni V2).
   Legacy e TRAMA ONE senza V2 invariati (passo Pagamento simulato).
2. **Pagina di accesso** → da rispiegare: è unica per tutti (anche Legacy), il flag non si conosce prima del login.
3. **"Chi accompagna" sugli impegni aggiunti a mano** → utile: da definire (cambia la regola del Planner), non fatto.
4. **"Classe e scuola"** → FATTO con la nuova barra (elenco, dettaglio, Planner → Gruppi). Stesse tabelle e rotte.
   Testi in `lib/nextgen/classe-scuola-copy.ts`. "Segnalato dalla community" del Radar non toccato.
5. **Feedback in Home** → FATTO: riga "Dicci cosa ne pensi" in fondo alla Home V2 (stesso pannello, fonte "home").

Test: `tests/one/beta-richiesta-classe.spec.ts` (BR-01..04, CS-01..03, FH-01); test live adattati ai due flussi
con `tests/fixtures/booking-flow.ts` (pending local verification).
