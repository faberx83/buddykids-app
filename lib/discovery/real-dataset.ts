// TRAMA — REAL DISCOVERY PILOT (16/09/2026, esteso 17/09/2026 — COMPLETION PASS)
//
// Dataset CODE-BASED (nessuna nuova tabella, nessuna riga in "activities"/
// "centers") di attività estive REALMENTE esistenti, scoperte sul web da
// TRAMA ma NON pubblicate/gestite da un Partner TRAMA. Vive qui — non in
// Supabase — proprio perché il modello dati "activities" presuppone sempre
// un Partner (centro con account, RLS, wizard di prenotazione "Prenota
// ora" — vedi Data Model Audit nel report). Mischiare i due domini
// rappresenterebbe falsamente un'attività scoperta come se fosse gestita
// da TRAMA: vedi DiscoveryLeadCard.tsx (componente separato da
// ActivityCard, MAI "Prenota ora").
//
// REGOLA NON NEGOZIABILE (istruzione esplicita di Fabrizio): REAL DATA YES,
// FAKE PARTNERS NO. Ogni riga qui sotto è tracciabile a una fonte reale
// (sources[]), e ogni campo non verificabile dalla fonte resta `null` —
// mai inventato per "completare" una card. Vedi il campo `temporalNote` per
// la trasparenza sulla stagionalità.
//
// COMPLETION PASS (17/09/2026): il dataset è passato da 6 a 13 record dopo
// una seconda ricerca più approfondita su entrambi i cluster geografici
// (vedi report "TRAMA REAL DISCOVERY PILOT — FINAL RESULT" per il dettaglio
// fonte per fonte). 13 record onesti sono stati preferiti a un numero
// artificialmente più alto: diversi lead scoperti in questa sessione
// (Cusago, ASD Sensazioni in Movimento Mola di Bari) sono stati
// deliberatamente ESCLUSI per verificabilità insufficiente — vedi
// REJECTED_DISCOVERY_LEADS in fondo a questo file.
//
// DISCOVERY UNIFICATION + PROPONI INVITO (21/09/2026): aggiunti due campi
// derivati SOLO da informazioni già verificate nella sessione precedente
// (nessuna nuova ricerca, nessun dato inventato):
// - `invitable`: true per i 7 record dove l'ORGANIZZATORE è un'entità reale,
//   nominata, distinta dal Comune che eventualmente commissiona il servizio
//   (Stripes, Milanosport, Lyceum, NotFormalCamp, USOB, Oratorio San
//   Giovanni Bosco, Il Sogno di Don Bosco). false per i 6 record dove la
//   fonte descrive un SERVIZIO COMUNALE con gestore non nominato o che
//   ruota di anno in anno (Cornaredo, Pero, Settimo Milanese, Milano Centri
//   Estivi Primarie, Bareggio comunale, Noicattaro) — mostrare "Proponi
//   invito" su questi ultimi genererebbe una manifestazione d'interesse
//   verso un'entità che TRAMA non può realisticamente contattare (il Comune
//   non è l'organizzatore commerciale dell'attività). Per rho-cre-collodi-
//   stripes, `organizerName` è stato corretto da "Comune di Rho (gestione:
//   Stripes...)" a "Stripes Cooperativa Sociale ONLUS" — il legame con il
//   Comune (ente commissionante, non gestore) resta comunque descritto in
//   `shortDescription`, dove era già presente: nessuna informazione persa,
//   solo il campo ORGANIZER separato dalla fonte/commissione.
// - `officialUrlIsOrganizerSite`: true SOLO quando `officialUrl` punta al
//   dominio proprio dell'organizzatore (es. usob1949.it, lyceum.it) — false
//   quando punta a un portale terzo (Comune, Arcidiocesi, piattaforma di
//   hosting) anche se il record è comunque `invitable` (es. l'Oratorio di
//   Baggio è un'entità reale invitabile, ma l'unica fonte raggiunta è un
//   articolo del portale diocesano, non il sito dell'oratorio). Determina
//   SOLO il wording della CTA secondaria ("Sito dell'organizzatore" vs
//   "Vedi la fonte") — mai inventato, sempre derivabile dal dominio già
//   noto in `officialUrl`.
//
// Gated da REAL_DISCOVERY_DATASET_ENABLED (lib/feature-flags/registry.ts),
// risolto server-side in app/nextgen/search/page.tsx, di default invisibile
// a chiunque finché Fabrizio non attiva cohort:internal-preview da Admin →
// Feature Flags → Release (stesso pattern di School Calendar Intelligence,
// Calendar Export, Global Action Progress).

export type DiscoveryLeadCategory =
  | "educativo"
  | "sportivo"
  | "multisport"
  | "artistico";

export type DiscoveryLeadConfidence = "high" | "medium";

// "primary_official": fonte ufficiale dell'ente pubblico/organizzatore,
// letta e verificata direttamente in questa sessione.
// "primary_organizer": fonte ufficiale dell'organizzatore privato, letta e
// verificata direttamente.
// "secondary_corroborated": dettaglio specifico (prezzo/età/date) letto da
// una fonte secondaria (directory/aggregatore) perché la fonte primaria non
// pubblica quel dettaglio o non è stata raggiungibile direttamente — mai
// usata come UNICA prova quando esiste una fonte primaria raggiungibile.
export type DiscoveryLeadSourceType =
  | "primary_official"
  | "primary_organizer"
  | "secondary_corroborated";

export interface DiscoveryLeadSource {
  label: string;
  url: string;
}

export interface DiscoveryLeadRecord {
  id: string;
  organizerName: string;
  activityTitle: string;
  shortDescription: string;
  category: DiscoveryLeadCategory;
  ageMin: number | null;
  ageMax: number | null;
  locationName: string | null;
  address: string | null;
  comune: string;
  region: "Lombardia" | "Puglia";
  startDate: string | null;
  endDate: string | null;
  weeklyStructure: string | null;
  price: number | null;
  priceUnit: "per_settimana" | null;
  registrationUrl: string | null;
  officialUrl: string;
  contact: string | null;
  // V1: sempre null — vedi §9 Image/Copyright Audit nel report. Nessuna
  // immagine è stata copiata da alcun sito. DiscoveryLeadCard usa un visual
  // neutro TRAMA quando questo campo è null (sempre, oggi).
  image: null;
  sourceType: DiscoveryLeadSourceType;
  sources: DiscoveryLeadSource[];
  seasonYear: number;
  confidence: DiscoveryLeadConfidence;
  temporalNote: string;
  // DISCOVERY UNIFICATION + PROPONI INVITO (21/09/2026) — vedi commento di
  // testa del file per la definizione completa di entrambi i campi.
  invitable: boolean;
  officialUrlIsOrganizerSite: boolean;
  // TRAMA — DISCOVERY MAP + POLISH (21/09/2026), §5-7 del prompt "CURATED
  // GEO DATA" / "DATA MODEL". Coordinate STATICHE curate a mano (mai
  // geocoding a runtime, mai una dipendenza da API esterna durante l'uso
  // dell'app — vedi lib/discovery/result-model.ts#buildDiscoveryMapItems).
  // REGOLA NON NEGOZIABILE, identica a quella del resto del dataset: se la
  // sede non è determinabile con una fonte verificabile, lat/lng restano
  // `null` — MAI un centroide del Comune, MAI una stima "a memoria". In
  // questa sessione nessuna delle due fonti di geocodifica statica
  // disponibili (OpenStreetMap Nominatim, ricerca OSM) ha restituito un
  // risultato utilizzabile per i 5 record con un indirizzo civico noto
  // (rho-cre-collodi-stripes, settimo-milanese, milano-lyceum,
  // milano-notformalcamp, conversano-beltempo) — vedi CURATED GEO AUDIT nel
  // report "TRAMA DISCOVERY MAP + POLISH — RESULT" per il dettaglio record
  // per record. Tutti e 13 restano quindi `lat: null, lng: null` oggi: lo
  // schema è pronto, nessuna migration necessaria, pronto ad accogliere
  // coordinate verificate in un passaggio futuro (da Fabrizio via Google
  // Maps, o da una sessione con accesso a un geocoder funzionante).
  lat: number | null;
  lng: number | null;
  // "approximate" DELIBERATAMENTE ESCLUSO dai valori possibili (§7 del
  // prompt: "Valuta se approximate abbia davvero senso... se implica un
  // marker potenzialmente fuorviante, NON usarlo") — un marker sulla mappa è
  // per natura un punto preciso: un marker "approssimativo" comunicherebbe
  // comunque una sede esatta e fuorviante a colpo d'occhio, indipendentemente
  // dall'etichetta. Solo due valori onesti: "exact" (indirizzo civico
  // verificato) o "venue" (sede/struttura nota ma non un civico puntuale,
  // es. un impianto sportivo con più ingressi) — mai usati oggi (nessuna
  // coordinata popolata), pronti per quando lo saranno.
  geoPrecision: "exact" | "venue" | null;
}

export const REAL_DISCOVERY_LEADS: DiscoveryLeadRecord[] = [
  // ============ CLUSTER A — MILANO / MILANO OVEST (11 record) ============
  {
    id: "rho-cre-collodi-stripes",
    // Corretto 21/09/2026 (DISCOVERY UNIFICATION §8): era "Comune di Rho
    // (gestione: Stripes...)" — organizzatore ed ente commissionante
    // separati, nessuna informazione persa (il legame col Comune resta in
    // shortDescription, dove era già descritto).
    organizerName: "Stripes Cooperativa Sociale ONLUS",
    activityTitle: 'CRE Estivo Scuola Primaria "C. Collodi"',
    shortDescription:
      "Centro ricreativo estivo comunale per la scuola primaria, gestito dalla cooperativa sociale Stripes su incarico del Comune di Rho.",
    category: "educativo",
    ageMin: null,
    ageMax: null,
    locationName: 'Scuola Primaria "C. Collodi"',
    address: "Via Togliatti 8, Rho (MI)",
    comune: "Rho",
    region: "Lombardia",
    startDate: "2026-07-02",
    endDate: "2026-08-28",
    weeklyStructure:
      "Dal 2 luglio al 7 agosto 2026 e dal 24 al 28 agosto 2026, lun-ven 8:00-16:00 (post-campus facoltativo fino alle 17:30).",
    price: null,
    priceUnit: null,
    registrationUrl: "https://www.centriestivirho.com",
    officialUrl: "https://www.pedagogia.it/stripes/campus-estivo-2026-rho/",
    contact: null,
    image: null,
    sourceType: "primary_organizer",
    sources: [
      { label: "Stripes Cooperativa Sociale ONLUS — pagina ufficiale campus 2026", url: "https://www.pedagogia.it/stripes/campus-estivo-2026-rho/" },
      { label: "Comune di Rho — Centri Estivi e Invernali", url: "https://www.comune.rho.mi.it/en-us/servizi/educazione-e-formazione/centri-estivi-e-invernali-102-6725-1-1694f1f1ef1a72626b65bc0116c05588" },
    ],
    seasonYear: 2026,
    confidence: "high",
    temporalNote:
      "Pagina pubblicata dall'organizzatore il 15/04/2026 per la stagione 2026, già conclusa alla data di questa ricerca (17/09/2026). Sede/orari/gestore confermati direttamente dalla fonte primaria — riconfermare data/prezzo per l'estate 2027 prima della pubblicazione al pubblico.",
    invitable: true,
    // officialUrl è pedagogia.it (piattaforma terza che ospita la pagina
    // Stripes), non un dominio proprio di Stripes — CTA secondaria "Vedi la
    // fonte", non "Sito dell'organizzatore".
    officialUrlIsOrganizerSite: false,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "cornaredo-centri-estivi-comunali",
    organizerName: "Comune di Cornaredo",
    activityTitle: "Centri Ricreativi Diurni Estivi per Minori",
    shortDescription:
      "Servizio ricreativo estivo comunale, in edifici scolastici di proprietà comunale, con animazione, gite, sport e piscina. Rivolto ai bambini che hanno frequentato almeno un anno di scuola dell'Infanzia fino alla 1ª classe della scuola secondaria di primo grado (fino ai 12 anni).",
    category: "educativo",
    ageMin: null,
    ageMax: 12,
    locationName: "Sedi scolastiche comunali (variano per anno)",
    address: null,
    comune: "Cornaredo",
    region: "Lombardia",
    startDate: null,
    endDate: null,
    weeklyStructure:
      "Turni settimanali nelle settimane di sospensione didattica estiva. Retta settimanale stabilita annualmente dal Comune, con riduzioni ISEE. Iscrizioni comunicate ogni anno in aprile/maggio.",
    price: null,
    priceUnit: null,
    registrationUrl: null,
    officialUrl: "https://comune.cornaredo.mi.it/servizio/centri-diurni-estivi-per-minori/",
    contact: null,
    image: null,
    sourceType: "primary_official",
    sources: [
      { label: "Comune di Cornaredo — Centri Estivi per Minori (pagina di servizio)", url: "https://comune.cornaredo.mi.it/servizio/centri-diurni-estivi-per-minori/" },
    ],
    seasonYear: 2026,
    confidence: "high",
    temporalNote:
      "Pagina di servizio permanente (ultimo aggiornamento dichiarato 08/04/2026), non legata a un'unica edizione: date esatte, sede e importo della retta sono pubblicati dal Comune ogni anno in aprile/maggio, non ancora disponibili per il 2027 alla data di questa ricerca.",
    // Nessun gestore nominato (organizerName = "Comune di Cornaredo",
    // servizio comunale diretto) — non invitabile come Partner commerciale.
    invitable: false,
    officialUrlIsOrganizerSite: false,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "pero-centro-estivo-primaria",
    organizerName: "Comune di Pero",
    activityTitle: "Centro Diurno Estivo — Scuola Primaria",
    shortDescription:
      "Centro diurno estivo comunale con attività ludico-ricreative, sportive, pedagogiche e di animazione, rivolto ai bambini che hanno frequentato la scuola primaria (residenti e non residenti).",
    category: "educativo",
    ageMin: null,
    ageMax: null,
    locationName: "Locali e giardini scolastici comunali",
    address: null,
    comune: "Pero",
    region: "Lombardia",
    startDate: null,
    endDate: null,
    weeklyStructure:
      "Orario 8:00-18:00 (ingresso 8:00-9:00, uscita 16:00-18:00); frequenza e pagamento su base settimanale minima. Iscrizioni scuola primaria dal 13 aprile al 18 maggio 2026.",
    price: 88.2,
    priceUnit: "per_settimana",
    registrationUrl: "https://sportellotelematico.comune.pero.mi.it/action:c_c013:centro.diurno.estivo;clone",
    officialUrl: "https://sportellotelematico.comune.pero.mi.it/action:c_c013:centro.diurno.estivo;clone",
    contact: null,
    image: null,
    sourceType: "primary_official",
    sources: [
      { label: "Comune di Pero — Andare al centro estivo (scuola primaria)", url: "https://sportellotelematico.comune.pero.mi.it/action:c_c013:centro.diurno.estivo;clone" },
    ],
    seasonYear: 2026,
    confidence: "high",
    temporalNote:
      "Pagina di servizio aggiornata per la stagione 2026 (iscrizioni 13 aprile–18 maggio 2026), consultata il 17/09/2026 a stagione conclusa. Il prezzo riportato (88,20€/settimana) è la tariffa intera residenti (ISEE ≥30.000€): esistono riduzioni ISEE fino a 27,56€ e una tariffa non residenti di 110,25€, non rappresentabili in un singolo numero — vedi weeklyStructure. Da riconfermare per il 2027.",
    invitable: false,
    officialUrlIsOrganizerSite: false,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "settimo-milanese-centro-diurno-ricreativo",
    organizerName: "Comune di Settimo Milanese",
    activityTitle: "Centro Diurno Ricreativo Estivo",
    shortDescription:
      "Centro diurno ricreativo comunale per bambini e ragazzi delle scuole dell'infanzia, primaria e secondaria, attivo nel periodo di chiusura estiva delle scuole presso la scuola statale di via Bruno Buozzi.",
    category: "educativo",
    ageMin: null,
    ageMax: null,
    locationName: "Scuola statale di Settimo Milanese",
    address: "Via Bruno Buozzi 5, Settimo Milanese (MI)",
    comune: "Settimo Milanese",
    region: "Lombardia",
    startDate: null,
    endDate: null,
    weeklyStructure:
      "Orario 7:30-17:30 (ingresso entro le 9:00, uscita dalle 16:30). Iscrizioni dall'8 aprile al 15 maggio 2026, graduatoria pubblicata entro il 31 maggio.",
    price: 77,
    priceUnit: "per_settimana",
    registrationUrl: "https://comune.settimomilanese.mi.it/servizio/p24-servizio-centro-diurno-ricreativo-estivo/",
    officialUrl: "https://comune.settimomilanese.mi.it/servizio/p24-servizio-centro-diurno-ricreativo-estivo/",
    contact: "02.33509216 — istruzione@comune.settimomilanese.mi.it",
    image: null,
    sourceType: "primary_official",
    sources: [
      { label: "Comune di Settimo Milanese — Servizio centro diurno ricreativo estivo", url: "https://comune.settimomilanese.mi.it/servizio/p24-servizio-centro-diurno-ricreativo-estivo/" },
    ],
    seasonYear: 2026,
    confidence: "high",
    temporalNote:
      "Pagina di servizio ufficiale (rev. P24 del 3/4/2026, ultimo aggiornamento dichiarato 30/06/2026) — dati correnti per la stagione 2026, già conclusa alla data di questa ricerca (17/09/2026). Prezzo riportato è la tariffa residenti (non residenti 95,70€, dal secondo figlio 71,50€). Date esatte di apertura non pubblicate su questa pagina (solo periodo di iscrizione) — da riconfermare per il 2027.",
    invitable: false,
    officialUrlIsOrganizerSite: false,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "milano-centri-estivi-scuole-primarie-comunali",
    organizerName: "Comune di Milano — Direzione Educazione",
    activityTitle: "Centri Estivi delle Scuole Primarie 2026",
    shortDescription:
      "Centri di vacanza diurni organizzati dal Comune di Milano presso sedi scolastiche con spazi all'aperto, con attività ludiche, sportive e di intrattenimento, in 3 periodi prenotabili anche non consecutivi. Include sedi nel Municipio 7 — Milano Ovest (Via Dolci 5, Via Viterbo 31, Via Muggiano 16, Via Forze Armate 65, zona Baggio/San Siro/QT8), oltre a numerose altre sedi cittadine elencate nel comunicato ufficiale.",
    category: "educativo",
    ageMin: null,
    ageMax: null,
    locationName:
      "Sedi scolastiche comunali multiple, incluso Municipio 7 (Baggio/San Siro): Via Dolci 5, Via Viterbo 31, Via Muggiano 16, Via Forze Armate 65",
    address: null,
    comune: "Milano",
    region: "Lombardia",
    startDate: "2026-06-10",
    endDate: "2026-07-21",
    weeklyStructure:
      "3 periodi prenotabili anche non consecutivi: A (10-19 giugno, 8gg), B (22 giugno-3 luglio, 10gg), C (6-21 luglio, 12gg). Orario 8:30-16:30, pre/post centro opzionali 7:30-8:30 / 16:30-18:00.",
    price: null,
    priceUnit: null,
    registrationUrl: "https://www.comune.milano.it/servizi/scuola/scuole-primarie-centri-estivi",
    officialUrl: "https://www.comune.milano.it/servizi/scuola/scuole-primarie-centri-estivi",
    contact: null,
    image: null,
    sourceType: "primary_official",
    sources: [
      { label: "Comune di Milano — Comunicato di servizio Centri Estivi Scuole Primarie 2026 (PDF, incl. elenco sedi per Municipio)", url: "https://www.comune.milano.it/documents/20118/5921271/COMUNICATO_CE_2026.pdf" },
      { label: "Comune di Milano — pagina servizio Centri Estivi Scuole Primarie", url: "https://www.comune.milano.it/servizi/scuola/scuole-primarie-centri-estivi" },
    ],
    seasonYear: 2026,
    confidence: "high",
    temporalNote:
      "Comunicato ufficiale datato 19/02/2026 per la stagione 2026 (già conclusa alla data di questa ricerca, 17/09/2026), comprensivo dell'elenco reale delle sedi per Municipio — usato qui per confermare la copertura specifica del Municipio 7 (Milano Ovest). Il contributo è fortemente dipendente da fascia ISEE e periodo (da 0€ fino a un tetto di circa 254€ per il periodo più lungo, 279,48€ per i non residenti): non riportato come prezzo singolo per non falsare il dato. Sedi e tariffe da riconfermare per la stagione 2027 (nuovo comunicato annuale atteso).",
    // "Comune di Milano — Direzione Educazione", nessun gestore operativo
    // nominato: descrive il SERVIZIO comunale, non un'entità invitabile.
    invitable: false,
    officialUrlIsOrganizerSite: false,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "milano-milanosport-campus-multisport",
    organizerName: "Milanosport SSD S.p.A. (società sportiva del Comune di Milano)",
    activityTitle: "Campus Estivi Milanosport — Campus Multisport",
    shortDescription:
      "Campus estivo multisport (nuoto, basket, pallavolo, calcetto, pallamano, tennis, unihockey, atletica, badminton) con pranzo incluso, su iscrizione settimanale. Milanosport gestisce anche altre tipologie di campus (PlayCamp, SwimCamp, SmartCamp, VolleyCamp) in altri impianti cittadini, incluso l'impianto Quarto Cagnino (Milano Ovest) che però offre solo corsi di nuoto, non un campus.",
    category: "multisport",
    ageMin: 5,
    ageMax: 14,
    locationName: "Centro Sportivo Iseo (e altri impianti: Arioli Venegoni, Cambini Fossati, Carella Cantù, Mincio, Murat, Suzzani, Vigorelli)",
    address: null,
    comune: "Milano",
    region: "Lombardia",
    startDate: "2026-06-08",
    endDate: "2026-09-04",
    weeklyStructure: "Iscrizioni settimanali dall'8 giugno al 4 settembre 2026. Certificato medico sportivo obbligatorio dai 6 anni.",
    price: 194,
    priceUnit: "per_settimana",
    registrationUrl: "https://www.milanosport.it/corso/45/campus/342/",
    officialUrl: "https://www.milanosport.it/sport/342/campus/12/",
    contact: null,
    image: null,
    sourceType: "secondary_corroborated",
    sources: [
      { label: "Milanosport — pagina ufficiale Campus (organizzatore, identità/impianti confermati)", url: "https://www.milanosport.it/sport/342/campus/12/" },
      { label: "Facilebimbi.it — Campus Multisport Iseo 2026 (età/prezzo/date)", url: "https://www.facilebimbi.it/it-it/tempo-libero/eventi-bambini-milano/milanosport-campus-multisport-bambini-ragazzi-iseo" },
    ],
    seasonYear: 2026,
    confidence: "medium",
    temporalNote:
      "La stagione 2026 è già conclusa alla data di questa ricerca (16/09/2026): la pagina ufficiale Milanosport mostra ora \"Ci vediamo a giugno 2027!\" senza ancora dettagli pubblicati per la prossima stagione. Età/prezzo/date qui riportati sono per l'edizione 2026 e provengono da una fonte secondaria (facilebimbi.it) coerente con quanto annunciato dall'organizzatore, non da una pagina prezzi Milanosport verificata direttamente — riconfermare su milanosport.it prima della stagione 2027.",
    // Milanosport SSD S.p.A. è un'entità distinta e reale (anche se
    // partecipata dal Comune di Milano) — CLEAN, invitabile.
    invitable: true,
    officialUrlIsOrganizerSite: true,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "milano-lyceum-summer-camp",
    organizerName: "Associazione LYCEUM — Impresa Sociale",
    activityTitle: "Lyceum Summer Camp — arte, movimento e laboratori espressivi",
    shortDescription:
      "Campo estivo educativo a impronta artistica (laboratori di arte, danza, teatro, gioco libero), gruppi piccoli (max 20 bambini), segnalato tra le iniziative del Municipio 1 del Comune di Milano.",
    category: "artistico",
    ageMin: null,
    ageMax: null,
    locationName: "Lyceum Academy (complesso IBVA)",
    address: "Via Calatafimi 10, Milano",
    comune: "Milano",
    region: "Lombardia",
    startDate: "2026-06-15",
    endDate: "2026-07-24",
    weeklyStructure: "6 settimane, lun-ven 9:00-16:30 (pre-camp 8:00-9:00 e post-camp 16:30-17:45 facoltativi, con costo aggiuntivo).",
    price: 240,
    priceUnit: "per_settimana",
    registrationUrl: "https://lyceum.it/form-summer-camp-2026/",
    officialUrl: "https://lyceum.it/summer-camp-milano/",
    contact: "02 23168407 — summercamp@lyceum.it",
    image: null,
    sourceType: "primary_organizer",
    sources: [
      { label: "Lyceum — pagina ufficiale Summer Camp Milano 2026", url: "https://lyceum.it/summer-camp-milano/" },
      { label: "Municipio 1, Comune di Milano — segnalazione iniziativa", url: "https://www2.comune.milano.it/web/municipio-1/-/lyceum-summer-camp-2026" },
    ],
    seasonYear: 2026,
    confidence: "high",
    temporalNote:
      "Dati completi, correnti e aggiornati dall'organizzatore il 19/05/2026 per la stagione 2026, in corso di svolgimento al momento della ricerca. NOTA GEOGRAFICA: sede in Municipio 1 (centro città), NON nel cluster Milano Ovest prioritario del pilota — incluso solo per varietà di categoria (artistico/creativo), non conta come copertura Milano Ovest.",
    invitable: true,
    officialUrlIsOrganizerSite: true,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "milano-notformalcamp-san-siro",
    organizerName: "L'Orma S.S.D. a r.l. (NotFormalCamp — Piccolo Stadio San Siro)",
    activityTitle: "NotFormalCamp — Piccolo Stadio San Siro / Lampugnano",
    shortDescription:
      "Summer camp multidisciplinare con focus sul movimento: attività sportive, percorsi psicomotori, laboratori artistico-espressivi, un ingresso settimanale in piscina comunale di Lampugnano, Padel in collaborazione con Milano Padel Academy. Sede in zona Lampugnano (Municipio 8, Milano Ovest), a pochi passi dalla fermata M1 Lampugnano.",
    category: "sportivo",
    ageMin: 4,
    ageMax: 12,
    locationName: "Piccolo Stadio San Siro",
    address: "Via Carlo Osma 9, Milano (MI)",
    comune: "Milano",
    region: "Lombardia",
    startDate: "2026-07-06",
    endDate: "2026-07-31",
    weeklyStructure: "4 turni settimanali (6-10, 13-17, 20-24, 27-31 luglio 2026), lun-ven 8:00-17:15.",
    price: 195,
    priceUnit: "per_settimana",
    registrationUrl: null,
    officialUrl: "https://notformalcamp.it/piccolo-stadio-san-siro/",
    contact: null,
    image: null,
    sourceType: "secondary_corroborated",
    sources: [
      { label: "NotFormalCamp — homepage organizzatore (identità e attività generale confermate)", url: "https://notformalcamp.it/" },
      { label: "Tutto Campi Estivi — scheda NotFormalCamp Milano Lampugnano (prezzo/età/date/sede, dichiarato verificato dal team il 12/03/2026)", url: "https://www.tuttocampiestivi.com/it/campi-estivi-nord-italia/campi-estivi-lombardia/campi-estivi-milano/notformalcamp-milano-san-siro" },
    ],
    seasonYear: 2026,
    confidence: "medium",
    temporalNote:
      "Identità e attività generale dell'organizzatore (L'Orma S.S.D.) confermate sulla sua homepage ufficiale. La pagina organizzatore specifica per la sede San Siro non si è resa leggibile in questa sessione (contenuto reso via JavaScript, fetch diretto vuoto). Prezzo, età e date riportati provengono dall'aggregatore Tutto Campi Estivi, che dichiara di aver verificato questi dati il 12/03/2026 — non da lettura diretta della pagina dell'organizzatore. Quota di iscrizione associativa una tantum di 20€/famiglia non inclusa nel prezzo settimanale indicato.",
    invitable: true,
    officialUrlIsOrganizerSite: true,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "bareggio-usob-campus-multisport",
    organizerName: "U.S.O.B. 1949 (Unione Sportiva Oratorio Bareggio) A.S.D.",
    activityTitle: "Campus Multisport USOB",
    shortDescription:
      "Camp estivo sportivo in oratorio con rotazione di più discipline (calcio, volley, basket, attività motorie), gruppi per fasce d'età, pranzo in oratorio incluso. Iscrivibile anche a singola settimana o singolo giorno.",
    category: "multisport",
    ageMin: null,
    ageMax: null,
    locationName: "Oratorio USOB, Bareggio",
    address: null,
    comune: "Bareggio",
    region: "Lombardia",
    startDate: null,
    endDate: null,
    weeklyStructure:
      "Giornata indicativa 8:00-17:00, pranzo in oratorio e merenda pomeridiana inclusi. Possibile iscrizione a singola settimana o singolo giorno.",
    price: null,
    priceUnit: null,
    registrationUrl: "https://www.cloud32.it/GES/pub/corsisel/180812?tipord=002&rpet=true",
    officialUrl: "https://usob1949.it/campus-multisport",
    contact: "asdusob1949@gmail.com — 351 559 2657",
    image: null,
    sourceType: "primary_organizer",
    sources: [
      { label: "USOB Bareggio — pagina ufficiale Campus Multisport", url: "https://usob1949.it/campus-multisport" },
    ],
    seasonYear: 2026,
    confidence: "medium",
    temporalNote:
      "Pagina ufficiale dell'organizzatore, contenuti aggiornati (policy minori/genere datate 15/04/2026) — identità e programma generale confermati direttamente. La pagina non pubblica però prezzo né date specifiche per l'edizione 2026: questi campi restano `null` invece di stimati.",
    invitable: true,
    officialUrlIsOrganizerSite: true,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "milano-baggio-oratorio-san-giovanni-bosco",
    organizerName: "Parrocchia San Giovanni Bosco — Oratorio di Baggio (Arcidiocesi di Milano)",
    activityTitle: "Oratorio Estivo — Parrocchia San Giovanni Bosco",
    shortDescription:
      "Oratorio estivo della parrocchia più popolosa del quartiere di Baggio (Milano Ovest), circa 600 iscritti nell'edizione 2026, con un educatore specializzato dedicato all'integrazione dei bambini con disabilità e laboratori sportivi (rugby, basket) proposti da società del quartiere.",
    category: "educativo",
    ageMin: null,
    ageMax: null,
    locationName: "Oratorio San Giovanni Bosco, Baggio",
    address: null,
    comune: "Milano",
    region: "Lombardia",
    startDate: null,
    endDate: null,
    weeklyStructure:
      "Programma settimanale con laboratori sportivi (rugby, basket) e attività di animazione a tema; presenza di un educatore specializzato per l'integrazione dei bambini con disabilità.",
    price: null,
    priceUnit: null,
    registrationUrl: null,
    officialUrl: "https://www.chiesadimilano.it/news/chiesa-diocesi/oratorio-estivo-baggio-2874899.html",
    contact: null,
    image: null,
    sourceType: "primary_official",
    sources: [
      { label: "Chiesa di Milano (portale ufficiale Arcidiocesi) — \"A Baggio l'oratorio è inclusivo e aperto al dialogo\"", url: "https://www.chiesadimilano.it/news/chiesa-diocesi/oratorio-estivo-baggio-2874899.html" },
    ],
    seasonYear: 2026,
    confidence: "high",
    temporalNote:
      "Articolo del portale ufficiale dell'Arcidiocesi di Milano, pubblicato l'8/06/2026 durante lo svolgimento dell'oratorio estivo 2026 — conferma diretta (parroco don Giovanni Salatino citato per nome) dell'esistenza e della scala reale dell'iniziativa (circa 600 iscritti) nel quartiere di Baggio. Non riporta prezzo, età numerica né date esatte di inizio/fine: questi campi restano `null` invece di stimati.",
    // Entità reale e nominata (parroco citato per nome dalla fonte),
    // NEEDS NORMALIZATION → normalizzata: invitabile pur senza sito/
    // contatto diretto (l'outreach resta un processo manuale di TRAMA, non
    // un limite del modello dati). officialUrl è chiesadimilano.it (portale
    // diocesano), non un sito proprio dell'oratorio.
    invitable: true,
    officialUrlIsOrganizerSite: false,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "bareggio-centro-estivo-comunale-infanzia",
    organizerName: "Comune di Bareggio",
    activityTitle: "Centro Estivo Comunale (Scuola dell'Infanzia)",
    shortDescription:
      "Centro estivo comunale rivolto ai bambini della scuola dell'infanzia, con iscrizioni gestite direttamente dal Comune di Bareggio.",
    category: "educativo",
    ageMin: null,
    ageMax: null,
    locationName: null,
    address: null,
    comune: "Bareggio",
    region: "Lombardia",
    startDate: null,
    endDate: null,
    weeklyStructure: "Finestra di iscrizione comunicata annualmente dal Comune (edizione 2026 individuata tramite comunicazione ufficiale a fine aprile).",
    price: null,
    priceUnit: null,
    registrationUrl: "https://www.comune.bareggio.mi.it/carta-dei-servizi/iscrizione-ai-centri-estivi-scuola-dellinfanzia/",
    officialUrl: "https://www.comune.bareggio.mi.it/carta-dei-servizi/iscrizione-ai-centri-estivi-scuola-dellinfanzia/",
    contact: null,
    image: null,
    sourceType: "secondary_corroborated",
    sources: [
      { label: "Comune di Bareggio — pagina servizio \"Iscrizione ai centri estivi (Scuola dell'Infanzia)\" (titolo confermato via indicizzazione, contenuto non renderizzato in questa sessione)", url: "https://www.comune.bareggio.mi.it/carta-dei-servizi/iscrizione-ai-centri-estivi-scuola-dellinfanzia/" },
      { label: "Comune di Bareggio — canale Facebook ufficiale (annunci iscrizione centro estivo comunale)", url: "https://www.facebook.com/comunedibareggio/" },
    ],
    seasonYear: 2026,
    confidence: "medium",
    temporalNote:
      "Il fetch diretto della pagina di servizio non ha restituito contenuto leggibile in questa sessione (probabile rendering lato client). L'esistenza del servizio e la finestra di iscrizione 2026 sono confermate tramite il titolo indicizzato dal motore di ricerca e comunicazioni ufficiali del Comune sui propri canali — non tramite lettura diretta della pagina. Quasi tutti i campi operativi (età esatta, date, prezzo) restano `null` per questo motivo: record incluso solo perché l'esistenza del servizio comunale resta comunque accertata da fonte ufficiale, non da un'unica menzione indiretta.",
    invitable: false,
    officialUrlIsOrganizerSite: false,
    lat: null,
    lng: null,
    geoPrecision: null,
  },

  // ============ CLUSTER B — RUTIGLIANO / SUD-EST BARESE (2 record) ============
  {
    id: "conversano-beltempo",
    organizerName: "Il Sogno di Don Bosco — Società Cooperativa Sociale",
    activityTitle: 'Centro Estivo "Beltempo" (VII edizione 2026)',
    shortDescription:
      "Centro estivo della cooperativa sociale Il Sogno di Don Bosco, con sede principale a Conversano (posti disponibili anche nelle sedi di Bari e Noicattaro, stesso operatore). Programma con sport, piscina e giochi d'acqua, animazione, cultura e natura.",
    category: "educativo",
    ageMin: null,
    ageMax: null,
    locationName: 'Centro Aperto Polivalente "Beltempo"',
    address: "Via Lacalandra 37, Conversano (BA)",
    comune: "Conversano",
    region: "Puglia",
    startDate: null,
    endDate: null,
    weeklyStructure: "Lun-ven 8:30-14:30, con tempo prolungato facoltativo fino alle 16:30. Attività: sport, piscina e giochi d'acqua, animazione, cultura, natura.",
    price: null,
    priceUnit: null,
    registrationUrl: null,
    officialUrl: "https://www.ilsognodidonbosco.it/beltempo.html",
    contact: "080 3849773",
    image: null,
    sourceType: "secondary_corroborated",
    sources: [
      { label: "Il Sogno di Don Bosco — pagina ufficiale Beltempo (identità, sede, contatti)", url: "https://www.ilsognodidonbosco.it/beltempo.html" },
    ],
    seasonYear: 2026,
    confidence: "medium",
    temporalNote:
      "Organizzatore reale, verificato direttamente sulla pagina ufficiale (sede, P.IVA, telefono). I dettagli della \"VII edizione 2026\" (orari, attività, scadenza iscrizioni 27 febbraio) risultano da una sintesi del motore di ricerca su un articolo dell'organizzatore che non sono riuscito a recuperare e leggere direttamente in questa sessione (pagina non renderizzata) — consigliata riconferma diretta (telefono in sources) prima della pubblicazione.",
    invitable: true,
    officialUrlIsOrganizerSite: true,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
  {
    id: "noicattaro-centri-estivi-comunali",
    organizerName: "Comune di Noicàttaro — Ufficio Servizi Sociali",
    activityTitle: "Centri estivi comunali per minori (avviso pubblico annuale)",
    shortDescription:
      "Il Comune di Noicàttaro pubblica ogni anno un avviso rivolto a cooperative sociali, associazioni di promozione sociale, oratori/enti ecclesiastici e associazioni sportive dilettantistiche del territorio, che possono candidarsi a organizzare attività estive per bambini e ragazzi. Le famiglie presentano poi domanda di partecipazione per i propri figli.",
    category: "educativo",
    ageMin: 6,
    ageMax: 14,
    locationName: null,
    address: null,
    comune: "Noicattaro",
    region: "Puglia",
    startDate: null,
    endDate: null,
    weeklyStructure: "Periodo luglio-settembre; sede e operatore effettivo variano in base a quali enti del terzo settore vengono selezionati tramite l'avviso pubblico di quell'anno.",
    price: null,
    priceUnit: null,
    registrationUrl: null,
    officialUrl: "https://www.comune.noicattaro.bari.it/it/news/1854356",
    contact: null,
    image: null,
    sourceType: "primary_official",
    sources: [
      { label: "Comune di Noicàttaro — Centri estivi 2025 (atto dirigenziale n. 463 del 04.06.2025)", url: "https://www.comune.noicattaro.bari.it/it/news/1854356" },
    ],
    seasonYear: 2025,
    confidence: "medium",
    temporalNote:
      "La fonte ufficiale più recente reperita in questa sessione riguarda l'edizione 2025 (\"Tornano le attività estive...\", meccanismo esplicitamente ricorrente ogni anno). Non ho trovato un avviso 2026 già pubblicato: utile a dimostrare che Noicattaro adotta un bando pubblico annuale (non un operatore con sito stabile), ma non spendibile come dettaglio 2026/2027 confermato — riconfermare prima della pubblicazione.",
    // "avviso pubblico annuale" letterale nel titolo — l'esempio citato dal
    // prompt come caso da non trattare mai come organizzatore invitabile.
    invitable: false,
    officialUrlIsOrganizerSite: false,
    lat: null,
    lng: null,
    geoPrecision: null,
  },
];

// ============ LEAD SCARTATI (documentati, mai inseriti nel dataset) ============
// §7-8 del report: lead con dati incoerenti/non verificabili restano fuori
// dal dataset pilota, ma vengono comunque tracciati per trasparenza — mai
// silenziosamente scartati.
export interface RejectedDiscoveryLead {
  id: string;
  organizerName: string;
  comune: string;
  reason: string;
}

export const REJECTED_DISCOVERY_LEADS: RejectedDiscoveryLead[] = [
  {
    id: "mola-di-bari-sensazioni-in-movimento",
    organizerName: "Asd Sensazioni in Movimento",
    comune: "Mola di Bari",
    reason:
      "Date del City Camp incoerenti tra due ricerche separate (\"14 giugno – 13 settembre 2026\" vs \"8 giugno – 30 settembre 2026\"), nessuna pagina ufficiale raggiungibile per risolvere la contraddizione. Confidence risultante LOW — esclusa dal dataset pilota per istruzione esplicita (i record LOW non entrano).",
  },
  {
    id: "milano-cusago-cre-comunale",
    organizerName: "Comune di Cusago",
    comune: "Cusago",
    reason:
      "Esistenza del CRE 2026 comunale confermata solo dal titolo indicizzato dal motore di ricerca (\"Iscrizione CRE 2026 e servizi scolastici comunali\"); il fetch diretto della pagina ufficiale non ha restituito alcun contenuto in due tentativi in questa sessione. Nessun dato verificabile oltre al titolo: escluso per evitare un record praticamente vuoto.",
  },
  {
    id: "rutigliano-sport-centre",
    organizerName: "ASD Sport Centre Rutigliano — Centro Sportivo \"Franceschino\"",
    comune: "Rutigliano",
    reason:
      "Associazione sportiva reale e verificata (riconosciuta CONI, affiliata FIGC/FIPAV, gestisce impianti comunali in concessione), con una scuola calcio annuale per bambini 6-14. Nessuna fonte reperita in questa sessione conferma però un programma di CENTRO ESTIVO/camp multi-settimanale distinto dalla scuola calcio annuale — non incluso per evitare di rappresentare un servizio scolastico-sportivo come se fosse un centro estivo strutturato.",
  },
  {
    id: "noicattaro-pro-gioventu",
    organizerName: "ASD Pro Gioventù Noicàttaro — Scuola Calcio Giovanile",
    comune: "Noicattaro",
    reason:
      "Scuola calcio reale e attiva da oltre 35 stagioni. Nessuna fonte reperita in questa sessione conferma un centro estivo/camp specifico distinto dall'attività di scuola calcio annuale — stesso motivo di esclusione di ASD Sport Centre Rutigliano.",
  },
];

/**
 * true se il periodo dell'attività (startDate/endDate) si sovrappone alla
 * settimana indicata — stesso criterio di sovrapposizione già usato per le
 * attività reali (vedi lib/season-weeks.ts#overlaps), riapplicato qui senza
 * duplicare quella dipendenza (il modulo season-weeks è lato client/server
 * generico, importabile anche da qui). Un record senza date complete (molti,
 * onestamente, in questo dataset — vedi startDate/endDate: null sopra) non
 * viene MAI escluso automaticamente: torna sempre true, perché non abbiamo
 * abbastanza informazione per escluderlo, e un "non escludere" è più sicuro
 * di un "escludere per errore" un'attività che potrebbe davvero essere
 * compatibile.
 */
export function isDiscoveryLeadCompatibleWithWeek(
  lead: Pick<DiscoveryLeadRecord, "startDate" | "endDate">,
  weekStartIso: string,
  weekEndIso: string
): boolean {
  if (!lead.startDate || !lead.endDate) return true;
  return lead.startDate <= weekEndIso && weekStartIso <= lead.endDate;
}

// ============ FILTER INTEGRATION ADAPTERS (TRAMA REAL DISCOVERY PILOT — COMPLETION PASS, 17/09/2026) ============
//
// §4 del prompt "COMPLETION PASS": questi adapter applicano ai
// DiscoveryLeadRecord la STESSA semantica dei filtri esistenti di
// /nextgen/search — dove è semanticamente corretto farlo senza inventare
// dati — restando puri (nessun I/O) e SEPARATI dalla pipeline di filtro
// Partner in SearchDiscoveryClient.tsx (nessuna modifica al dominio
// Activity/filteredActivities). Regola comune a tutti: un campo `null` (dato
// non dichiarato dalla fonte) non esclude MAI un record da un filtro — solo
// un dato realmente noto e realmente incompatibile lo esclude. Vedi il
// report, sezione "FILTER PIPELINE AUDIT", per la tabella filtro-per-filtro
// con la motivazione di ciascuna scelta.

/**
 * Filtro ETÀ. Overlap tra [minAge,maxAge] scelto dall'utente e
 * [ageMin,ageMax] noto del lead. Un bound non dichiarato dalla fonte (null)
 * non vincola quel lato dell'intervallo — non equivale a "0" o "99" scritti
 * nel dato, è solo il confronto a trattarlo come "nessun vincolo noto su
 * questo lato", esattamente come l'default dei filtri Partner (0-18, cioè
 * "nessun filtro") lascia passare tutto.
 */
export function isDiscoveryLeadCompatibleWithAgeRange(
  lead: Pick<DiscoveryLeadRecord, "ageMin" | "ageMax">,
  minAge: number,
  maxAge: number
): boolean {
  const effectiveMin = lead.ageMin ?? 0;
  const effectiveMax = lead.ageMax ?? 99;
  return effectiveMax >= minAge && effectiveMin <= maxAge;
}

/**
 * Filtro PREZZO (tetto massimo €/settimana). Un prezzo non dichiarato dalla
 * fonte (price: null) non viene MAI trattato come 0 né come "fuori budget":
 * resta semplicemente compatibile con qualunque tetto, perché TRAMA non ha
 * l'informazione per affermare il contrario — escluderlo sarebbe
 * un'inferenza non richiesta dalla fonte, esattamente il tipo di invenzione
 * vietata da "REAL DATA YES, FAKE PARTNERS NO". Solo priceUnit ===
 * "per_settimana" è oggi supportato (unico valore non-null nel dataset).
 */
export function isDiscoveryLeadCompatibleWithPriceCap(
  lead: Pick<DiscoveryLeadRecord, "price" | "priceUnit">,
  maxPricePerWeek: number
): boolean {
  if (lead.price === null) return true;
  if (lead.priceUnit !== "per_settimana") return true;
  return lead.price <= maxPricePerWeek;
}

/**
 * Filtro ZONA (testo libero, stesso campo `zone` del pannello Zona di
 * SearchDiscoveryClient). Confronta la query con locationName/address/
 * comune concatenati. NIENT'ALTRO: il filtro geo a raggio (haversineKm) NON
 * è applicato ai lead perché nessun lead ha lat/lng verificate (§2 Target
 * Data Contract: "lat/long solo se ottenibili correttamente" — non lo sono
 * mai stati in questa sessione) — inventare coordinate per farle entrare
 * nel calcolo di distanza violerebbe la stessa regola. Vedi report,
 * KNOWN LIMITATIONS.
 */
export function isDiscoveryLeadCompatibleWithZoneQuery(
  lead: Pick<DiscoveryLeadRecord, "locationName" | "address" | "comune">,
  zoneQuery: string
): boolean {
  const q = zoneQuery.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${lead.locationName ?? ""} ${lead.address ?? ""} ${lead.comune}`.toLowerCase();
  return haystack.includes(q);
}

/**
 * Filtro ricerca testuale libera (stesso campo `query` della searchbar
 * principale di Scopri). Confronta su titolo attività, organizzatore e
 * descrizione breve.
 */
export function isDiscoveryLeadCompatibleWithTextQuery(
  lead: Pick<DiscoveryLeadRecord, "activityTitle" | "organizerName" | "shortDescription">,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${lead.activityTitle} ${lead.organizerName} ${lead.shortDescription}`.toLowerCase();
  return haystack.includes(q);
}

/**
 * Filtro CATEGORIA/TAG. Il sistema Partner usa una tassonomia granulare a
 * 14 tag (lib/mock-data.ts#categories: sport, arte, musica, stem, outdoor,
 * piscina, teatro, tecnologia, natura, lingue, cucina, danza, + intera/
 * mezza che sono in realtà copertura, non categoria). Il dataset curato usa
 * invece 4 macro-categorie. Una mappatura 1:1 non esiste semanticamente:
 * CATEGORY_TAG_MAP rappresenta quindi un'approssimazione DICHIARATA, non
 * un'equivalenza esatta — vedi report, FILTER PIPELINE AUDIT.
 *
 * "educativo" è un caso speciale: nessun tag Partner esistente rappresenta
 * correttamente "CRE/centro ricreativo generico" (i 14 tag sono tutti
 * orientati a una disciplina specifica). Piuttosto che forzare una mappatura
 * arbitraria e fuorviante (es. verso "outdoor" o "natura", che
 * escluderebbe erroneamente un CRE che non fa nulla di "natura"), un lead
 * "educativo" NON viene mai escluso dal filtro tag: è un compromesso
 * dichiarato, non un bug.
 */
export const DISCOVERY_CATEGORY_TAG_MAP: Record<Exclude<DiscoveryLeadCategory, "educativo">, string[]> = {
  sportivo: ["sport", "piscina"],
  multisport: ["sport", "piscina", "outdoor"],
  artistico: ["arte", "musica", "teatro", "danza"],
};

// ============ COVERAGE FILTER — SEMANTICA PER CURATED (TRAMA — DISCOVERY MAP + POLISH, 21/09/2026) ============
//
// §11 del prompt "IMPORTANT — COVERAGE FILTER". Deliberatamente NESSUNA
// funzione `isDiscoveryLeadCompatibleWithCoverage` esiste in questo file: il
// filtro Copertura (settimana intera/giorni singoli/entrambe,
// `selectedCoverageModes`/`onlyDaySpots` in SearchDiscoveryClient.tsx) non
// viene MAI applicato ai lead curati — stessa scelta già dichiarata per
// "Servizi" (vedi FILTER INTEGRATION ADAPTERS sopra: "campi che non esistono
// nel Target Data Contract").
//
// Semantica esplicita, per evitare l'ambiguità segnalata dal test live
// (Copertura → "Giorni singoli", count 20→13): un lead curato con modalità
// di prenotazione SCONOSCIUTA non viene MAI escluso da questo filtro — resta
// sempre compatibile, esattamente come un'età o un prezzo non dichiarati non
// escludono mai (stesso principio null-safe di tutto il pilot). Questo NON
// equivale a dichiarare che il lead supporta la prenotazione a giorno
// singolo (UNKNOWN non diventa MAI TRUE nel senso di "disponibilità spot
// confermata") — è un'esclusione-soltanto-se-certa-dell'incompatibilità,
// non un'affermazione positiva di capacità. Coerente con questo,
// DiscoveryLeadCard.tsx e DiscoveryMapPopupCard.tsx non mostrano MAI
// "Giorni spot disponibili"/disponibilità/posti per un lead curato — la
// UI non fa mai la promessa che questo filtro, da solo, potrebbe far
// pensare stia facendo.
export function isDiscoveryLeadCompatibleWithCategoryTags(
  lead: Pick<DiscoveryLeadRecord, "category">,
  selectedTagIds: string[]
): boolean {
  if (selectedTagIds.length === 0) return true;
  if (lead.category === "educativo") return true;
  const compatibleTags = DISCOVERY_CATEGORY_TAG_MAP[lead.category];
  return compatibleTags.some((tag) => selectedTagIds.includes(tag));
}

/**
 * RANKING (§6 del prompt "COMPLETION PASS"): nessun rating/popolarità/
 * disponibilità finti — mai stati presenti nel dataset (§9, `image: null`
 * è l'unico placeholder previsto) e nessuno viene introdotto qui.
 * Ordinamento neutro e deterministico: confidence HIGH prima di MEDIUM,
 * a parità di confidence l'ordine resta quello di dichiarazione nel file
 * (stabile — Array.prototype.sort di Node/V8 è stable sort). Nessuna
 * "vicinanza" perché nessun lead ha coordinate verificate (stesso motivo
 * di isDiscoveryLeadCompatibleWithZoneQuery sopra).
 */
const CONFIDENCE_RANK: Record<DiscoveryLeadConfidence, number> = { high: 0, medium: 1 };

export function sortDiscoveryLeadsForDisplay(leads: DiscoveryLeadRecord[]): DiscoveryLeadRecord[] {
  return [...leads].sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]);
}

// ============ PROPONI INVITO (DISCOVERY UNIFICATION, 21/09/2026) ============
//
// §7-8 del prompt "DISCOVERY UNIFICATION + PROPONI INVITO": "Proponi invito"
// è una CTA primaria mostrata SOLO quando esiste una reale entità
// invitabile — mai sui 6 record SOURCE-ONLY (vedi campo `invitable` sopra).

export function isDiscoveryLeadInvitable(lead: Pick<DiscoveryLeadRecord, "invitable">): boolean {
  return lead.invitable;
}

// §11 del prompt: "se URL dell'organizzatore → 'Sito dell'organizzatore'; se
// esiste solo fonte pubblica/Comune → 'Vedi la fonte'. Non chiamare
// genericamente tutto 'sito ufficiale'." Wording derivato SOLO da
// officialUrlIsOrganizerSite (mai dal flag `invitable`, sono assi diversi —
// vedi il caso Oratorio Baggio: invitabile ma con un link-fonte, non un
// sito proprio).
export function secondaryLinkLabelForLead(
  lead: Pick<DiscoveryLeadRecord, "officialUrlIsOrganizerSite">
): "Sito dell'organizzatore" | "Vedi la fonte" {
  return lead.officialUrlIsOrganizerSite ? "Sito dell'organizzatore" : "Vedi la fonte";
}
