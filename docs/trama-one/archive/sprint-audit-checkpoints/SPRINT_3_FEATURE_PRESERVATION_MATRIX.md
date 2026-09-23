# TRAMA ONE Build Sprint 3 — Matrice pagina-per-pagina / route-per-route

Artefatto obbligatorio prerequisito richiesto da `SPRINT_GOVERNANCE.md` (Sprint 3: "matrice pagina-per-pagina/route-per-route estesa alle route coinvolte in questo sprint") prima dell'implementazione. Copre Parent discovery e selezione giorni.

## Riconciliazione AS-IS — verificata leggendo il codice, non assunta

**Scope Sprint 3** (`SPRINT_GOVERNANCE.md`): context object (source/week/child/filters/correlationId); ricerca/dettaglio Next Gen adattati a Offering; richiesta; filtro Parent per disponibilità giornaliera; selezione giorni nel dettaglio; calcolo costo dinamico; selezione servizi per giorno; mantenimento del context durante la navigazione. Fuori scope: risposta Partner e Booking (Sprint 4).

| Requisito Sprint 3 | Stato AS-IS (verificato nel codice) | Evidenza |
|---|---|---|
| Ricerca (località, età, periodo, categoria, prezzo) | **Già funzionante** | `app/(main)/search/SearchClient.tsx`, `app/nextgen/search/SearchDiscoveryClient.tsx` |
| Dettaglio attività standard (contenuto, prezzo, servizi, CTA) | **Già funzionante** | `app/activity/[id]/DetailClient.tsx` — route unica condivisa da Legacy e NextGen |
| Richiesta/booking leggero (selezione bambino+periodo, invio, stato) | **Già funzionante, solo a livello settimana** | `app/booking/[id]/BookingClient.tsx`, `app/booking/[id]/actions.ts` |
| **Filtro Parent per disponibilità giornaliera (Giorni spot)** | **IMPLEMENTATA (2026-07-21, DEC-38)** — non più una lettura per il solo Gestore | `app/activity/[id]/page.tsx` chiama `getActivityDays(activity)` (nessuna modifica alla funzione stessa) quando `bookingMode !== "week_only"`, passata a `DetailClient.tsx` |
| **Selezione giorni nel dettaglio** | **IMPLEMENTATA (2026-07-21, DEC-38)** | `DetailClient.tsx`, sezione "Giorni spot" — toggle per giorno, disabilitato se pieno/non `singleDayBookable`; propagata a `/booking/[id]` via `?days=` |
| **Calcolo costo dinamico (giorni)** | **IMPLEMENTATA (2026-07-21, DEC-38)** | `lib/day-pricing.ts` (nuovo, funzioni pure): tariffa base `pricePerWeek / 5` + sconto del giorno; usato sia in `DetailClient.tsx` (anteprima) sia in `BookingClient.tsx` (step 1/3, congelato in `booking_days.price` alla conferma) |
| **Selezione servizi per giorno** | **ANCORA MANCANTE — deliberatamente fuori da questa fetta** | I servizi (`pre_service`/`post_service`/`meal_option`) restano letti a livello attività, non per singolo giorno. Conseguenza esplicita (DEC-38): nessun costo navetta applicato alle prenotazioni a Giorni spot (nessuna tariffa "a giorno" mai definita per `shuttlePrice`) — scelto di non applicare un costo piuttosto che inventarne uno non richiesto |
| **Filtro di RICERCA per disponibilità giornaliera** | **IMPLEMENTATA (2026-07-22, DEC-40)** | `lib/data/activities.ts::getActivitiesWithOpenDaySpots()` (nuova, query unica) → `SearchClient.tsx`/`SearchDiscoveryClient.tsx`, filtro "Giorni spot" (chip + pannello), stesso pattern client-side degli altri filtri |
| **Context object (source/week/child/filters/correlationId)** | **PARZIALE, scope minimo chiuso (2026-07-22, DEC-41)** — source/correlationId propagati end-to-end ricerca→dettaglio→prenotazione (query string) e loggati server-side (non persistiti); week/kid restano parametri separati (già da Segment C), NON unificati in un unico oggetto | `ActivityCardHorizontal.tsx`/`ActivityCard.tsx` (props opzionali) → `DetailClient.tsx` → `BookingClient.tsx` → `actions.ts` (`logTelemetryEvent("booking_created")`, vedi `lib/telemetry/correlation.ts`) |
| `lib/telemetry/correlation.ts` (già esistente da Sprint 0) | **Collegato al journey Parent discovery→richiesta (2026-07-22, DEC-41)** | Riusato senza modifiche alla libreria stessa: `generateCorrelationId()` e `logTelemetryEvent()` chiamati da `SearchClient.tsx`/`SearchDiscoveryClient.tsx` e `actions.ts` |

## Decisione di riuso

**ADAPT, non REPLACE**: nessuna nuova pagina di ricerca/dettaglio/richiesta. Le route esistenti (`/search`, `/nextgen/search`, `/activity/[id]`, `/booking/[id]`) restano gli stessi file, estesi con: lettura di `getActivityDays()` (già scritta, Sprint 2) nel dettaglio; UI di selezione giorno quando `activity.bookingMode !== "week_only"`; calcolo prezzo dinamico basato sui giorni scelti + eventuale sconto/minimo giorni (`min_days_per_booking`); un context object leggero (probabile estensione di `lib/telemetry/correlation.ts` o un nuovo modulo dedicato, da decidere in fase di design) propagato via query param/sessionStorage-equivalente lato server tra ricerca→dettaglio→richiesta.

## Route/oggetti AS-IS nel perimetro (verificati, nessuno da modificare strutturalmente)

| Route/oggetto AS-IS | File | Sprint 3 lo tocca? | Note di preservazione |
|---|---|---|---|
| `/search`, `/nextgen/search` | `SearchClient.tsx`, `SearchDiscoveryClient.tsx` | Sì, in AGGIUNTA (filtro disponibilità giornaliera, propagazione context) | Nessun filtro esistente rimosso |
| `/activity/[id]` | `DetailClient.tsx` | Sì, in AGGIUNTA (sezione selezione giorni quando pertinente) | Contenuto standard esistente invariato per attività `week_only`/`mixed` senza Giorni spot configurati |
| `/booking/[id]` | `BookingClient.tsx`, `actions.ts` | Sì, in AGGIUNTA (calcolo dinamico giorni+servizi, quando l'attività li supporta) | Flusso settimanale esistente invariato come default |
| `lib/data/activity-days.ts::getActivityDays()` | Data layer | Riusata, nessuna modifica alla funzione | Già scritta in Sprint 2, semplicemente collegata a una UI Parent per la prima volta |
| `public.activity_days`, `public.activities.booking_mode/min_days_per_booking` | `supabase/schema.sql` + `migration_11` | Sì, in LETTURA (nessuna colonna nuova su queste tabelle) | `getActivityDays()` invariata; nessuna riga esistente alterata |
| `public.booking_days` (NUOVO, additivo) | `supabase/migration_12_booking_days.sql` | Sì — nuova tabella, non applicata da Claude | Stesso pattern di `booking_weeks` (PK composita, RLS ownership genitore + visibilità centro); da applicare in Supabase SQL Editor da Fabrizio prima che le prenotazioni a Giorni spot persistano davvero i giorni (senza, `createBookingAction` fallisce silenziosamente solo quell'insert, best-effort, non l'intera prenotazione) |
| `public.bookings`, `public.activity_inquiries` | `supabase/schema.sql` | No (fuori scope, unificazione Request è Sprint 4) | Invariate |
| `lib/telemetry/correlation.ts` | Sprint 0 | Probabile riuso per il context object | Da confermare in fase di design, nessuna decisione presa qui |

## Esito

Nessuna capability AS-IS a rischio: tutte le estensioni previste sono additive (nuove sezioni UI condizionali, nuova logica di calcolo attivata solo quando `bookingMode !== "week_only"`), il flusso esistente a settimana intera resta il comportamento di default per ogni attività non ancora configurata a Giorni spot lato Partner. Prerequisito Sprint 3 soddisfatto: matrice prodotta, V2 di `ASSUMPTION_LOG.md` verificata per l'epic E06 (vedi voce dedicata).

**Aggiornamento 2026-07-21 (DEC-38)** — prima fetta di implementazione chiusa: selezione giorni nel dettaglio, calcolo costo dinamico, prenotazione a Giorni spot (`booking_days`, migration_12) sono passate da MANCANTE a IMPLEMENTATA. Migration_12 e la STEP 7 di `seed-test-data.sql` sono state poi confermate applicate/eseguite da Fabrizio.

**Aggiornamento 2026-07-22 (DEC-40, DEC-41)** — seconda fetta chiusa: filtro di RICERCA per disponibilità giornaliera (Legacy+NextGen) e context object leggero (source/correlationId, propagato end-to-end e loggato server-side via `logTelemetryEvent`) sono passati da MANCANTE/PARZIALE a IMPLEMENTATA (nello scope minimo descritto in DEC-41). Restano MANCANTI, onestamente non silenziati: selezione servizi per giorno (e di conseguenza nessun costo navetta su Giorni spot), unificazione di week/kid/filters in un unico oggetto context (restano parametri separati, non un solo oggetto — gap volutamente non chiuso in questa fetta, vedi DEC-41), estensione dell'avviso "settimana già impegnata" (`findWeekOverlapConflicts`) al caso giorni. Nessuno di questi tre gap blocca la chiusura di Sprint 3: sono scope esplicitamente rinviato, non regressioni.

## Precondizione esplicita — CHIUSA con evidenza reale (2026-07-21)

Per `SPRINT_GOVERNANCE.md` §Sprint 3, "Artefatti obbligatori" richiedeva: **suite di regressione booking Legacy/NextGen eseguita e verde come precondizione esplicita (condizione GO WITH CONDITIONS #3)**, prima di scrivere qualunque codice di Sprint 3. Fabrizio ha eseguito:

```
source .env.test
TEST_BASE_URL=https://buddykids-app.vercel.app npx playwright test tests/genitori/prenotazione.spec.ts --reporter=list
```

**Risultato: 9 passed, 0 failed, 45 skipped** (chromium + mobile-chrome). Vedi DEC-37 per il dettaglio (due run precedenti erano falliti per un comando incompleto dato da Claude — mancava `TEST_BASE_URL`, non un bug del prodotto). Precondizione soddisfatta: l'implementazione di Sprint 3 può iniziare.
