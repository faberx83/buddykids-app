// TRAMA — REAL DISCOVERY PILOT (16/09/2026)
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
// la trasparenza sulla stagionalità (oggi, 16/09/2026, l'estate 2026 è già
// conclusa: molte fonti sono quindi "stagione appena conclusa", non ancora
// riconfermate per il 2027 — la nota lo dichiara sempre esplicitamente).
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
}

export const REAL_DISCOVERY_LEADS: DiscoveryLeadRecord[] = [
  {
    id: "rho-cre-collodi-stripes",
    organizerName: "Comune di Rho (gestione: Stripes Cooperativa Sociale ONLUS)",
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
      "Pagina pubblicata dall'organizzatore il 15/04/2026 per la stagione 2026, già conclusa alla data di questa ricerca (16/09/2026). Sede/orari/gestore confermati direttamente dalla fonte primaria — riconfermare data/prezzo per l'estate 2027 prima della pubblicazione al pubblico.",
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
  },
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
