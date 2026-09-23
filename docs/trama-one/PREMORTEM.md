# TRAMA — Pre-mortem

23/09/2026.

Esercizio di pre-mortem: si assume che TRAMA sia fallito o si sia arenato 12-18 mesi da oggi, e si lavora a ritroso sulle cause plausibili — combinando rischi già osservati concretamente nel prodotto (`STATE_OF_THE_ART.md`) e rischi strutturali tipici di marketplace bilaterali per famiglie in fase pre-pilota. Non è una previsione, è uno strumento per mitigare per tempo.

Questo documento non sostituisce il pre-mortem già presente nel Master Plan di Fabrizio (§12, "Pre-mortem e rischi principali", 13/07/2026): lo eredita, lo aggiorna con quanto verificato nel codice/DB l'11 settembre dopo, e lo riorganizza per severità × probabilità con azioni concrete. Dove il Master Plan aveva già individuato un rischio, è citato esplicitamente.

---

## 1. Metodo

Il pre-mortem (Gary Klein, *Performing a Project Premortem*, HBR 2007) capovolge la domanda tipica della pianificazione. Invece di chiedere "cosa potrebbe andare storto?", si immagina che il progetto **sia già fallito** e si chiede "cosa deve essere successo perché questo fallimento sia plausibile?". Il vantaggio rispetto a un risk assessment prospettico è psicologico e pratico: lavorare a ritroso da un fallimento immaginato riduce l'ottimismo da pianificazione (planning fallacy) e dà il permesso, a chi partecipa, di esprimere dubbi che normalmente restano non detti finché tutto va bene.

Applicazione in questo documento:

1. **Scenario**: è il 23/09/2026 + 12-18 mesi (indicativamente Q3-Q4 2027). TRAMA non è cresciuto, ha esaurito energia/capitale/tempo del founder, o è stato messo in pausa/chiuso.
2. **Cause radice**: per ciascuna categoria di rischio, si elencano cause plausibili che avrebbero portato a quello scenario, con segnali d'allarme osservabili oggi e mitigazioni.
3. **Fonti**: le cause non sono ipotetiche generiche — dove possibile sono ancorate a gap *già osservati* nel prodotto reale (`STATE_OF_THE_ART.md`, verificato contro codice e DB di produzione il 23/09/2026), al modello di business proposto (`BUSINESS_PLAN.md`), al pre-mortem originale del Master Plan (§12) e a un audit storico dell'agosto 2026 (`docs/trama-one/archive/prelaunch-360-audit-agosto/TRAMA_PRELAUNCH_RISK_REGISTER.md`) usato solo come indice di rischi già una volta identificati, non come stato attuale (molte righe di quel registro sono oggi superate — vedi note puntuali sotto).
4. **Limite dichiarato**: questo esercizio è condotto da un agente AI (Claude) sopra documenti e codice, non in una sessione di gruppo con Fabrizio e stakeholder reali (il modo in cui Klein raccomanda di farlo). Le probabilità/impatti in questo documento sono quindi una **prima ipotesi da validare**, non un output di un workshop collettivo.

---

## 2. Scenari di fallimento — cause radice

### 2.1 Rischio di validazione/domanda

**Descrizione generale**: nessuno vuole davvero il prodotto oltre Fabrizio e i suoi conoscenti; la beta privata non converte in utilizzo reale ripetuto.

- **Causa A — Il pilota non parte mai davvero.** Oggi (23/09/2026) tutti i 10 account in produzione sono di Fabrizio (incluse varianti `+test-*`) o di due conoscenti/familiari; zero utenti acquisiti via canale reale (`STATE_OF_THE_ART.md`, "Dati reali in produzione"). Il calendario dichiarato nella Competitive Intelligence prevedeva "beta privata e apprendimento" da settembre a dicembre 2026 con 30-50 famiglie e 5-10 centri attivi (`BUSINESS_PLAN.md`, §6.3) — a oggi zero.
  - *Segnali d'allarme*: nessun invito inviato a famiglie/centri esterni entro fine ottobre; nessuna crescita della cohort beta oltre le 8 membership attuali.
  - *Mitigazione*: eseguire concretamente il GTM sequence del Master Plan (§10.1): 2-3 zone Milano, 25-30 centri onboardati, waitlist famiglie — prima di investire ulteriore tempo prodotto.

- **Causa B — I pochi utenti reali provano il prodotto una volta e non tornano.** Nessuna metrica di retention è oggi misurabile (zero dati reali). Il Master Plan stesso identifica questo come rischio critico ("Cold start domanda: le famiglie non scoprono o non si fidano", §12) e la Competitive Intelligence lo inquadra come il vero "incumbent" da battere: il workflow informale (WhatsApp, Excel, passaparola) è "gratuito, familiare e sufficientemente buono" (`BUSINESS_PLAN.md`, §2) — un'interfaccia più elegante non basta a spostare comportamento.
  - *Segnali d'allarme*: `app_reopened_7d` e `second_booking_completed` (eventi previsti nel Growth Graph, Master Plan §5.3) restano bassi o non tracciati; famiglie che completano un solo booking e spariscono.
  - *Mitigazione*: instrumentare davvero gli eventi P0 del Growth Graph prima/durante l'onboarding dei primi utenti esterni, non dopo.

- **Causa C — Nessuna validazione sistematica con interviste reali.** Il Master Plan classifica "interviste strutturate e test con famiglie e gestori reali" come tema aperto P0 (§15), non ancora chiuso secondo questo documento (non verificabile da questa sessione se sia stato fatto nel frattempo).
  - *Segnali d'allarme*: decisioni prodotto prese solo per intuizione di Fabrizio, senza feedback strutturato da utenti esterni.
  - *Mitigazione*: 10-15 interviste (Master Plan, Fase B) prima di continuare a costruire feature POST-BETA.

### 2.2 Rischio marketplace/cold-start

**Descrizione generale**: lato Partner (offerta) e lato Genitore (domanda) non crescono in parallelo; senza massa critica su un lato l'altro abbandona — problema classico dei marketplace bilaterali, già identificato esplicitamente nel Master Plan ("Il marketplace soffre del cold start: le famiglie non arrivano senza offerta e i gestori non entrano senza domanda", §10).

- **Causa A — Offerta troppo sottile per generare scoperta reale.** Oggi in produzione: 9 `centers`, 8 `activities` (`STATE_OF_THE_ART.md`). Il Master Plan indicava una soglia minima di 25-30 centri "con schede complete e disponibilità reale" (§10.1) prima del lancio territoriale — siamo a circa un terzo. Con un catalogo così piccolo, la Discovery Map (per quanto tecnicamente ben rifinita dopo il ciclo di bugfix di settembre) mostra poche opzioni per zona.
  - *Segnali d'allarme*: famiglie che aprono la ricerca e trovano 0-2 risultati rilevanti nella loro zona/fascia d'età.
  - *Mitigazione*: dare priorità assoluta al reclutamento Partner rispetto a nuove feature famiglia, finché non si superano le 20-25 attività pubblicate.

- **Causa B — I centri onboardati non pubblicano disponibilità reale o smettono di aggiornarla.** `center_leads`=6 righe con solo 6 `claimed` su 18 `suggested` (`STATE_OF_THE_ART.md`) — un funnel di acquisizione supply ancora molto stretto anche solo per generare lead, prima ancora di arrivare a centri attivi.
  - *Segnali d'allarme*: centri che si candidano ma non completano l'onboarding (`center_onboarding_state` fermo); attività pubblicate ma mai aggiornate (settimane/posti scaduti).
  - *Mitigazione*: onboarding assistito 1:1 nella fase pilota (coerente con "Assistenza diretta TRAMA" già presente in `ROADMAP.md`), non solo self-service.

- **Causa C — Disintermediazione: una volta connessi, famiglia e centro si accordano fuori piattaforma.** Rischio esplicito nel Master Plan (§12, "Disintermediazione: famiglie e centri concludono fuori piattaforma — Alto"). Con zero pagamenti in-app (`ROADMAP.md`, SCALE/FUTURE: "Pagamenti in-app — Non esiste — LOW") e zero servizi esclusivi a valore aggiunto ancora dimostrati con utenti reali, non c'è oggi nessun meccanismo che renda costoso uscire dalla piattaforma dopo il primo contatto.
  - *Segnali d'allarme*: alto tasso di `activity_inquiries` (già 211 righe, `STATE_OF_THE_ART.md`, verosimilmente in parte test) che non convertono mai in `bookings` (solo 20 booking totali).
  - *Mitigazione*: costruire valore ricorrente (planner, gruppi, promemoria, condivisione) che renda la piattaforma utile anche dopo la prima prenotazione, non solo un canale di primo contatto.

- **Causa D — Nessuna soglia di densità geografica definita e rispettata.** Sia il Master Plan (§10.1, "la densità vale più della copertura estesa") sia la Competitive Intelligence insistono su 2-3 micro-zone, non "tutta Milano". Se il reclutamento centri si disperde geograficamente invece di concentrarsi, nessuna zona raggiunge mai densità sufficiente per generare un'esperienza di ricerca convincente.
  - *Segnali d'allarme*: centri onboardati sparsi su zone diverse senza un cluster con almeno 5-8 centri comparabili nello stesso raggio.
  - *Mitigazione*: bloccare esplicitamente l'onboarding fuori dalle 2-3 zone scelte, anche se un centro interessato è fuori perimetro.

### 2.3 Rischio di fiducia/qualità

**Descrizione generale**: senza Trust Layer/verifica reale, i genitori non si fidano di centri sconosciuti trovati online.

- **Causa A — Zero UI di Trust Score, nonostante sia centrale nel posizionamento dichiarato.** Confermato in `STATE_OF_THE_ART.md`: "zero occorrenze nel codice applicativo — il concetto compare solo nei documenti (Handbook derivati, `DECISION_LOG.md`), mai in un componente reale". Il positioning statement stesso (`BUSINESS_PLAN.md`, §2) promette "un'attività verificata" — una promessa che il prodotto reale non mostra ancora visivamente.
  - *Segnali d'allarme*: genitori che abbandonano la scheda attività prima di richiedere/prenotare, citando "non conosco questo centro" nei feedback (`beta_feedback`, 7 righe oggi).
  - *Mitigazione*: anche una versione minima di trust signal (es. badge "verificato da TRAMA" per i centri con onboarding completo) prima di aprire a famiglie esterne, non aspettare il Trust Layer completo.

- **Causa B — Verifica identità Partner non collegata.** `center_identity_verifications`=0 righe: schema pronto, upload documento non collegato per decisione esplicita DEC-22 (`STATE_OF_THE_ART.md`) — una scelta di scope dichiarata, non un bug, ma che lascia oggi la piattaforma senza alcuna verifica reale dell'identità dei centri pubblicati.
  - *Segnali d'allarme*: un centro fittizio o problematico riesce a pubblicarsi senza che nessun controllo umano/automatico lo intercetti prima che una famiglia prenoti.
  - *Mitigazione*: verifica manuale umana (Fabrizio/Admin) di ogni centro prima della pubblicazione, come controllo compensativo finché la verifica automatica non esiste.

- **Causa C — Nessuna recensione/rating visibile da genitori precedenti.** Non risulta nel codice verificato un sistema di recensioni post-booking. Senza segnali sociali di fiducia (nemmeno un case study/testimonianza, ancora da costruire secondo il Master Plan §16 Fase C), un genitore nuovo non ha nulla su cui basare la fiducia oltre al marchio TRAMA stesso, che non ha ancora reputazione.
  - *Segnali d'allarme*: tasso di conversione richiesta→prenotazione basso specificamente per centri "nuovi" senza storico.
  - *Mitigazione*: raccogliere e mostrare le prime testimonianze/case study appena disponibili (Master Plan, Fase C), anche in forma manuale/curata prima di un sistema di recensioni strutturato.

### 2.4 Rischio tecnico/operativo

**Descrizione generale**: legal docs non pubblicati, vulnerabilità di sicurezza note non risolte, nessun test sotto carico reale, possibili bug live simili a quelli già trovati e corretti in questa sessione che potrebbero riemergere altrove nel codice.

- **Causa A — Apertura a utenti esterni prima della pubblicazione dei documenti legali.** `legal_documents`=0 righe in produzione (`STATE_OF_THE_ART.md`); il codice è onesto ("Documento in preparazione") ma questo blocca esplicitamente, per `ROADMAP.md`, "qualunque acquisizione di utenti reali" — urgenza ALTA. Se questo blocker viene bypassato per fretta (es. "tanto sono solo amici"), il rischio si sposta da tecnico a legale/reputazionale reale nel momento in cui la beta si allarga anche di poco oltre la cerchia stretta.
  - *Segnali d'allarme*: inviti a famiglie esterne inviati prima che `legal_documents` abbia almeno una riga `PUBLISHED`.
  - *Mitigazione*: trattare la pubblicazione Privacy/Termini come gate bloccante hard, non aggirabile, prima di qualunque invito esterno — coerente con quanto già scritto in `ROADMAP.md`.

- **Causa B — Vulnerabilità npm nota non risolta prima di aprire il traffico.** 1 vulnerabilità `high` confermata via `npm audit` (`sharp` <0.35.4, GHSA-rgj7-g3m4-5g8c) con fix disponibile (`npm audit fix`) ma non applicato (`STATE_OF_THE_ART.md`). Nota storica: l'audit dell'agosto 2026 (`TRAMA_PRELAUNCH_RISK_REGISTER.md`, R-06) aveva già chiuso una vulnerabilità `high` diversa su `next` — questa è una vulnerabilità nuova/diversa riapparsa nel frattempo, segno che il ciclo "vulnerabilità nota → fix → nuova vulnerabilità" è ricorrente e richiede un processo, non un intervento una tantum.
  - *Segnali d'allarme*: `npm audit` continua a mostrare advisory `high` non risolte a distanza di settimane.
  - *Mitigazione*: applicare `npm audit fix` come parte del ciclo di manutenzione regolare, non solo quando un audit esterno lo segnala.

- **Causa C — Golden Journeys mai eseguiti sotto ambiente reale.** 81 test su 124 file `.spec.ts` totali sono gated `isRealDeployment` e non sono mai stati eseguiti come PASS confermato contro un ambiente live (`STATE_OF_THE_ART.md`, `ROADMAP.md`) — condizione nota da settimane, invariata rispetto a quanto già segnalato a settembre.
  - *Segnali d'allarme*: un bug in produzione che uno di questi test avrebbe intercettato, scoperto solo da un utente reale.
  - *Mitigazione*: eseguire i Golden Journeys contro un ambiente reale prima di scalare oltre il Micro Pilot, come già indicato in `ROADMAP.md` (urgenza MEDIA).

- **Causa D — Bug live simili a quelli già trovati e corretti potrebbero riemergere altrove.** Il ciclo di bugfix Discovery Map di questa settimana (commit `fa121ca` → `1f0e0ea`, `STATE_OF_THE_ART.md`) ha corretto più bug di stato/URL e "filtri fantasma" scoperti solo da uso dal vivo, non da test automatici — un pattern (stato non sincronizzato tra URL/UI/persistenza) che è plausibile riappaia in altre aree del prodotto (es. Planner, prenotazioni) non ancora sottoposte allo stesso livello di stress test dal vivo.
  - *Segnali d'allarme*: segnalazioni utente (`beta_feedback`) che descrivono comportamento "fantasma" (dato mostrato non corrisponde allo stato reale) in aree diverse dalla Mappa.
  - *Mitigazione*: applicare lo stesso tipo di verifica dal vivo (non solo unit test) usata per la Discovery Map anche a Planner e prenotazioni prima di ampliare la beta.

- **Causa E — Race condition sotto carico concorrente reale mai testata.** Il fix CAS su `spots_left` (`lib/capacity/service.ts`) è verificato staticamente con un test dedicato, ma non ancora sotto carico concorrente reale in produzione (`STATE_OF_THE_ART.md`) — un limite dichiarato esplicitamente, non un gap nascosto.
  - *Segnali d'allarme*: overbooking segnalato da un Partner con più prenotazioni simultanee sullo stesso ultimo posto.
  - *Mitigazione*: monitorare i log di retry CAS (`MAX_CAS_ATTEMPTS`) durante i primi periodi di traffico concorrente reale, non aspettare un incidente per accorgersene.

- **Causa F — Dati mock non distinguibili da dati reali in alcune dashboard.** Non riverificato voce per voce in questa sessione (`STATE_OF_THE_ART.md`) se le dashboard Admin/Partner abbiano un banner esplicativo ovunque necessario. L'audit storico dell'agosto 2026 aveva già trovato e mitigato questo problema una volta (R-01/R-12 nel risk register archiviato) — il fatto che oggi risulti di nuovo "da riverificare" suggerisce che nuove superfici potrebbero essere state aggiunte senza applicare lo stesso standard.
  - *Segnali d'allarme*: un Partner o Admin reale scambia un numero mock per un dato reale e prende una decisione di business su quello.
  - *Mitigazione*: ispezione UI dedicata per dashboard, come già raccomandato in `ROADMAP.md` (urgenza BASSA/MEDIA), prima di mostrare le dashboard a Partner esterni.

### 2.5 Rischio di execution/team

**Descrizione generale**: Fabrizio come founder solo/quasi solo, carico su una sola persona per prodotto+business+tech.

- **Causa A — Burnout founder.** Rischio esplicito già nel Master Plan (§12: "Burnout founder: troppi ruoli contemporaneamente — Alto"). Il modello di lavoro descritto ("Product/Fabrizio + Claude/Engineering", `BUSINESS_PLAN.md` §8) conferma che oggi non ci sono altri ruoli (Partner Ops, Admin Ops, UX/Data) coperti da persone reali distinte — sono trattati come funzioni nella RACI, non come team.
  - *Segnali d'allarme*: ritmo di lavoro insostenibile prolungato; decisioni prese sotto pressione senza validazione esterna.
  - *Mitigazione*: le soglie esplicite del Master Plan (§14.1) per il passaggio full-time includono "carico del progetto incompatibile con il lavoro principale" — usarle come segnale di allarme precoce, non solo come traguardo.

- **Causa B — Nessun secondo paio d'occhi su decisioni di business/legal critiche.** Nessun consulente legale GDPR confermato coinvolto (il Master Plan lo cita come necessario, §12, "consulenza GDPR"), nessun co-founder o advisor confermato oltre Fabrizio (`BUSINESS_PLAN.md`, §8, sezione team con placeholder esplicito).
  - *Segnali d'allarme*: pubblicazione dei documenti legali fatta senza revisione professionale, per fretta di sbloccare l'onboarding.
  - *Mitigazione*: coinvolgere un consulente legale (anche una consulenza puntuale, non necessariamente un rapporto continuativo) prima di pubblicare Privacy/Termini per un prodotto che tratta dati di minori.

- **Causa C — Dipendenza totale da un singolo agente AI (Claude) per l'intera execution tecnica.** Il modello RACI attuale (`BUSINESS_PLAN.md`, §8) assegna "Claude/Engineering" come responsible sull'implementazione tecnica — un modello di sviluppo interamente mediato da sessioni AI, senza un team di sviluppo umano di backup. Non è di per sé un fallimento, ma è un singolo punto di dipendenza operativa.
  - *Segnali d'allarme*: velocità di correzione bug/feature che rallenta bruscamente per qualunque motivo (disponibilità, budget, cambio di strumento).
  - *Mitigazione*: mantenere documentazione tecnica aggiornata (come questo stesso corpus `docs/trama-one/`) abbastanza esplicita da permettere a un altro sviluppatore umano o a un'altra sessione AI di orientarsi rapidamente.

### 2.6 Rischio di business model

**Descrizione generale**: commissioni/canone non validati con dati reali, possibile resistenza dei centri a pagare, incertezza su chi paga cosa.

- **Causa A — Pricing interamente ipotetico, mai testato con un centro pagante reale.** `BUSINESS_PLAN.md` §5.3 lo dichiara esplicitamente: "Le cifre sopra (commissioni 3-8%, canoni 30-80€/149€, referral 10%/25€) sono ipotesi da validare, non prezzi decisi né testati con clienti reali." Zero `partner_offers` in produzione, zero transazione commissionata registrata.
  - *Segnali d'allarme*: nessun centro accetta di passare dal modello "gratuito nella fase pilota" a un canone/commissione reale quando richiesto.
  - *Mitigazione*: testare la willingness to pay con i primi Founder Partner appena onboardati, anche solo con una domanda diretta prima del commitment tecnico completo.

- **Causa B — Percezione di TRAMA come "tassa" invece che valore aggiunto.** Il Master Plan stesso motiva il modello ibrido (canone + commissione) proprio per evitare che "una commissione unica sul fatturato" sia "percepita come una tassa" e incentivi la disintermediazione (`BUSINESS_PLAN.md`, §5.1) — un rischio già anticipato nella progettazione del modello, non ancora testato.
  - *Segnali d'allarme*: centri che pubblicano attività ma cercano di reindirizzare le famiglie fuori piattaforma per evitare la commissione.
  - *Mitigazione*: rendere il valore del canale (lead qualificati, visibilità, riduzione lavoro amministrativo) tangibile e misurabile per il Partner prima di introdurre la commissione reale.

- **Causa C — Nessun dato per stimare CAC/LTV/break-even.** `BUSINESS_PLAN.md` §9 conferma che nessuna proiezione di ricavi, costi, CAC, LTV o break-even è oggi deducibile — è un tema P1 esplicitamente aperto nel Master Plan (§15). Senza questi numeri, non è possibile sapere se il modello di business, anche se accettato dai centri, sia sostenibile.
  - *Segnali d'allarme*: crescita di utenti/centri senza mai calcolare quanto costa acquisirli rispetto a quanto generano.
  - *Mitigazione*: iniziare a tracciare il costo reale (tempo di Fabrizio, eventuali spese) per ogni centro/famiglia onboardata manualmente durante il pilota, anche in modo grezzo, per avere un primo CAC osservato.

- **Causa D — Ambiguità su chi paga cosa in una fase in cui tutto è gratuito.** Oggi sia famiglie sia Partner sono su un modello gratuito/shadow (`BUSINESS_PLAN.md` §5.2) — un design intenzionale per il beta, ma che rimanda il vero test del modello di business a una fase successiva mai ancora raggiunta.
  - *Segnali d'allarme*: il pilota si allunga indefinitamente in modalità "tutto gratis" senza mai introdurre un test di pagamento reale, anche piccolo.
  - *Mitigazione*: definire in anticipo un trigger esplicito (es. dopo N centri attivi o M settimane) per introdurre almeno un primo test di commissione/canone reale, anche simbolico.

### 2.7 Rischio competitivo

**Descrizione generale**: player esistenti già con base utenti consolidata — perché un genitore/centro dovrebbe cambiare?

- **Causa A — Player con base utenti enormemente più grande già oggi.** Dati auto-dichiarati citati in `BUSINESS_PLAN.md` §4.2: SQUBY oltre 170.000 utenti [S6], Tutto Campi Estivi oltre 250.000 visite/stagione con 140+ organizzatori [S9], BookyWay oltre 2.300 attività e un milione di utenti [S13]. TRAMA parte da 9 centri e 10 account, quasi tutti di Fabrizio. Il gap di scala è enorme e nessun dato di mercato dimensionato (TAM/SAM/SOM) esiste ancora per capire quanto sia realistico colmarlo (`BUSINESS_PLAN.md`, §4.2, placeholder esplicito).
  - *Segnali d'allarme*: un centro contattato preferisce restare su/aggiungere SQUBY o BookyWay perché "tutti già li usano" o "i miei clienti sono già lì".
  - *Mitigazione*: la strategia di posizionamento del Master Plan (§4.3, `BUSINESS_PLAN.md`) tratta esplicitamente SQUBY come "possibile partner/integration target più che concorrente diretto" — un'ipotesi di convivenza/integrazione da validare piuttosto che una battaglia frontale su scala, che TRAMA non può vincere nel breve periodo.

- **Causa B — Differenziazione (Planner familiare, discovery cross-centro) non ancora provata come motivo di scelta reale.** Il "white space" need-first orchestration (`BUSINESS_PLAN.md` §4.1) è una tesi di posizionamento, non ancora validata da un solo genitore esterno che abbia scelto TRAMA specificamente per questo motivo rispetto a un'alternativa esistente.
  - *Segnali d'allarme*: gli utenti pilota (quando arriveranno) usano solo la funzione di prenotazione base e ignorano Planner/gruppi/condivisione — il differenziatore dichiarato non genera comportamento diverso.
  - *Mitigazione*: misurare esplicitamente l'uso di Planner/gruppi/condivisione (non solo ricerca+prenotazione) nei primi utenti reali, per verificare se il differenziatore regge.

- **Causa C — Rischio di dipendenza da/assorbimento da parte di agenti AI generalisti.** Il Master Plan lo affronta esplicitamente (§11, "Strategia AI e rischio dei personal AI OS"): "TRAMA è vulnerabile se resta un catalogo o un frontend. È più difendibile se possiede dati aggiornati, relazioni con i centri, disponibilità, pagamenti, recensioni, workflow e gruppi." Oggi TRAMA è più vicino al primo stato che al secondo (pagamenti non esistono, recensioni non esistono, Trust Layer non esiste in UI).
  - *Segnali d'allarme*: un assistente AI generalista (es. un chatbot di pianificazione familiare) diventa capace di rispondere alla stessa domanda ("trovami un centro estivo per mio figlio in questa settimana") usando dati pubblici, senza bisogno di TRAMA come intermediario.
  - *Mitigazione*: costruire i moat non-copiabili nel breve periodo (relazioni reali con i centri, disponibilità verificata, gruppi attivi) prima che sia solo un frontend di ricerca sostituibile.

### 2.8 Rischio regolatorio/compliance

**Descrizione generale**: dati minori, GDPR, privacy — aggravato dal fatto che privacy/termini non sono ancora pubblicati.

- **Causa A — Zero documenti legali pubblicati mentre il prodotto tratta dati di minori.** `legal_documents`=0 righe (`STATE_OF_THE_ART.md`); il tema "GDPR minori, termini, responsabilità, cancellazioni, assicurazione" è esplicitamente classificato priorità P1 nel Master Plan (§15) e risulta, secondo questo documento, non ancora risolto in produzione al 23/09/2026. L'audit storico dell'agosto 2026 (`TRAMA_PRELAUNCH_RISK_REGISTER.md`, R-03) aveva già costruito tutta l'infrastruttura tecnica (tabelle, gate, route pubbliche) lasciando esplicitamente il contenuto legale come "gate genuino" da risolvere — un mese dopo, il gate risulta ancora aperto.
  - *Segnali d'allarme*: qualunque acquisizione di utenti esterni reali avviata prima che questo gate sia chiuso.
  - *Mitigazione*: trattarlo come blocco hard (già fatto in `ROADMAP.md`, urgenza ALTA) — nessuna eccezione, nemmeno per "pochi amici fidati", dato che si tratta di dati di minori.

- **Causa B — Nessun cookie banner / consenso su chiamate di terze parti.** Segnalato nell'audit storico (R-22, `TRAMA_PRELAUNCH_RISK_REGISTER.md`) come rischio basso ma presente: Google Fonts e jsDelivr Tabler icons partono senza gate di consenso. Non riverificato in questa sessione se sia stato risolto nel frattempo.
  - *Segnali d'allarme*: una verifica di compliance esterna (es. in vista di un fundraising o di una partnership) segnala questo gap come bloccante.
  - *Mitigazione*: self-hosting di font/icone (soluzione già indicata nell'audit storico) risolverebbe alla radice, sforzo basso.

- **Causa C — RLS a livello di riga ma non di colonna su dati sensibili di minori.** Segnalato nell'audit storico (R-21): la protezione che impedisce a un Partner di vedere `birth_date`/foto di un bambino vive nel livello applicativo (query specifiche), non nel database — fragile a future modifiche incaute che potrebbero esporre involontariamente questi dati.
  - *Segnali d'allarme*: una nuova query Partner su `kids` aggiunta senza replicare esplicitamente la stessa protezione delle query esistenti.
  - *Mitigazione*: introdurre una VIEW dedicata con column-level security quando si aggiungono nuove query Partner su `kids`, come già raccomandato nell'audit storico.

- **Causa D — Nessuna consulenza legale GDPR confermata prima della pubblicazione dei documenti.** Il Master Plan cita esplicitamente "consulenza GDPR" come mitigazione necessaria per il rischio "Privacy minori" (§12), non confermata come già ottenuta.
  - *Segnali d'allarme*: documenti legali pubblicati redatti solo internamente (es. da un modello AI) senza revisione professionale, per un prodotto che tratta dati di minori — rischio sia legale sia reputazionale se scoperto.
  - *Mitigazione*: far rivedere il testo legale finale da un professionista prima della pubblicazione, anche con una consulenza puntuale.

---

## 3. Top 5 rischi per severità × probabilità

**Nota metodologica esplicita**: questa è una valutazione qualitativa di questo agente (Claude), fatta leggendo documenti e codice, non un dato oggettivo né il risultato di un workshop con Fabrizio o altri stakeholder. Probabilità e impatto vanno validati e, se necessario, corretti da Fabrizio — in particolare la probabilità, che dipende da informazioni (es. quanto tempo/energia Fabrizio può dedicare nei prossimi mesi, se ci sono già conversazioni con centri) che questa sessione non ha.

| # | Rischio | Probabilità (qualitativa) | Impatto (qualitativo) | Perché è in Top 5 |
|---|---|---|---|---|
| 1 | Il pilota non genera mai dati di mercato reali (resta dogfooding indefinitamente) | Alta | Critico | È la condizione attuale, non un'ipotesi: zero utenti esterni reali a oggi, nessun'altra sezione di questo documento è verificabile senza superare questo primo gradino |
| 2 | Cold-start marketplace: offerta troppo sottile (9 centri) per generare scoperta/conversione convincente anche quando arrivano famiglie | Alta | Critico | Anche risolvendo il rischio #1, un catalogo di 8-9 attività non sostiene un'esperienza di ricerca credibile — soglia dichiarata nel Master Plan è 25-30 centri |
| 3 | Fiducia: assenza di Trust Layer/verifica visibile mentre il posizionamento promette "attività verificata" | Media-Alta | Alto | Rischio di un gap diretto tra promessa di marketing e prodotto reale, che può danneggiare la fiducia dei primissimi utenti esterni — costosa da recuperare in una fase così iniziale |
| 4 | Blocco legale/reputazionale per apertura a utenti esterni prima della pubblicazione di Privacy/Termini | Media | Critico | Probabilità media perché il gate è già noto e monitorato (`ROADMAP.md`), ma l'impatto è critico e irreversibile (dati di minori) se bypassato per fretta |
| 5 | Business model mai testato con un pagamento reale (pricing resta ipotesi indefinitamente) | Media-Alta | Alto | Anche con crescita di utenti/centri, senza mai testare la willingness to pay il progetto non genera evidenza per decidere se è sostenibile — rischio di "crescita di vanità" senza economia reale |

---

## 4. Azioni di mitigazione immediate (prossimi 30-60 giorni)

Ancorate a `ROADMAP.md` dove possibile — non è un nuovo backlog, è una selezione con priorità di quanto già lì presente più alcune azioni di processo aggiuntive emerse da questo esercizio.

1. **Pubblicare Privacy Notice e Termini** (`ROADMAP.md`, blocker urgenza ALTA) — precondizione hard per qualunque azione di GTM verso utenti esterni. Coinvolgere revisione legale professionale (§2.8, Causa D di questo documento).
2. **Applicare `npm audit fix` per la vulnerabilità `sharp`** (`ROADMAP.md`, blocker urgenza ALTA) — a basso sforzo, nessuna scusa per rimandare.
3. **Confermare configurazione `RESEND_API_KEY` in produzione** (`ROADMAP.md`, blocker urgenza ALTA) — verificabile solo da Fabrizio/Vercel, azione singola e rapida.
4. **Avviare concretamente l'onboarding di centri esterni nelle 2-3 zone scelte**, con l'obiettivo dichiarato dal Master Plan di 25-30 centri prima del lancio territoriale — oggi a 9. Priorità sopra qualunque nuova feature.
5. **Introdurre un trust signal minimo visibile** (anche solo badge "profilo completato/verificato da TRAMA") prima di invitare le prime famiglie esterne, senza aspettare il Trust Layer completo.
6. **Eseguire i Golden Journeys contro un ambiente reale** (`ROADMAP.md`, urgenza MEDIA) prima di ampliare la beta oltre il Micro Pilot.
7. **Definire un trigger esplicito per il primo test di pagamento reale** (anche simbolico: un canone minimo o una commissione su un singolo booking), per non lasciare il modello di business indefinitamente ipotetico.
8. **Instrumentare gli eventi Growth Graph P0** (Master Plan §5.3) prima/durante l'onboarding dei primi utenti esterni, così da poter osservare i segnali d'allarme di questo documento appena accadono, non retroattivamente.

---

## 5. Segnali da monitorare (early warning indicators)

Metriche/segnali concreti che, se osservati, indicherebbero che uno scenario di fallimento è in corso — utili per una revisione periodica (es. mensile) di questo documento con Fabrizio.

| Segnale | Cosa indicherebbe | Dove guardare |
|---|---|---|
| Zero nuovi `profiles` esterni a Fabrizio/conoscenti dopo 4-6 settimane di GTM attivo | Rischio di validazione/domanda in corso | Query diretta su `profiles`, filtrando gli account noti di Fabrizio |
| `centers` non supera 12-15 entro fine ottobre 2026 | Cold-start offerta in corso, soglia Master Plan (25-30) lontana | Query diretta su `centers` con stato attivo |
| `activity_inquiries` alto ma `bookings` stagnante (rapporto inquiry→booking basso e stabile) | Possibile disintermediazione o problema di fiducia/conversione | Confronto `activity_inquiries` vs `bookings` nel tempo |
| `beta_feedback` con temi ricorrenti su fiducia/sconosciuto centro | Rischio fiducia/qualità in corso | Lettura diretta `beta_feedback` |
| Nessun centro accetta di discutere un canone/commissione reale quando proposto | Rischio business model in corso | Conversazioni dirette Fabrizio-centri, da tracciare anche solo in modo informale |
| `legal_documents` resta a 0 righe mentre si pianificano inviti esterni | Rischio regolatorio/compliance imminente | Query diretta su `legal_documents` prima di ogni invito |
| Ritmo di commit/attività di sviluppo che rallenta bruscamente senza spiegazione di scope | Possibile segnale precoce di burnout founder | Osservazione diretta di `deploy_events`/cronologia commit nel tempo |
| Famiglie pilota usano solo ricerca+prenotazione, mai Planner/gruppi/condivisione | Il differenziatore competitivo dichiarato non genera comportamento diverso | Eventi Growth Graph (quando instrumentati) per feature usage |
| `npm audit` continua a mostrare advisory `high` non risolte a distanza di settimane | Debito di sicurezza diventato strutturale, non occasionale | `npm audit` periodico |

---

## 6. Riferimenti

- `docs/trama-one/STATE_OF_THE_ART.md` — verificato contro codice sorgente e DB di produzione il 23/09/2026 (fonte primaria dei gap tecnici/prodotto citati in questo documento).
- `docs/trama-one/ROADMAP.md` — 23/09/2026, blocker pre-crescita/pre-produzione citati nella sezione 4.
- `docs/trama-one/BUSINESS_PLAN.md` — 23/09/2026, modello di business, dati competitivi e placeholder citati nelle sezioni 2.6/2.7.
- *TRAMA — Master Plan — Sintesi strategica e temi aperti*, v1.0, 13/07/2026 (`uploads/TRAMA_Master_Plan_Sintesi_Strategica_v1.docx`) — in particolare §10 (GTM/cold-start), §12 (pre-mortem originale), §13 (scenari 12-24 mesi), §14 (soglie full-time), §15 (registro temi aperti).
- `docs/trama-one/archive/prelaunch-360-audit-agosto/TRAMA_PRELAUNCH_RISK_REGISTER.md` — audit storico del 24-25/08/2026, usato solo come indice di rischi già una volta identificati (molte righe oggi superate o mitigate diversamente — vedi note puntuali nel testo, es. §2.4 Causa B e F, §2.8 Causa A/B/C).
