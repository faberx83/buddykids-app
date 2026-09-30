
# TRAMA — FINAL PRODUCT STATE & DOCUMENTATION HANDOFF

**Post Beta v1.1.1 Reconciliation — 03/09/2026**
Repository e database come source of truth. Nessuna modifica al codice, nessun commit creato per questo report, nessuna migration applicata, nessuna nuova feature proposta — audit di sola lettura (Read/Grep/git log + query Supabase in sola SELECT).

Metodologia: dove non diversamente specificato, ogni affermazione è verificata leggendo il codice sorgente e/o interrogando in sola lettura il database di produzione (project `eagsgfxunwyyxwwilldy`). Questo ambiente non ha un browser reale: **nessuna voce di questo report è "LIVE VERIFIED"** in senso stretto (nessun click reale eseguito). La tassonomia di stato usata ovunque è:

- **IMPLEMENTED-STATIC-VERIFIED** — codice esiste, letto per intero, logica coerente e verificata.
- **IMPLEMENTED-LIVE-NOT-VERIFIED** — codice sembra completo ma dipende da dati/config runtime non ispezionabili da qui (es. variabili d'ambiente di Vercel).
- **PARTIAL** — parte del comportamento descritto esiste, parte no.
- **NOT IMPLEMENTED** — nessuna evidenza nel codice.
- **MOCK/DEMO** — pagina esistente ma collegata a dati statici (`lib/mock-data.ts`), non al database.

---

## 0. BASELINE TEMPORALE

| Campo | Valore |
|---|---|
| Branch corrente | `main` |
| HEAD | `af4f712` — `feat(bookings): distingue accettato/in attesa/rifiutato/lista d'attesa nella griglia Giorni spot` (03/09/2026 09:06) |
| Working tree | Pulito (nessuna modifica non committata) |
| Sync con `origin/main` | Non verificabile da questo ambiente (nessuna credenziale git configurata nel sandbox: `fatal: could not read Password for 'https://faberx83@github.com'`) — Fabrizio deve confermare che `main` locale sia allineato a `origin/main` prima di considerare questo audit rappresentativo di ciò che è (o sarà) in produzione. Il deploy stesso resta, per governance di sessione, un'azione che esegue solo Fabrizio.
| Baseline richiesta | `dbe3f77` — commit valido, presente nella storia di `main`. |
| Commit rilevanti da `dbe3f77` a HEAD | **20**, tutti datati 02–03/09/2026 (una sola giornata e mezza di lavoro, nessun commit precedente incluso per errore di baseline). |
| package.json version | `0.1.0` (invariata — non è un identificatore di release affidabile) |
| Ultima migration nota come applicata (da conversazione precedente, confermata via query `pg_constraint`) | migration_34 (`booking_days_waitlist`) — confermata APPLICATA sul DB reale. Migration_19 (`email_delivery_status`) risulta invece **non ancora applicata** per stessa fonte. Non ho ri-verificato l'intero elenco delle migration in questa sessione: raccomando a Fabrizio un controllo puntuale di `supabase/migration_*.sql` vs stato reale prima di citare questo dato altrove. |

---

## 1. EXECUTIVE PRODUCT STATE

TRAMA (ex BuddyKids) è oggi una piattaforma a due lati — famiglie e centri estivi/attività — con tre superfici applicative distinte che convivono nello stesso repository: **Legacy** (routing storico, es. `/prenotazioni`, `/center`), **NextGen** (`/nextgen/*`, `/center` resta condiviso per il Partner — vedi §11), e **TRAMA ONE** (`/one`, `/center/one`, `/admin/one`, gated dal flag `TRAMA_ONE_ENABLED`, oggi attivo solo per il cohort Beta controllata e per `platform_admin`).

Le ultime 20 commit (tutte del 2–3 settembre) sono quasi interamente concentrate su **un singolo problema end-to-end**: il flusso di accettazione delle prenotazioni "Giorni spot" (booking a giorno singolo, non a settimana intera) aveva una frattura strutturale — il centro poteva accettare i giorni uno per uno, ma né il Planner, né "Le mie prenotazioni", né l'Inbox del gestore, né l'Admin riflettevano correttamente l'esito parziale. Questo filone (root cause + fix + feature "conferma parziale" + lista d'attesa + bulk actions + disponibilità visibile + 3 bug di rifinitura scoperti in diretta da Fabrizio testando il fix) rappresenta la stragrande maggioranza del lavoro di questa finestra. Il resto (9 commit) copre: coerenza visiva legacy/nextgen residua, un fix semantico sul modello di "organizzazione familiare completa" (distinzione tra copertura-attività e completezza-coordinamento), il piano condiviso pubblico, e la navigazione dei Gruppi.

**In una frase**: TRAMA ha una base prodotto solida e reale (non demo) sul lato Parent e su gran parte del Partner/Admin, con un debito di parallelismo Legacy/NextGen ancora vivo, due superfici Admin esplicitamente mock (dashboard e catalogo attività), un impianto legale costruito ma spento (`LEGAL_TERMS_GATE` a `false` ovunque), e un impianto di analytics/KPI ancora troppo stretto per rispondere alle domande di business più ovvie (nessun evento su accettazione/rifiuto prenotazione, nessun evento su notifiche, nessun evento su Community).

---

## 2. RELEASE / TECHNICAL BASELINE — RICONCILIAZIONE COMMIT

| SHA | Data | Area prodotto | Cosa cambia (impatto utente) | Impatto documentazione |
|---|---|---|---|---|
| `6763b6b` | 02/09 | Infra/deploy | `DEPLOY_NOTIFY_SECRET` configurabile via `.env.deploy` — nessun impatto utente. | Nessuno. |
| `2ea8495` | 02/09 | Piano condiviso | Il link pubblico condiviso ora mostra correttamente prenotazioni "Giorni spot" (prima invisibili) e lo stato reale (`partner_decision`, non solo `status`). | Family deck: sezione "Piano condiviso" da aggiornare con lo screenshot nuovo. |
| `ed9ff65` | 02/09 | Gruppi | Il tasto "indietro" da un gruppo aperto dal Planner tornava sempre al Planner root, perdendo il tab "Gruppi". Ora torna al tab corretto. | Nessuno strutturale, solo UX polish. |
| `e80d1f0` | 02/09 | Chi fa cosa | L'assegnazione massiva Andata/Ritorno usava un modello a esclusione (niente selezionato = "tutto incluso", cliccare escludeva) — controintuitivo. Ora è a selezione positiva. | Family deck: eventuale screenshot di "Chi fa cosa" da rifare se mostra il vecchio pattern. |
| `76f6f1a` | 02/09 | Prenotazioni (root cause) | **Fix strutturale**: Planner e "Le mie prenotazioni" ora riflettono l'accettazione giorno-per-giorno del centro (prima mostravano lo stato aggregato `bookings.partner_decision`, mai aggiornato per prenotazioni a giorni). | Product Master: il modello dati booking day-based deve essere descritto correttamente. |
| `562f600` | 02/09 | Organizzazione | Introduce la distinzione formale "copertura attività" vs "completezza coordinamento" nel calcolo dello stato di organizzazione familiare. | **Alto impatto Product Master** — la promessa "100% organizzato"/"organizzazione completa" cambia definizione, vedi §4. |
| `e08fb34` | 02/09 | Home/Planner | Il gap di coordinamento (Andata/Ritorno non assegnati) diventa visibile in Home e Planner, aggregato su più settimane (prima non esisteva alcun calcolo aggregato). | Family deck: nuova sezione Home da documentare. |
| `feb38b7` | 02/09 | Piano condiviso | Il link pubblico condiviso ora mostra anche centro, indirizzo (+ link Maps), orari e "chi fa cosa" per i giorni effettivamente prenotati. | Family deck: nuovo screenshot piano condiviso. |
| `2f81764` | 02/09 | Planner | L'alert del gap di coordinamento nel Coverage Hero non reagiva al click (bug di routing Next.js — stessa route montata, stato mai riletto). Ora funziona. | Nessuno strutturale. |
| `bd562a7` | 02/09 | UI globale | Sfondo globale (`body`, `.app-backdrop`) ancora sui toni pre-rebrand (azzurrino) invece della palette "trama" calda. | Nessuno strutturale — solo visivo. |
| `5f57372` | 02/09 | UI "Modifica prenotazione" | Pagina 100% legacy nonostante il resto del flusso booking avesse già la modalità nextgen. Ora dual-mode come le altre. | Nessuno strutturale. |
| `143f933` | 02/09 | UI booking | "Totale" nel riepilogo prenotazione restava blu legacy anche in modalità nextgen. Corretto. | Nessuno strutturale. |
| `dfc2fc7` | 02/09 | Prenotazioni (Partner/Admin) | **Fix strutturale gemello di `76f6f1a`**: l'Inbox del gestore (`/center/prenotazioni`) e l'Admin (`/admin/bookings`) non riflettevano l'accettazione giorno-per-giorno — una prenotazione accettata su tutti i giorni singolarmente restava "Da rispondere". Introduce anche il primo stato "conferma parziale". | **Alto impatto Product Master/Partner deck** — comportamento centrale del flusso di accettazione Partner cambia. |
| `f292bf1` | 02/09 | Prenotazioni | Ridefinizione di "conferma parziale": scatta anche mentre restano giorni non ancora decisi dal centro (non solo a risposta completata). | Come sopra. |
| `10e6df8` | 02/09 | Prenotazioni (Partner) | Il gestore ora vede i posti residui PRIMA di decidere se accettare (dato esistente in DB, mai letto fino ad ora). | Partner deck: nuovo elemento UI da documentare. |
| `4236270` | 02/09 | Prenotazioni (Partner) | Accetta/rifiuta in blocco su tutte le richieste selezionate (prima solo singolarmente). | Partner deck: nuova funzione bulk. |
| `5c968a3` | 02/09 | Prenotazioni (Parent) | Badge "In lista d'attesa" visibile in app al genitore (prima solo via email). | Family deck: nuovo stato prenotazione da documentare. |
| `d0ddedb` | 03/09 | UI Prenotazioni (Parent) | Fix rifinitura: il badge "Confermata parzialmente" con nota lunga sfondava il bordo della card. | Nessuno strutturale. |
| `030bcfa` | 03/09 | UI Prenotazioni (Partner) | Fix rifinitura: i giorni "Giorni spot" nell'Inbox del gestore comparivano in ordine non cronologico; didascalia "Stato prenotazione" priva di separazione visiva. | Nessuno strutturale. |
| `af4f712` | 03/09 | Prenotazioni (Parent) | **Ultimo fix della catena**: la griglia "Giorni spot" nel dettaglio attività mostrava ogni giorno prenotato come "Prenotato" indipendentemente dall'esito reale (accettato/in attesa/rifiutato/lista d'attesa erano visivamente indistinguibili). Ora 4 stati distinti; un giorno rifiutato torna selezionabile per una nuova richiesta. | **Family deck** — nuovo comportamento visibile nel flusso di prenotazione. |

**Nota sulla baseline**: `dbe3f77` è confermata come baseline valida (commit presente nella storia). Tutti i 20 commit ricadono in un'unica finestra di lavoro di circa 30 ore (02/09 mattina → 03/09 mattina), interamente guidata da segnalazioni dirette di Fabrizio in beta testing, non da un piano di sprint precedente.

---

## 3. PARENT CAPABILITY MAP

Legenda stato come in premessa. Fonte: lettura diretta di `app/`, `lib/data/`, `lib/nextgen/` + query Supabase.

| Capability | Stato | Note/evidenza |
|---|---|---|
| Ricerca/Scopri attività | IMPLEMENTED-STATIC-VERIFIED | `app/nextgen/search/SearchDiscoveryClient.tsx`, filtri reali su DB. |
| Dettaglio attività + booking (settimana intera) | IMPLEMENTED-STATIC-VERIFIED | `app/activity/[id]/DetailClient.tsx`, `app/booking/[id]/`. |
| Dettaglio attività + booking ("Giorni spot") | IMPLEMENTED-STATIC-VERIFIED | Vedi §2, ultimo commit `af4f712` chiude l'ultimo gap noto (stato per giorno). |
| Modifica prenotazione (add/remove giorni) | IMPLEMENTED-STATIC-VERIFIED | `app/prenotazioni/[id]/modifica/` — nota: qui `bookedDayDates` ha significato diverso (giorni prenotati ALTROVE), non ancora esteso con la stessa distinzione per-decisione di `af4f712` — **gap aperto**, vedi §23. |
| Annulla prenotazione | IMPLEMENTED-STATIC-VERIFIED | Finestra di preavviso configurabile dal centro, verificata server-side. |
| Le mie prenotazioni (Elenco/Copertura/Calendario) | IMPLEMENTED-STATIC-VERIFIED | `app/(main)/prenotazioni/PrenotazioniClient.tsx`, badge stato ricco (confermata/parziale/lista d'attesa/proposta). |
| Home — coverage hero, "organizzazione completa" | IMPLEMENTED-STATIC-VERIFIED (con caveat) | Vedi §4/§5 — il calcolo distingue correttamente copertura attività da completezza coordinamento dal 02/09, ma non segnala nell'hero le prenotazioni ancora "in attesa del centro" quando la copertura è già 100%. |
| Home — prossimo appuntamento (CTA) | PARTIAL | Guidato solo da `booking.status`/`firstWeekStart`, non legge `partnerDecision`/`waitlistedDayCount` — una prenotazione "parziale" o "in lista d'attesa" non è distinta qui. Vedi §5. |
| Planner — Organizzazione (coverage hero + timeline) | IMPLEMENTED-STATIC-VERIFIED | §6. |
| Planner — Calendario | IMPLEMENTED-STATIC-VERIFIED | Collassato dentro "Organizzazione", non più tab separato. |
| Planner — Budget | IMPLEMENTED-LIVE-NOT-VERIFIED | Tab esistente (`components/nextgen/PlannerBudgetView.tsx`), non ispezionato in profondità in questa sessione. |
| Planner — Gruppi | IMPLEMENTED-STATIC-VERIFIED | Condiviso con `/nextgen/groups`. |
| Chi fa cosa (Andata/Ritorno) | IMPLEMENTED-STATIC-VERIFIED | Modello a 6 responsabili (`io/partner/nonno/nonna/tata/altro`), limite noto: non è scoperto per attività quando due attività diverse cadono sullo stesso giorno/bambino (vedi §4). |
| Piano condiviso (link pubblico) | IMPLEMENTED-STATIC-VERIFIED / IMPLEMENTED-LIVE-NOT-VERIFIED | Codice completo (§8), ma il percorso arricchito richiede `SUPABASE_SERVICE_ROLE_KEY` lato server — non verificabile da qui se è impostata in produzione; se assente degrada silenziosamente alla versione pre-fix (senza errore visibile). |
| Gruppi (sconto famiglia) | IMPLEMENTED-STATIC-VERIFIED | Tabelle live con dati reali, "Scopri"/"Inviti" con logica reale dal 24/08 (migration_25) — nota: `lib/feature-registry/catalog.ts` la classifica ancora come `INCOMPLETE` con testo obsoleto, **discrepanza documentale da correggere**. |
| Carpool | IMPLEMENTED-STATIC-VERIFIED (scope limitato) | Solo suggerimento/matching, nessuna prenotazione/assegnazione vincolante — di proposito. |
| Community | PARTIAL | Codice completo, tabelle DB vuote (0 righe) — feature mai realmente esercitata in produzione. |
| Notifiche in-app (bell/Notification Center) | IMPLEMENTED-STATIC-VERIFIED | DTO calcolato, non una tabella persistita — 10 tipi di notifica coperti. |
| Notifiche push | PARTIAL | Infrastruttura reale (Web Push + VAPID), ma **booking accettato/rifiutato non genera push** (solo "proposed"), e il toggle "Notifiche push" nelle preferenze non è enforced server-side (la spedizione ignora `profiles.notify_push`). |
| Notifiche SMS | NOT IMPLEMENTED | Solo il toggle esiste in UI/DB, nessun codice di invio. |
| Profilo/Account (dati, figli, preferenze, privacy, sicurezza) | IMPLEMENTED-STATIC-VERIFIED | Incluso il flusso "modifica caratteristiche figlio" (età), da lavoro di sessioni precedenti. |
| Cancellazione account (GDPR) | PARTIAL | Solo richiesta (flag `deletion_requested`), cancellazione reale è intervento manuale `platform_admin`, nessuna cancellazione automatizzata, nessun export dati. |
| Certificazioni centro (badge fiducia) | IMPLEMENTED-STATIC-VERIFIED | Solo certificazioni approvate da un Admin piattaforma. |
| Preferiti | IMPLEMENTED-STATIC-VERIFIED | — |
| Presenze (calendario presenze bambino) | IMPLEMENTED-STATIC-VERIFIED | `components/PresenzeView.tsx`, condiviso legacy/nextgen. |
| Onboarding Beta (carosello) | IMPLEMENTED-STATIC-VERIFIED | 5 slide, WCAG-AA, persistito via `tutorial_progress`, gated al cohort Beta. |
| Contatta il gestore / Richieste (ticketing) | IMPLEMENTED-STATIC-VERIFIED | Con push su nuova richiesta/risposta. |
| Servizi consigliati (Partner offers, lato Parent) | IMPLEMENTED-STATIC-VERIFIED / MOCK-fallback | Reale se Supabase configurato, mock solo come fallback esplicito. |
| Privacy/Termini (accettazione consensi) | PARTIAL — READY_OFF | Codice completo, gate `LEGAL_TERMS_GATE` a `false` per tutti — vedi §14. |
| Legal pages pubbliche (`/privacy`, `/terms`) | PARTIAL | Pagine funzionanti ma **0 righe** in `legal_documents` — mostrano "Documento in preparazione" per chiunque. |

---

## 4. ORGANIZATION MODEL — REGOLE DI BUSINESS (derivate dal codice)

Fonte unica di verità: `lib/nextgen/week-roles.ts` + `lib/data/planner.ts`. Non un'interpretazione — sono le funzioni pure effettivamente eseguite.

**Activity Coverage** (`lib/data/planner.ts`): una settimana è `covered = true` non appena esiste **almeno una prenotazione** (qualsiasi stato: anche solo richiesta, non ancora accettata dal centro) per almeno un figlio. La conferma del centro è tracciata a parte come `awaitingPartnerConfirmation` e non influisce sul calcolo di copertura.

**Coordination Coverage** (`lib/nextgen/week-roles.ts`, `computeRolesToCover`):
```
SUM( GIORNI-BAMBINO REALMENTE PRENOTATI × {ANDATA, RITORNO} ) − RESPONSABILITÀ ASSEGNATE = RUOLI DA COPRIRE
```
Limite noto e documentato nel codice stesso: la chiave di aggregazione è `bambino__giorno-settimana__momento`, **non** per-attività — se lo stesso bambino ha due attività diverse lo stesso giorno, collassano in un solo slot Andata + un solo slot Ritorno invece di due. Non è un bug silente: è commentato esplicitamente come "CURRENT DOMAIN LIMITATION".

**Full Organization** (`computeOrganizationState`):
```js
if (!activityCoverageComplete) return "activity_gap";
if (missingCoordinationCount > 0) return "coordination_gap";
return "full";
```
La copertura attività domina sempre: un gap di coordinamento non può mai mascherare un gap di attività, e viceversa i due badge non compaiono mai insieme nella stessa vista.

**Conseguenza pratica non ancora risolta** (osservazione emersa da questo audit, non un bug dei fix recenti): poiché `covered` conta anche prenotazioni **non ancora accettate dal centro**, è possibile che l'Hero di Home/Planner mostri "organizzazione completa" (100%, tutto verde) mentre una o più prenotazioni sono ancora "in attesa" o "confermate parzialmente" presso il centro. Questo segnale esiste ed è mostrato correttamente altrove (badge in "Le mie prenotazioni", §3), ma non nell'Hero stesso — vedi gap aperto in §23.

---

## 5. HOME

File: `app/nextgen/page.tsx`, `app/nextgen/HomeDashboardClient.tsx`.

- **Messaggio "Organizzata al N%"**: `percent = coveredNeededCount / neededCount`, solo Activity Coverage. Se esiste un gap di coordinamento, il valore percentuale non viene mostrato affatto — sostituito da "✓ Attività organizzate" + una riga secondaria sui passaggi Andata/Ritorno ancora da assegnare. Le due condizioni sono mutuamente esclusive per costruzione: non capita mai di vedere contemporaneamente un gap attività e un gap coordinamento nello stesso hero. **IMPLEMENTED-STATIC-VERIFIED.**
- **Andata/Ritorno**: prima del 02/09 (`e08fb34`) Home non aggregava affatto i passaggi mancanti su più settimane — oggi lo fa, sommando su tutte le settimane future rilevanti. Resta il limite strutturale di §4 (collisione multi-attività stesso giorno).
- **CTA "prossimo appuntamento"**: seleziona la prenotazione attiva più vicina per data (`booking.status !== "cancelled"`, ordinata per `firstWeekStart`). **Non legge `partnerDecision`** — una prenotazione "parziale" o "in lista d'attesa" appare con lo stesso badge generico di una "confermata" piena. Questo è un gap reale, dato che l'informazione più ricca (`acceptedDayCount`, `waitlistedDayCount`, ecc.) esiste già in `MyBooking` ed è usata altrove (§3). **PARTIAL.**

---

## 6. PLANNER

File: `app/nextgen/planner/PlannerClient.tsx`, `components/nextgen/PlannerCalendarView.tsx`.

Struttura: 4 tab — Organizzazione / Mappa / Budget / Gruppi. "Calendario" non è più un tab a sé (rimosso in uno sprint correttivo precedente), vive dentro "Organizzazione" come pannello collassabile "Calendario e Chi fa cosa?".

**Coverage Hero**: due rami — (a) settimane future rilevanti presenti → barra di progresso + "prossimo passo" + (dal 02/09) bottone secondario per il gap di coordinamento, mostrato solo quando non c'è già un gap di copertura attività da chiudere; (b) nessuna settimana futura rilevante → riepilogo di fine stagione.

**Bug chiuso il 02/09** (`2f81764`): l'alert del gap di coordinamento era un link verso la stessa route montata (`?mode=calendario&week=...`), che Next.js App Router non rimonta — lo stato locale (`useState` letto una sola volta al mount) non si aggiornava mai. Risolto convertendo l'alert in un bottone che imposta lo stato direttamente, con un pattern "adjusting state during render" scelto esplicitamente per rispettare la regola lint `react-hooks/set-state-in-effect` del repo invece di un `useEffect`.

Planner e Home condividono le stesse funzioni pure (`computeCoordinationGap`, `computeOrganizationState`) — nessuna logica divergente tra le due viste. **IMPLEMENTED-STATIC-VERIFIED.**

---

## 7. "CHI FA COSA"

Modello dati: `week_responsibilities`, una riga per `(genitore, figlio, settimana, giorno, momento)`. Responsabile: `io | partner | nonno | nonna | tata | altro` (con possibilità di persona custom persistita o etichetta libera per "altro"). L'etichetta "partner" è contestuale al ruolo del genitore che guarda (Mamma/Papà), mai dedotta da nome/genere.

**Fix 02/09 (`e80d1f0`)**: il bulk-assign per Andata/Ritorno era un modello a esclusione (nessuna selezione = "tutto incluso", cliccare un'etichetta la escludeva) — comportamento opposto a quanto un click normalmente implica. Ora è a selezione positiva esplicita, con l'assegnazione disabilitata finché non è selezionato almeno un momento.

L'overwrite dell'assegnazione massiva copre sempre tutti e 5 i giorni feriali per ogni figlio/momento selezionato (comportamento voluto e ora reso esplicito in UI, non un nuovo modale). **IMPLEMENTED-STATIC-VERIFIED.**

---

## 8. PIANO CONDIVISO (SHARE)

Fix 02/09 (`feb38b7` + `2ea8495`). Ora il link pubblico mostra: nome/indirizzo centro (+ link "Naviga" verso Google Maps), orari, giorni, e "chi fa cosa" per weekday effettivamente prenotati da quel figlio (mai una griglia fittizia a 5 giorni; slot non assegnati → "Da assegnare", mai un'assegnazione inventata).

**Root cause del bug precedente**: la funzione SQL `get_shared_plan()` leggeva solo `booking_weeks`, mai `booking_days` — le prenotazioni "Giorni spot" erano invisibili nel piano condiviso pur essendo visibili nel Planner. Usava anche `bookings.status` invece di `partner_decision`, mostrando "Confermata" anche per prenotazioni non ancora accettate dal centro. Fix: nuova query applicativa lato server (service-role) che legge entrambe le tabelle e deriva lo stato da `partner_decision`.

**Caveat non risolvibile da questo ambiente**: il percorso arricchito si attiva solo se `SUPABASE_SERVICE_ROLE_KEY` è impostata nell'ambiente di deploy — non presente in `.env.local`/`.env.example` di questo checkout (solo in `.env.test`). Se assente in produzione, la feature degrada silenziosamente al comportamento pre-fix, senza errore visibile. **Fabrizio deve confermare che questa variabile sia impostata su Vercel prima di considerare questa feature pienamente attiva in produzione.**

---

## 9. GROUPS / COMMUNITY / CARPOOL

**Gruppi**: feature reale, non uno stub — tabelle live con dati reali (`groups`, `group_members`, `group_kids`, `group_subgroups`). Sconto a scaglioni configurabile per centro. "Scopri" e "Inviti" hanno logica reale dal 24/08 (migration_25) — prima erano testo statico "funzionalità in arrivo".

⚠️ **Discrepanza documentale trovata**: `lib/feature-registry/catalog.ts` classifica ancora `groups_discover_invites` come `INCOMPLETE` con la descrizione obsoleta pre-24/08. Il codice reale è avanti rispetto al catalogo — da correggere nel catalogo, non da fraintendere come feature ancora mancante.

**Carpool**: matching di offerte/richieste passaggio scoped dentro un Gruppo, con notifiche di match — esplicitamente solo un livello di suggerimento, nessuna prenotazione o assegnazione vincolante del passaggio.

**Community** (distinta dai Gruppi: multi-attività e persistente, non a scadenza singola attività): codice server-side completo (creazione, join by-code, proposte di attività, voto/interesse, conversione proposta→gruppo), ma le 4 tabelle dedicate hanno **0 righe** in produzione — feature mai realmente esercitata. **PARTIAL.**

---

## 10. NOTIFICATIONS / PUSH

**Infrastruttura push**: reale, Web Push + VAPID, self-cleaning delle subscription scadute, best-effort (non blocca mai il flusso principale).

**Matrice trigger attuali**: invito a gruppo, richiesta sconto gruppo (al centro), nuova richiesta/risposta ticketing, nuova prenotazione (al centro), **proposta alternativa del centro** (al genitore). Esplicitamente **NON** instrumentato: booking accettato, booking rifiutato, giorno promosso da lista d'attesa — tutti questi restano solo via email, per una scelta di scope P0 documentata nel codice stesso, non per dimenticanza.

**Gap trovato**: il toggle "Notifiche push" nelle Preferenze scrive su `profiles.notify_push`, ma `lib/push/send.ts` non legge mai quella colonna prima di inviare — disattivare il toggle non impedisce realmente l'invio.

**SMS**: solo un toggle UI/colonna DB, nessun codice di invio reale. **NOT IMPLEMENTED.**

**Notification Center in-app**: separato dal push, DTO calcolato al volo (mai una tabella `notifications` persistita), 10 tipi coperti, bell icon in entrambe le shell Parent/Partner. **IMPLEMENTED-STATIC-VERIFIED**, indipendente dal push.

---

## 11. PARTNER (GESTORE)

Enumerazione completa di `app/center/`: Attività (CRUD + calendario/capacità), Prenotazioni (Inbox, oggetto di quasi tutti i fix di questa finestra), Presenze + Report presenze, Richieste Gruppo, Le mie richieste (ticketing genitori), Promozioni, Servizi consigliati, Inviti team, Profilo centro, Account. Tutte **IMPLEMENTED-STATIC-VERIFIED** con dati reali da Supabase.

**Correzione a un'assunzione dell'audit originale**: non esiste, lato Partner, il pattern "prop `nextgen` per pagina" usato lato Parent. Il dual-mode TRAMA ONE per il Partner è invece una **shell di route parallela** (`/center/one/*`), gated dallo stesso flag, che **reindirizza a `/center` (legacy) se il flag è spento**. La route `/center/one` stessa è esplicitamente marcata "INTERNAL_ONLY" nel codice — nessuna voce di menu la espone. Di conseguenza: **tutte le pagine Partner elencate sopra sono al 100% in stile legacy**, con solo due iniezioni nextgen-adjacent nella UI legacy (tour "PartnerSpotlight" e widget feedback beta, entrambi non invasivi sul layout).

---

## 12. ADMIN

| Pagina | Stato |
|---|---|
| Dashboard `/admin` | **MOCK/DEMO** — sempre, non solo come fallback. Auto-dichiarato nel codice: "la superficie operativa canonica della Beta è `/admin/one`". |
| `/admin/activities` | **MOCK/DEMO** — sempre. |
| `/admin/analytics` | PARTIAL — tabella Gestori reale, resto (grafico occupancy, breakdown tag/età) mock. |
| Centri, Prenotazioni, Richieste Gruppo, Richieste SLA, Certificazioni, Presenze (overview), Preferiti (demand signal), Fornitori, Segnalazioni Beta, Segnalazioni centri, Feature flag, Inviti Beta, Documenti legali (view-only), Tag | Tutte **IMPLEMENTED-STATIC-VERIFIED**, dati reali. |
| Command Center (`/admin/one`) | IMPLEMENTED-STATIC-VERIFIED, gated — 7 code operative reali + link a Pilot dashboard. |
| Onboarding review, Pilot dashboard (`/admin/one/*`) | IMPLEMENTED-STATIC-VERIFIED, gated. |
| **Impersonazione utente** | **NOT IMPLEMENTED** — zero riferimenti nel codice. |

Le due superfici mock (dashboard root, `/admin/activities`) sono un debito noto e auto-dichiarato dal codice stesso (banner obbligatorio previsto), non una scoperta di questo audit — ma vale la pena riportarlo esplicitamente nel Product Master perché un lettore esterno del solo dashboard potrebbe scambiarlo per la superficie reale.

---

## 13. BETA ENTRY / ONBOARDING / PILOT JOURNEY

**Parent**: self-signup aperto, nessun invito obbligatorio. Due codici opzionali via query string: `?invite=` (sconto centro, promo business) e `?beta=` (eleggibilità Beta, verificata server-side con stati redeemable/inactive/expired/exhausted). Routing post-login a NextGen solo se `role=parent` **e** `TRAMA_ONE_ENABLED` risolve vero.

**Partner**: nessuna auto-registrazione. Solo candidatura pubblica (`/auth/candidati`) → nessun account creato, solo un record di lead → approvazione admin → email con link diretto di signup.

**Legal Gate**: costruito per intero (checkbox Termini/Privacy, opt-in marketing, dichiarazione responsabilità genitoriale alla creazione figlio) ma **`LEGAL_TERMS_GATE` a zero override nel DB** — confermato via query diretta, non solo per assunzione: si risolve sempre al default `false`.

**Query `beta_feedback` (56 righe totali, in sola lettura)**:
- Stato: 52 `nuovo`, 4 `risolto`.
- Area: Planner 43 (76% del totale), poi Profilo, Scopri, Prenotazioni, Home a 1-3 ciascuna.
- Le due segnalazioni più recenti prima di questa sessione (01/09 e 02/09, entrambe su `/center/prenotazioni`) descrivono esattamente il problema di "conferma parziale"/"seleziona tutto giorni" chiuso in questa stessa finestra di lavoro — **ma il loro `status` risulta ancora `nuovo`**, non aggiornato a `risolto` nonostante il fix sia in `main`. Segnalo questo come una lacuna di igiene amministrativa (52 righe su 56 non hanno mai ricevuto un aggiornamento di stato), non come un problema di prodotto.

**Feature flags — stato live** (query diretta su `feature_flag_overrides`):

| Flag | Stato globale | Override attivi |
|---|---|---|
| `TRAMA_ONE_ENABLED` | OFF globale | ON per cohort `trama-one-controlled-beta` (6 utenti, scade 02/10/2026) e per ruolo `platform_admin` (permanente) |
| `LEGAL_TERMS_GATE` | OFF | Nessun override — mai acceso per nessuno |

Codice beta invite attivo: `TRAMABETA26`, illimitato, 2 redenzioni finora, scade 01/11/2026.

---

## 14. LEGAL / PRIVACY / DATA READINESS

| Elemento | Stato |
|---|---|
| Gate consensi (Termini/Privacy/Marketing + dichiarazione genitoriale) | Costruito, **READY_OFF** — confermato spento per chiunque via query diretta. |
| Contenuto legale reale (`legal_documents`) | **0 righe in produzione** — `/privacy` e `/terms` mostrano "Documento in preparazione" per chiunque, non un placeholder generico ma un dato di fatto verificato via query. |
| Export/cancellazione dati (GDPR) | PARTIAL — solo richiesta di cancellazione (flag), esecuzione reale è intervento manuale `platform_admin` senza SLA; nessun export/portabilità dati implementato. |
| Cookie banner | **NOT IMPLEMENTED** — zero componenti applicativi, solo una menzione in un documento di gap-analysis interno. |
| RLS `legal_documents` | Nota tecnica minore: policy SELECT solo per `authenticated`, nessuna per `anon` — innocuo oggi (0 righe) ma bloccherebbe le pagine pubbliche se il contenuto venisse pubblicato senza correggere anche questo. |

---

## 15. KPI / NORTH STAR — RICONCILIAZIONE

Nessun SDK di analytics di terze parti (verificato: zero hit reali per posthog/mixpanel/gtag/amplitude). Tutto passa da `lib/telemetry/events.ts::persistProductEvent()`, che scrive su `product_events` **solo** se il nome evento è nella whitelist `KNOWN_PRODUCT_EVENTS` — scelta deliberata anti-PII, non un limite tecnico.

**Eventi realmente strumentati oggi** (con conteggio reale su 2209 righe totali in `product_events`): `walkthrough_step_started` (725), `one_route_access` (588), `spotlight_target_not_found` (506), `spotlight_shown` (291), `walkthrough_step_completed` (32), `walkthrough_step_skipped` (29), `spotlight_dismissed` (26), `walkthrough_restarted` (6), `booking_created` (3), `one_route_fallback` (1), `carpool_offer_created` (1), `group_created` (1). Definiti ma mai ancora scattati: `group_joined`, `carpool_request_created`.

**Reconciliation per il Product Master**: la strumentazione attuale copre bene onboarding/adozione beta (walkthrough, spotlight, route access) e pochissimo altro. **Non esiste alcun evento** su: esito accettazione/rifiuto/lista-attesa prenotazione, attività di messaggistica/ticketing, apertura/click di una notifica push, uso di Community. Qualunque KPI North Star che voglia misurare "tasso di conferma prenotazioni" o "efficacia notifiche" richiede nuovi call-site di instrumentazione, non solo nuove query — questo è probabilmente il gap più concreto per chi deve scrivere KPI nel Product Master.

---

## 16. VALUE PROPOSITION — EVIDENZA

| Promessa | Evidenza a supporto | Stato |
|---|---|---|
| "Organizza tutte le attività extra-scolastiche dei tuoi figli in un posto solo" | Planner + Home coverage hero, modello Activity/Coordination Coverage reale e testato su dati reali (19 bookings attivi, 16 booking_days, 38 week_responsibilities). | Supportata, con il limite noto del multi-attività-stesso-giorno (§4). |
| "Sai sempre chi accompagna e chi ritira" | "Chi fa cosa" — modello dati reale, bulk assign ridisegnato il 02/09. | Supportata. |
| "Prenota anche solo i giorni che ti servono" | "Giorni spot" — flusso completo, ultimo gap di visibilità stato-per-giorno chiuso il 03/09 (`af4f712`). | Supportata, ora più solida che a inizio settimana. |
| "Il centro ti risponde e tu lo sai sempre" | Catena di fix 02–03/09 su conferma parziale/lista d'attesa/badge — prima di questa finestra era il punto più debole del prodotto (bug strutturale confermato su dati reali di produzione). | Ora supportata; era la promessa più a rischio prima di questa finestra di lavoro. |
| "Condividi il piano con chi ti aiuta" | Piano condiviso pubblico, arricchito il 02/09 — ma dipende da una variabile d'ambiente non verificabile da qui (§8). | Supportata con riserva (verifica env richiesta a Fabrizio). |
| "I tuoi dati sono al sicuro" (compliance) | Gate legale costruito ma spento, 0 documenti legali pubblicati, nessun cookie banner. | **Non supportata oggi** — promessa non ancora attivabile in produzione. |

---

## 17. KILLER APPLICATIONS — RANKING

1. **Accettazione prenotazioni giorno-per-giorno con stato reale ovunque** (Planner, Le mie prenotazioni, Inbox gestore, Admin) — differenzia TRAMA da una semplice lista di richieste; appena resa solida da questa finestra di lavoro.
2. **Coverage Hero con distinzione Activity/Coordination** — nessun concorrente "banale" calendario-attività separa esplicitamente "hai prenotato" da "hai organizzato chi accompagna".
3. **Chi fa cosa con responsabili persistenti custom** (non solo Mamma/Papà) — copre famiglie allargate/nonni/tate, raro nei prodotti di settore.
4. **Piano condiviso pubblico senza login** — abbassa l'attrito per chi aiuta (nonni, tate) a restare informato senza dover creare un account.
5. **Lista d'attesa automatica su capacità esaurita** (vs. rifiuto secco) — meccanismo silenzioso ma concreto per non perdere una famiglia interessata.

---

## 18. DOCUMENTATION DELTA

Documenti esistenti più rilevanti trovati in `docs/trama-one/`:

| Documento | Ultimo aggiornamento noto | Delta rispetto allo stato reale di oggi |
|---|---|---|
| `analysis/TRAMA_PLATFORM_PRODUCT_TRUTH.md` | 25/08/2026 | Documento di audit precedente, struttura simile a questa. Confermava già i due mock Admin (§12) — ancora veri oggi, nessun regresso. Da aggiornare con: fix conferma parziale/lista d'attesa (§2), nuovo modello Organization (§4), stato reale Gruppi/Community (§9, incluso il catalogo disallineato). |
| `analysis/TRAMA_CAPABILITY_COMPLETENESS_MATRIX.md` | Non verificato in questa sessione | Da incrociare riga-per-riga con la Parent Capability Map di §3 — non ho fatto un diff puntuale, solo letto la sua esistenza. |
| `analysis/TRAMA_BETA_ROADMAP_EXTERNAL.md` | Non verificato in questa sessione | Input principale per §22 — da leggere per intero prima di scrivere la roadmap definitiva. |
| `analysis/TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md` | Non verificato in questa sessione | Probabilmente già copre §14 in dettaglio — da riconciliare per evitare duplicazione. |
| `lib/feature-registry/catalog.ts` (non un doc `.md`, ma fonte di verità auto-dichiarata nel codice) | — | Contiene una voce stale confermata (`groups_discover_invites` ancora `INCOMPLETE`, §9) — correzione consigliata direttamente nel codice/commento, non solo nella documentazione esterna. |

**Nota importante**: non ho letto per intero tutti i documenti sopra (solo header/grep mirati) — questo report non sostituisce una riconciliazione riga-per-riga con ciascuno, ma fornisce lo stato-di-fatto verificato da codice/DB con cui riconciliarli.

---

## 19. DECK UPDATE MAP

Non esistono file `.pptx`/`.potx` nel repository. Gli artefatti più vicini a un "deck" sono 4 documenti Word in `docs/trama-one/`:

| Documento | Sezioni da aggiornare secondo questo audit |
|---|---|
| `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx` (Family) | Flusso prenotazione Giorni spot (nuovi 4 stati), Home coverage hero (nuova distinzione Activity/Coordination), Piano condiviso (nuovo contenuto), Chi fa cosa (nuovo bulk assign). |
| `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx` | Inbox prenotazioni (conferma parziale, bulk accetta/rifiuta, disponibilità visibile, ordine cronologico) — è l'area con più delta di questa intera finestra. |
| `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx` | Vista Admin prenotazioni (stessa logica di conferma parziale), promemoria sui due mock (dashboard/attività) se non già presenti. |
| `TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx` | Non toccato da questa finestra di lavoro (competitive intelligence, non stato prodotto) — nessun delta noto. |

Se esiste altrove (fuori repo) un vero deck `.pptx` per Family/Partner, non è raggiungibile da questo ambiente — Fabrizio dovrà indicarne la posizione per una mappatura più precisa.

---

## 20. SCREENSHOT MANIFEST

| ID | Route | Cosa mostrare | Priorità |
|---|---|---|---|
| P-01 | `/nextgen` (Home) | Coverage hero con gap di coordinamento visibile (non solo attività) | Alta |
| P-02 | `/nextgen/prenotazioni` | Card "Confermata parzialmente (N di M giorni)" con nota separata (post-fix `d0ddedb`) | Alta |
| P-03 | `/nextgen/prenotazioni` | Card "In lista d'attesa" | Alta |
| P-04 | `/activity/[id]` | Griglia "Giorni spot" con i 4 stati distinti (post-fix `af4f712`) | Alta |
| P-05 | `/nextgen/planner` | Coverage Hero + alert coordinamento cliccabile | Media |
| P-06 | `/nextgen/planner` (Chi fa cosa) | Bulk assign a selezione positiva | Media |
| P-07 | `/share/planner/[token]` | Piano condiviso arricchito (centro, indirizzo, orari, chi fa cosa) | Media |
| P-08 | `/nextgen/groups` | Tab "Scopri"/"Inviti" con logica reale | Bassa |
| PT-01 | `/center/prenotazioni` | Richiesta con badge "Confermata parzialmente" + posti residui visibili prima di decidere | Alta |
| PT-02 | `/center/prenotazioni` | Giorni in ordine cronologico corretto (post-fix `030bcfa`) | Alta |
| PT-03 | `/center/prenotazioni` | Toolbar bulk "Accetta/Rifiuta selezionate" | Alta |
| PT-04 | `/center/prenotazioni` | Giorno "In lista d'attesa" con bottone "Promuovi" | Media |
| PT-05 | `/center/activities/[id]/calendar` | Vista capacità/spots_left | Bassa |
| PT-06 | `/center/report-presenze` | Grafici trend/tasso presenze | Bassa |
| A-01 | `/admin/bookings` | Badge "Confermata parzialmente" lato Admin | Media |
| A-02 | `/admin/one` (Command Center) | 7 code operative reali | Media |
| A-03 | `/admin` (root) | **Da mostrare con banner mock esplicito**, mai come rappresentativo dello stato reale | Bassa |

---

## 21. CORE PROCESS MAPS

### Family Core Flow (prenotazione Giorni spot, end-to-end, stato al 03/09/2026)
1. Genitore cerca/apre un'attività (`/activity/[id]`) → vede griglia "Giorni spot" con eventuali giorni già prenotati distinti per stato (accettato/in attesa/rifiutato/lista d'attesa).
2. Seleziona N giorni (minimo configurabile dal centro) → checkout → `bookings` + N righe `booking_days`, tutte `partner_decision = pending`.
3. Il centro risponde giorno per giorno (§11) → `effectiveDayBasedDecision` aggrega lo stato: tutto accettato → "accepted"; tutto rifiutato → "rejected"; almeno un giorno accettato ma non tutti (indipendentemente dal resto) → **"partial"**; nessun giorno accettato → "pending".
4. Se un giorno è pieno al momento dell'accettazione → `waitlisted`, non un rifiuto — email al genitore, badge dedicato in "Le mie prenotazioni", nessuna promozione automatica (solo bottone manuale "Promuovi" lato centro).
5. Il genitore vede lo stato aggiornato in: Home (CTA prossimo appuntamento — **non distingue parziale/lista d'attesa**, §5), "Le mie prenotazioni" (badge ricco e corretto), Planner (coverage hero, corretto), Piano condiviso (se attivo, corretto).
6. Il genitore può modificare (aggiungere/rimuovere giorni) o annullare, rispettando la finestra di preavviso del centro.

### Partner Core Flow (risposta a una richiesta di prenotazione, stato al 03/09/2026)
1. Nuova prenotazione → push + notifica in-app al centro.
2. Il centro apre `/center/prenotazioni` → vede la richiesta con: nome/email genitore, figli, se "Giorni spot" i giorni in ordine cronologico (post-fix `030bcfa`) con posti residui visibili PRIMA di decidere (`spots_left`, mai contaminato da altre richieste pending).
3. Risposta: singolo giorno (Accetta/Rifiuta), bulk su giorni selezionati, o bulk su tutte le richieste pending della pagina.
4. Se accetta e la capacità è esaurita nel frattempo → `waitlisted` automatico (mai un errore silenzioso, mai un overbooking).
5. Lo stato aggregato (`partnerDecision`) si aggiorna correttamente per l'Inbox stessa (fix `dfc2fc7`) e per l'Admin (`app/admin/bookings`).
6. Il "Da rispondere" (KPI/filtro Inbox) usa `bookingNeedsAction()` — non più il solo `partnerDecision === "pending"` — per non perdere di vista una prenotazione "parziale" con ancora giorni da decidere.

---

## 22. ROADMAP RECONCILIATION (NOW / NEXT / LATER)

**NOW (già fatto in questa finestra, 02–03/09)**: intera catena di fix sul flusso di accettazione Giorni spot (root cause, conferma parziale, lista d'attesa, bulk actions, disponibilità visibile, 3 fix di rifinitura visiva scoperti in diretta da Fabrizio).

**NEXT (candidati concreti emersi da questo audit, non un impegno)**:
- Estendere la distinzione per-giorno (accettato/in attesa/rifiutato/lista d'attesa) a "Modifica prenotazione", oggi rimasta al vecchio comportamento binario (§3).
- Rendere la CTA "prossimo appuntamento" in Home consapevole di `partnerDecision`/`waitlistedDayCount` (§5).
- Far leggere a `lib/push/send.ts` il flag `profiles.notify_push` prima di inviare (§10).
- Aggiungere push (non solo email) per booking accettato/rifiutato/promosso da lista d'attesa — decisione di scope da riconfermare, non un bug (§10).
- Correggere la voce stale `groups_discover_invites` nel `feature-registry/catalog.ts` (§9).
- Aggiornare lo `status` delle 2 segnalazioni beta più recenti (già risolte dal codice) da `nuovo` a `risolto` (§13).

**LATER (fuori scope immediato, richiede decisione di prodotto)**:
- Contenuto legale reale + attivazione `LEGAL_TERMS_GATE` + cookie banner (§14) — blocco per qualunque lancio pubblico.
- Superare il limite "multi-attività stesso giorno" nel modello di coordinamento (§4) — richiede una ri-progettazione della chiave di aggregazione, non un fix locale.
- Strumentare KPI mancanti (esito prenotazione, notifiche, Community) prima di poter riportare quei numeri nel Product Master (§15).
- Decidere il destino delle due superfici Admin mock (dashboard, attività) — collegarle al DB reale o rimuoverle esplicitamente dalla superficie "canonica".

---

## 23. OPEN GAPS (RANKED)

1. **CTA "prossimo appuntamento" in Home non distingue prenotazioni parziali/in lista d'attesa** — rischio di mostrare un falso senso di "tutto ok" nel punto più visibile dell'app. (Impatto: Alto · Sforzo: Basso)
2. **"Modifica prenotazione" non ha la stessa distinzione per-giorno appena aggiunta a `/activity/[id]`** — incoerenza tra due punti dello stesso flusso. (Impatto: Medio · Sforzo: Basso)
3. **Toggle "Notifiche push" non è enforced server-side** — promessa di controllo utente non mantenuta silenziosamente. (Impatto: Medio · Sforzo: Basso)
4. **Piano condiviso arricchito dipende da una env var non verificabile da qui, degrada silenziosamente se assente** — nessun errore visibile a nessuno se mal configurato. (Impatto: Medio · Sforzo: Basso — solo verifica)
5. **Voce `groups_discover_invites` stale nel feature-registry** — la documentazione interna del codice è più indietro del codice stesso. (Impatto: Basso · Sforzo: Basso)
6. **52/56 segnalazioni beta mai chiuse in stato, incluse 2 già risolte dal codice** — igiene del processo, non del prodotto. (Impatto: Basso · Sforzo: Basso)
7. **Contenuto legale reale assente (0 righe `legal_documents`) + gate spento ovunque** — blocco per qualunque comunicazione pubblica sulla compliance. (Impatto: Alto (per un lancio pubblico) · Sforzo: Alto — non tecnico, richiede testo legale)
8. **Nessun cookie banner** — stesso blocco di cui sopra. (Impatto: Alto · Sforzo: Medio)
9. **Nessuna cancellazione/export dati automatizzati (GDPR)** — solo richiesta manuale. (Impatto: Medio-Alto · Sforzo: Alto)
10. **Limite "multi-attività stesso giorno" nel modello di coordinamento** — sottostima i passaggi realmente necessari in un caso reale non raro (più corsi lo stesso pomeriggio). (Impatto: Medio · Sforzo: Alto)
11. **Notifiche push assenti su esiti booking definitivi (accettato/rifiutato/promosso)** — solo email, scelta di scope non ancora rivalidata. (Impatto: Medio · Sforzo: Medio)
12. **KPI mancanti su esito prenotazione/notifiche/Community** — nessun modo oggi di rispondere a domande di business ovvie senza nuova instrumentazione. (Impatto: Alto (per decisioni di prodotto) · Sforzo: Medio)
13. **Due superfici Admin restano mock senza percorso dichiarato verso il reale** (dashboard, attività). (Impatto: Basso (banner già previsto) · Sforzo: Alto se si decide di collegarle davvero)
14. **Impersonazione utente Admin assente** — utile per supporto/debug, oggi zero codice. (Impatto: Basso · Sforzo: Medio)
15. **Sincronizzazione `main` locale ↔ `origin/main` non verificabile da questo ambiente** — questo intero report assume che siano allineati; se non lo sono, alcune sezioni potrebbero descrivere codice non ancora in produzione. (Impatto: Alto per l'affidabilità di questo stesso report · Sforzo: Nullo, basta una conferma di Fabrizio)

---

## 24. FINAL DOCUMENTATION VERDICT

**PRODUCT STATE**: Beta funzionale e in evoluzione attiva, con il flusso centrale (accettazione prenotazioni) appena consolidato dopo un difetto strutturale reale confermato su dati di produzione; readiness per un lancio pubblico bloccata soprattutto da compliance (legale/privacy), non da funzionalità core.

**DOCUMENTATION CONFIDENCE**: MEDIUM — alta fiducia sulle sezioni verificate riga per riga da codice/DB (§2–§14), fiducia più bassa su §15–§22 dove non ho letto per intero i documenti esistenti (`TRAMA_CAPABILITY_COMPLETENESS_MATRIX.md`, `TRAMA_BETA_ROADMAP_EXTERNAL.md`, `TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md`) da riconciliare puntualmente prima di pubblicare aggiornamenti derivati da quelle sezioni.

**READY TO UPDATE PRODUCT MASTER**: SÌ, per le sezioni Prenotazioni/Organizzazione/Chi fa cosa/Piano condiviso/Partner Inbox (§2–§13); NO per KPI/Roadmap finché non si riconciliano i documenti esistenti citati sopra.

**READY TO UPDATE FAMILY DECK**: SÌ — delta chiaro e circoscritto (§2, §19), screenshot manifest pronto (§20).

**READY TO UPDATE PARTNER DECK**: SÌ — è l'area con il delta più corposo di questa intera finestra di lavoro (Inbox prenotazioni).

**MISSING EVIDENCE**: (a) stato reale di `SUPABASE_SERVICE_ROLE_KEY` su Vercel/produzione (Piano condiviso, §8); (b) conferma che `main` locale sia allineato a `origin/main` e che tutti i 20 commit siano effettivamente deployati (§0); (c) lettura riga-per-riga di `TRAMA_CAPABILITY_COMPLETENESS_MATRIX.md`, `TRAMA_BETA_ROADMAP_EXTERNAL.md`, `TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md` per una riconciliazione puntuale invece che per titolo; (d) conferma dello stato reale delle migration oltre la 34 (ho verificato solo migration_19 e migration_34 in questa sessione, non l'elenco completo).
