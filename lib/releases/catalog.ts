// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Release Catalog — source of truth CODE-BASED (nessuna nuova tabella, come
// richiesto esplicitamente) di CHE COSA contiene ciascuna release. Non
// contiene MAI uno stato INTERNAL/PILOT/GLOBAL: quello è sempre DERIVATO a
// runtime da feature_flag_overrides (vedi lib/releases/visibility.ts +
// lib/data/releases.ts), mai hardcoded qui — se questo file dicesse
// "status: PILOT" e un Admin disattivasse l'override, il file mentirebbe
// finché qualcuno non lo aggiornasse a mano. Stesso principio già seguito da
// lib/feature-registry/catalog.ts ("popolato SOLO con voci verificate",
// mai assunte) applicato qui alla dimensione "release" invece che
// "capability singola".
//
// featureKeys fa riferimento a `key` di lib/feature-registry/catalog.ts
// (FEATURE_CATALOG) — riuso deliberato invece di duplicare label/flagName
// qui: "il release catalog descrive CHE COSA contiene la release, i flag
// descrivono CHI LA VEDE" (istruzione esplicita di Fabrizio) si traduce in
// "il Feature Catalog resta l'unico posto che sa QUALE flag governa cosa".

export type ReleaseTargetAudience = "parent" | "partner" | "admin" | "cross_tenant";

export interface ReleaseCatalogEntry {
  /** Identificatore stabile, kebab-case — usato come chiave nelle Server Action di promotion. */
  id: string;
  label: string;
  shortDescription: string;
  /** Una o più aree — la maggior parte delle release avrà un solo target, ma non è un vincolo strutturale. */
  targetAudience: ReleaseTargetAudience[];
  /** Chiavi in lib/feature-registry/catalog.ts (FEATURE_CATALOG) — MAI duplicare qui label/flagName/status. */
  featureKeys: string[];
  knownLimitations?: string[];
  notes?: string;
}

export const RELEASE_CATALOG: ReleaseCatalogEntry[] = [
  // TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026) — RELEASE
  // PLACEHOLDER creata esplicitamente per testare l'infrastruttura
  // Release/Promotion end-to-end (autorizzato da Fabrizio: "Puoi
  // eventualmente creare una RELEASE PLACEHOLDER [...] con feature future
  // non attive SOLO se questo è utile per testare la UI"). Le 3 feature
  // elencate sotto sono PLACEHOLDER in FEATURE_CATALOG (status
  // INTERNAL_PREVIEW, note "PLACEHOLDER", zero codice applicativo dietro) —
  // vedi lib/feature-registry/catalog.ts. Da sostituire con la release reale
  // quando le capability verranno effettivamente costruite (fuori scope di
  // questa sessione).
  {
    id: "planner-intelligence",
    label: "TRAMA — Planner Intelligence",
    shortDescription:
      "Il Planner parte dalle settimane realmente da organizzare, anche quando le attività sono fuori da TRAMA.",
    targetAudience: ["parent"],
    featureKeys: ["school_calendar_intelligence", "external_planner_items", "calendar_export"],
    // TRAMA — School Calendar Intelligence (14/09/2026): "school_calendar_intelligence"
    // diventa la SECONDA delle 3 feature ad avere implementazione reale
    // (dopo calendar_export, 11/09/2026) — SOLO "external_planner_items"
    // resta placeholder. Limitazioni aggiornate di conseguenza (§B13: questo
    // cambio non tocca in alcun modo lo stato/gli override di
    // calendar_export, riga separata sotto, invariata).
    knownLimitations: [
      "calendar_export (V1): export .ics client-side, un file per download. NIENTE integrazione Google Calendar/Outlook/CalDAV, NIENTE feed ICS sottoscrivibile, NIENTE sync bidirezionale — solo impegni con provenienza TRAMA (bookings), external_planner_items non ancora implementato quindi nessuna Attività Esterna nel file esportato.",
      "school_calendar_intelligence (V1): 0 calendari/eventi reali in produzione — il dataset è vuoto finché Fabrizio non decide quale Regione/Comune popolare per il pilota (Admin → gestione calendari scolastici). Chiusure modellate a livello di REGIONE, non di singolo comune (school_calendar_events non ha una colonna comune). Una settimana con un solo giorno festivo/ponte isolato (1-4 giorni su 5) non genera un segnale 'da organizzare' per l'intera settimana — solo una settimana interamente senza scuola lo fa (decisione V1 documentata in lib/school-calendar/need-core.ts).",
      "external_planner_items: PLACEHOLDER — nessuna implementazione applicativa esiste ancora per questa funzionalità.",
    ],
    notes:
      "Creata durante l'implementazione dell'infrastruttura Release/Promotion (10/09/2026) per avere un caso reale, non ipotetico, su cui esercitare l'Admin UI — incluso lo stato \"Rilascio parziale\" quando le 3 feature non sono allo stesso stadio. Calendar Export V1 (11/09/2026) e School Calendar Intelligence V1 (14/09/2026) sono le prime 2 capability reali di questa release: entrambe implementate, entrambe gated (default off, nessun override GLOBAL/PILOT), attivabili in ANTEPRIMA INTERNA indipendentemente l'una dall'altra solo da Fabrizio via Admin → Feature Flags → Release.",
  },
  // TRAMA — FINAL PRE-DEPLOY FIX (14/09/2026, richiesta esplicita di
  // Fabrizio: "non inserirla nella release Planner Intelligence se
  // concettualmente non appartiene lì [...] usa eventualmente una piccola
  // release/catalog entry: TRAMA — UX Foundations"). Release separata,
  // dedicata a capability trasversali di esperienza (non dati/dominio Planner
  // specifici) — oggi una sola voce, pensata per accoglierne altre future
  // dello stesso tipo (indicatori, feedback, micro-interazioni) senza
  // continuare a gonfiare "Planner Intelligence" con cose che non ne fanno
  // concettualmente parte.
  {
    id: "ux-foundations",
    label: "TRAMA — UX Foundations",
    shortDescription: "Componenti di esperienza trasversali (feedback visivo, indicatori di attività) non legati a una singola area di dominio.",
    targetAudience: ["parent"],
    featureKeys: ["global_action_progress", "nextgen_classic_fallback"],
    knownLimitations: [
      "global_action_progress (V1): copertura automatica solo per la navigazione interna e per le 4 CTA esplicitamente istrumentate in questa sessione (vedi PROGRESS COVERAGE nel report di implementazione) — booking/admin/promotion NON sono ancora coperte, deliberatamente (nessun layer condiviso affidabile individuato per quelle superfici senza modificare manualmente decine di componenti).",
      "Non ancora verificata visivamente live: resta dietro flag (cohort:internal-preview) finché Fabrizio non la abilita e la controlla di persona su un dispositivo reale.",
      "nextgen_classic_fallback (V1): copre solo il verso NextGen → Legacy. Il ritorno da Legacy a NextGen per un utente normale non ha oggi un percorso in UI (VersionToggle.tsx, l'unico meccanismo bidirezionale esistente, resta riservato alle utenze di test di Fabrizio) — limite esistente riportato, non introdotto da questa feature.",
    ],
    notes:
      "Creata il 14/09/2026 per ospitare Global CTA Progress Bar separatamente da \"TRAMA — Planner Intelligence\" (che resta scope Planner/School Calendar/Calendar Export). Nessuna nuova tabella, nessun nuovo meccanismo di promotion: stessa infrastruttura Release Catalog/Feature Registry esistente. Estesa il 15/09/2026 con nextgen_classic_fallback (PART C, TRAMA Beta Chrome Cleanup): stesso principio, stessa release — capability trasversale di esperienza, non specifica del Planner.",
  },
  // TRAMA — REAL DISCOVERY PILOT (16/09/2026). Release separata da "Planner
  // Intelligence" e da "UX Foundations": dominio Scopri/Ricerca, non
  // Planner. Dataset code-based (lib/discovery/real-dataset.ts), nessuna
  // nuova tabella, nessuna riga in "activities"/"centers"/"bookings".
  {
    id: "real-discovery-pilot",
    label: "TRAMA — Real Discovery Pilot",
    shortDescription:
      "Scopri unificato: risultati Partner e Scoperte TRAMA (attività estive reali, non Partner, raccolte da fonti pubbliche) nello stesso result set, stesso count, stessi filtri.",
    targetAudience: ["parent"],
    // TRAMA — RADAR (13/10/2026): "Aggiungi una scoperta" vive in Scopri,
    // nello stesso result set: stessa release, gestibile dalla stessa card
    // Admin → Feature Flags → Release (Anteprima interna / Pilot / Tutti).
    featureKeys: ["real_discovery_dataset", "radar_community_discovery"],
    // CORRETTO 21/09/2026 (DISCOVERY UNIFICATION + PROPONI INVITO, §4 del
    // prompt: "Correggi la documentazione stale... che dichiara ancora
    // erroneamente che Real Discovery non è integrato con i filtri"). Le due
    // voci sotto erano vere il 16/09 e sono rimaste FALSE dopo il
    // COMPLETION PASS del 17/09 (adapter filtro) e dopo l'unificazione del
    // 21/09 (result set unico) — nessuno le aveva più aggiornate: la scheda
    // Admin → Feature Flags → Release comunicava un limite non più esistente.
    knownLimitations: [
      "real_discovery_dataset (V1): 13 record reali verificati manualmente (11 Milano/Milano Ovest incl. Bareggio, 2 Puglia Conversano/Noicattaro) — non un motore di ingestion. Rutigliano stesso non ha ancora un operatore estivo specifico confermato (il Comune regola i centri estivi tramite bando pubblico annuale, nessun operatore con sito stabile trovato finora) — documentato come RUTIGLIANO SEARCH TRACE nel report, non trattato come fallimento del dataset.",
      "Filtri (settimana/età/prezzo/zona testuale/categoria/ricerca) SONO applicati ai lead curati con la stessa semantica null-safe dei filtri Partner (un dato mancante non esclude mai un record) — vedi gli adapter puri in lib/discovery/real-dataset.ts. NON applicati: zona a raggio geografico (nessun lead ha coordinate verificate) e Servizi/Copertura (campi che non esistono nel Target Data Contract) — limitazioni deliberate, non un gap di implementazione.",
      "Result set unificato (21/09/2026): Partner e Scoperte TRAMA convivono nello stesso elenco con un unico count, intercalati con un ordinamento deterministico (2 Partner : 1 Curated, nessun Match/punteggio inventato per il Curated) — nessuna sezione separata 'Scoperte TRAMA' più in cima alla pagina.",
      "'Proponi invito' (manifestazione d'interesse verso public.center_leads, infrastruttura esistente) mostrato SOLO sui 7/13 record con un'entità organizzatrice reale e nominata — i 6 record che descrivono un servizio comunale con gestore non nominato/rotante restano visibili ma senza questa CTA (mostrano solo il link alla fonte).",
      "Nessuna immagine: ogni card usa un visual neutro TRAMA (vedi §9 Image/Copyright Audit del report) finché non viene presa una decisione di prodotto/legal sulla gestione immagini.",
      "radar_community_discovery (V1): analisi in simulazione finché non c'è ANTHROPIC_API_KEY su Vercel (una foto senza testo chiede due righe di descrizione). Le scoperte community non hanno coordinate: niente Mappa né 'Vicino a te'. Condivisione da altre app solo Android, solo link e testo.",
      // AGGIORNATO 23/09/2026 (POST-DISCOVERY CONSOLIDATION): non più un gap
      // — Favorites ora disponibile anche per i lead curati, su una
      // tabella NUOVA e separata (public.curated_favorites, migration 38 —
      // NON ANCORA APPLICATA), senza alcuno schema change su
      // public.favorites/activities. Vedi lib/data/curated-favorites.ts +
      // lib/discovery/unified-favorites.ts (meccanismo di merge/promotion
      // Curated → Partner nei Preferiti unificati).
    ],
    notes:
      "Creata il 16/09/2026, estesa il 17/09 (COMPLETION PASS: dataset 6→13, filtri, analytics), il 21/09/2026 (DISCOVERY UNIFICATION + PROPONI INVITO: result set unico, CTA 'Proponi invito' su riuso di center_leads) e il 23/09/2026 (POST-DISCOVERY CONSOLIDATION: Curated Favorites, tabella curated_favorites NON ANCORA APPLICATA — migration 38). Non ancora verificata visivamente live in nessuna delle iterazioni (nessun accesso a browser/dev-server nell'ambiente di sviluppo): resta dietro flag (cohort:internal-preview) finché Fabrizio non la abilita e la controlla di persona.",
  },
  {
    // TRAMA — HOME V2 (Fase 1, 13/10/2026). Una release a sé: si accende e
    // si spegne indipendentemente dal Planner (Fase 2, non ancora qui).
    id: "home-v2",
    label: "TRAMA — Home V2",
    shortDescription:
      "Nuova Home famiglie: cosa succede oggi, cosa c'è da fare, come sta il periodo, prossima chiusura della scuola.",
    targetAudience: ["parent"],
    featureKeys: ["home_v2"],
    knownLimitations: [
      "home_v2 (Fase 1): il riepilogo del periodo usa la stagione estiva già calcolata dal Planner; gli impegni aggiunti a mano compaiono in Oggi ma non contano nella copertura (regola attuale). Suggerimenti solo Partner. La prossima chiusura richiede il calendario scolastico attivo e la scuola indicata per almeno un figlio.",
    ],
    notes:
      "Creata il 13/10/2026. Ripiego: con il flag spento, o se la lettura del flag fallisce, resta la Home attuale. Da verificare dal vivo da Fabrizio prima di estendere oltre l'anteprima interna.",
  },
  {
    // TRAMA — PLANNER V2 (14/10/2026). Release a sé, indipendente da Home V2.
    id: "planner-v2",
    label: "TRAMA — Planner V2",
    shortDescription: "Planner famiglie con le viste Settimana e Stagione; Mappa, Gruppi e Mese come strumenti secondari.",
    targetAudience: ["parent"],
    featureKeys: ["planner_v2", "groups_v2"],
    knownLimitations: [
      "planner_v2: la Stagione mostra le settimane estive già calcolate; la Settimana qualunque settimana. Gli impegni aggiunti a mano non contano nella copertura (regola attuale).",
      "groups_v2: le pagine Community (elenco e dettaglio) restano quelle attuali.",
    ],
    notes:
      "Creata il 14/10/2026. Ripiego: con il flag spento, o se la lettura del flag fallisce, resta il Planner attuale.",
  },
  {
    // TRAMA — NUOVA BARRA (14/10/2026). Pensata insieme a Home V2: l'avatar
    // per il Profilo sta nell'intestazione della Home V2.
    id: "nav-v2",
    label: "TRAMA — Nuova barra",
    shortDescription: "Barra in basso con il pulsante + al centro; il Profilo si apre dall'avatar in Home.",
    targetAudience: ["parent"],
    featureKeys: ["nav_v2", "profile_v2"],
    knownLimitations: [
      "nav_v2: va accesa insieme a Home V2 (l'avatar del Profilo sta nella sua intestazione).",
      "profile_v2: le sottopagine del Profilo restano quelle attuali (solo l'intestazione prende il segno TRAMA).",
    ],
    notes: "Creata il 14/10/2026. Ripiego: flag spento = barra attuale con Profilo.",
  },
  {
    // TRAMA — SCOPRI E PRENOTAZIONI V2 (14/10/2026).
    id: "scopri-prenotazioni-v2",
    label: "TRAMA — Scopri e Prenotazioni V2",
    shortDescription: "Scopri e Prenotazioni nello stile della nuova Home e del nuovo Planner.",
    targetAudience: ["parent"],
    featureKeys: ["bookings_v2", "discover_v2"],
    knownLimitations: [
      "bookings_v2: i servizi extra (pranzo, navetta) non sono ancora nel riepilogo della prenotazione aperta.",
      "discover_v2: le card delle Scoperte TRAMA e community restano quelle attuali; 'Per quando' sulle chiusure richiede il calendario scolastico attivo.",
    ],
    notes: "Creata il 14/10/2026. Ripiego: flag spento = pagine attuali.",
  },
  {
    // TRAMA — ONBOARDING V2 (14/10/2026).
    id: "onboarding-v2",
    label: "TRAMA — Onboarding V2",
    shortDescription: "Benvenuto animato in tre schermate, poi figli e scuola, poi la Home.",
    targetAudience: ["parent"],
    featureKeys: ["onboarding_v2"],
    knownLimitations: [
      "onboarding_v2: il passo 'Chi vi aiuta' non c'è (si fa dal + o dal Profilo); la scuola si imposta per tutti i figli insieme.",
    ],
    notes:
      "Creata il 14/10/2026. Si vede una volta per account (chiave family_onboarding_v2). Ripiego: flag spento = onboarding attuale.",
  },
  {
    // TRAMA — PROMEMORIA PER LE FAMIGLIE (15/10/2026).
    id: "promemoria-famiglie",
    label: "TRAMA — Promemoria famiglie",
    shortDescription: "Notifiche: chi accompagna domani, scuola chiusa in arrivo, nuove proposte in Classe e scuola.",
    targetAudience: ["parent"],
    featureKeys: ["family_reminders_push"],
    knownLimitations: [
      "family_reminders_push: un solo giro al giorno (piano Vercel Hobby), nel tardo pomeriggio; sabato e domenica non hanno Porta/Ritira; le chiusure richiedono la scuola impostata e il calendario scolastico acceso.",
    ],
    notes: "Creata il 15/10/2026. Ripiego: flag spento = nessuna di queste notifiche (le altre restano come prima).",
  },
  {
    // TRAMA — CONSENSI E INFORMATIVE (16/10/2026, pacchetto 2 go-live).
    id: "consensi-informative",
    label: "TRAMA — Consensi e informative",
    shortDescription:
      "In registrazione: accettazione dei Termini, link all'Informativa privacy, consenso marketing facoltativo. Aggiungendo un figlio: dichiarazione del genitore.",
    targetAudience: ["parent", "partner"],
    featureKeys: ["legal_terms_gate_signup", "legal_terms_gate_parental_declaration"],
    knownLimitations: [
      "Va accesa SOLO dopo aver pubblicato i testi (supabase/legal_publish_2026-10-16_bozza1.sql): senza testi pubblicati la registrazione si blocca con 'momentaneamente non disponibile'.",
      "Al Pilot le caselle compaiono a chi si registra da un link d'invito beta (?beta=CODICE, la coorte arriva dal codice); chi si registra senza invito le vede solo con la release in GLOBALE.",
      "Chi è già registrato non viene richiesto di accettare: serve una schermata di accettazione per gli account esistenti (da fare).",
      "Testi in BOZZA, da far rivedere a un legale (dati di minori).",
    ],
    notes: "Creata il 16/10/2026. Ripiego: flag spento = registrazione come prima, senza caselle.",
  },
  {
    // TRAMA — TRASLOCO SU tramapp.it (16/10/2026).
    id: "trasloco-tramapp",
    label: "TRAMA — Trasloco su tramapp.it",
    shortDescription:
      "Chi apre i vecchi indirizzi .vercel.app finisce su tramapp.it (o partner./admin.) alla stessa pagina, già collegato.",
    targetAudience: ["parent", "partner", "admin"],
    featureKeys: ["domain_move_tramapp"],
    knownLimitations: [
      "domain_move_tramapp: a Interno e Pilot si sposta solo chi è collegato e nella coorte; chi apre il vecchio indirizzo senza essere collegato resta lì finché la release non è a tutti.",
      "Le notifiche sul telefono sono legate all'indirizzo: sul nuovo vanno riattivate. L'app installata sulla schermata Home conviene reinstallarla da tramapp.it.",
      "Accendere solo dopo aver aggiunto https://tramapp.it/** (e partner., admin.) tra i Redirect URLs di Supabase.",
    ],
    notes: "Creata il 16/10/2026. Ripiego: flag spento = i vecchi indirizzi funzionano come prima (al massimo un controllo all'ora, invisibile).",
  },
  {
    // TRAMA — PAGINA DI BENVENUTO (20/10/2026).
    id: "pagina-benvenuto",
    label: "TRAMA — Pagina di benvenuto",
    shortDescription:
      "Chi apre tramapp.it senza account vede cos'è TRAMA e può chiedere un invito; 'Registrati' senza invito diventa 'Chiedi un invito'.",
    targetAudience: ["parent"],
    featureKeys: ["landing_benvenuto"],
    knownLimitations: [
      "landing_benvenuto: per chi non ha un account vale solo la release a tutti; Interno e Pilot non cambiano nulla per i visitatori. Per vederla prima: tramapp.it/benvenuto.",
      "Le richieste di invito si salvano solo dopo migration_44_beta_waitlist.sql; prima il modulo risponde 'scrivici a privacy@tramapp.it'.",
      "Le visite (landing_viewed) sono un conteggio indicativo: ricariche comprese, anteprime dei link escluse.",
    ],
    notes: "Creata il 20/10/2026. Ripiego: flag spento = tramapp.it senza account apre l'accesso come prima.",
  },
  {
    // TRAMA — RITORNO ALLA HOME DOPO UNA PAUSA (20/10/2026).
    id: "home-dopo-pausa",
    label: "TRAMA — Dopo una pausa si riparte dalla Home",
    shortDescription: "App installata: riaprendola dopo più di 30 minuti si torna alla Home invece che all'ultima pagina vista.",
    targetAudience: ["parent"],
    featureKeys: ["return_home_after_idle"],
    knownLimitations: [
      "return_home_after_idle: solo con l'app installata sulla schermata Home; nel browser resta l'ultima pagina. Le notifiche aperte prima del deploy del nuovo service worker possono ancora portare alla Home dopo una pausa.",
    ],
    notes: "Creata il 20/10/2026. Ripiego: flag spento = l'app riapre l'ultima pagina vista, come prima.",
  },
  {
    // TRAMA — ADMIN BETA COCKPIT (20/10/2026).
    id: "survey-beta",
    label: "TRAMA — Survey della beta",
    shortDescription: "Due survey brevi in Home (giorno 3 e giorno 14), risposte in Admin → Beta Famiglie.",
    targetAudience: ["parent"],
    featureKeys: ["beta_survey"],
    knownLimitations: [
      "beta_survey: compare solo con la Home V2 accesa.",
      "beta_survey: senza migration_46 i giorni restano 3 e 14 e non si possono spegnere le singole survey da Admin.",
    ],
    notes: "Creata il 20/10/2026. Ripiego: flag spento = nessuna card; le risposte già date restano nei feedback.",
  },
  {
    // TRAMA — IL BUONGIORNO DI TRAMA (20/10/2026).
    id: "buongiorno-trama",
    label: "TRAMA — Il buongiorno",
    shortDescription: "Riepilogo del mattino alle 8 (impegni, chi accompagna, chiusure), sul telefono e/o per email, da attivare in Profilo.",
    targetAudience: ["parent"],
    featureKeys: ["daily_briefing"],
    knownLimitations: [
      "daily_briefing: va applicata migration_45_daily_briefing.sql; senza, l'opzione in Profilo non compare.",
      "daily_briefing: piano Vercel Hobby, arriva fra le 8:00 e le 8:59; se il giorno è vuoto non arriva nulla.",
      "daily_briefing: l'email parte solo con RESEND_API_KEY su Vercel e 'Notifiche email' attive.",
    ],
    notes: "Creata il 20/10/2026. Ripiego: flag spento = niente opzione e niente invii, anche per chi l'aveva attivato.",
  },
  {
    // TRAMA — RICERCA LUOGHI (21/10/2026).
    id: "ricerca-luoghi",
    label: "TRAMA — Ricerca luoghi",
    shortDescription: "Nome della scuola o del posto → indirizzo suggerito (OpenStreetMap), negli impegni e nell'orario della scuola.",
    targetAudience: ["parent"],
    featureKeys: ["place_search"],
    knownLimitations: [
      "place_search: dipende dai dati OpenStreetMap — una scuola o una palestra non mappata non compare (si scrive a mano).",
      "place_search: servizio pubblico Photon con limite di uso 'ragionevole'; con molti utenti conviene un'istanza nostra.",
    ],
    notes: "Creata il 21/10/2026. Ripiego: flag spento = campi di testo normali.",
  },
  {
    // TRAMA — SETTIMANA TIPO (21/10/2026), Fase A dell'iniziativa.
    id: "settimana-tipo",
    label: "TRAMA — Settimana tipo",
    shortDescription: "Impegni che si ripetono ogni settimana (anche il sabato, anche a settimane alterne) e orario della scuola per figlio.",
    targetAudience: ["parent"],
    featureKeys: ["weekly_routine"],
    knownLimitations: [
      "weekly_routine: la scuola non genera ancora passaggi in Chi accompagna (Fase B, con una migrazione).",
      "weekly_routine: Chi accompagna resta lun–ven finché non arriva la Fase B; gli impegni del sabato si vedono in agenda.",
    ],
    notes: "Creata il 21/10/2026. Ripiego: flag spento = niente opzioni nuove; gli impegni ricorrenti già creati restano nei loro giorni.",
  },
  {
    // TRAMA — PLANNER UN GIORNO ALLA VOLTA (21/10/2026): versione A delle anteprime.
    id: "planner-giorno",
    label: "TRAMA — Planner, un giorno alla volta",
    shortDescription: "La Settimana del Planner un giorno alla volta: per ogni figlio la giornata come catena di passaggi, con chi accompagna.",
    targetAudience: ["parent"],
    featureKeys: ["planner_day_view"],
    knownLimitations: [
      "planner_day_view: un'andata e un ritorno per figlio e giorno; l'uscita da scuola non ha ancora un suo passaggio (Fase B).",
    ],
    notes: "Creata il 21/10/2026. Ripiego: flag spento = la lista dei sette giorni di prima.",
  },
  {
    // TRAMA — CORREZIONI DAL TEST UX PARENT (21/10/2026).
    id: "correzioni-test-ux",
    label: "TRAMA — Correzioni dal test UX (21/10)",
    shortDescription:
      "Risultati per periodo veritieri, date e stato vero delle attività, scuola mancante per un figlio, Stagione senza scuola e le altre correzioni del test del 21/10.",
    targetAudience: ["parent"],
    featureKeys: ["parent_ux_fix"],
    knownLimitations: [
      "parent_ux_fix: i centri di prova spariscono dal catalogo famiglie solo dopo la migration 47 (centers.is_test_fixture); prima, nessun centro è nascosto.",
      "parent_ux_fix: 'Indica la scuola' non ha ancora un 'Più tardi': resta in Da fare finché ogni figlio ha la scuola.",
    ],
    notes: "Creata il 21/10/2026. Ripiego: flag spento = tutto come prima.",
  },
  {
    // TRAMA — CHI ACCOMPAGNA PIÙ VELOCE (20/10/2026).
    id: "chi-accompagna-veloce",
    label: "TRAMA — Chi accompagna più veloce",
    shortDescription: "Applica a tutto l'impegno, avviso all'altro genitore, piano da mandare a nonni e tata.",
    targetAudience: ["parent"],
    featureKeys: ["chi_accompagna_plus"],
    knownLimitations: [
      "chi_accompagna_plus: la notifica arriva solo se l'altro genitore è nella famiglia su TRAMA e ha le notifiche push attive.",
      "chi_accompagna_plus: 'tutto l'impegno' copre al massimo sei mesi e solo i giorni feriali (sabato e domenica non hanno Chi accompagna).",
    ],
    notes: "Creata il 20/10/2026. Ripiego: flag spento = foglio come prima, senza proposte né notifiche (resta la scelta istantanea).",
  },
];

export function getReleaseCatalog(): ReleaseCatalogEntry[] {
  return RELEASE_CATALOG;
}

export function getReleaseById(id: string): ReleaseCatalogEntry | undefined {
  return RELEASE_CATALOG.find((r) => r.id === id);
}
