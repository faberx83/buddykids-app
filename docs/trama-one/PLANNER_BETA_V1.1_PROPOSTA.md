# Planner Beta v1.1 — Proposta di revisione (design only, nessuna modifica al codice)

Ruoli assunti: Senior Product Designer + Senior Frontend Architect + UX Lead.
Perimetro: Parent portal NEXTGEN (`/nextgen/planner`), nessuna modifica a LEGACY, routing, bottom nav o architettura dati salvo l'aggiunta minima indicata.

---

## 1. Executive summary

Il Planner NEXTGEN oggi (`app/nextgen/planner/PlannerClient.tsx`, modalità "Organizzazione") impila **9 sezioni verticali** nella stessa pagina, sotto gli stessi 4 tab (`PlannerModeTabs`: Organizzazione/Mappa/Budget/Gruppi): alert, copertura stagionale, copertura per bambino, striscia "Stato per settimana", pannello Calendario/Chi fa cosa, box Sovrapposizioni, Timeline completa delle 13 settimane, griglia di suggerimenti (ActivityCard con match%). Tre di queste sezioni rappresentano **la stessa metrica** (% di copertura) in tre forme diverse, e l'ultima duplica visivamente Scopri (stesso componente `ActivityCard`, stessa libreria `computeSmartMatches`).

Il mockup "Planner semplificato" allegato propone una **progressive disclosure a 3 tappe**: Overview (sintesi + prossimo passo) → Dettaglio settimana (stato + suggerimento singolo) → Calendario operativo (una attività alla volta, andata/ritorno, responsabili, condivisione). Questa proposta traduce quel mockup nell'architettura esistente con un principio guida: **reuse-first** — nessun nuovo modello dati, nessuna nuova query server oltre a quelle già presenti in `app/nextgen/planner/page.tsx`, nessuna nuova tab, nessuna modifica a routing/bottom nav/Scopri.

Il lavoro è quasi interamente **riorganizzazione dell'information architecture e della gerarchia visiva**, non nuove feature: la card "Copertura" esiste già e si sposta nell'hero; la lista "prossime settimane" è un nuovo filtro sugli stessi `weeks` già calcolati; il "Suggerimento principale" riusa `computeSmartMatches` già invocato oggi; il Calendario/Chi fa cosa è già stato semplificato in questa stessa giornata di lavoro (vedi commit `c93390e`) e richiede solo rifiniture. L'unico dato realmente nuovo — "Ruoli da coprire" (Andata/Ritorno mancanti per una settimana) — è derivabile **client-side** dai dati "Chi fa cosa" già fetchati, senza query aggiuntive né estensione di dominio, come richiesto esplicitamente nel contesto strategico.

Versioning: **Planner Beta v1.1**, esposto come piccola etichetta testuale accanto al titolo di pagina (non sostituisce il ribbon "Beta" generico di `NextgenBadge`, che resta invariato e condiviso con Home/Admin/Center).

---

## 2. Analisi delta — AS-IS vs TO-BE

| # | Area | AS-IS | TO-BE | Problema risolto | Impatto UX | Impatto tecnico | Classificazione | Note implementative |
|---|------|-------|-------|-------------------|------------|------------------|------------------|----------------------|
| 1 | Hero / overview iniziale | `DecorativeIntroCard` con `NextgenBadge` + descrizione statica per modalità (`PLANNER_MODE_DESCRIPTIONS`); il numero di copertura vero appare solo più sotto, in una card separata dopo gli alert. | L'hero mostra subito la sintesi di copertura stagionale (N/M settimane, barra, messaggio "prossimo obiettivo") — la card "Copertura" esistente si sposta dentro/sotto l'hero, eliminando un livello di scroll prima di capire "dove sono". | "Dove sono" non è chiaro finché non si scorre oltre i tab. | Risposta immediata allo stato generale, meno scroll iniziale. | Basso — resequencing JSX, stessi dati (`planner.coveredNeededCount`/`neededCount`). | **ADAPT** | Nessun nuovo calcolo: `progressPercent` è già calcolato in `PlannerClient.tsx`. |
| 2 | Tabs del Planner | 4 tab (`PlannerModeTabs`): Organizzazione/Mappa/Budget/Gruppi, scroll orizzontale con fade. "Organizzazione" è denso (9 sotto-sezioni). | Stessi 4 tab, invariati. Nessuna tab "Calendario" a sé (coerente con la decisione già presa in passato di tenerla come pannello dentro Organizzazione). | — | Zero learning cost aggiuntivo, nessuna nuova superficie di navigazione. | Nullo. | **REUSE** | `PlannerModeTabs.tsx` non si tocca. |
| 3 | Copertura stagionale | Rappresentata **3 volte**: card "N di M coperte" + barra; "Copertura per bambino" (barre espandibili, solo se >1 figlio); striscia "Stato per settimana" (barrette colorate cliccabili → scroll a Timeline). | Una sola sintesi nell'hero (riga 1). "Copertura per bambino" diventa dettaglio secondario dietro toggle (non più visibile di default). "Stato per settimana" viene rimossa: la sua funzione di colpo d'occhio è assorbita dalla nuova lista "Prossime settimane da completare" (riga 4) e, per lo sguardo sull'intera stagione, dalla vista Mese del Calendario (già esistente). | 3 rappresentazioni ridondanti della stessa metrica competono per attenzione. | -1 sezione full-width, meno rumore visivo. | Basso/medio — "Copertura per bambino": stesso state `expandedKidId`, solo gating diverso. "Stato per settimana": rimozione di `computeWeekStatus`/`jumpToWeek` in quel punto (verificare nessun deep-link esterno la presupponga). | Copertura per bambino: **ADAPT** · Stato per settimana: **REPLACE** (funzione assorbita altrove) | Il box "Sovrapposizioni da controllare" resta, ma dentro il sistema `allAlerts` già esistente (1 avviso alla volta + "Mostra tutti"), non come box indipendente. |
| 4 | Lista settimane (Timeline) | "Timeline della stagione": **tutte** le settimane, raggruppate per mese, ogni mese pieghevole (aperto di default solo quello con la settimana prioritaria/prima scoperta). | L'Overview mostra solo le "Prossime settimane da completare" (max 3, come nel mockup: SETT 14/15/16). La Timeline completa (tutte le settimane, incluse coperte/passate) resta disponibile per consultazione dietro un link "Vedi tutte le settimane" o dentro Calendario → vista Mese. | 13 righe sono un contenuto di consultazione, non l'azione primaria — competono con "cosa faccio ora". | Overview diventa una vera task-list ("prossime 2-3 cose da fare"), non un elenco esaustivo. | Medio — nuovo filtro derivato (`!covered && !dismissed && !isPast`, ordinato per index, limit 3) sugli stessi `weeks`, nessuna nuova query. `groupWeeksByMonth`/`monthGroups` non si buttano: si spostano dietro il link di consultazione. | **ADAPT** | Riusa `computeWeekStatus`/`WEEK_STATUS_LABEL` per il testo di stato di ogni riga — zero nuovo calcolo di dominio. |
| 5 | CTA primaria | Bottone "Riempi" **ripetuto per ogni riga** scoperta della Timeline — nessuna CTA dominante a livello pagina. | Una CTA dominante full-width "Riempi settimana" nell'Overview, che agisce sulla settimana prioritaria (`priorityWeek`, già calcolata). Le altre righe "prossime settimane" restano cliccabili singolarmente ma senza bottone ripetuto identico. | Troppe CTA identiche, nessuna si distingue come "quella giusta ora". | Azione ovvia, coerente con "una CTA dominante per step". | Basso — riusa `priorityWeek`/link `/nextgen/search?week=` già esistente. | **ADAPT** | Le righe non prioritarie portano al Dettaglio Settimana (riga 7), non direttamente a Scopri. |
| 6 | Suggerimenti | Sezione "Consigliate"/"Per riempire la Settimana N" in fondo alla pagina: griglia fino a 4 `ActivityCard` con match% e reason-chip — di fatto un mini-Scopri incorporato (stesso componente, stessa libreria `computeSmartMatches`). | Nell'Overview resta solo un link leggero "Suggerimenti per te · N suggerimenti" (nessuna griglia). Il suggerimento pieno si vede nel Dettaglio Settimana: 1 card "hero" + link "Altre opzioni"/"Vedi tutte in Scopri". | Duplicazione percepita con Scopri (stessa UI in due punti). | Chiarisce "Scopri = esploro, Planner = mi viene proposta la soluzione migliore". | Basso/medio — `computeSmartMatches` invariata (usata identica in Scopri); cambia solo dove/quanto se ne renderizza. | **ADAPT** | Rischio principale di scope-creep: "Altre opzioni" deve restare un elenco compatto (titolo+prezzo+match%), mai un'altra griglia `ActivityCard`. |
| 7 | Entrata nel dettaglio settimana | Non esiste una vista intermedia: click su settimana **coperta** → `/nextgen/prenotazioni?bookingId=`; CTA "Riempi" su settimana **scoperta** → direttamente `/nextgen/search?week=`. Nessuna fermata per orientarsi prima di agire. | Nuova vista "Dettaglio Settimana" (mockup schermata 2), raggiunta dalla lista "prossime settimane": mostra stato/copertura/ruoli/suggerimento prima di mandare l'utente verso Scopri o Prenotazioni. | Oggi si salta da 0 a 100 — manca un passo di orientamento per-settimana. | Alto — è il cuore del redesign: introduce vera progressive disclosure. | Medio — nuova route o pannello, ma **tutti i dati sono già nel payload di `page.tsx`** (nessuna nuova query); solo "Ruoli da coprire" è un derivato nuovo, calcolato client-side (vedi riga 11). | **NEW** (vista) + **REUSE** (dati) | Raccomandato: route dedicata `/nextgen/planner/settimana/[startDate]` (Server Component), coerente con le altre sotto-pagine esistenti (`/logistica`, `/famiglia`, `/indirizzi`, `/promemoria`). |
| 8 | Timeline settimana (contenuto del dettaglio) | Info equivalenti sparse tra Timeline (stato/nome), Stato-per-settimana (colore), box Sovrapposizioni (separato), Consigliate (in fondo, non specifico per settimana se non via `priorityWeek`). | Ordine fisso nel Dettaglio Settimana: 1) Stato, 2) Copertura %+posti da coprire, 3) Ruoli da coprire (solo se pertinente), 4) Suggerimento principale, 5) Altre opzioni. | "Cosa posso fare" richiede oggi di ricomporre info da 3-4 sezioni diverse. | Alto — risposta in un colpo d'occhio, ordine coerente con la decisione reale. | Medio, vedi riga 7. | **NEW** (vista) + **REUSE** (dati) | — |
| 9 | Calendario | Pannello pieghevole dentro Organizzazione (oggi aperto di default e rietichettato "Calendario e Chi fa cosa?" dopo il fix di questa sessione): Mese/Settimana, legenda, riepilogo giorno/settimana con bulk-assign, elenco per giorno Andata/Ritorno (già semplificato oggi), Condivisione Piano. | Stessa collocazione. Gap residuo rispetto al mockup: (a) una sola attività espansa alla volta quando un giorno ne ha più di una; (b) campo "Note" libero per l'assegnazione (non esiste oggi). | "Quando apro Calendario esplode in troppi dettagli" — già in gran parte risolto oggi; resta il caso multi-attività/giorno. | Medio (a) — meno densità nei giorni con più figli/attività. | Basso per (a): nuovo `useState` locale (`expandedActivityKey`) sopra struttura esistente. (b) richiede un nuovo campo dati (schema) — **fuori scope raccomandato per v1.1** per via del divieto di migrazioni in questa fase. | (a) **ADAPT** · (b) **NEW — raccomandato DEFER** | — |
| 10 | Vista mese/settimana | Toggle "Mese"/"Settimana" già esistente in `PlannerCalendarView`. | Invariato — il mockup conferma l'approccio attuale. | — | Nessuno (già allineato). | Nullo. | **REUSE** | — |
| 11 | Assegnazione andata/ritorno | Dopo il fix di oggi: due bottoni Andata/Ritorno per giorno feriale, icona+nome assegnato o "+ Assegna"; click apre pannello con `RESPONSIBLE_OPTIONS` sotto il giorno specifico. | Concettualmente equivalente al mockup ("Responsabili assegnati 1/2" con chip). Eventuale rifinitura: icona "auto" al posto delle frecce ti-arrow-right/left, come richiamo visivo (non funzionale) al tema passaggi auto. | Già in gran parte risolto oggi. | Basso residuo (rifinitura). | Basso — solo classi/icone, stessa struttura dati (`handleAssign`/`handleClear`). | **ADAPT** | Nessuna logica di car-pooling reale: solo segnale visivo, come richiesto ("semplificare visivamente, non espandere il dominio"). |
| 12 | Note / condivisione | "Condivisione Piano" è un pannello **separato**, più in basso nella stessa vista Calendario (bottone "Condividi" per mese/settimana). Note per singola assegnazione: non esistono. | "Condividi questa assegnazione" come azione rapida dentro la card dell'attività espansa (stessa `createPlanShareAction`, trigger riposizionato con scope preimpostato). | Azione di condivisione oggi richiede scroll per essere trovata. | Basso/medio — azione a portata di mano quando serve. | Basso — stessa action, cambia solo il trigger/scope iniziale. | **ADAPT** | Il campo "Note (opzionale)" resta rimandato (vedi riga 9b). |
| 13 | Relazione con Scopri | Concettualmente separati, ma la sezione "Consigliate" in fondo al Planner duplica visivamente Scopri (stesso `ActivityCard`, stesso match%). | Planner non mostra più griglie in Overview; nel Dettaglio Settimana al massimo 1 card hero + elenco compatto + link esplicito "Vedi tutte in Scopri" (`/nextgen/search?week=`, invariato). | Il modello mentale "Scopri = esploro, Planner = completo" non era percepibile. | Alto. | Basso — nessuna modifica a Scopri. | **ADAPT** | — |
| 14 | Relazione con Gruppi | Tab indipendente (`PlannerGroupsView`), dominio separato (coordinamento sociale). | Nessun cambiamento — il mockup non tocca Gruppi. | — | Nessuno. | Nullo. | **REUSE** | — |

---

## 3. Information & interaction design

### 3.1 Pagina Planner — Overview (`/nextgen/planner`, tab "Organizzazione")

- **Obiettivo:** rispondere a "sono organizzato per l'estate?" e "cosa devo fare adesso?" in un colpo d'occhio.
- **Contenuto principale:** hero con copertura stagionale (N/M, barra, messaggio); tab bar (invariata); 1 alert al massimo (`allAlerts`, sistema esistente); lista "Prossime settimane da completare" (max 3-4 righe con stato); CTA dominante "Riempi settimana" (agisce sulla settimana prioritaria).
- **Contenuto secondario:** link "Calendario"; link "Suggerimenti per te" (conteggio); link "Vedi tutte le settimane"; box Sovrapposizioni solo se presenti (dentro `allAlerts`).
- **CTA dominante:** "Riempi settimana" → `/nextgen/search?week=<priorityWeek.startDate>` (link invariato, solo restyle).
- **CTA secondarie:** riga di settimana → Dettaglio Settimana; "Calendario" → pannello/vista Calendario; "Suggerimenti per te" → Dettaglio Settimana o Scopri; "Vedi tutte" → Timeline completa/Calendario→Mese.
- **Cosa NON deve esserci:** griglia `ActivityCard`; striscia "Stato per settimana"; "Copertura per bambino" sempre visibile; budget (resta nel tab dedicato); Condivisione Piano (resta nel Calendario).
- **Relazione con le altre pagine:** è l'hub — porta a Dettaglio Settimana, a Calendario, a Scopri (via link, mai via contenuto embedded), a Le mie prenotazioni (settimane già coperte, invariato).

### 3.2 Dettaglio settimana (nuovo — `/nextgen/planner/settimana/[startDate]`)

- **Obiettivo:** far capire stato e prossimo passo per UNA settimana specifica.
- **Contenuto principale:** header (Settimana N + date) + badge Stato; box Copertura (%) + posti da coprire; box Ruoli da coprire (Andata/Ritorno, solo se la settimana ha già ≥1 copertura); box Suggerimento principale (1 card hero, match%, CTA diretta).
- **Contenuto secondario:** "Altre opzioni" (elenco compatto, non griglia, con link "Vedi tutte in Scopri"); nota sovrapposizione se pertinente.
- **CTA dominante:** azione sul suggerimento principale, oppure — se la settimana è già coperta — "Vai alla prenotazione" (riuso invariato verso Le mie prenotazioni).
- **CTA secondarie:** "Altre opzioni" → Scopri filtrato; "Non mi serve"/"Ripristina" (riuso `toggleWeekDismissedAction`); torna a Overview.
- **Cosa NON deve esserci:** filtri di ricerca, mappa, griglie multiple.
- **Relazione con le altre pagine:** raggiunta da Overview; porta a Scopri o a booking/Le mie prenotazioni.

### 3.3 Calendario operativo (pannello "Calendario e Chi fa cosa?" dentro Organizzazione)

- **Obiettivo:** gestire andata/ritorno/responsabili per i prossimi giorni senza tornare a ragionare sull'intera stagione.
- **Contenuto principale:** toggle Mese/Settimana (invariato); calendario con legenda per bambino (invariato); riepilogo giorno/settimana con **una attività alla volta espansa** (nuovo: se il giorno ha più attività/bambini, solo 1 aperta per volta); Andata/Ritorno con responsabili chiari (già fatto oggi); "Condividi questa assegnazione" a portata di mano.
- **Contenuto secondario:** "Applica a tutta la settimana" (bulk, resta collassato/secondario); elenco link condivisi (gestione/revoca, in fondo).
- **CTA dominante:** assegnare/modificare responsabile andata o ritorno del giorno attivo.
- **CTA secondarie:** "Condividi questa assegnazione"; cambio vista Mese/Settimana; "Applica a tutta la settimana".
- **Cosa NON deve esserci:** ricerca attività, suggerimenti/matching, budget.
- **Relazione con le altre pagine:** raggiunto da Overview via link; dati già passati da `PlannerClient`, nessun nuovo fetch.

**Riepilogo spostamenti:**
- **Resta in Planner:** copertura stagionale, prossime settimane da completare, dettaglio settimana, calendario operativo/chi fa cosa, condivisione piano.
- **Si alleggerisce verso Scopri:** la griglia di suggerimenti (Planner mostra 1 hero + link); i filtri di ricerca restano confermati solo in Scopri (mai stati nel Planner).
- **Resta in Calendario:** vista mese/settimana, assegnazione andata/ritorno, condivisione piano.
- **Non più mostrato tutto insieme:** overview stagionale + timeline completa + calendario + griglia suggerimenti + budget non coesistono più nella stessa schermata a scroll continuo — sono 3 tappe separate, ciascuna con un solo compito.

---

## 4. Proposta UI implementabile, schermo per schermo

### Overview

**Blocchi (ordine gerarchico):**
1. `PageHeader` (riuso) + `NextgenBadge` (riuso) + nuova etichetta testuale "Planner Beta v1.1"
2. Hero: `DecorativeIntroCard` (riuso) con sintesi copertura (N/M, barra, messaggio) — **adattata** per includere la card "Copertura" oggi separata
3. `PlannerModeTabs` (riuso invariato)
4. Alert singolo (riuso invariato: `allAlerts.slice(0,1)` + "Mostra tutti")
5. Lista "Prossime settimane da completare" (**nuovo** componente presentazionale, dati derivati da `weeks` esistente)
6. CTA dominante "Riempi settimana" (**adattata** dal bottone "Riempi" esistente)
7. Link secondari: "Calendario", "Suggerimenti per te" (conteggio da `recommendations.length`), "Vedi tutte le settimane"

- **Empty state:** `neededCount === 0` → messaggio di rassicurazione già esistente ("Tutto sotto controllo per questa estate").
- **Loading:** nessuno aggiuntivo — Server Component, dati già in `page.tsx`.
- **Error:** invariato (`isSupabaseConfigured` guard già presente).
- **Responsive:** mobile-first invariato, nessun nuovo breakpoint.
- **Riusabili:** `DecorativeIntroCard`, `PlannerModeTabs`, `PageHeader`, `NextgenBadge`.
- **Da adattare:** blocco "Copertura" (spostato nell'hero), bottone "Riempi" (diventa CTA dominante full-width).
- **Nuovi minimi:** `UpcomingWeeksList` (lista compatta, deriva da `weeks`+`computeWeekStatus`), `SuggestionsTeaser` (link leggero con conteggio).

### Dettaglio settimana

**Blocchi:**
1. `PageHeader` con back verso Planner (riuso)
2. Badge Stato + eventuale nota sovrapposizione (`computeWeekStatus`/`WEEK_STATUS_LABEL`, riuso)
3. Box Copertura (% + posti da coprire) — riuso `coveredKids`/`kids.length`
4. Box Ruoli da coprire (Andata/Ritorno) — **nuovo**, derivato client-side
5. Box Suggerimento principale — riuso `ActivityCard` (variante "hero"/prima card) + `computeSmartMatches`
6. "Altre opzioni" (elenco compatto) — **nuovo** layout minimale, stessi dati `recommendations[1..]`
7. CTA dominante + CTA secondarie

- **Empty state:** nessun suggerimento disponibile → messaggio + link diretto a Scopri.
- **Loading:** nessuno — Server Component (route dedicata).
- **Error:** `startDate` non valido → `notFound()` standard Next.js.
- **Responsive:** invariato mobile-first.
- **Riusabili:** `PageHeader`, `ActivityCard`, `computeSmartMatches`, `computeWeekStatus`, `toggleWeekDismissedAction`.
- **Da adattare:** eventuale variante compatta di `ActivityCard` per "Altre opzioni" (o riuso as-is se già sufficientemente compatto — verificato: `ActivityCard.tsx` non ha oggi varianti/size prop, quindi serve un componente riga dedicato invece di riusarlo per l'elenco compatto).
- **Nuovi minimi:** `WeekDetailHeader`, `RolesToCoverCard`, la route/pagina stessa, un componente riga leggero per "Altre opzioni" (titolo+prezzo+match%, non `ActivityCard`).

### Calendario operativo

**Blocchi:** invariati da oggi (toggle Mese/Settimana, legenda, griglia/elenco, riepilogo giorno con Chi fa cosa) + 2 adattamenti: (a) expand/collapse per singola attività quando un giorno ne ha più di una; (b) CTA "Condividi questa assegnazione" spostata dentro la card attività.

- **Empty/Loading/Error:** invariati (già gestito: "Nessuna settimana stagionale disponibile").
- **Responsive:** invariato.
- **Riusabili:** `PlannerCalendarView` quasi interamente (già adattato oggi per Chi fa cosa).
- **Da adattare:** `PlannerCalendarView` (expand/collapse multi-attività, riposizionamento CTA condivisione).
- **Nuovi minimi:** nessuno strettamente necessario.

---

## 5. Piano di implementazione

### Wave 1 — Overview (rischio più basso, valore percepito più alto)
- **File coinvolti:** `app/nextgen/planner/PlannerClient.tsx` (resequencing hero+copertura, nuova lista prossime settimane, CTA dominante, rimozione/gating "Stato per settimana" e "Copertura per bambino", sostituzione blocco "Consigliate" con teaser); eventuale nuova funzione pura in `lib/nextgen/planner-insights.ts` (`getUpcomingWeeks(weeks, todayIso, limit)`) per non duplicare il filtro in JSX.
- **Dipendenze:** nessuna nuova query — dati già presenti in `app/nextgen/planner/page.tsx`.
- **Rischi:** rimuovere "Stato per settimana" tocca `highlightedWeekIndex`/`jumpToWeek` — verificare (grep mirato) che nessun altro punto dell'app faccia deep-link presupponendo quella striscia.
- **Rollback:** commit isolato su `PlannerClient.tsx`, revert diretto.
- **Test da aggiornare:** non risultano test automatizzati dedicati al Planner in questa sessione — verifica manuale strutturata (screenshot before/after) per QA; se il repo introduce test in futuro, coprire almeno il rendering della nuova lista e della CTA dominante.
- **Acceptance criteria:** l'hero mostra la copertura; è presente al massimo 1 CTA full-width dominante; nessuna griglia `ActivityCard` visibile senza navigare al Dettaglio Settimana/Scopri; "Copertura per bambino" non è più visibile di default.

### Wave 2 — Dettaglio Settimana (nuova route)
- **File coinvolti:** nuovo `app/nextgen/planner/settimana/[startDate]/page.tsx` (Server Component, riusa `getPlannerData`/`getKidsForUser`/`getActivities`/`getActivityAvailabilityByWeek`/`computeSmartMatches`, stesso pattern `Promise.all` di `planner/page.tsx` ma filtrato sulla settimana richiesta); nuovo `WeekDetailClient.tsx`; nuova funzione pura `computeRolesToCover(week, coveredKids, responsibilities)` in `lib/nextgen/planner-insights.ts` (client-safe, nessun import server); collegare i link da `PlannerClient.tsx`.
- **Dipendenze:** Wave 1 (la lista "prossime settimane" deve linkare qui).
- **Rischi:** invocare `computeSmartMatches` per una settimana diversa dalla prioritaria richiede un nuovo punto di invocazione server-side (stessa funzione, dataset piccolo — rischio basso, da verificare comunque il costo).
- **Rollback:** route additiva — rimuovere route + link, zero impatto sulle pagine esistenti.
- **Test da aggiornare:** smoke test manuale per `/nextgen/planner/settimana/<data valida>` e `<data non valida>` (404).
- **Acceptance criteria:** settimana scoperta → stato+copertura+ruoli(se applicabile)+1 suggerimento hero+"altre opzioni"; settimana coperta → stato+CTA "Vai alla prenotazione".

### Wave 3 — Calendario operativo (rifiniture)
- **File coinvolti:** `components/nextgen/PlannerCalendarView.tsx` (expand/collapse multi-attività per giorno, riposizionamento CTA condivisione).
- **Dipendenze:** nessuna — indipendente, può partire in parallelo alle altre wave.
- **Rischi:** basso — componente già toccato/verificato in questa sessione.
- **Rollback:** commit isolato.
- **Test da aggiornare:** verifica manuale multi-bambino/multi-attività nello stesso giorno.
- **Acceptance criteria:** un giorno con più bambini/attività mostra una sola card espansa alla volta; "Condividi questa assegnazione" è visibile senza scroll oltre la card attiva.

### Wave 4 — backlog, esplicitamente FUORI da v1.1
Campo "Note" per l'assegnazione andata/ritorno (richiede estensione schema), eventuale car-pooling reale: rimandate a decisione di prodotto separata, fuori dal perimetro di questa revisione ("semplificare visivamente, non espandere il dominio").

---

## 6. Rischi e assunzioni

**Assunzioni:**
- Nessuna nuova migrazione DB in questa fase — ogni dato nuovo ("Ruoli da coprire" incluso) deve essere derivabile client-side dai dati già fetchati, mai da nuove tabelle/colonne.
- Il routing esistente resta invariato; l'unica aggiunta è `/nextgen/planner/settimana/[startDate]`, additiva.
- `NextgenBottomNav` non viene toccata.
- Scopri (`SearchDiscoveryClient.tsx`) non viene modificato — il Planner cambia solo come presenta un sottoinsieme degli stessi dati/link.
- Il layer LEGACY (`components/PlannerView.tsx`) resta fuori scope, coerente con come sono stati trattati tutti i fix precedenti in questa sessione.

**Rischi:**
- Rimuovere "Stato per settimana" e alleggerire "Copertura per bambino" tocca codice nato da feedback espliciti di Fabrizio in sprint precedenti — se in QA risultasse che manca il colpo d'occhio sull'**intera** stagione (non solo le prossime 3 settimane), va reintrodotto come vista secondaria (es. dentro Calendario→Mese, che già lo offre in forma di griglia mensile) invece che eliminato del tutto.
- Passare da griglia a singola card "hero" per i suggerimenti riduce la visibilità di alternative — rischio percepito di "meno scelta", mitigato dal link "Altre opzioni"/"Vedi tutte in Scopri", da validare in QA.
- La nuova route Dettaglio Settimana introduce un click in più dove oggi (per la settimana prioritaria) l'azione era diretta in un click ("Riempi" → Scopri). **Raccomandazione:** la CTA dominante dell'Overview per la settimana prioritaria continua a puntare **direttamente** a Scopri (comportamento invariato); il Dettaglio Settimana è il percorso per le settimane non prioritarie/di consultazione — va reso esplicito in implementazione per non aggiungere frizione al flusso più frequente.
- "Ruoli da coprire" calcolato client-side da `responsibilities` (intera stagione) resta un dataset piccolo per famiglia (già oggi interamente fetchato per il Calendario) — rischio basso, da monitorare solo in caso di famiglie con molti figli/stagioni molto lunghe.

---

## 7. Prompt finale per Claude Code / cowork

```
Implementa "Planner Beta v1.1" nel repository BuddyKids (parent portal NEXTGEN), seguendo
la proposta di design allegata (PLANNER_BETA_V1.1_PROPOSTA.md). Regole vincolanti:

REUSE-FIRST — non riscrivere nulla che possa essere riusato:
- Riusa invariati: PlannerModeTabs, DecorativeIntroCard, NextgenBadge, PageHeader,
  ActivityCard, computeSmartMatches, computeWeekStatus, WEEK_STATUS_LABEL,
  computePriorityWeekIndex, toggleWeekDismissedAction, createPlanShareAction,
  NextgenBottomNav (nessuna modifica).
- Non toccare: routing esistente (/nextgen/planner/logistica, /famiglia, /indirizzi,
  /promemoria), Scopri (app/nextgen/search/SearchDiscoveryClient.tsx), Gruppi
  (PlannerGroupsView), Budget (PlannerBudgetView), Mappa (PlannerMapView), il layer
  LEGACY (components/PlannerView.tsx).
- Nessuna nuova query server oltre a quelle già presenti in app/nextgen/planner/page.tsx:
  ogni dato derivato nuovo ("prossime settimane", "ruoli da coprire") va calcolato da
  funzioni pure lato client/server component sui dati già fetchati, mai da nuove tabelle
  o migrazioni (nessuna migrazione ammessa in questo lavoro).

WAVE 1 — Overview (app/nextgen/planner/PlannerClient.tsx, modalità "organizzazione"):
1. Sposta la sintesi di copertura (planner.coveredNeededCount/neededCount, barra,
   messaggio "Tutto sotto controllo" quando 100%) dentro/subito sotto l'hero
   (DecorativeIntroCard), prima dei tab.
2. Rimuovi la striscia "Stato per settimana" (barrette cliccabili + jumpToWeek):
   prima di rimuoverla, grep nel repo per verificare che nessun altro punto
   dell'app faccia deep-link presupponendone la presenza.
3. Nascondi di default "Copertura per bambino" dietro un toggle/link (stesso stato
   expandedKidId, stessa logica — cambia solo la visibilità di default).
4. Sostituisci la sezione "Timeline della stagione" (tutte le settimane) con una nuova
   lista compatta "Prossime settimane da completare": filtra weeks su
   !covered && !dismissed && !isPast(todayIso), ordina per index, mostra le prime 3,
   ciascuna con badge di stato (riusa computeWeekStatus/WEEK_STATUS_LABEL). Aggiungi
   un link "Vedi tutte le settimane" che porta alla Timeline completa esistente
   (spostala, non cancellarla — es. dentro il pannello Calendario, vista Mese).
5. Trasforma il bottone "Riempi" per-riga in UNA CTA dominante full-width "Riempi
   settimana" che agisce sulla settimana prioritaria (priorityWeek, già calcolata in
   page.tsx), stesso link /nextgen/search?week=<priorityWeek.startDate> invariato.
6. Sostituisci la griglia di ActivityCard in fondo alla pagina ("Consigliate"/"Per
   riempire la Settimana N") con un link leggero "Suggerimenti per te · N
   suggerimenti" (N = recommendations.length) che porta al Dettaglio Settimana
   (Wave 2) della settimana prioritaria.
7. Aggiungi una piccola etichetta testuale "Planner Beta v1.1" vicino al titolo di
   pagina (PageHeader) — NON modificare NextgenBadge.tsx (resta il ribbon "Beta"
   generico condiviso con Home/Admin/Center).

WAVE 2 — Dettaglio Settimana (nuova route additiva):
1. Crea app/nextgen/planner/settimana/[startDate]/page.tsx (Server Component):
   - valida startDate, notFound() se non corrisponde a nessuna SeasonWeek;
   - riusa getPlannerData/getKidsForUser/getActivities/getActivityAvailabilityByWeek/
     getResponsibilitiesForParent (stesso pattern Promise.all di planner/page.tsx),
     invoca computeSmartMatches con uncoveredWeekStart = startDate della settimana
     richiesta (non solo la prioritaria).
2. Aggiungi in lib/nextgen/planner-insights.ts una funzione pura
   computeRolesToCover(week, coveredKids, responsibilities) — nessun import
   server-only in questo file (deve restare client-safe, stesso vincolo già
   documentato per responsibility-options.ts) — calcola quanti slot
   Andata/Ritorno (giorni feriali della settimana × bambini coperti) risultano
   senza un responsible assegnato in responsibilities.
3. Crea WeekDetailClient.tsx che mostra, in quest'ordine: badge Stato (+ nota
   sovrapposizione se pertinente), box Copertura (%, posti da coprire), box Ruoli
   da coprire (solo se week.covered), 1 ActivityCard "hero" per il primo
   suggerimento, elenco compatto (NUOVO componente riga, non ActivityCard) per le
   altre opzioni con link "Vedi tutte in Scopri" (/nextgen/search?week=...).
   CTA dominante: azione sul suggerimento principale, oppure "Vai alla
   prenotazione" (link a /nextgen/prenotazioni?bookingId=) se week.covered.
4. Collega i link dalla Wave 1 (righe "prossime settimane" non prioritarie, link
   "Suggerimenti per te") a questa route. La CTA dominante dell'Overview per la
   settimana PRIORITARIA continua a puntare direttamente a Scopri (non passa da
   qui) — non aggiungere un click al flusso più frequente.

WAVE 3 — Calendario operativo (components/nextgen/PlannerCalendarView.tsx):
1. Quando il giorno/settimana selezionata ha più di un'attività/bambino, mostra
   una sola card espansa alla volta (nuovo stato locale, es. expandedActivityKey),
   le altre collassate con un semplice header cliccabile per espanderle.
2. Sposta il trigger "Condividi" dentro la card dell'attività/giorno attivo
   (riusa createPlanShareAction/lo stesso stato sharingScope, con scope
   preimpostato sul giorno/settimana attiva invece di richiedere di scegliere da
   capo).
3. NON toccare la logica di assegnazione Andata/Ritorno già semplificata in
   questa sessione (handleAssign/handleClear, RESPONSIBLE_OPTIONS) — solo
   eventuale cambio icona (ti-car al posto delle frecce) come rifinitura
   puramente visiva, se ritieni coerente col resto.

VINCOLI TRASVERSALI:
- Ogni commit separato e scoped a UNA delle wave sopra, titolo in italiano,
  descrittivo (stesso stile già usato nella storia recente del repo).
- tsc --noEmit e eslint puliti su ogni file toccato prima di committare; build
  (npm run build) verde prima di considerare una wave completa.
- Non introdurre feature extra rispetto a quanto elencato sopra (niente filtri di
  ricerca nel Planner, niente campo "Note" per l'assegnazione, niente logica di
  car-pooling reale — tutto questo è backlog Wave 4, esplicitamente fuori scope).
- Aggiorna/aggiungi test se il repo ne ha per l'area Planner; se non esistono test
  automatizzati dedicati, documenta nel messaggio di commit i controlli manuali
  eseguiti (screenshot before/after, casi limite verificati: 0 settimane, tutte
  coperte, settimana con più figli/attività lo stesso giorno).
- Non modificare Scopri, Gruppi, Budget, Mappa, LEGACY, bottom nav, o applicare
  migrazioni DB.
- Alla fine, riporta un riepilogo conciso in italiano di cosa è stato fatto per
  ciascuna wave, cosa resta (Wave 4/backlog) e l'esito di tsc/eslint/build.
```

---

*Documento di analisi/proposta — nessuna modifica al codice, nessun commit effettuato in questa fase.*
