// TRAMA ONE Build Sprint 1 — motore Walkthrough generico, registry.
//
// Generico per costruzione: tutorial_key non è vincolato a un solo dominio
// (onboarding Center, benvenuto Parent, futuro onboarding Admin...) — ogni
// voce di questo registry è un percorso indipendente, identificato da una
// chiave libera, con i propri step ordinati. Lo stato di avanzamento per
// utente vive in Supabase (tabella public.tutorial_progress, vedi
// supabase/migration_09_center_onboarding.sql), le DEFINIZIONI qui, stesso
// pattern già usato per lib/feature-flags/registry.ts e
// lib/onboarding/checklist-registry.ts.
//
// V4 di ASSUMPTION_LOG.md ("il pattern TutorialProgress è sufficiente come
// base schema, senza colonne aggiuntive non ancora previste") verificata
// qui: ogni step ha solo key/title/description, nessun campo extra richiesto
// dal motore generico per la demo di Sprint 1 (benvenuto/completamento
// profilo Parent).

export interface WalkthroughStepDefinition {
  key: string;
  title: string;
  description: string;
  // CONTROLLED BETA EXPERIENCE GATE (§7-14) — campi OPZIONALI per il vero
  // motore Spotlight (components/spotlight/SpotlightOverlay.tsx): quando
  // presenti, questo step ha un elemento reale nell'interfaccia da
  // evidenziare (non solo una card testuale). `spotlightTarget` è il valore
  // dell'attributo `data-spotlight` sull'elemento reale nella pagina;
  // `spotlightRoute` è il pattern di path dove quell'elemento si trova (vedi
  // lib/spotlight/position.ts::matchesSpotlightRoute per la sintassi `*`).
  // Percorsi che NON li impostano (es. welcome_parent) restano serviti dal
  // vecchio WalkthroughCard testuale — nessuna regressione, puro opt-in.
  spotlightTarget?: string;
  spotlightRoute?: string;
  // Visual Acceptance Gate (§15, DEC-69) — bug reale trovato da Fabrizio:
  // quando il target reale di uno step vive su una pagina DIVERSA da quella
  // corrente (es. "Configura i Giorni spot" richiede di navigare dalla
  // scheda di modifica al Calendario disponibilità), il badge "target non
  // trovato" mostrava solo del testo — nessuna azione cliccabile, l'utente
  // doveva indovinare dove andare. Campo opzionale: quando presente, il
  // badge aggiunge un link REALE verso `pathname corrente + suffix`.
  // Deliberatamente semplice (un suffisso relativo al pathname corrente, non
  // un href assoluto): un solo caso d'uso reale oggi (edit -> calendar dello
  // STESSO id attività), non serve un meccanismo più generico finché non ne
  // emerge un secondo.
  spotlightMissingHint?: { suffix: string; label: string };
  // Visual Acceptance Gate (§15, DEC-71) — bug reale trovato da Fabrizio: per
  // gli step il cui target è una CARD con più campi da compilare (non un
  // singolo pulsante/link), il vecchio comportamento "il primo click dentro
  // il target completa lo step" faceva scattare l'avanzamento al primo
  // click su QUALUNQUE campo (es. la checkbox "Ingresso anticipato" dentro
  // "Servizi extra e pasto"), impedendo di fatto di finire di compilare gli
  // altri campi della stessa card. Campo opzionale: quando true, il click
  // genuino NON completa più lo step — il popover mostra invece un pulsante
  // esplicito "Ho finito, continua →" (vedi PartnerSpotlight.tsx). Assente/
  // false per gli step il cui target È l'azione stessa (create_activity:
  // click sul link "+ Nuova attività"; publish: click su "Salva modifiche"):
  // lì il click resta la conferma genuina, comportamento invariato.
  spotlightManualAdvance?: boolean;
  // Visual Acceptance Gate (§15, DEC-73) — bug reale trovato da Fabrizio: sul
  // badge "target non trovato" mostrato quando il target esiste sulla
  // pagina corrente ma non è visibile ADESSO (es. "dashboard" nel cassetto
  // mobile chiuso, vedi pickVisibleTargetIndex/DEC-70), non c'era alcun
  // indizio su COME renderlo visibile — a differenza di spotlightMissingHint
  // (un link a un'ALTRA pagina), qui non serve navigare, basta un'azione
  // nella pagina stessa (es. aprire il menu ☰). Campo opzionale di solo
  // testo (nessun link, l'azione non è cliccabile da qui) mostrato SOLO nel
  // badge di fallback, per non appesantire la description normale mostrata
  // quando il target è già visibile.
  spotlightMissingNote?: string;
}

export interface WalkthroughDefinition {
  key: string;
  title: string;
  steps: WalkthroughStepDefinition[];
}

export const WALKTHROUGH_REGISTRY: Record<string, WalkthroughDefinition> = {
  welcome_parent: {
    key: "welcome_parent",
    title: "Benvenuto in TRAMA ONE",
    steps: [
      {
        key: "welcome",
        title: "Benvenuto",
        description: "TRAMA ONE è la nuova esperienza in costruzione — qui trovi le novità in anteprima.",
      },
      {
        key: "profile_check",
        title: "Completa il profilo",
        description: "Verifica che il profilo di famiglia e dei bambini sia aggiornato.",
      },
      {
        key: "done",
        title: "Tutto pronto",
        description: "Hai completato il percorso di benvenuto.",
      },
    ],
  },
  // TRAMA ONE Build Sprint 2 — percorso Partner per la creazione di
  // un'attività, come richiesto dallo scope Sprint 2 (SPRINT_GOVERNANCE.md:
  // "step Walkthrough attività: crea attività/configura settimane/prezzi/
  // Giorni spot/pubblica/dashboard"). Riusa lo stesso motore generico di
  // welcome_parent, nessuna modifica al motore stesso — solo una nuova
  // definizione di percorso e la sua pagina di collegamento (/center/one).
  // Ogni step linka la pagina reale AS-IS dove l'azione va fatta (nessuna
  // logica di business duplicata qui: il percorso è solo una checklist
  // guidata, la scrittura reale resta in ActivityEditForm.tsx/
  // saveActivityDaysAction, invariati da questo sprint).
  // Visual Acceptance Gate (§15, DEC-69) — ordine e testi rivisti dopo il
  // riscontro di Fabrizio: la sequenza precedente (configure_spot_days
  // PRIMA di publish) obbligava a rimbalzare tra due pagine (modifica ->
  // calendario -> di nuovo modifica per salvare) senza che la ragione fosse
  // evidente, e 2 step avevano una descrizione che non corrispondeva
  // all'elemento realmente evidenziato (vedi commenti sui singoli step
  // sotto). Nuovo ordine, che segue il percorso naturale del form: crea ->
  // informazioni di base -> servizi extra -> pubblica (salva) -> Giorni
  // spot (richiede di aprire un'altra pagina, ora con un link esplicito,
  // vedi spotlightMissingHint) -> dashboard.
  activity_creation_partner: {
    key: "activity_creation_partner",
    title: "Pubblica la tua prima attività",
    steps: [
      {
        key: "create_activity",
        title: "Crea l'attività",
        description: "Vai su \"Le tue attività\" e crea una nuova scheda: nome, fascia d'età, descrizione.",
        spotlightTarget: "create_activity",
        spotlightRoute: "/center/activities",
      },
      // Il target reale (data-spotlight="configure_weeks") è la card
      // "Informazioni generali" di ActivityEditForm.tsx — NON contiene
      // "settimane disponibili"/"capacità" (quello vive nel Calendario
      // disponibilità, step successivo di Giorni spot): testo corretto per
      // descrivere ciò che l'utente vede davvero in questa card, la chiave
      // tecnica ("configure_weeks") resta invariata per non rompere lo
      // storico di tutorial_progress già scritto.
      {
        key: "configure_weeks",
        title: "Informazioni di base",
        description: "Compila nome, fascia d'età, prezzo a settimana e descrizione dell'attività.",
        spotlightTarget: "configure_weeks",
        spotlightRoute: "/center/activities/*",
        spotlightManualAdvance: true,
      },
      // Il target reale (data-spotlight="configure_pricing") è la card
      // "Servizi extra e pasto" — non contiene "prezzo"/"navetta" (quelli
      // sono nella card precedente): testo corretto di conseguenza.
      {
        key: "configure_pricing",
        title: "Servizi extra e pasto",
        description: "Configura ingresso anticipato, uscita posticipata e l'opzione pasto per questa attività.",
        spotlightTarget: "configure_pricing",
        spotlightRoute: "/center/activities/*",
        spotlightManualAdvance: true,
      },
      {
        key: "publish",
        title: "Pubblica",
        description: "Salva la scheda: da questo momento è visibile ai genitori in ricerca.",
        spotlightTarget: "publish",
        spotlightRoute: "/center/activities/*",
      },
      // Dopo aver salvato si resta sulla pagina di modifica: il target reale
      // di questo step vive sul Calendario disponibilità (altra pagina),
      // raggiungibile SOLO scrivendo l'URL a mano finché non c'è un link
      // esplicito — spotlightMissingHint aggiunge quel link al badge
      // "target non trovato" mostrato sulla pagina di modifica.
      {
        key: "configure_spot_days",
        title: "Configura i Giorni spot",
        description: "Apri il Calendario disponibilità e scegli quali giorni sono prenotabili singolarmente, con eventuale sconto o minimo giorni.",
        spotlightTarget: "configure_spot_days",
        spotlightRoute: "/center/activities/*/calendar",
        spotlightMissingHint: { suffix: "/calendar", label: "Vai al Calendario disponibilità →" },
        // Stesso motivo di configure_weeks/configure_pricing (DEC-71): il
        // target è il calendario con più giorni cliccabili singolarmente
        // (AvailabilityCalendar), non un singolo pulsante.
        spotlightManualAdvance: true,
      },
      // Visual Acceptance Gate (§15, DEC-73) — bug reale trovato da
      // Fabrizio: su mobile (390px) la voce "Dashboard" vive nel cassetto
      // laterale, invisibile finché non lo si apre (DEC-70): il badge
      // "target non trovato" mostrava titolo/descrizione ma nessun indizio
      // su COSA fare per vederla evidenziata — l'ha trovata solo aprendo il
      // menu per tentativi. spotlightMissingNote aggiunge quel suggerimento
      // testuale al badge (nessun link: l'azione è "apri il cassetto", non
      // una navigazione ad altra pagina).
      {
        key: "dashboard",
        title: "Monitora dalla dashboard",
        description: "Segui prenotazioni, presenze e richieste ricevute dal pannello Gestore.",
        spotlightTarget: "dashboard",
        spotlightRoute: "*",
        spotlightMissingNote: "Su schermi piccoli, apri il menu ☰ in alto per trovare la voce \"Dashboard\" nel cassetto laterale.",
      },
    ],
  },
  // TRAMA ONE Parent Spotlight sprint (24/08/2026) — equivalente lato
  // Genitore di activity_creation_partner: stesso motore generico
  // (components/spotlight/SpotlightEngine.tsx, estratto da PartnerSpotlight
  // in questo stesso sprint), nessuna modifica al motore. Percorso "golden
  // path" del genitore: cerca -> filtra per settimana -> apri una scheda ->
  // prenota -> ritrova tutto nel Planner — ricalca la Golden Journey A
  // (docs/TRAMA_Golden_Journeys_A-F). Nessuno step usa spotlightMissingHint:
  // ogni target vive sulla stessa pagina raggiunta dallo step precedente,
  // quindi nessun link di deep-link è necessario (vedi ParentSpotlight.tsx).
  discover_book_parent: {
    key: "discover_book_parent",
    title: "Trova e prenota la tua prima settimana",
    steps: [
      {
        key: "search_activity",
        title: "Cerca un centro estivo",
        description: "Scrivi un nome o una zona per iniziare a cercare tra le attività disponibili.",
        spotlightTarget: "search_bar",
        spotlightRoute: "/nextgen/search",
      },
      {
        key: "filter_week",
        title: "Filtra per settimana",
        description: "Scegli le settimane che ti servono: vedrai solo le disponibilità reali per quei giorni.",
        spotlightTarget: "week_filter",
        spotlightRoute: "/nextgen/search",
      },
      {
        key: "open_activity",
        title: "Apri una scheda attività",
        description: "Tocca una card per vedere foto, prezzo e giorni prenotabili.",
        spotlightTarget: "activity_card",
        spotlightRoute: "/nextgen/search",
      },
      {
        key: "book_activity",
        title: "Prenota",
        description: "Scegli la settimana o i singoli giorni e invia la richiesta al centro.",
        spotlightTarget: "book_activity",
        spotlightRoute: "/activity/*",
      },
      {
        key: "planner_nav",
        title: "Segui tutto dal Planner",
        description: "Le tue richieste e prenotazioni restano sempre visibili qui, settimana per settimana.",
        spotlightTarget: "planner_nav",
        spotlightRoute: "*",
      },
    ],
  },
};

export function isKnownTutorial(tutorialKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(WALKTHROUGH_REGISTRY, tutorialKey);
}

export function getTutorialDefinition(tutorialKey: string): WalkthroughDefinition | undefined {
  return WALKTHROUGH_REGISTRY[tutorialKey];
}
