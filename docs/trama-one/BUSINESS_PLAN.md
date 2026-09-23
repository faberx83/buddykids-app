# TRAMA — Business Plan (bozza)

23/09/2026.

Bozza scritta da Claude (agente AI) a partire dai documenti strategici di Fabrizio (*TRAMA Master Plan — Sintesi strategica e temi aperti*, v1.0, 13/07/2026; *TRAMA MVP Settembre 2026 — Competitive Intelligence Italia*, v1.1 Trust Layer, 16/07/2026) e dallo stato verificato del prodotto (`docs/trama-one/STATE_OF_THE_ART.md`, verificato contro codice e DB di produzione il 23/09/2026). I dati di business non deducibili da questi documenti sono marcati esplicitamente come **[PLACEHOLDER — DA COMPILARE: ...]** con una nota su cosa serve. Questo documento va validato e completato da Fabrizio, non è un piano approvato.

Nessuna cifra finanziaria, dato di mercato o informazione sul team è stata inventata: ogni numero riportato è citato fedelmente da uno dei due documenti sorgente (con riferimento alla fonte originale, incluse le fonti esterne [S1]-[S16] citate nella Competitive Intelligence), oppure è marcato come placeholder.

---

## 1. Executive summary

**Problema.** I genitori devono organizzare attività, settimane, spostamenti, prenotazioni e responsabilità familiari per i propri figli senza che questo diventi un secondo lavoro. Il problema nasce da un'esperienza personale di Fabrizio e si è progressivamente allargato: da "trovare un centro estivo" a "organizzare la vita familiare senza ansia e senza dispersione" (Master Plan, §1.1).

**Soluzione.** TRAMA è un ecosistema con quattro anime integrate: un'app per le famiglie (ricerca, Planner, prenotazione, gruppi), un portale operativo per i gestori dei centri, una control room amministrativa e, in prospettiva, un marketplace di fornitori e professionisti (Master Plan, Executive summary). Il differenziatore proposto non è una singola funzione ma un'orchestrazione *need-first*: la famiglia parte da un bisogno/periodo scoperto, confronta offerte verificate multi-centro, invia una richiesta o prenota, e il proprio Planner si aggiorna di conseguenza (Competitive Intelligence, §1.3 e §15.1).

**Stato attuale — onestà preliminare.** Il prodotto esiste ed è tecnicamente maturo su gran parte del perimetro descritto nei documenti strategici (verificato in `STATE_OF_THE_ART.md`: onboarding, Planner con persistenza reale, ricerca/Discovery Map, prenotazioni, gruppi/community, portale gestori con candidatura/verifica/gestione attività/inbox richieste, area Admin con approvazioni e audit log). **Non esiste però, a oggi 23/09/2026, nessun dato di mercato reale**: i 10 account in produzione sono tutti riconducibili a Fabrizio o a due conoscenti/familiari (`luca.d.magi@gmail.com`, `mariafpoli@gmail.com`), nessun utente è stato acquisito tramite un canale di marketing o outreach reale (`STATE_OF_THE_ART.md`, sezione "Dati reali in produzione"). Il flag `TRAMA_ONE_ENABLED` è **OFF globalmente** in produzione, visibile solo a una cohort beta controllata e a `platform_admin`. Nessun documento legale (Privacy/Termini) è pubblicato (`legal_documents`=0 righe).

**Visione.** Nel lungo periodo TRAMA vuole diventare "l'infrastruttura digitale che collega famiglie, organizzatori, professionisti e servizi nel mondo delle attività per bambini e ragazzi" (Master Plan, §1.2) — ma va "progettata oggi come piattaforma, lanciata come soluzione molto focalizzata" (Master Plan, Executive summary): organizzare i centri estivi e le esperienze condivise delle famiglie in un'area geografica precisa, con un perimetro di lancio a Milano (Competitive Intelligence, §1.2).

Questo documento non contiene proiezioni finanziarie, dati di team o cifre di mercato dimensionate (TAM/SAM/SOM): questi dati non sono presenti nei due documenti strategici sorgente e sono marcati come placeholder nelle sezioni dedicate.

---

## 2. Il problema e la value proposition

Dal Master Plan (§1.1): la prima risposta al problema è stata un'app per cercare e prenotare centri estivi. Durante lo sviluppo è emerso che il problema più ampio non è "trovare un campus", ma "organizzare la vita familiare senza ansia e senza dispersione" — caos organizzativo, ricerca frammentata su più canali, logistica di spostamenti e accompagnamenti, budget e comunicazioni disperse tra gestori diversi.

Il "vero incumbent" competitivo non è un prodotto ma un workflow informale — Google, Instagram, passaparola, gruppi WhatsApp, moduli, e-mail, fogli Excel, calendari personali — "gratuito, familiare e sufficientemente buono" (Competitive Intelligence, §14.3). TRAMA vince solo se riduce concretamente tempo, incertezza e ripetizioni: "una UI più elegante non basta" (stessa fonte).

**Value proposition per lato dell'ecosistema** (Master Plan, §2, tabella attori):

| Attore | Problema principale | Valore TRAMA |
|---|---|---|
| Famiglie | Caos organizzativo, ricerca frammentata, logistica | Ricerca, planner, gruppi, condivisione, pagamenti |
| Gestori | Fogli, WhatsApp, iscrizioni e disponibilità difficili da gestire | Gestionale, visibilità, prenotazioni, pagamenti, analytics |
| Fornitori | Accesso frammentato ai clienti | Marketplace e domanda qualificata |
| Professionisti | Difficoltà a trovare incarichi affidabili | Candidature, matching, reputazione |
| Admin / piattaforma | Qualità, equilibrio domanda-offerta, crescita | Control room, standard, dati e governance |

**Positioning statement** (Competitive Intelligence, §15.1): "Per genitori che devono coprire e coordinare il tempo dei figli, TRAMA è il sistema operativo familiare che trasforma un periodo scoperto in un'attività verificata e organizzata. A differenza delle directory e dei gestionali del singolo centro, collega pianificazione, discovery, offerta disponibile e gestione post-scelta in un unico circuito."

---

## 3. Prodotto ed ecosistema

Il Master Plan (Executive summary, §1.2) descrive **quattro anime integrate**:

1. **App famiglie** — ricerca, Planner, prenotazione, gruppi, condivisione.
2. **Portale gestori** — gestione attività, calendario, prezzi, capacità, richieste.
3. **Control room amministrativa** — qualità, copertura territoriale, SLA, governance.
4. **Marketplace fornitori/professionisti** — "in prospettiva" (visione futura, non attuale).

### Cosa è oggi verificato reale (da `STATE_OF_THE_ART.md`, 23/09/2026)

- **App famiglie**: onboarding, Planner (settimana/famiglia/indirizzi/logistica/promemoria con persistenza DB reale), ricerca/Discovery con Mappa (ciclo di bugfix live completato e deployato a settembre 2026), prenotazioni con wizard, gruppi/community, condivisione piano via link pubblico, segnalazioni. Funzionante nel codice e verificato via query sul DB di produzione.
- **Portale gestori**: candidatura, verifica identità (schema pronto, upload documento *non collegato* per scelta esplicita di scope — non un gap), gestione attività/calendario/prezzi/capacità (inclusa una race condition su `spots_left` risolta con Compare-And-Swap e test di regressione), inbox richieste, risposta a prenotazioni, cancellazioni/rimborsi per giorno.
- **Admin**: approvazioni centri/certificazioni, qualità catalogo, anomalie booking, supply acquisition (CenterLead), audit log, feature flags con UI dedicata.
- **Marketplace fornitori/professionisti**: **non implementato** — resta visione futura, coerente con quanto il Master Plan definisce "in prospettiva" e con la Competitive Intelligence che lo classifica esplicitamente fuori scope per il beta di settembre 2026 (§2.4, "OUT of scope — Servizi extra: catering, navette e supplier marketplace: solo modello futuro, non delivery settembre").

### Cosa è ancora solo dichiarato nei documenti TO-BE ma non verificato/implementato

- UI di Trust Score visibile: zero occorrenze nel codice applicativo — il concetto esiste solo nei documenti Handbook (`STATE_OF_THE_ART.md`).
- Referral economics automatici (reward/commission): previsti solo in modalità "shadow"/simulata secondo la Competitive Intelligence (§2.2, §10.1), non attivi.
- Trust Score avanzato, verifica AI, Partnership Level visibili: esplicitamente rimandati dopo il beta (Competitive Intelligence, §18.2, punto 8).

---

## 4. Mercato e competizione

### 4.1 Struttura del mercato (da Competitive Intelligence, §11.1)

Il mercato italiano non presenta un competitor diretto equivalente a TRAMA. È diviso in cinque categorie:

| Categoria | Player esemplificativi | Limite rispetto a TRAMA |
|---|---|---|
| Gestionali B2B/B2C | SQUBY, Golee, BookyWay | Discovery cross-centro e Planner famiglia non sono il core |
| Marketplace / discovery | Tutto Campi Estivi, KidPass, Keikibu | Operazioni Partner e orchestrazione post-scelta limitate |
| Marketplace + gestionale sport | Sportclubby | Focus sport/fitness, non organizzazione multi-bambino |
| Piattaforme pubbliche | SYSAP e portali comunali | Scope territoriale/istituzionale, processo voucher-centrico |
| Workflow informale | Google, Instagram, WhatsApp, Excel | Frammentazione, nessun Planner integrato |

Il "white space" identificato è la **need-first orchestration**: nessun player analizzato combina in modo evidente bisogno temporale della famiglia → confronto multi-centro → offerta verificata → richiesta/booking → aggiornamento del Planner → dato di domanda non servita che alimenta l'acquisizione di nuovi centri (Competitive Intelligence, §14.2).

### 4.2 Dati di mercato citati nelle fonti (con fonte originale)

Questi sono gli **unici** numeri di mercato presenti nei documenti sorgente. Sono riportati fedelmente, incluse le fonti primarie citate dalla Competitive Intelligence:

- **Spesa media centri estivi 2026**: 179 €/settimana media nazionale, 233 €/settimana a Milano — fonte: monitoraggio Eures–Adoc riportato da Sky TG24 [S3, citato in Competitive Intelligence §11.2].
- **Finestra di iscrizione comunale Milano**: le iscrizioni ai centri estivi comunali per l'estate 2026 sono state aperte dal 19 marzo al 7 aprile 2026 — fonte: Comune di Milano [S2].
- **Calendario scolastico Lombardia 2026/2027**: avvio 7 settembre (infanzia) e 14 settembre (altri ordini) — fonte: Regione Lombardia [S1].
- **Fruizione territoriale**: dati disomogenei a livello territoriale, con la Lombardia sopra la media nazionale nelle misure citate — fonte: Centro nazionale per l'infanzia / Osservatorio #Conibambini [S4].
- **Scala dichiarata dai competitor (self-reported, non market share certificata)**: SQUBY dichiara oltre 170.000 utenti [S6]; Tutto Campi Estivi dichiara oltre 250.000 visite/stagione, 140+ organizzatori, 800+ proposte, 18.000 iscritti alla community [S9]; BookyWay dichiara oltre 2.300 attività e un milione di utenti, pur dichiarando esplicitamente di non essere un aggregatore [S13].

**[PLACEHOLDER — DA COMPILARE: dimensionamento mercato con fonte]** — Nessuno dei due documenti sorgente fornisce un TAM/SAM/SOM per il mercato italiano delle attività extrascolastiche per bambini, né una stima del numero di famiglie o di centri indirizzabili nell'area di lancio (Milano). Serve una ricerca di mercato dedicata (es. dimensione del mercato "centri estivi + attività annuali" in Italia/Lombardia/Milano, numero di famiglie con figli 0-13 nell'area target, numero di centri/organizzatori attivi).

### 4.3 Competitor rilevanti (sintesi da Competitive Intelligence, §12-13)

- **SQUBY** (iGrest Srl, Milano) — benchmark operativo più maturo. Pricing pubblico dichiarato: piani annuali per anagrafica, Lite 0,90 €, Standard 2,29 €, Professional 2,99 € [S6]. Materiale stampa 2025 indica fundraising ed espansione europea dal 2026 [S8]. Valutato come possibile partner/integration target più che concorrente diretto, poiché non emerge come core una discovery neutrale cross-centro né un Planner familiare.
- **Sportclubby** — benchmark architetturale più vicino (marketplace + gestionale + app), ma su un segmento diverso (sport/fitness generale, non organizzazione multi-bambino).
- **Tutto Campi Estivi, Keikibu, KidPass** — competitor su discovery/audience, senza profondità operativa Partner né Planner familiare.
- **Golee, BookyWay** — gestionali Partner; BookyWay offre API di sincronizzazione, potenziale partner tecnologico.
- **SYSAP** — piattaforma pubblica/voucher, benchmark per orchestrazione Admin multi-attore.

---

## 5. Modello di business

### 5.1 Ipotesi di modello a regime (dal Master Plan, §6.1)

Il Master Plan propone un modello ibrido: componente gestionale (canone) + componente legata al valore generato (commissione), per evitare che una commissione unica sul fatturato sia percepita come una tassa e incentivi la disintermediazione.

| Componente | Ipotesi | Fonte |
|---|---|---|
| Iscrizione catalogo | Gratuita nella fase pilota | Master Plan §6.1 |
| Commissione lead/prenotazioni TRAMA | 3% Founder, poi 5-8% | Master Plan §6.1 |
| Canone gestionale | 30-80 €/mese per piccoli e medi centri | Master Plan §6.1 |
| Pro | 49-149 €/mese in base a scala e moduli (analytics, automazioni, CRM, promozioni) | Master Plan §6.1 |
| Marketplace servizi | Fee o commissione futura (catering, navetta, personale, assicurazioni) | Master Plan §6.1 |

**Founder Program**: i primi 50 gestori possono diventare "Founder Partner" con commissione ridotta, canone agevolato, badge, accesso anticipato, supporto prioritario e crediti promozionali — esplicitamente *non* una revenue share aperta sul fatturato futuro (Master Plan, §6.2).

**Referral gestori**: un gestore che ne porta un altro può ricevere mesi gratuiti o crediti marketing, non obblighi finanziari indefiniti (Master Plan, §6.3).

### 5.2 Modello proposto per il beta (dalla Competitive Intelligence, §10.1 — più recente e operativo)

| Attore | Prezzo beta | Cosa si misura |
|---|---|---|
| Famiglie | Gratuito | Uso, retention, richiesta, willingness to pay indiretta |
| Primi Partner | Gratuito fino a fine pilot | Onboarding, valore lead, tempo risparmiato, willingness to pay/commission |
| Commissione "shadow" | Simulata al 3% promo / 5% standard, non necessariamente fatturata | Margine, accettabilità, impatto sui prezzi |
| Servizi extra | Non attivi | Raccogliere interesse senza costruire il marketplace |
| Referral Parent (shadow) | Nessun reward sulla sola segnalazione; simulato 10% fino a 25 € dopo primo booking con centro attivato | Eligibility, costo potenziale, redemption, abuso |
| Partner referral tier (shadow) | Simulato 3% vs 5% per 50 booking/12 mesi con quality target | Accettabilità, qualità supply, costo di acquisizione |

**Nota importante** (Competitive Intelligence, §10.1, box "Attenzione strategica"): "Il prezzo di Squby parte da valori annuali per anagrafica molto bassi e include una profondità operativa elevata. TRAMA non deve giustificare il proprio prezzo come sostituto del gestionale; deve monetizzare domanda incrementale, conversione, intelligence e servizi di ecosistema."

### 5.3 Possibile modello post-validazione (Competitive Intelligence, §10.2)

- Commissione sul booking confermato: 3% early adopter, 5% standard, da validare per segmento e ticket.
- Partner Lite gratuito/costo minimo per pubblicare; Premium per analytics/automazioni/strumenti operativi.
- Lead generation / featured placement senza degradare il ranking organico.
- Commissione sui servizi B2B extra dopo validazione del supplier model.
- B2G/B2B2C per enti, welfare aziendale e voucher, in fase successiva.

**[PLACEHOLDER — DA COMPILARE: pricing definitivo e take-rate confermati]** — Le cifre sopra (commissioni 3-8%, canoni 30-80€/149€, referral 10%/25€) sono *ipotesi da validare*, non prezzi decisi né testati con clienti reali. Nessun documento sorgente riporta un pricing confermato o un contratto firmato con un centro pagante. A oggi (`STATE_OF_THE_ART.md`) non risultano né `partner_offers` (0 righe) né alcuna transazione commissionata registrata in produzione.

---

## 6. Go-to-market

### 6.1 Perimetro di lancio (Master Plan §10.1, Competitive Intelligence §1.2)

- **Tipo di lancio**: beta privata / invite-only, non lancio nazionale pubblico.
- **Geografia**: 1-2 micro-zone di Milano e primo hinterland, scelte in base ai contatti disponibili — "la densità vale più della copertura estesa" (Competitive Intelligence §1.2, §8.1).
- **Cohort Genitori target**: 30-50 famiglie amiche o facilmente osservabili (target Competitive Intelligence); il Master Plan parla più in generale di "prime 300-500 famiglie" come obiettivo GTM P1 più a valle (Master Plan §15, registro temi aperti).
- **Cohort Partner target**: 5-10 centri attivi, con 20-40 offerte pubblicate complessive (Competitive Intelligence §1.2, §8.1); il Master Plan indica un obiettivo più a regime di "primi 30-50 gestori" per il pricing pilota (Master Plan §5, §15).

### 6.2 Sequenza GTM (Master Plan §10.1)

1. Scegliere 2-3 zone di Milano realmente coperte, non comunicare genericamente tutta l'area.
2. Onboardare almeno 25-30 centri con schede complete e disponibilità reale.
3. Costruire una waitlist di famiglie prima dell'apertura delle prenotazioni.
4. Usare i gestori come canale: kit WhatsApp, email e social per le loro famiglie storiche.
5. Attivare gruppi, referral e inviti fin dal primo giorno.
6. Fare un soft launch con famiglie selezionate e monitoraggio manuale.
7. Espandere solo quando densità e conversione sono sufficienti.

### 6.3 Calendario di fase (Competitive Intelligence §1.1, §18.3)

| Periodo | Fase | Scopo |
|---|---|---|
| Settembre-dicembre 2026 | Beta privata e apprendimento | Validare comprensione del valore, onboarding supply, qualità dati, uso Planner |
| Gennaio-febbraio 2027 | Costruzione offerta estiva | Onboarding centri per l'estate, settimane/disponibilità, waitlist |
| Marzo-aprile 2027 | Pilot commerciale stagionale | Validare conversione ricerca → richiesta/prenotazione, willingness to pay (coerente con la finestra iscrizioni comunali Milano 2026, 19 marzo-7 aprile [S2]) |
| Giugno-luglio 2027 | Validazione operativa | Qualità servizio, cambi, presenze, supporto, retention |

**Nota di realtà**: questo calendario è il piano *dichiarato* al 16/07/2026 nella Competitive Intelligence. `STATE_OF_THE_ART.md` (23/09/2026) conferma che il prodotto è tecnicamente pronto per gran parte del perimetro "beta" descritto, ma la fase "beta privata e apprendimento" (settembre-dicembre 2026) **non ha ancora prodotto dati pilota reali**: zero famiglie esterne, zero centri esterni onboardati in produzione al di là dei dati di test/dogfooding.

---

## 7. Stato di validazione attuale (ancorato a STATE_OF_THE_ART.md)

Sezione di onestà brutale, richiesta esplicitamente da Fabrizio.

- **Utenti pilota reali da canale esterno**: **zero**. Tutti i 10 `profiles` in produzione sono account di Fabrizio (incluse varianti `+test-*`) o di due conoscenti/familiari (`luca.d.magi@gmail.com`, `mariafpoli@gmail.com`, `ppirulli@libero.it`). Nessun utente è stato acquisito tramite un canale di marketing o outreach reale.
- **Dati transazionali**: 9 `centers`, 8 `activities`, 20 `bookings` (17 confirmed, 1 pending, 2 cancelled) — volumi coerenti con dogfooding/test, non con un pilota di mercato.
- **Beta cohort**: il flag `TRAMA_ONE_ENABLED` è OFF globalmente; visibile solo alla cohort `trama-one-controlled-beta` (8 membership, scadenza estesa al 31/12/2026) e a `platform_admin`. Il prodotto "TRAMA ONE" descritto nei documenti strategici non è quindi accessibile al pubblico.
- **Documenti legali**: `legal_documents`=0 righe pubblicate in produzione. Il codice mostra onestamente "Documento in preparazione" invece di testo fittizio, ma non c'è alcuna Privacy Notice o Termini di servizio pubblicati — **blocker per qualunque acquisizione di utenti esterni reali**, marcato ALTA urgenza in `ROADMAP.md`.
- **Sicurezza**: 1 vulnerabilità npm di livello `high` nota (sharp <0.35.4), fix disponibile ma non applicato.
- **Notifiche email**: codice pronto (degrada senza rompersi se la chiave manca), ma non è verificabile da remoto se `RESEND_API_KEY` sia oggi impostata in produzione.
- **Test end-to-end**: 81 test su 124 file `.spec.ts` totali sono gated per richiedere un ambiente reale (`isRealDeployment`) e non sono mai stati eseguiti come PASS confermato contro un ambiente live.

**Cosa serve prima di poter iniziare a validare il business plan con dati di mercato reali** (da `ROADMAP.md`, sezione "Blocker pre-crescita / pre-produzione"):

1. Pubblicazione di Privacy Notice e Termini (ALTA urgenza — blocca l'acquisizione di utenti).
2. Fix della vulnerabilità npm `high` (ALTA urgenza).
3. Conferma della configurazione di `RESEND_API_KEY` in produzione (ALTA urgenza).
4. Esecuzione dei Golden Journeys sotto ambiente reale (MEDIA urgenza).
5. Avvio effettivo dell'onboarding di famiglie e centri esterni (oggi zero, nonostante il piano GTM della Competitive Intelligence preveda 30-50 famiglie e 5-10 centri attivi entro dicembre 2026).

Questo business plan descrive quindi una **fase pre-pilota**: il prodotto è pronto tecnicamente su gran parte del perimetro, ma nessuna delle quattro ipotesi di validazione elencate nella Competitive Intelligence (Problem, Solution, Supply, Transaction — §9.1) ha ancora raccolto evidenza da utenti esterni reali.

---

## 8. Team

**[PLACEHOLDER — DA COMPILARE: composizione team, ruoli, eventuali co-founder/collaboratori]**

Nessuno dei due documenti strategici sorgente descrive la composizione del team in termini di ruoli, competenze o eventuali co-founder al di là di Fabrizio Pirulli (autore dichiarato della Competitive Intelligence) e di un modello di lavoro "Product/Fabrizio + Claude/Engineering" citato nel RACI operativo del pilot (Competitive Intelligence §8.3): Fabrizio è indicato come accountable/responsible su scope, priorità, implementazione e decisioni KPI; "Claude/Engineering" è indicato come responsible sull'implementazione tecnica. Non ci sono altri ruoli (Partner Ops, Admin Ops, UX/Data) confermati come persone reali assegnate — la tabella RACI li tratta come funzioni, non necessariamente come persone distinte già in squadra. Serve una sezione dedicata su chi fa cosa, eventuali collaboratori esterni, consulenti (es. legale GDPR, citato come necessario nel Master Plan §12) e advisor.

---

## 9. Proiezioni finanziarie

**[PLACEHOLDER — DA COMPILARE: nessun dato finanziario deducibile dal codice o dai documenti strategici disponibili — servono ipotesi di costo, pricing, CAC/LTV stimati]**

Nessuno dei due documenti sorgente contiene una proiezione di ricavi, costi, CAC, LTV, GMV o break-even. Il Master Plan elenca esplicitamente "Modello economico a scenari, CAC, LTV, GMV e break-even" come tema aperto di priorità P1 nel registro dei temi aperti (§15), non come dato già disponibile. La Competitive Intelligence fornisce solo ipotesi di pricing *da validare* (sezione 5 sopra), non proiezioni di volume o di conto economico.

Elementi che servirebbero per costruire questa sezione:
- Costo di acquisizione stimato per famiglia e per centro (CAC).
- Valore atteso nel tempo per famiglia/centro (LTV), anche solo come ipotesi di scenario.
- Struttura di costo attuale (hosting/infrastruttura Supabase/Vercel, eventuali costi di sviluppo, marketing).
- Ipotesi di conversione da richiesta a booking pagante, una volta introdotti i pagamenti (oggi non implementati — vedi `ROADMAP.md`, sezione SCALE/FUTURE: "Pagamenti in-app — Non esiste — LOW (nessuna data sostenibile oggi)").
- Break-even ipotetico per scenario (progetto laterale sostenibile / azienda verticale / piattaforma nazionale — vedi §13 del Master Plan, sezione 11 di questo documento).

---

## 10. Fundraising / fabbisogno di capitale

Il Master Plan tratta il fundraising come uno dei sette temi dell'indice (Prodotto, Ecosistema, Growth Graph, Business Model, Brand, Go-to-Market, **Fundraising**) ma, nel corpo del documento fornito, non sviluppa una sezione dedicata con importi, uso dei fondi o stato delle conversazioni. Il registro dei temi aperti (§15) classifica "Bandi, acceleratori, angel, deck e data room" sotto l'area Fundraising con priorità **P2** (la più bassa delle tre priorità usate nel documento), esplicitamente successiva a Strategia, Growth, Business, Validazione, Competitor e Brand (tutte P0).

Il Piano di lavoro consigliato (Master Plan §16, Fase D — Decisione strategica, 6-12 mesi) colloca la decisione "se cercare bandi, angel o acceleratore" *dopo* aver aggiornato le unit economics e gli scenari finanziari, non come azione immediata.

**[PLACEHOLDER — DA COMPILARE: importo, uso dei fondi, stato conversazioni]** — Non è deducibile dai documenti sorgente se siano in corso conversazioni con investitori, acceleratori o enti erogatori di bandi, né un importo target di raccolta o un piano di utilizzo dei fondi.

---

## 11. Le decisioni aperte (dal Master Plan)

Queste decisioni erano **aperte al 13/07/2026** secondo il Master Plan. Lo stato di avanzamento va riconfermato con Fabrizio — non è possibile da questa sessione sapere se siano state nel frattempo prese, parzialmente prese o restino ancora aperte.

### Le cinque decisioni da prendere per prime (Master Plan, Executive summary)

1. Qual è il perimetro commerciale del lancio: solo centri estivi a Milano o una categoria più ampia?
2. Quale modello di monetizzazione testare con i primi 30-50 gestori?
3. Quali eventi e metriche devono essere tracciati dal giorno zero?
4. TRAMA è un marchio legalmente sostenibile oppure serve un'alternativa?
5. Quali soglie oggettive determineranno il passaggio da progetto parallelo ad azienda full-time?

### Registro completo dei temi aperti per priorità (Master Plan, §15)

**Priorità P0:**
- Definizione definitiva del beachhead market e della sequenza geografica/categorie (Strategia).
- Growth Graph, event taxonomy, dashboard e data governance (Growth).
- Pricing pilota, Founder Program e commissioni applicate solo al valore generato (Business).
- Interviste strutturate e test con famiglie e gestori reali (Validazione).
- Matrice competitor italiana/europea e white-space analysis (Competitor) — **nota: questo tema risulta in gran parte affrontato dalla Competitive Intelligence del 16/07/2026**, che fornisce profili di 8 player e una scorecard comparativa.
- Clearance di TRAMA e shortlist alternativa (Brand).

**Priorità P1:**
- Audit NEXTGEN, design system, iconografia, microcopy e distintività (UX).
- Definizione scope gruppi, condivisione e logistica per il lancio (Product).
- Customer journey, onboarding, supporto e valore misurabile (Gestori).
- Control room, quality governance e processi operativi (Admin).
- Piano primi 30-50 gestori e prime 300-500 famiglie (GTM).
- GDPR minori, termini, responsabilità, cancellazioni, assicurazione (Legal) — **nota: `STATE_OF_THE_ART.md` conferma che, al 23/09/2026, questo tema resta non risolto in produzione: zero documenti legali pubblicati.**
- Modello economico a scenari, CAC, LTV, GMV e break-even (Finance).

**Priorità P2:**
- Bandi, acceleratori, angel, deck e data room (Fundraising).
- Roadmap AI utile, API-first e knowledge graph (AI).
- Marketplace fornitori e professionisti (Ecosistema).
- Jingle, sonic identity, manifesto e social storytelling (Brand media).

### Soglie indicative per il passaggio full-time (Master Plan, §14.1)

- 12-18 mesi di sicurezza finanziaria personale.
- Almeno 6 mesi di crescita o stabilità dei ricavi.
- Segnali di product-market fit: uso ripetuto, referral e retention.
- Unit economics credibili e non basate su lavoro manuale gratuito.
- Pipeline gestori sufficiente per i 6-12 mesi successivi.
- Carico del progetto incompatibile con il lavoro principale.
- Capitale raccolto o ricavi in grado di sostenere il founder.
- Rischio-opportunità del lavoro lasciato valutato esplicitamente.

---

## 12. Riferimenti

- *TRAMA — Master Plan — Sintesi strategica e temi aperti*, v1.0, 13/07/2026 (`uploads/TRAMA_Master_Plan_Sintesi_Strategica_v1.docx`).
- *TRAMA MVP Settembre 2026 — Competitive Intelligence Italia*, v1.1 Trust Layer, 16/07/2026, autore Fabrizio Pirulli (`docs/trama-one/TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx`).
- `docs/trama-one/STATE_OF_THE_ART.md` — verificato contro codice sorgente e DB di produzione il 23/09/2026.
- `docs/trama-one/ROADMAP.md` — 23/09/2026, costruita sopra `STATE_OF_THE_ART.md`.
- Fonti esterne citate nella Competitive Intelligence (Appendice A del documento originale): Regione Lombardia [S1], Comune di Milano [S2], Sky TG24 su Osservatorio Eures–Adoc [S3], Minori.gov.it [S4], Dipartimento Politiche Famiglia [S5], SQUBY/iGrest [S6-S8], Tutto Campi Estivi [S9], Sportclubby [S10], Keikibu [S11], Golee [S12], BookyWay [S13-S14], SYSAP [S15], KidPass/Centri Estivi Digitali [S16].
