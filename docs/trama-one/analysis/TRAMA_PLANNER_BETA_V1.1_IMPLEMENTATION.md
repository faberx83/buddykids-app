# TRAMA BETA v1.1 — Planner Simplification + Booking-aware Home CTA — Implementazione

Documento di implementazione per la revisione "PLANNER BETA v1.1 / PLANNER SIMPLIFICATION + BOOKING-AWARE HOME CTA", eseguita in 5 wave dopo la fase di design separata (`/outputs/PLANNER_BETA_V1.1_PROPOSTA.md`, presentata e approvata da Fabrizio). Principio guida su ogni decisione: **REUSE > ADAPT > WRAP > NEW > REPLACE**. Nessuna migration DB, nessuna nuova route eccetto quella additiva del Dettaglio Settimana, nessuna modifica a Bottom Nav/Scopri/Gruppi/Budget/Mappa/Legacy/auth/Beta routing/Legal/Notifications/Carpool domain model/RLS.

## 1. Overview del Planner — prima/dopo

**Prima:** `PlannerClient.tsx` (tab Organizzazione) mostrava, in ordine: alert (Promemoria/Missioni), "Stato per settimana" (striscia compatta a 13 barre colorate), "Copertura per bambino" (sempre visibile se 2+ figli), il riquadro Calendario, il box indipendente "Sovrapposizioni da controllare", la Timeline completa (13 settimane sempre visibili, raggruppata per mese) e infine una griglia completa di `ActivityCard` ("Consigliate"/"Per riempire").

**Dopo (Wave 1, commit `bb596a8`):** ordine ridisegnato per rispondere subito a "come siamo messi e cosa devo fare adesso?" senza scroll significativo:

1. Hero di copertura stagionale (`{coveredNeededCount} di {neededCount} settimane coperte` + barra di progresso) — primo contenuto, dati invariati (`planner.coveredNeededCount`/`neededCount`/`progressPercent`).
2. Alert unificati (`allAlerts`, invariato — un solo alert di default, "Mostra tutti" per il resto).
3. **"Prossime settimane da completare"** (nuovo): al massimo 3 righe, filtro `getUpcomingWeeks` = `!covered && !dismissed && !isPast(todayIso)`, ordinate per indice, ognuna apre il Dettaglio Settimana. Nessun'azione "Riempi" per riga qui (eliminata la ripetizione).
4. **CTA dominante "Riempi settimana"** (nuovo): unica, link diretto a `/nextgen/search?week=<priorityWeek.startDate>` — mai al Dettaglio Settimana.
5. **Teaser "Suggerimenti per te · N"** (nuovo, sostituisce la griglia `ActivityCard`): riga singola, apre il Dettaglio Settimana della settimana prioritaria.
6. Link "Vedi tutte le settimane" (nuovo toggle, default chiuso) → riapre la Timeline completa (contenuto interno invariato) come consultazione secondaria.
7. "Copertura per bambino" (invariata nei dati, ora dietro un secondo toggle `kidCoverageOpen`, default chiuso — solo se 2+ figli).
8. Riquadro "Calendario e Chi fa cosa?" (invariato, default chiuso — vedi §7).

**Rimosso:** la striscia "Stato per settimana" (ridondante con la Timeline e priva di alcun valore informativo che la Timeline/gli alert non avessero già) e il box indipendente "Sovrapposizioni da controllare" (ridondante con l'alert di sovrapposizione, `computeOverlapReminders`, che genera lo stesso avviso nello stesso sistema di alert). La griglia `ActivityCard` completa in fondo alla pagina è stata rimossa: "Non deve esistere un mini-Scopri in fondo al Planner".

## 2. Modello di progressive disclosure a 3 livelli

| Livello | Domanda a cui risponde | Superficie |
|---|---|---|
| Overview | "Come siamo messi e cosa devo fare adesso?" | `app/nextgen/planner/PlannerClient.tsx` (tab Organizzazione) |
| Dettaglio Settimana | "Cosa succede in questa settimana e qual è il prossimo passo?" | `app/nextgen/planner/settimana/[startDate]/page.tsx` (nuovo) |
| Calendario Operativo | "Chi accompagna, chi riprende e come siamo organizzati?" | `components/nextgen/PlannerCalendarView.tsx` (dietro il riquadro "Calendario e Chi fa cosa?") |

Ogni superficie ha una responsabilità esclusiva, non duplicata altrove: SCOPRI esplora opportunità, PLANNER organizza/completa le settimane, CALENDARIO coordina operativamente, GRUPPI coordina con altre famiglie.

## 3. Dettaglio Settimana (Wave 2, commit `2edf54c`)

Nuova route additiva **`/nextgen/planner/settimana/[startDate]`** (Server Component, Next.js 15 async params). `startDate` validato contro `planner.weeks`: se non corrisponde a nessuna `SeasonWeek` reale della stagione corrente, `notFound()` (404).

Riuso totale di logica di dominio esistente, nessuna duplicazione: `getPlannerData`, `getMyBookingsForParent`, `getKidsForUser`, `getActivities`, `getActivityAvailabilityByWeek`, `getResponsibilitiesForParent`, `computeSmartMatches`, `computeKidOverlaps`, `computeWeekStatus`, `computePriorityWeekIndex`.

Ordine di contenuto fisso:

1. Settimana + date (`Settimana N · dateRange`).
2. Stato (`WEEK_STATUS_LABEL`, stessa fonte della Timeline).
3. Copertura — dati sintetici REALI (bambini coperti, giorni coperti per bambino), **nessuna percentuale inventata** dove il dominio non la supporta in modo coerente.
4. Organizzazione Andata/Ritorno (vedi §4-6) — mostrata solo se esiste almeno un child-day realmente prenotato.
5. Suggerimento principale (`computeSmartMatches`, solo se la settimana non è coperta).
6. Alternative in righe compatte (titolo, prezzo, match, chevron — non `ActivityCard` piene).
7. CTA: "Vai alla prenotazione" (settimana coperta) oppure link a Scopri filtrato (settimana scoperta).

## 4. Formula del calcolo child-day (Andata/Ritorno)

Fonte di verità riusata identica a quella già in uso da "Chi fa cosa?": `bookings` → `booking_kids(kid_id, kids)` → `booking_weeks(activity_weeks)`/`booking_days(activity_days)`, filtrata `parent_id = utente` e `status != cancelled` (`lib/data/responsibilities.ts#getKidsWithActivityToday`, generalizzata qui a un intervallo di 5 date invece di una sola data).

**Nuova funzione** `getKidsBookedDaysForWeek(weekdayDates: string[])` (`lib/data/responsibilities.ts`): STESSA query, accumula per ciascun bambino un `Set<string>` di date realmente coperte (prenotazione a settimana intera → tutti i 5 giorni feriali del range; prenotazione "Giorni spot" → solo le date esatte di `activity_days`).

**Nuova funzione pura** `computeRolesToCover(weekStartDate, bookedDays, responsibilities)` (`lib/nextgen/week-roles.ts`), formula vincolante:

```
SUM( REAL BOOKED CHILD-DAYS × {ANDATA, RITORNO} ) − ASSIGNED RESPONSIBILITIES = ROLES TO COVER
```

La derivazione è fatta **esclusivamente** sui giorni realmente prenotati per ciascun bambino — mai `5 giorni feriali × numero bambini coperti` (formula esplicitamente vietata dalla revisione perché conta giorni non realmente prenotati). Chiave di ogni slot: `kid_id + weekday + moment`. Verificato con **8 test puri eseguiti realmente in sandbox** (`tests/nextgen/planner-beta-v1-1-child-day.spec.ts`, 8/8 PASS — non richiedono un deploy, `computeRolesToCover` è una funzione pura senza chiamate Supabase/DOM).

## 5. Comportamento multi-bambino

Ogni child-day è qualificato da `kidId`: un martedì condiviso da due bambini genera **4 slot distinti** (Sofia Andata, Sofia Ritorno, Niccolò Andata, Niccolò Ritorno), mai deduplicati per giorno di famiglia. Assegnare Sofia/martedì/Andata **non** influenza Niccolò/martedì/Andata — non-interferenza cross-bambino garantita per costruzione (le chiavi `assignedKeys` includono sempre `kidId`).

Esempio vincolante dalla revisione, verificato da `PLN11-T01`/`PLN11-T02`/`PLN11-T03`: Sofia (lun, mar, gio) + Niccolò (mar, mer, ven), nessuna assegnazione → **12 slot totali** (6 + 6); il martedì genera i 4 slot distinti sopra descritti.

## 6. Limite noto — multi-attività stesso bambino/stesso giorno

**CURRENT DOMAIN LIMITATION — ACTIVITY-LEVEL TRANSPORT NOT MODELED.** Il modello `week_responsibilities` è chiave per `(kid_id, week_start_date, weekday, moment)`, non per singola occorrenza di attività: non può quindi distinguere due Andate diverse per lo stesso bambino nello stesso giorno se il bambino ha due attività quel giorno. `getKidsBookedDaysForWeek` deduplica già a monte per `(kid, giorno)` tramite `Set<string>`, quindi **massimo 1 Andata + 1 Ritorno per `kid_id + giorno`**, qualunque sia il numero di attività prenotate quel giorno per quel bambino. Nessuna migration per risolverlo in questa fase — backlog per una futura modellazione a livello di occorrenza attività (vedi §12).

## 7. Calendario Operativo — disclosure semplificata (Wave 3, commit `b02c0e6`)

`PlannerCalendarView.tsx` **non è stato riscritto**: Mese/Settimana, legenda, Andata/Ritorno, `RESPONSIBLE_OPTIONS`, `handleAssign`/`handleClear`, applicazione bulk a tutta la settimana e Condivisione Piano restano identici. Unica semplificazione: quando un giorno/settimana selezionata ha **più di un bambino coperto**, resta espansa **una sola card** "Chi fa cosa?" alla volta (le altre diventano header compatti cliccabili con pallino+nome+chevron); nuovo stato `expandedKidKey`, con fallback automatico (`effectiveExpandedKidId`, calcolato via IIFE, nessun `useEffect` di reset) sul primo bambino se lo stato punta a un bambino non più presente. Con un solo bambino il comportamento resta identico a prima (sempre espanso). "Condividi" era già posizionato accanto alla card/giorno attivo (`openShare`) — nessuna modifica necessaria lì, nessun nuovo sistema di condivisione, nessun campo Note introdotto (backlog, vedi §12).

## 8. Planner vs Scopri — separazione di responsabilità

- **Planner Overview**: zero griglie di discovery (rimossa la griglia `ActivityCard` completa).
- **Dettaglio Settimana**: un suggerimento principale + alternative leggere in forma compatta.
- **Scopri** (`SearchDiscoveryClient.tsx`): esperienza di ricerca/filtro completa — **non modificato** in nessuna wave.

Il flusso più frequente resta `Planner → Riempi settimana → Scopri filtrato` (CTA dominante diretta, mai instradata attraverso il Dettaglio Settimana).

## 9. Home "Prossimo appuntamento" + CTA booking-aware (Wave 4, commit `d750582`)

**Bug corretto:** `HomeDashboardClient.tsx` → `BookingVisualCard` → `/activity/[id]` (route condivisa Legacy/NextGen) mostrava sempre "Prenota ora" nell'Activity Detail, anche per un'attività già prenotata dal genitore — semanticamente errato.

**Fix** in `app/activity/[id]/page.tsx`: risolto server-side, per qualunque punto di ingresso (Home/Planner/Scopri/Le mie prenotazioni linkano tutti alla stessa route), lo stato reale del genitore rispetto all'attività — riuso di `getMyBookingsForParent()` (stessa fonte di verità di "Le mie prenotazioni"/Planner), cercando la prenotazione attiva più recente (`status !== "cancelled"`) per `activity.dbId`. Nessuna nuova query/tabella, nessuna nuova interpretazione dello stato prenotazione.

**CTA in `DetailClient.tsx`** (footer sticky), nuovo prop `existingBooking`:

| Stato | CTA mostrata |
|---|---|
| Nessuna prenotazione attiva | "Prenota ora" (comportamento invariato) |
| Prenotazione attiva, `canCancelOrModify = true` | "Modifica prenotazione" → `/prenotazioni/{id}/modifica` (route condivisa esistente, riusata da "Le mie prenotazioni") |
| Prenotazione attiva, `canCancelOrModify = false` | Solo stato testuale ("Prenotazione confermata"/"Prenotazione in attesa") + rimando al "Contatta il gestore" già presente in pagina — **nessuna capability backend inventata** |

Poiché il flag `nextgen` e ora anche `existingBooking` sono risolti **una sola volta, server-side, per utente** (non per route/entry-point), la coerenza della CTA fra Home/Planner/Scopri/Le mie prenotazioni è garantita architetturalmente: "a parità di user + activity + booking state la CTA è semanticamente coerente", nessuna logica `se vengo da Home allora CTA X`.

## 10. Coerenza visiva NextGen

Verificato via grep mirato su `DetailClient.tsx`: il colore "azzurrino" Legacy (`bg-sky`) compare solo nel ramo ternario `!nextgen` esplicitamente previsto (`accentBg = nextgen ? "bg-trama-violet" : "bg-sky"`), mai fuori da quel branch. Il restyle CTA richiesto dalla revisione (sezione 24) risultava **già corretto da un intervento dello stesso giorno precedente a questa revisione** — nessuna modifica aggiuntiva necessaria in questa wave, solo verifica.

## 11. Source of truth della versione Beta (Wave 5, commit `ffb9b82`)

Prima di questa modifica **non esisteva alcuna costante di versione** nel repository (verificato via grep su tutto il codice): il ribbon "Beta" (`components/nextgen/NextgenBadge.tsx`) era testo hardcoded senza numero.

Nuovo `lib/beta-version.ts`:

```ts
export const TRAMA_BETA_VERSION = "v1.1";
```

`NextgenBadge.tsx` (unico badge Beta dell'app, montato su Home/Planner/Admin/Center/ecc. — nessun secondo badge creato per il Planner) importa questa costante e mostra `Beta · v1.1`, discreto (9px, non dominante). Cambiare la versione in futuro richiede modificare **un'unica riga** in `lib/beta-version.ts`; nessuna stringa `"v1.1"` è disseminata nelle pagine.

## 12. Backlog esplicitamente rimandato (non implementato in questa Beta)

- **Modellazione del trasporto a livello di occorrenza attività** (§6): risolverebbe il limite "multi-attività stesso bambino/stesso giorno" con una chiave più granulare di `week_responsibilities` — richiederebbe una migration, esplicitamente esclusa da questa revisione.
- **Campo Note per singola assegnazione** nel Calendario (mostrato nel mockup grafico condiviso da Fabrizio, ma non implementato per esplicita istruzione della revisione: "NON implementare il campo Note mostrato nel concept grafico").
- **Nuova interpretazione del calendario** o una seconda fonte di verità per la copertura: esplicitamente vietata, mantenuta la fonte unica già in uso.

## Riferimenti commit

| Wave | Commit | Oggetto |
|---|---|---|
| 1 | `bb596a8` | Planner Overview simplification |
| 2 | `2edf54c` | Dettaglio Settimana + calcolo child-day |
| 3 | `b02c0e6` | Calendario — una sola card espansa |
| 4 | `d750582` | Activity Detail CTA booking-aware |
| 5 | `ffb9b82` | Centralizzazione versione Beta |
